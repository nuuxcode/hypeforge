"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { ComplimentCard } from "@/components/ComplimentCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { InputPanel } from "@/components/InputPanel";
import { LoadingState } from "@/components/LoadingState";
import type { ApiErrorResponse, ComplimentCard as ComplimentCardType, EscalateResponse, GenerateResponse } from "@/lib/types";
import { MAX_INPUT_LENGTH, MIN_INPUT_LENGTH } from "@/lib/validate";

const EXAMPLES = [
  "Customer Success Manager",
  "Recruiter who never misses",
  "Founding Engineer",
  "My friend Sara who fixes every crisis",
  "A teacher who makes everyone believe in themselves",
  "A product manager with impossible calendar skills",
] as const;

function isGenerateResponse(value: unknown): value is GenerateResponse {
  return Boolean(value && typeof value === "object" && Array.isArray((value as GenerateResponse).cards));
}

function isEscalateResponse(value: unknown): value is EscalateResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as EscalateResponse).text === "string" &&
      Array.isArray((value as EscalateResponse).history) &&
      typeof (value as EscalateResponse).dramaLevel === "number",
  );
}

function errorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && typeof (value as ApiErrorResponse).error === "string") {
    return (value as ApiErrorResponse).error;
  }
  return fallback;
}

function fallbackCopy(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Fallback copy failed");
}

export default function Page() {
  const [input, setInput] = useState("");
  const [cards, setCards] = useState<ComplimentCardType[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const copyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const trimmedInput = input.trim();
  const canGenerate = useMemo(
    () => trimmedInput.length >= MIN_INPUT_LENGTH && trimmedInput.length <= MAX_INPUT_LENGTH,
    [trimmedInput],
  );

  useEffect(() => {
    const timers = copyTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const setCardCopied = useCallback((cardId: string, copied: boolean) => {
    setCards((current) => current.map((card) => (card.id === cardId ? { ...card, copied } : card)));
  }, []);

  const setCardError = useCallback((cardId: string, message: string) => {
    setCards((current) =>
      current.map((card) => (card.id === cardId ? { ...card, status: "error", error: message } : card)),
    );
  }, []);

  const generate = useCallback(async () => {
    if (isGenerating) return;
    if (!trimmedInput) {
      setGlobalError("Give me a job title or person details first.");
      return;
    }
    if (!canGenerate) {
      setGlobalError("That is a lot of greatness. Try a shorter version.");
      return;
    }

    setIsGenerating(true);
    setGlobalError(null);
    setCards([]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: trimmedInput }),
      });
      const body = (await response.json().catch(() => ({}))) as unknown;

      if (!response.ok) {
        if (isGenerateResponse(body)) setCards(body.cards);
        setGlobalError(errorMessage(body, "The compliment engine got overwhelmed by your brilliance. Try again."));
        return;
      }

      if (!isGenerateResponse(body)) {
        setGlobalError("The compliment came back too chaotic to display. Try again.");
        return;
      }

      setCards(body.cards);
    } catch {
      setGlobalError("Network error. Check your connection and retry.");
    } finally {
      setIsGenerating(false);
    }
  }, [canGenerate, isGenerating, trimmedInput]);

  const escalate = useCallback(
    async (cardId: string) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card || card.status === "loading" || !card.text) return;

      setCards((current) =>
        current.map((item) => (item.id === cardId ? { ...item, status: "loading", error: undefined } : item)),
      );

      try {
        const response = await fetch("/api/escalate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            personaId: card.personaId,
            originalInput: card.originalInput,
            currentText: card.text,
            history: card.history,
            dramaLevel: card.dramaLevel,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as unknown;

        if (!response.ok || !isEscalateResponse(body)) {
          setCardError(cardId, errorMessage(body, "The compliment engine got overwhelmed by your brilliance. Try again."));
          return;
        }

        setCards((current) =>
          current.map((item) =>
            item.id === cardId
              ? {
                  ...item,
                  text: body.text,
                  history: body.history,
                  dramaLevel: body.dramaLevel,
                  status: "idle",
                  error: undefined,
                  copied: false,
                }
              : item,
          ),
        );
      } catch {
        setCardError(cardId, "Network error. Check your connection and retry.");
      }
    },
    [cards, setCardError],
  );

  const copyText = useCallback(
    async (cardId: string, text: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          fallbackCopy(text);
        }
        setCardCopied(cardId, true);
        if (copyTimers.current[cardId]) clearTimeout(copyTimers.current[cardId]);
        copyTimers.current[cardId] = setTimeout(() => setCardCopied(cardId, false), 1800);
      } catch {
        try {
          fallbackCopy(text);
          setCardCopied(cardId, true);
          if (copyTimers.current[cardId]) clearTimeout(copyTimers.current[cardId]);
          copyTimers.current[cardId] = setTimeout(() => setCardCopied(cardId, false), 1800);
        } catch {
          setCardError(cardId, "Copy failed. You can still select the text manually.");
        }
      }
    },
    [setCardCopied, setCardError],
  );

  return (
    <main className="min-h-dvh px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
        <InputPanel
          canGenerate={canGenerate}
          examples={EXAMPLES}
          input={input}
          isGenerating={isGenerating}
          maxLength={MAX_INPUT_LENGTH}
          onExampleSelect={setInput}
          onGenerate={generate}
          onInputChange={setInput}
        />

        <section className="min-w-0 space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase text-[#2f5d50]">Compliment deck</p>
              <h2 className="text-2xl font-black text-neutral-950">Three fresh legends</h2>
            </div>
            {cards.length > 0 ? (
              <button
                className="flex min-h-10 items-center gap-2 rounded-[8px] border-2 border-neutral-950 bg-white px-3 py-2 text-sm font-black text-neutral-950 transition hover:-translate-y-0.5 hover:bg-[#eaf4ef] focus:outline-none focus:ring-4 focus:ring-[#2f5d50]/30"
                type="button"
                onClick={() => {
                  setCards([]);
                  setGlobalError(null);
                }}
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                Start over
              </button>
            ) : null}
          </div>

          {globalError ? <ErrorBanner message={globalError} onDismiss={() => setGlobalError(null)} /> : null}

          {isGenerating && cards.length === 0 ? <LoadingState /> : null}

          {cards.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {cards.map((card) => (
                <ComplimentCard card={card} key={card.id} onCopy={copyText} onEscalate={escalate} />
              ))}
            </div>
          ) : !isGenerating ? (
            <div className="grid min-h-[360px] place-items-center rounded-[8px] border-2 border-dashed border-neutral-300 bg-white/70 p-6 text-center">
              <div className="max-w-md">
                <div className="mx-auto grid size-14 place-items-center rounded-[8px] border-2 border-neutral-950 bg-[#f7c948]">
                  <Sparkles aria-hidden="true" className="size-7 text-neutral-950" />
                </div>
                <p className="mt-4 text-xl font-black text-neutral-950">Awaiting greatness.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-neutral-600">
                  The first run will return one grand, one mythic, and one chaotic persona.
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
