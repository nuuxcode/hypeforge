"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  History,
  Moon,
  RotateCcw,
  Settings2,
  Share2,
  Sparkles,
  Sun,
} from "lucide-react";
import { ComplimentGuideDialog } from "@/components/compliment-guide-dialog";
import { DeckHistoryDrawer } from "@/components/deck-history-drawer";
import { SettingsDialog } from "@/components/settings-dialog";
import { Tooltip } from "@/components/tooltip";
import { V2InputPanel } from "@/components/v2-input-panel";
import { V2ComplimentCard } from "@/components/v2-compliment-card";
import { fetchWithTimeout } from "@/lib/client-fetch";
import { isAtDramaCap } from "@/lib/drama";
import { playForgeSound } from "@/lib/forge-sound";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  buildSoftPreferenceContext,
  clearActiveDeckId,
  clearDeckHistory,
  clearTasteSignals,
  loadActiveDeckId,
  loadDeckHistory,
  loadTasteSignals,
  nextFeedbackVote,
  readShareToken,
  truncateHistoryAt,
  removeDeckHistory,
  removeTasteSignal,
  saveDeckHistory,
  saveActiveDeckId,
  saveTasteSignal,
  type DeckHistoryEntry,
  type SharedDeckSnapshot,
  type TasteSignal,
} from "@/lib/deck-history";
import type {
  ComplimentCard as ComplimentCardType,
  ComplimentCardVersion,
  CardPendingAction,
  DeliveryMode,
  FeedbackVote,
  PersonaBucket,
} from "@/lib/types";
import { MAX_HISTORY_ITEMS, MAX_INPUT_LENGTH, MIN_INPUT_LENGTH } from "@/lib/validate";
import { appendCardVersion, createCardVersion, hydrateCard, hydrateCards } from "@/lib/card-versions";
import {
  CLIENT_DEBUG,
  cardErrorMessage,
  globalErrorMessage,
  hasVisibleCards,
  isApiErrorResponse,
  isEscalateResponse,
  isGenerateResponse,
  isRetryResponse,
  isShareResponse,
  isSharedDeckResponse,
  isTweakResponse,
  logApiExchange,
} from "@/lib/api-responses";

const BUCKET_ACCENT: Record<PersonaBucket, string> = {
  grand: "#7050c8",
  mythic: "#168a87",
  chaotic: "#ff6b5f",
};

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

type CardVersionPanel = Record<string, boolean>;

type ThemeMode = "light" | "dark";

function LoadingPreview() {
  return (
    <div className="v2-forge-preview" aria-label="Forging three compliment voices" role="status">
      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {["grand", "mythic", "chaotic"].map((bucket, index) => (
          <div
            className="v2-card v2-forge-card min-h-[260px] p-5"
            key={bucket}
            style={
              {
                "--bucket-accent": BUCKET_ACCENT[bucket as PersonaBucket],
                "--heat": 0,
                "--forge-delay": `${index * 140}ms`,
              } as CSSProperties
            }
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold capitalize" style={{ color: BUCKET_ACCENT[bucket as PersonaBucket] }}>{bucket}</p>
              <div className="h-8 w-24 rounded-full bg-[var(--muted-fill-strong)]" />
            </div>
            <div className="mt-12 space-y-4">
              <div className="h-5 rounded-full bg-[var(--muted-fill-strong)]" />
              <div className="h-5 w-11/12 rounded-full bg-[var(--muted-fill-strong)]" />
              <div className="h-5 w-8/12 rounded-full bg-[var(--muted-fill-strong)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function V2Page() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [input, setInput] = useState("");
  const [personDetails, setPersonDetails] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("direct");
  const [cards, setCards] = useState<ComplimentCardType[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [deckHistory, setDeckHistory] = useState<DeckHistoryEntry[]>([]);
  const [tasteSignals, setTasteSignals] = useState<TasteSignal[]>([]);
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionPanels, setVersionPanels] = useState<CardVersionPanel>({});
  const [tweakCardId, setTweakCardId] = useState<string | null>(null);
  const [shareCardId, setShareCardId] = useState<string | null>(null);
  const [speakingCardId, setSpeakingCardId] = useState<string | null>(null);
  const [tweakDrafts, setTweakDrafts] = useState<Record<string, string>>({});
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [pendingCardActions, setPendingCardActions] = useState<Record<string, CardPendingAction | undefined>>({});
  const copyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const speechRequest = useRef(0);
  const wasGenerating = useRef(false);

  const trimmedInput = input.trim();
  const trimmedDetails = personDetails.trim();
  const canGenerate = useMemo(
    () => trimmedInput.length >= MIN_INPUT_LENGTH && trimmedInput.length <= MAX_INPUT_LENGTH,
    [trimmedInput],
  );
  const tasteContext = useMemo(() => buildSoftPreferenceContext(tasteSignals), [tasteSignals]);

  useEffect(() => {
    if (CLIENT_DEBUG) {
      console.info("[HypeForge V2 UI] mounted", {
        debugTip: "API calls log grouped request/response/server-debug entries here in development.",
      });
    }
    const timers = copyTimers.current;
    return () => Object.values(timers).forEach((timer) => clearTimeout(timer));
  }, []);

  const stopSpeech = useCallback(() => {
    speechRequest.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingCardId(null);
  }, []);

  const toggleSpeech = useCallback((cardId: string, text: string) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setShareMessage("Read aloud is not supported in this browser.");
      return;
    }

    const wasSpeaking = speakingCardId === cardId;
    speechRequest.current += 1;
    const request = speechRequest.current;
    window.speechSynthesis.cancel();
    if (wasSpeaking) {
      setSpeakingCardId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1.04;
    const preferredVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("en") && voice.localService);
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onend = () => {
      if (speechRequest.current === request) setSpeakingCardId(null);
    };
    utterance.onerror = (event) => {
      if (speechRequest.current !== request || event.error === "canceled" || event.error === "interrupted") return;
      console.error("[HypeForge read aloud] Speech synthesis failed", event.error);
      setSpeakingCardId(null);
      setShareMessage("This device could not read the compliment aloud.");
    };
    setSpeakingCardId(cardId);
    window.speechSynthesis.speak(utterance);
  }, [speakingCardId]);

  useEffect(() => () => {
    speechRequest.current += 1;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    if (wasGenerating.current && !isGenerating && cards.some((card) => card.text.trim())) {
      playForgeSound("deck-complete");
    }
    wasGenerating.current = isGenerating;
  }, [cards, isGenerating]);

  useEffect(() => {
    if (currentDeckId && cards.length > 0) saveActiveDeckId(currentDeckId);
  }, [cards.length, currentDeckId]);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const storedDecks = loadDeckHistory();
      setDeckHistory(storedDecks);
      setTasteSignals(loadTasteSignals());

      const importSharedDeck = (sharedDeck: SharedDeckSnapshot) => {
        const createdAt = new Date().toISOString();
        const restoredCards = sharedDeck.cards.map((card) => {
          const text = card.text.trim();
          const version = text
            ? createCardVersion(text, card.dramaLevel, "generated", card.guidelines)
            : undefined;
          return {
            id: crypto.randomUUID(),
            originalInput: card.originalInput || sharedDeck.input,
            jobFunction: card.jobFunction ?? sharedDeck.jobFunction ?? sharedDeck.input,
            personDetails: card.personDetails ?? sharedDeck.personDetails,
            deliveryMode: card.deliveryMode ?? sharedDeck.deliveryMode ?? "public",
            personaId: card.personaId,
            personaName: card.personaName,
            text,
            history: text ? [text] : [],
            versions: version ? [version] : [],
            activeVersionId: version?.id,
            dramaLevel: card.dramaLevel,
            status: "idle" as const,
            copied: false,
            guidelines: card.guidelines,
          };
        });
        const deckId = crypto.randomUUID();
        const entry: DeckHistoryEntry = {
          id: deckId,
          input: sharedDeck.input,
          jobFunction: sharedDeck.jobFunction,
          personDetails: sharedDeck.personDetails,
          deliveryMode: sharedDeck.deliveryMode ?? restoredCards[0]?.deliveryMode,
          cards: restoredCards,
          createdAt,
          updatedAt: createdAt,
        };
        setDeckHistory(saveDeckHistory(entry));
        saveActiveDeckId(deckId);
        setCurrentDeckId(deckId);
        setInput(sharedDeck.jobFunction ?? sharedDeck.cards[0]?.jobFunction ?? sharedDeck.input);
        setPersonDetails(sharedDeck.personDetails ?? sharedDeck.cards[0]?.personDetails ?? "");
        setDeliveryMode(sharedDeck.deliveryMode ?? sharedDeck.cards[0]?.deliveryMode ?? "public");
        setCards(restoredCards);
        setShareMessage("Shared deck saved to this device.");
        const location = new URL(window.location.href);
        location.searchParams.delete("share");
        location.hash = "";
        window.history.replaceState(null, "", `${location.pathname}${location.search}`);
      };

      const shareSlug = new URLSearchParams(window.location.search).get("share");
      if (shareSlug) {
        void (async () => {
          try {
            const response = await fetchWithTimeout(`/api/share/${encodeURIComponent(shareSlug)}`);
            const body = (await response.json().catch(() => ({}))) as unknown;
            if (!response.ok || !isSharedDeckResponse(body)) {
              setShareMessage("This shared deck could not be loaded.");
              return;
            }
            importSharedDeck(body.deck);
          } catch {
            setShareMessage("This shared deck could not be loaded.");
          }
        })();
        return;
      }

      const token = new URLSearchParams(window.location.hash.slice(1)).get("deck");
      const sharedDeck = token ? readShareToken(token) : null;
      if (sharedDeck) {
        importSharedDeck(sharedDeck);
        return;
      }

      const activeDeckId = loadActiveDeckId();
      const activeDeck = activeDeckId ? storedDecks.find((entry) => entry.id === activeDeckId) : undefined;
      if (!activeDeck) {
        if (activeDeckId) clearActiveDeckId();
        return;
      }

      setInput(activeDeck.jobFunction ?? activeDeck.cards[0]?.jobFunction ?? activeDeck.input);
      setPersonDetails(activeDeck.personDetails ?? activeDeck.cards[0]?.personDetails ?? "");
      setDeliveryMode(activeDeck.deliveryMode ?? activeDeck.cards[0]?.deliveryMode ?? "public");
      setCards(hydrateCards(activeDeck.cards));
      setCurrentDeckId(activeDeck.id);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  const persistDeck = useCallback(
    (nextCards: ComplimentCardType[], preferredId?: string) => {
      const deckId = preferredId ?? currentDeckId ?? crypto.randomUUID();
      const existing = loadDeckHistory().find((entry) => entry.id === deckId);
      const now = new Date().toISOString();
      const entry: DeckHistoryEntry = {
        id: deckId,
        input: nextCards[0]?.originalInput ?? trimmedInput,
        jobFunction: nextCards[0]?.jobFunction ?? trimmedInput,
        personDetails: nextCards[0]?.personDetails ?? (trimmedDetails || undefined),
        deliveryMode: nextCards[0]?.deliveryMode ?? deliveryMode,
        cards: nextCards.map(hydrateCard),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      setDeckHistory(saveDeckHistory(entry));
      saveActiveDeckId(deckId);
      setCurrentDeckId(deckId);
      return deckId;
    },
    [currentDeckId, deliveryMode, trimmedDetails, trimmedInput],
  );

  const setCardCopied = useCallback((cardId: string, copied: boolean) => {
    setCards((current) => current.map((card) => (card.id === cardId ? { ...card, copied } : card)));
  }, []);

  const setCardError = useCallback((cardId: string, message: string) => {
    setCards((current) =>
      current.map((card) => (card.id === cardId ? { ...card, status: "error", error: message } : card)),
    );
  }, []);

  const focusDeck = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.getElementById("v2-deck")?.scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
    });
  }, []);

  const generate = useCallback(async () => {
    if (isGenerating) return;
    if (!trimmedInput || trimmedInput.length < MIN_INPUT_LENGTH) {
      setGlobalError("Add someone to hype first.");
      return;
    }
    if (trimmedInput.length > MAX_INPUT_LENGTH) {
      setGlobalError("That is a lot of greatness. Try a shorter version.");
      return;
    }

    setIsGenerating(true);
    setGlobalError(null);
    setCards([]);

    const payload = {
      jobFunction: trimmedInput,
      personDetails: trimmedDetails || undefined,
      deliveryMode,
      preference: tasteContext,
    };
    const startedAt = performance.now();
    try {
      const response = await fetchWithTimeout("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as unknown;
      logApiExchange({
        endpoint: "POST /api/generate",
        payload,
        status: response.status,
        ok: response.ok && !isApiErrorResponse(body),
        body,
        startedAt,
      });

      if (isApiErrorResponse(body)) {
        const nextCards = hasVisibleCards(body) ? hydrateCards(body.cards) : [];
        setCards(nextCards);
        if (nextCards.length > 0) {
          persistDeck(nextCards, crypto.randomUUID());
          focusDeck();
        }
        setGlobalError(globalErrorMessage(body));
        return;
      }

      if (!response.ok || !isGenerateResponse(body)) {
        const nextCards = hasVisibleCards(body) ? hydrateCards(body.cards) : [];
        setCards(nextCards);
        if (nextCards.length > 0) {
          persistDeck(nextCards, crypto.randomUUID());
          focusDeck();
        }
        setGlobalError(globalErrorMessage(body));
        return;
      }

      const nextCards = hydrateCards(body.cards);
      setCards(nextCards);
      persistDeck(nextCards, crypto.randomUUID());
      focusDeck();
    } catch (error) {
      logApiExchange({ endpoint: "POST /api/generate", payload, startedAt, error });
      setGlobalError("The forge hiccuped. The compliment engine got overwhelmed by your brilliance. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [deliveryMode, focusDeck, isGenerating, persistDeck, tasteContext, trimmedDetails, trimmedInput]);

  const escalate = useCallback(
    async (cardId: string) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card || card.status === "loading" || !card.text || isAtDramaCap(card.dramaLevel)) return;

      setCards((current) =>
        current.map((item) => (item.id === cardId ? { ...item, status: "loading", error: undefined } : item)),
      );
      setPendingCardActions((current) => ({ ...current, [cardId]: "escalate" }));

      const payload = {
        personaId: card.personaId,
        originalInput: card.originalInput,
        jobFunction: card.jobFunction,
        personDetails: card.personDetails,
        deliveryMode: card.deliveryMode ?? "public",
        currentText: card.text,
        history: card.history,
        dramaLevel: card.dramaLevel,
      };
      const startedAt = performance.now();
      try {
        const response = await fetchWithTimeout("/api/escalate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json().catch(() => ({}))) as unknown;
        logApiExchange({
          endpoint: "POST /api/escalate",
          payload,
          status: response.status,
          ok: response.ok && !isApiErrorResponse(body),
          body,
          startedAt,
        });

        if (isApiErrorResponse(body)) {
          setCardError(cardId, cardErrorMessage(body, "escalate"));
          return;
        }

        if (!response.ok || !isEscalateResponse(body)) {
          setCardError(cardId, cardErrorMessage(body, "escalate"));
          return;
        }

        const nextCards = cards.map((item) => {
          if (item.id !== cardId) return item;
          const version = createCardVersion(body.text, body.dramaLevel, "dramatic", body.guidelines);
          return {
            ...item,
            text: body.text,
            history: body.history,
            versions: appendCardVersion(item, version),
            activeVersionId: version.id,
            dramaLevel: body.dramaLevel,
            guidelines: body.guidelines,
            status: "idle" as const,
            error: undefined,
            copied: false,
          };
        });
        setCards(nextCards);
        persistDeck(nextCards);
      } catch (error) {
        logApiExchange({ endpoint: "POST /api/escalate", payload, startedAt, error });
        setCardError(cardId, cardErrorMessage(undefined, "escalate"));
      } finally {
        setPendingCardActions((current) => ({ ...current, [cardId]: undefined }));
      }
    },
    [cards, persistDeck, setCardError],
  );

  const retryCard = useCallback(
    async (cardId: string) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card || card.status === "loading") return;

      setCards((current) =>
        current.map((item) => (item.id === cardId ? { ...item, status: "loading", error: undefined } : item)),
      );
      setPendingCardActions((current) => ({ ...current, [cardId]: "retry" }));

      const payload = {
        personaId: card.personaId,
        originalInput: card.originalInput,
        jobFunction: card.jobFunction,
        personDetails: card.personDetails,
        deliveryMode: card.deliveryMode ?? "public",
      };
      const startedAt = performance.now();
      try {
        const response = await fetchWithTimeout("/api/retry", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json().catch(() => ({}))) as unknown;
        logApiExchange({
          endpoint: "POST /api/retry",
          payload,
          status: response.status,
          ok: response.ok && !isApiErrorResponse(body),
          body,
          startedAt,
        });

        if (!response.ok || isApiErrorResponse(body) || !isRetryResponse(body)) {
          setCardError(cardId, cardErrorMessage(body, "retry"));
          return;
        }

        const nextCards = cards.map((item) => {
          if (item.id !== cardId) return item;
          const version = createCardVersion(body.text, body.dramaLevel, "generated", body.guidelines);
          return {
            ...item,
            text: body.text,
            history: [...item.history, body.text].slice(-MAX_HISTORY_ITEMS),
            versions: appendCardVersion(item, version),
            activeVersionId: version.id,
            dramaLevel: body.dramaLevel,
            guidelines: body.guidelines,
            status: "idle" as const,
            error: undefined,
            copied: false,
          };
        });
        setCards(nextCards);
        persistDeck(nextCards);
      } catch (error) {
        logApiExchange({ endpoint: "POST /api/retry", payload, startedAt, error });
        setCardError(cardId, cardErrorMessage(undefined, "retry"));
      } finally {
        setPendingCardActions((current) => ({ ...current, [cardId]: undefined }));
      }
    },
    [cards, persistDeck, setCardError],
  );

  const tweakCard = useCallback(
    async (cardId: string) => {
      const card = cards.find((item) => item.id === cardId);
      const feedback = tweakDrafts[cardId]?.trim() ?? "";
      if (!card || card.status === "loading" || !card.text || feedback.length < 3) return;

      setCards((current) =>
        current.map((item) => (item.id === cardId ? { ...item, status: "loading", error: undefined } : item)),
      );
      setPendingCardActions((current) => ({ ...current, [cardId]: "tweak" }));

      const payload = {
        personaId: card.personaId,
        originalInput: card.originalInput,
        jobFunction: card.jobFunction,
        personDetails: card.personDetails,
        deliveryMode: card.deliveryMode ?? "public",
        currentText: card.text,
        history: card.history,
        dramaLevel: card.dramaLevel,
        feedback,
      };
      const startedAt = performance.now();
      try {
        const response = await fetchWithTimeout("/api/tweak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json().catch(() => ({}))) as unknown;
        logApiExchange({
          endpoint: "POST /api/tweak",
          payload,
          status: response.status,
          ok: response.ok && !isApiErrorResponse(body),
          body,
          startedAt,
        });

        if (!response.ok || isApiErrorResponse(body) || !isTweakResponse(body)) {
          setCardError(cardId, cardErrorMessage(body, "tweak"));
          return;
        }

        const nextCards = cards.map((item) => {
          if (item.id !== cardId) return item;
          const version = createCardVersion(body.text, body.dramaLevel, "tweaked", body.guidelines);
          return {
            ...item,
            text: body.text,
            history: body.history,
            versions: appendCardVersion(item, version),
            activeVersionId: version.id,
            dramaLevel: body.dramaLevel,
            guidelines: body.guidelines,
            status: "idle" as const,
            error: undefined,
            copied: false,
          };
        });
        setCards(nextCards);
        persistDeck(nextCards);
        setTweakCardId(null);
        setTweakDrafts((current) => ({ ...current, [cardId]: "" }));
      } catch (error) {
        logApiExchange({ endpoint: "POST /api/tweak", payload, startedAt, error });
        setCardError(cardId, cardErrorMessage(undefined, "tweak"));
      } finally {
        setPendingCardActions((current) => ({ ...current, [cardId]: undefined }));
      }
    },
    [cards, persistDeck, setCardError, tweakDrafts],
  );

  const setCardFeedback = useCallback(
    (cardId: string, vote: FeedbackVote) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card || !card.text) return;
      const nextVote = nextFeedbackVote(card.feedback, vote);
      const nextCards = cards.map((item) => (item.id === cardId ? { ...item, feedback: nextVote } : item));
      setCards(nextCards);
      const deckId = persistDeck(nextCards);
      const signalId = `${deckId}:${cardId}`;

      if (!nextVote) {
        setTasteSignals(removeTasteSignal(signalId));
        return;
      }

      setTasteSignals(
        saveTasteSignal({
          id: signalId,
          deckId,
          cardId,
          vote: nextVote,
          text: card.text,
          personaName: card.personaName,
          createdAt: new Date().toISOString(),
        }),
      );
    },
    [cards, persistDeck],
  );

  const restoreCardVersion = useCallback(
    (cardId: string, version: ComplimentCardVersion) => {
      const nextCards = cards.map((item) =>
        item.id === cardId
          ? {
              ...item,
              text: version.text,
              history: truncateHistoryAt(item.history, version.text),
              dramaLevel: version.dramaLevel,
              guidelines: version.guidelines,
              activeVersionId: version.id,
              status: "idle" as const,
              error: undefined,
              copied: false,
            }
          : item,
      );
      setCards(nextCards);
      persistDeck(nextCards);
    },
    [cards, persistDeck],
  );

  const restoreDeck = useCallback((entry: DeckHistoryEntry) => {
    setInput(entry.jobFunction ?? entry.cards[0]?.jobFunction ?? entry.input);
    setPersonDetails(entry.personDetails ?? entry.cards[0]?.personDetails ?? "");
    setDeliveryMode(entry.deliveryMode ?? entry.cards[0]?.deliveryMode ?? "public");
    setCards(hydrateCards(entry.cards));
    saveActiveDeckId(entry.id);
    setCurrentDeckId(entry.id);
    setGlobalError(null);
    setHistoryOpen(false);
    window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
  }, []);

  const shareDeck = useCallback(async () => {
    const shareableCards = cards.filter((card) => card.text.trim());
    if (shareableCards.length === 0) return;

    const payload = {
      input: shareableCards[0]?.originalInput ?? trimmedInput,
      jobFunction: shareableCards[0]?.jobFunction ?? trimmedInput,
      personDetails: shareableCards[0]?.personDetails ?? (trimmedDetails || undefined),
      deliveryMode: shareableCards[0]?.deliveryMode ?? deliveryMode,
      cards: shareableCards.map((card) => ({
        personaId: card.personaId,
        personaName: card.personaName,
        text: card.text,
        dramaLevel: card.dramaLevel,
        originalInput: card.originalInput,
        jobFunction: card.jobFunction,
        personDetails: card.personDetails,
        deliveryMode: card.deliveryMode ?? deliveryMode,
        guidelines: card.guidelines,
      })),
    };
    const startedAt = performance.now();
    try {
      const response = await fetchWithTimeout("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as unknown;
      logApiExchange({
        endpoint: "POST /api/share",
        payload: { input: payload.input, cardCount: payload.cards.length },
        status: response.status,
        ok: response.ok && isShareResponse(body),
        body,
        startedAt,
      });
      if (!response.ok || !isShareResponse(body)) {
        setShareMessage("The share link could not be created. Try again.");
        return;
      }

      const url = `${window.location.origin}/deck/${body.slug}`;
      const shareText = payload.deliveryMode === "direct"
        ? `A three-voice HypeForge compliment deck written for ${payload.input}.`
        : `A three-voice HypeForge public shout-out for ${payload.input}.`;
      if (navigator.share) {
        await navigator.share({ title: `${payload.input} has a HypeForge deck`, text: shareText, url });
        setShareMessage("Share sheet opened.");
      } else {
        await copyTextToClipboard(url);
        setShareMessage("Share link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      logApiExchange({ endpoint: "POST /api/share", payload: { input: payload.input, cardCount: payload.cards.length }, startedAt, error });
      setShareMessage("Share link could not be copied.");
    }
  }, [cards, deliveryMode, trimmedDetails, trimmedInput]);

  const clearSavedDecks = useCallback(() => {
    clearDeckHistory();
    clearActiveDeckId();
    setDeckHistory([]);
    setCurrentDeckId(null);
  }, []);

  const resetTaste = useCallback(() => {
    clearTasteSignals();
    setTasteSignals([]);
    if (cards.length === 0) return;
    const nextCards = cards.map((card) => ({ ...card, feedback: undefined }));
    setCards(nextCards);
    persistDeck(nextCards);
  }, [cards, persistDeck]);

  const copyText = useCallback(
    async (cardId: string, text: string) => {
      try {
        if (CLIENT_DEBUG) {
          console.groupCollapsed(`[HypeForge V2 UI] copy requested ${cardId}`);
          console.log("Copy text", text);
        }
        await copyTextToClipboard(text);
        setCardCopied(cardId, true);
        if (copyTimers.current[cardId]) clearTimeout(copyTimers.current[cardId]);
        copyTimers.current[cardId] = setTimeout(() => setCardCopied(cardId, false), 1800);
        if (CLIENT_DEBUG) {
          console.log("Copy succeeded");
          console.groupEnd();
        }
      } catch {
        try {
          await copyTextToClipboard(text);
          setCardCopied(cardId, true);
          if (copyTimers.current[cardId]) clearTimeout(copyTimers.current[cardId]);
          copyTimers.current[cardId] = setTimeout(() => setCardCopied(cardId, false), 1800);
          if (CLIENT_DEBUG) {
            console.log("Fallback copy succeeded");
            console.groupEnd();
          }
        } catch (error) {
          if (CLIENT_DEBUG) {
            console.error("Copy failed", error);
            console.groupEnd();
          }
          setCardError(cardId, "Copy didn't take - select the text and copy manually.");
        }
      }
    },
    [setCardCopied, setCardError],
  );

  const showWorkspace = cards.length > 0 || isGenerating || Boolean(globalError);

  return (
    <main className={`v2-shell flex min-h-dvh flex-col ${theme === "dark" ? "v2-dark" : "v2-light"}`}>
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--chrome-bg)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)]">
              <Sparkles aria-hidden="true" className="size-4 text-[var(--accent)]" />
            </div>
            <p className="v2-display text-lg font-semibold text-[var(--text)]">HypeForge</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip align="end" className="hidden min-[380px]:inline-flex" label="Compliment guide">
              <button
                aria-label="Open compliment guide"
                className="v2-header-button"
                type="button"
                onClick={() => setGuideOpen(true)}
              >
                <BookOpen aria-hidden="true" className="size-4" />
              </button>
            </Tooltip>
            <Tooltip align="end" label="Saved compliment decks">
              <button
                aria-label="Open saved compliment decks"
                className="v2-header-button"
                type="button"
                onClick={() => setHistoryOpen(true)}
              >
                <History aria-hidden="true" className="size-4" />
              </button>
            </Tooltip>
            {cards.some((card) => card.text.trim()) ? (
              <Tooltip align="end" label="Create a share link">
                <button
                  aria-label="Share this compliment deck"
                  className="v2-header-button"
                  type="button"
                  onClick={shareDeck}
                >
                  <Share2 aria-hidden="true" className="size-4" />
                </button>
              </Tooltip>
            ) : null}
            <Tooltip align="end" label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
              <button
                aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                className="v2-header-button"
                type="button"
                onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? (
                  <Moon aria-hidden="true" className="size-4" />
                ) : (
                  <Sun aria-hidden="true" className="size-4" />
                )}
              </button>
            </Tooltip>
            <Tooltip align="end" label="Open settings">
              <button
                aria-label="Open settings"
                className="v2-header-button"
                type="button"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 aria-hidden="true" className="size-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      <section
        className={
          showWorkspace
            ? "mx-auto grid w-full max-w-[1500px] flex-1 gap-6 px-4 py-6 sm:px-6 lg:items-start lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8 lg:py-8"
            : "mx-auto flex w-full max-w-[720px] flex-1 items-start px-4 py-12 sm:px-6 sm:py-20"
        }
      >
        <V2InputPanel
          jobFunction={input}
          personDetails={personDetails}
          deliveryMode={deliveryMode}
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          compact={showWorkspace}
          onJobFunctionChange={setInput}
          onPersonDetailsChange={setPersonDetails}
          onDeliveryModeChange={setDeliveryMode}
          onGenerate={generate}
          onChooseExample={(example) => {
            setInput(example);
            setPersonDetails("");
          }}
        />

        {showWorkspace ? (
        <section className="min-w-0 scroll-mt-24 space-y-5" id="v2-deck" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="v2-display text-3xl font-semibold text-[var(--text)]">
                {cards.length > 0 ? "Choose a favorite" : "Forging three voices…"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--text-muted)]">
                {cards.length > 0
                  ? `Three verified ${cards[0]?.deliveryMode === "public" ? "public-post" : "direct-message"} compliments for ${trimmedInput}.`
                  : "This usually takes a few seconds."}
              </p>
            </div>
            {cards.length > 0 ? (
              <button
                className="v2-secondary-button inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-semibold"
                type="button"
                onClick={() => {
                  setCards([]);
                  clearActiveDeckId();
                  setCurrentDeckId(null);
                  setGlobalError(null);
                  setShareMessage(null);
                }}
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                New deck
              </button>
            ) : null}
          </div>

          {shareMessage ? (
            <p className="rounded-[12px] bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--text)]" role="status">
              {shareMessage}
            </p>
          ) : null}

          {globalError ? (
            <div className="flex items-start gap-3 rounded-[14px] border border-[#ff6b5f]/30 bg-[#ff6b5f]/10 p-4 text-sm font-medium text-[var(--text)]">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--coral)]" />
              <p className="min-w-0 flex-1">{globalError}</p>
              <button
                className="v2-secondary-button min-h-9 px-3 text-xs font-semibold"
                type="button"
                onClick={() => {
                  setGlobalError(null);
                  if (trimmedInput) generate();
                }}
              >
                Retry
              </button>
            </div>
          ) : null}

          {isGenerating && cards.length === 0 ? <LoadingPreview /> : null}

          {cards.length > 0 ? (
            <div className="v2-card-grid grid items-stretch gap-4">
              {cards.map((card, index) => (
                <V2ComplimentCard
                  card={card}
                  index={index}
                  key={card.id}
                  onCopy={copyText}
                  onEscalate={(cardId) => {
                    stopSpeech();
                    escalate(cardId);
                  }}
                  onRetry={(cardId) => {
                    stopSpeech();
                    retryCard(cardId);
                  }}
                  onTweak={(cardId) => {
                    stopSpeech();
                    tweakCard(cardId);
                  }}
                  onSetFeedback={setCardFeedback}
                  onRestoreVersion={(cardId, version) => {
                    stopSpeech();
                    restoreCardVersion(cardId, version);
                  }}
                  versionsOpen={Boolean(versionPanels[card.id])}
                  onToggleVersions={(cardId) => {
                    setTweakCardId(null);
                    setShareCardId(null);
                    setVersionPanels((current) => (current[cardId] ? {} : { [cardId]: true }));
                  }}
                  tweakOpen={tweakCardId === card.id}
                  shareOpen={shareCardId === card.id}
                  speaking={speakingCardId === card.id}
                  tweakValue={tweakDrafts[card.id] ?? ""}
                  pendingAction={pendingCardActions[card.id]}
                  onToggleTweak={(cardId) => {
                    setVersionPanels({});
                    setShareCardId(null);
                    setTweakCardId((current) => (current === cardId ? null : cardId));
                  }}
                  onToggleShare={(cardId) => {
                    setVersionPanels({});
                    setTweakCardId(null);
                    setShareCardId((current) => (current === cardId ? null : cardId));
                  }}
                  onToggleSpeech={toggleSpeech}
                  onTweakValueChange={(cardId, value) =>
                    setTweakDrafts((current) => ({ ...current, [cardId]: value }))
                  }
                />
              ))}
            </div>
          ) : null}
        </section>
        ) : null}
      </section>

      <footer className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-5 text-xs font-medium text-[var(--text-faint)] sm:px-6 lg:px-8">
        <p>HypeForge</p>
        <Link className="transition hover:text-[var(--text)]" href="/compliment-guide">Compliment guide</Link>
      </footer>

      <DeckHistoryDrawer
        entries={deckHistory}
        open={historyOpen}
        tasteSignalCount={tasteSignals.length}
        onClear={clearSavedDecks}
        onClose={() => setHistoryOpen(false)}
        onDelete={(id) => setDeckHistory(removeDeckHistory(id))}
        onOpenGuide={() => {
          setHistoryOpen(false);
          setGuideOpen(true);
        }}
        onResetTaste={resetTaste}
        onRestore={restoreDeck}
      />
      <ComplimentGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
