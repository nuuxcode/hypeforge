"use client";

import { Check, Copy, LoaderCircle, WandSparkles } from "lucide-react";
import type { ComplimentCard as ComplimentCardType } from "@/lib/types";
import { DramaBadge } from "./DramaBadge";

type ComplimentCardProps = {
  card: ComplimentCardType;
  onCopy: (cardId: string, text: string) => void;
  onEscalate: (cardId: string) => void;
};

const ACCENT_CLASS: Record<string, string> = {
  "awards-committee": "border-t-[#334eac]",
  "startup-hype": "border-t-[#2f5d50]",
  "theater-critic": "border-t-[#db5b2a]",
  "epic-bard": "border-t-[#744fc6]",
  "ancient-oracle": "border-t-[#151515]",
  "nature-doc": "border-t-[#3c8d72]",
  "hype-friend": "border-t-[#e04f87]",
  "sports-commentator": "border-t-[#f7c948]",
};

function dramaButtonLabel(level: number): string {
  if (level <= 1) return "Make it more dramatic";
  if (level === 2) return "Make it legally excessive";
  if (level === 3) return "Summon the prophecy";
  return "Launch it into mythology";
}

export function ComplimentCard({ card, onCopy, onEscalate }: ComplimentCardProps) {
  const isLoading = card.status === "loading";
  const hasText = card.text.trim().length > 0;

  return (
    <article
      className={`flex min-h-[360px] flex-col rounded-[8px] border-2 border-t-8 border-neutral-950 bg-white p-4 shadow-[5px_5px_0_#151515] ${
        ACCENT_CLASS[card.personaId] ?? "border-t-[#db5b2a]"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-neutral-500">Persona</p>
          <h2 className="text-lg font-black leading-6 text-neutral-950">{card.personaName}</h2>
        </div>
        <DramaBadge level={card.dramaLevel} />
      </header>

      <div className="mt-5 flex flex-1 flex-col justify-between gap-5">
        <div className="space-y-3">
          {hasText ? (
            <p className="text-lg font-bold leading-8 text-neutral-950">{card.text}</p>
          ) : (
            <p className="rounded-[8px] border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm font-bold leading-6 text-neutral-600">
              {card.error ?? "This persona needs another run before it can properly overreact."}
            </p>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-[8px] bg-[#eaf4ef] px-3 py-2 text-sm font-black text-[#2f5d50]">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Increasing drama...
            </div>
          ) : null}

          {card.error && hasText ? (
            <p className="rounded-[8px] border border-[#9f2d20] bg-[#ffe8df] px-3 py-2 text-sm font-bold text-[#6f1d16]">
              {card.error}
            </p>
          ) : null}
        </div>

        {hasText ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <button
              className="flex min-h-11 items-center justify-center gap-2 rounded-[8px] border-2 border-neutral-950 bg-[#f7c948] px-3 py-2 text-sm font-black text-neutral-950 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-neutral-200 focus:outline-none focus:ring-4 focus:ring-[#db5b2a]/30"
              disabled={isLoading}
              type="button"
              onClick={() => onEscalate(card.id)}
            >
              {isLoading ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <WandSparkles aria-hidden="true" className="size-4" />
              )}
              {dramaButtonLabel(card.dramaLevel)}
            </button>
            <button
              aria-label={`Copy ${card.personaName} compliment`}
              className="flex min-h-11 items-center justify-center gap-2 rounded-[8px] border-2 border-neutral-950 bg-white px-3 py-2 text-sm font-black text-neutral-950 transition hover:-translate-y-0.5 hover:bg-[#eaf4ef] focus:outline-none focus:ring-4 focus:ring-[#2f5d50]/30"
              type="button"
              onClick={() => onCopy(card.id, card.text)}
            >
              {card.copied ? (
                <Check aria-hidden="true" className="size-4 text-[#2f5d50]" />
              ) : (
                <Copy aria-hidden="true" className="size-4" />
              )}
              {card.copied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <div className="rounded-[8px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-bold leading-6 text-neutral-600">
            This persona did not produce a usable compliment. Try the full deck again from the input panel.
          </div>
        )}
      </div>
    </article>
  );
}
