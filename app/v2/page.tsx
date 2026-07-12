"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  History,
  Layers3,
  LoaderCircle,
  Moon,
  RotateCcw,
  Share2,
  Sparkles,
  Sun,
} from "lucide-react";
import { ComplimentGuideDialog } from "@/components/compliment-guide-dialog";
import { DeckHistoryDrawer } from "@/components/deck-history-drawer";
import { Tooltip } from "@/components/tooltip";
import { V2InputPanel } from "@/components/v2-input-panel";
import { V2ComplimentCard } from "@/components/v2-compliment-card";
import { fetchWithTimeout } from "@/lib/client-fetch";
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
  ApiDebug,
  ApiErrorResponse,
  ComplimentCard as ComplimentCardType,
  ComplimentCardVersion,
  EscalateResponse,
  FeedbackVote,
  GenerateResponse,
  GuidelineCompliance,
  PersonaBucket,
  TweakResponse,
} from "@/lib/types";
import { MAX_HISTORY_ITEMS, MAX_INPUT_LENGTH, MIN_INPUT_LENGTH } from "@/lib/validate";

const BUCKET_ACCENT: Record<PersonaBucket, string> = {
  grand: "#7050c8",
  mythic: "#168a87",
  chaotic: "#ff6b5f",
};

const LOADING_LINES = [
  "Summoning three compliments from the Department of Excessive Admiration...",
  "Consulting the compliment council...",
  "Inflating the metaphor balloon...",
  "Adding tasteful chaos...",
  "Polishing the crown...",
] as const;

const MAX_CARD_VERSIONS = 50;
const CLIENT_DEBUG = process.env.NODE_ENV !== "production";

type RetryResponse = {
  ok?: true;
  text: string;
  history: string[];
  dramaLevel: number;
  guidelines: GuidelineCompliance;
  debug?: ApiDebug;
};

type ShareResponse = {
  ok?: true;
  slug: string;
  createdAt: string;
  debug?: ApiDebug;
};

type SharedDeckResponse = {
  ok?: true;
  deck: SharedDeckSnapshot;
};

type CardVersionPanel = Record<string, boolean>;

type ThemeMode = "light" | "dark";

function isGenerateResponse(value: unknown): value is GenerateResponse {
  return Boolean(value && typeof value === "object" && Array.isArray((value as GenerateResponse).cards));
}

function isGuidelineCompliance(value: unknown): value is GuidelineCompliance {
  if (!value || typeof value !== "object") return false;
  const compliance = value as GuidelineCompliance;
  return (
    compliance.version === "2.1" &&
    typeof compliance.wordCount === "number" &&
    compliance.wordCount <= 40 &&
    Array.isArray(compliance.checks) &&
    compliance.checks.length === 8 &&
    compliance.checks.every((item) => item.state === "pass")
  );
}

function isEscalateResponse(value: unknown): value is EscalateResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as EscalateResponse).text === "string" &&
      Array.isArray((value as EscalateResponse).history) &&
      typeof (value as EscalateResponse).dramaLevel === "number" &&
      isGuidelineCompliance((value as EscalateResponse).guidelines),
  );
}

function isRetryResponse(value: unknown): value is RetryResponse {
  return isEscalateResponse(value);
}

function isTweakResponse(value: unknown): value is TweakResponse {
  return isEscalateResponse(value);
}

function isShareResponse(value: unknown): value is ShareResponse {
  return Boolean(value && typeof value === "object" && typeof (value as ShareResponse).slug === "string");
}

function isSharedDeckResponse(value: unknown): value is SharedDeckResponse {
  if (!value || typeof value !== "object") return false;
  const deck = (value as SharedDeckResponse).deck;
  return Boolean(deck && typeof deck.input === "string" && Array.isArray(deck.cards));
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as ApiErrorResponse).ok === false &&
      typeof (value as ApiErrorResponse).error === "string",
  );
}

function hasVisibleCards(value: unknown): value is { cards: ComplimentCardType[] } {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { cards?: unknown }).cards) &&
      (value as { cards: ComplimentCardType[] }).cards.length > 0,
  );
}

function getDebug(value: unknown): ApiDebug | undefined {
  if (value && typeof value === "object" && "debug" in value) {
    return (value as { debug?: ApiDebug }).debug;
  }
  return undefined;
}

function globalErrorMessage(body: unknown): string {
  if (isApiErrorResponse(body) && body.error.includes("Too much brilliance")) {
    return "Too much brilliance at once. Give it a second.";
  }
  if (isApiErrorResponse(body) && body.error.includes("Add someone")) {
    return "Add someone to hype first.";
  }
  return "The forge hiccuped. The compliment engine got overwhelmed by your brilliance. Try again.";
}

function cardErrorMessage(body: unknown): string {
  if (isApiErrorResponse(body) && body.error.includes("Too much brilliance")) {
    return "Too much brilliance at once. Give it a second.";
  }
  return "This persona lost the plot for a second. Retry this card.";
}

function logApiExchange(args: {
  endpoint: string;
  payload: unknown;
  status?: number;
  ok?: boolean;
  body?: unknown;
  startedAt: number;
  error?: unknown;
}) {
  if (!CLIENT_DEBUG) return;
  const elapsedMs = Math.round(performance.now() - args.startedAt);
  const debug = getDebug(args.body);
  const requestId = debug?.requestId ?? "no-request-id";
  const statusLabel = args.status ? `${args.status}` : "network-error";
  const okLabel = args.ok ? "ok" : "failed";
  const providerFailures =
    debug?.events.filter((event) => event.scope === "provider" && event.level === "error") ?? [];

  console.groupCollapsed(`[HypeForge V2 API] ${args.endpoint} ${statusLabel} ${okLabel} ${requestId} ${elapsedMs}ms`);
  console.log("Request payload", args.payload);
  if (args.body !== undefined) console.log("Response body", args.body);
  if (args.error) console.error("Network/client error", args.error);
  if (debug) {
    console.log("Server debug", debug);
    console.table(
      debug.events.map((event) => ({
        time: event.timestamp,
        level: event.level,
        scope: event.scope,
        message: event.message,
      })),
    );
  }
  if (!args.ok) console.warn("Handled API failure", { status: args.status, body: args.body, error: args.error });
  console.groupEnd();

  // Keep raw-but-redacted Gemini failures visible without expanding the request group.
  for (const event of providerFailures) {
    console.error(`[HypeForge V2 Gemini] ${event.message}`, {
      requestId,
      route: debug?.route,
      details: event.details,
    });
  }
}

function createCardVersion(
  text: string,
  dramaLevel: number,
  kind: ComplimentCardVersion["kind"],
  guidelines?: GuidelineCompliance,
): ComplimentCardVersion {
  return {
    id: crypto.randomUUID(),
    text,
    dramaLevel,
    kind,
    createdAt: new Date().toISOString(),
    guidelines,
  };
}

function versionsForCard(card: ComplimentCardType): ComplimentCardVersion[] {
  if (card.versions?.length) return card.versions;
  const versions = card.history.length > 0 ? card.history : card.text ? [card.text] : [];
  return versions.map((text, index) =>
    createCardVersion(
      text,
      index === 0 ? 1 : Math.min(card.dramaLevel, index + 1),
      index === 0 ? "generated" : "dramatic",
      text === card.text ? card.guidelines : undefined,
    ),
  );
}

function appendCardVersion(card: ComplimentCardType, version: ComplimentCardVersion): ComplimentCardVersion[] {
  return [...versionsForCard(card), version].slice(-MAX_CARD_VERSIONS);
}

function activeVersionIdFor(card: ComplimentCardType, versions: ComplimentCardVersion[]): string | undefined {
  if (card.activeVersionId && versions.some((version) => version.id === card.activeVersionId)) return card.activeVersionId;
  return [...versions]
    .reverse()
    .find((version) => version.text === card.text && version.dramaLevel === card.dramaLevel)?.id ?? versions.at(-1)?.id;
}

function hydrateCard(card: ComplimentCardType): ComplimentCardType {
  const versions = versionsForCard(card);
  const activeVersionId = activeVersionIdFor(card, versions);
  const activeVersion = versions.find((version) => version.id === activeVersionId);
  return {
    ...card,
    status: "idle",
    copied: false,
    versions,
    activeVersionId,
    guidelines: activeVersion?.guidelines,
  };
}

function hydrateCards(cards: ComplimentCardType[]): ComplimentCardType[] {
  return cards.map(hydrateCard);
}

function LoadingCopy() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % LOADING_LINES.length);
    }, 1200);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--control-bg)] px-4 py-3 text-sm font-bold text-[var(--text)]">
      <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-[var(--coral)]" />
      <span>{LOADING_LINES[index]}</span>
    </div>
  );
}

function EmptyPreview() {
  const previews = [
    { bucket: "grand" as const, label: "Grand", text: "Confident and generous" },
    { bucket: "mythic" as const, label: "Mythic", text: "Warm with a little wonder" },
    { bucket: "chaotic" as const, label: "Chaotic", text: "Playful, high-energy praise" },
  ];

  return (
    <section className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-raised)] p-5 sm:p-6" aria-label="Your future compliment deck">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="v2-mono text-[0.68rem] uppercase text-[var(--purple-soft)]">Step 2 · Your deck</p>
          <h3 className="v2-display mt-2 text-2xl font-semibold text-[var(--text)]">Your three compliments will appear here.</h3>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--text-muted)]">
            Describe someone on the left, then choose the version that feels most like them.
          </p>
        </div>
        <span className="v2-mono inline-flex rounded-full border border-[var(--line)] bg-[var(--control-bg)] px-3 py-2 text-xs font-bold text-[var(--text-muted)]">
          3 voices
        </span>
      </div>
      <div className="mt-6 grid gap-3 border-t border-[var(--line)] pt-5 md:grid-cols-3">
        {previews.map((preview) => (
          <div className="flex items-start gap-3" key={preview.bucket}>
            <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: BUCKET_ACCENT[preview.bucket] }} />
            <div>
              <p className="v2-mono text-xs font-bold uppercase text-[var(--text)]">{preview.label}</p>
              <p className="mt-1 text-sm font-medium leading-5 text-[var(--text-muted)]">{preview.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoadingPreview() {
  return (
    <div className="space-y-4">
      <LoadingCopy />
      <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {["grand", "mythic", "chaotic"].map((bucket) => (
          <div
            className="v2-card min-h-[330px] animate-pulse p-5"
            key={bucket}
            style={
              {
                "--bucket-accent": BUCKET_ACCENT[bucket as PersonaBucket],
                "--heat": 0,
              } as CSSProperties
            }
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-3 w-24 rounded-full bg-[var(--muted-fill-strong)]" />
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

function ProofStrip() {
  const items = [
    { icon: Layers3, title: "3 voices", text: "Grand, Mythic, and Chaotic voices keep every run varied." },
    { icon: History, title: "Per-card memory", text: "Escalation updates one compliment without touching the others." },
    { icon: Share2, title: "One-click copy", text: "Each finished card is ready to share." },
  ];

  return (
    <section className="border-y border-[var(--line)] py-8" aria-label="Product proof">
      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        {items.map((item) => (
          <div className="flex gap-4 py-3" key={item.title}>
            <div className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--cyan)]">
              <item.icon aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h3 className="v2-display text-lg font-semibold text-[var(--text)]">{item.title}</h3>
              <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-muted)]">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function V2Page() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [input, setInput] = useState("");
  const [personDetails, setPersonDetails] = useState("");
  const [cards, setCards] = useState<ComplimentCardType[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [deckHistory, setDeckHistory] = useState<DeckHistoryEntry[]>([]);
  const [tasteSignals, setTasteSignals] = useState<TasteSignal[]>([]);
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [versionPanels, setVersionPanels] = useState<CardVersionPanel>({});
  const [tweakCardId, setTweakCardId] = useState<string | null>(null);
  const [tweakDrafts, setTweakDrafts] = useState<Record<string, string>>({});
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [examplesExpanded, setExamplesExpanded] = useState(false);
  const copyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
          cards: restoredCards,
          createdAt,
          updatedAt: createdAt,
        };
        setDeckHistory(saveDeckHistory(entry));
        saveActiveDeckId(deckId);
        setCurrentDeckId(deckId);
        setInput(sharedDeck.jobFunction ?? sharedDeck.cards[0]?.jobFunction ?? sharedDeck.input);
        setPersonDetails(sharedDeck.personDetails ?? sharedDeck.cards[0]?.personDetails ?? "");
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
        cards: nextCards.map(hydrateCard),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      setDeckHistory(saveDeckHistory(entry));
      saveActiveDeckId(deckId);
      setCurrentDeckId(deckId);
      return deckId;
    },
    [currentDeckId, trimmedDetails, trimmedInput],
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
      document.getElementById("v2-deck")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  }, [focusDeck, isGenerating, persistDeck, tasteContext, trimmedDetails, trimmedInput]);

  const escalate = useCallback(
    async (cardId: string) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card || card.status === "loading" || !card.text) return;

      setCards((current) =>
        current.map((item) => (item.id === cardId ? { ...item, status: "loading", error: undefined } : item)),
      );

      const payload = {
        personaId: card.personaId,
        originalInput: card.originalInput,
        jobFunction: card.jobFunction,
        personDetails: card.personDetails,
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
          setCardError(cardId, cardErrorMessage(body));
          return;
        }

        if (!response.ok || !isEscalateResponse(body)) {
          setCardError(cardId, "This persona lost the plot for a second. Retry this card.");
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
        setCardError(cardId, "This persona lost the plot for a second. Retry this card.");
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

      const payload = {
        personaId: card.personaId,
        originalInput: card.originalInput,
        jobFunction: card.jobFunction,
        personDetails: card.personDetails,
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
          setCardError(cardId, cardErrorMessage(body));
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
        setCardError(cardId, "This persona lost the plot for a second. Retry this card.");
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

      const payload = {
        personaId: card.personaId,
        originalInput: card.originalInput,
        jobFunction: card.jobFunction,
        personDetails: card.personDetails,
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
          setCardError(cardId, cardErrorMessage(body));
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
        setCardError(cardId, "This persona lost the plot for a second. Retry this card.");
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
    setCards(hydrateCards(entry.cards));
    saveActiveDeckId(entry.id);
    setCurrentDeckId(entry.id);
    setGlobalError(null);
    setHistoryOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const shareDeck = useCallback(async () => {
    const shareableCards = cards.filter((card) => card.text.trim());
    if (shareableCards.length === 0) return;

    const payload = {
      input: shareableCards[0]?.originalInput ?? trimmedInput,
      jobFunction: shareableCards[0]?.jobFunction ?? trimmedInput,
      personDetails: shareableCards[0]?.personDetails ?? (trimmedDetails || undefined),
      cards: shareableCards.map((card) => ({
        personaId: card.personaId,
        personaName: card.personaName,
        text: card.text,
        dramaLevel: card.dramaLevel,
        originalInput: card.originalInput,
        jobFunction: card.jobFunction,
        personDetails: card.personDetails,
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
      const shareText = `A three-voice HypeForge compliment deck for ${payload.input}.`;
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
  }, [cards, trimmedDetails, trimmedInput]);

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

  return (
    <main className={`v2-shell min-h-dvh ${theme === "dark" ? "v2-dark" : "v2-light"}`}>
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--chrome-bg)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-2 px-2 min-[375px]:px-3 sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)]">
              <Sparkles aria-hidden="true" className="size-5 text-[var(--coral)]" />
            </div>
            <div className="min-w-0">
              <p className="v2-gradient-text v2-display text-lg font-semibold min-[360px]:text-xl">HypeForge</p>
              <p className="v2-mono hidden text-[0.68rem] uppercase text-[var(--text-faint)] sm:block">
                AI Compliment Generator
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Tooltip align="end" className="hidden min-[380px]:inline-flex" label="Compliment guide">
              <button
                aria-label="Open compliment guide"
                className="grid size-10 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--text)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
                type="button"
                onClick={() => setGuideOpen(true)}
              >
                <BookOpen aria-hidden="true" className="size-4" />
              </button>
            </Tooltip>
            <Tooltip align="end" label="Saved compliment decks">
              <button
                aria-label="Open saved compliment decks"
                className="grid size-10 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-xs font-bold text-[var(--text)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35 sm:inline-flex sm:w-auto sm:gap-2 sm:px-3 sm:py-2"
                type="button"
                onClick={() => setHistoryOpen(true)}
              >
                <History aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Saved</span>
              </button>
            </Tooltip>
            {cards.some((card) => card.text.trim()) ? (
              <Tooltip align="end" label="Create a share link">
                <button
                  aria-label="Share this compliment deck"
                  className="grid size-10 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--text)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
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
                className="grid size-10 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-xs font-bold text-[var(--text)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35 sm:inline-flex sm:w-auto sm:gap-2 sm:px-3 sm:py-2"
                type="button"
                onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? (
                  <Moon aria-hidden="true" className="size-4" />
                ) : (
                  <Sun aria-hidden="true" className="size-4" />
                )}
                <span className="hidden sm:inline">{theme === "light" ? "Dark" : "Light"}</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:items-start lg:grid-cols-[430px_minmax(0,1fr)] lg:px-8 lg:py-10">
        <V2InputPanel
          jobFunction={input}
          personDetails={personDetails}
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          examplesExpanded={examplesExpanded}
          onJobFunctionChange={setInput}
          onPersonDetailsChange={setPersonDetails}
          onGenerate={generate}
          onToggleExamples={() => setExamplesExpanded((current) => !current)}
          onChooseExample={(example) => {
            setInput(example);
            setPersonDetails("");
          }}
        />

        <section className="min-w-0 scroll-mt-24 space-y-5" id="v2-deck" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="v2-mono text-[0.68rem] uppercase text-[var(--purple-soft)]">
                {cards.length > 0 ? "Your compliment deck" : "Step 2 · Your deck"}
              </p>
              <h2 className="v2-display mt-1 text-3xl font-semibold text-[var(--text)]">
                {cards.length > 0 ? "Three distinct voices" : "Your deck, ready when you are"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--text-muted)]">
                {cards.length > 0
                  ? "Each card keeps its own memory. Make one more dramatic without changing the others."
                  : "Your Grand, Mythic, and Chaotic compliments will appear here after you generate."}
              </p>
            </div>
            {cards.length > 0 ? (
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] px-4 py-2 text-sm font-bold text-[var(--text)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
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
                Start over
              </button>
            ) : null}
          </div>

          {shareMessage ? (
            <p className="rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] px-3 py-2 text-sm font-bold text-[var(--text)]" role="status">
              {shareMessage}
            </p>
          ) : null}

          {globalError ? (
            <div className="flex items-start gap-3 rounded-[18px] border border-[#ff6b5f]/40 bg-[#ff6b5f]/10 p-4 text-sm font-bold text-[var(--text)]">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--coral)]" />
              <p className="min-w-0 flex-1">{globalError}</p>
              <button
                className="rounded-[12px] border border-[var(--line)] px-3 py-1 text-xs uppercase text-[var(--text-muted)] hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
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
            <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {cards.map((card, index) => (
                <V2ComplimentCard
                  card={card}
                  index={index}
                  key={card.id}
                  onCopy={copyText}
                  onEscalate={escalate}
                  onRetry={retryCard}
                  onTweak={tweakCard}
                  onSetFeedback={setCardFeedback}
                  onRestoreVersion={restoreCardVersion}
                  versionsOpen={Boolean(versionPanels[card.id])}
                  onToggleVersions={(cardId) =>
                    setVersionPanels((current) => ({ ...current, [cardId]: !current[cardId] }))
                  }
                  tweakOpen={tweakCardId === card.id}
                  tweakValue={tweakDrafts[card.id] ?? ""}
                  onToggleTweak={(cardId) => setTweakCardId((current) => (current === cardId ? null : cardId))}
                  onTweakValueChange={(cardId, value) =>
                    setTweakDrafts((current) => ({ ...current, [cardId]: value }))
                  }
                />
              ))}
            </div>
          ) : !isGenerating ? (
            <EmptyPreview />
          ) : null}
        </section>
      </section>

      <ProofStrip />

      <footer className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm font-semibold text-[var(--text-faint)] sm:px-6 lg:px-8">
        <p className="v2-gradient-text v2-display text-lg font-semibold">HypeForge</p>
        <div className="flex items-center gap-4">
          <Link className="text-[var(--text-muted)] underline decoration-[var(--purple)] decoration-2 underline-offset-4 transition hover:text-[var(--text)]" href="/compliment-guide">
            Compliment guide
          </Link>
          <p>Built for playful praise. No account needed.</p>
        </div>
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
    </main>
  );
}
