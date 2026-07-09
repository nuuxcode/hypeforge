"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  History,
  Layers3,
  LoaderCircle,
  Moon,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  WandSparkles,
} from "lucide-react";
import { ComplimentGuideDialog } from "@/components/compliment-guide-dialog";
import { DeckHistoryDrawer } from "@/components/deck-history-drawer";
import { Tooltip } from "@/components/tooltip";
import {
  buildSoftPreferenceContext,
  clearDeckHistory,
  clearTasteSignals,
  loadDeckHistory,
  loadTasteSignals,
  nextFeedbackVote,
  readShareToken,
  removeDeckHistory,
  removeTasteSignal,
  saveDeckHistory,
  saveTasteSignal,
  type DeckHistoryEntry,
  type SharedDeckSnapshot,
  type TasteSignal,
} from "@/lib/deck-history";
import { PERSONAS } from "@/lib/personas";
import type {
  ApiDebug,
  ApiErrorResponse,
  ComplimentCard as ComplimentCardType,
  ComplimentCardVersion,
  EscalateResponse,
  FeedbackVote,
  GenerateResponse,
  PersonaBucket,
  TweakResponse,
} from "@/lib/types";
import { MAX_HISTORY_ITEMS, MAX_INPUT_LENGTH, MIN_INPUT_LENGTH } from "@/lib/validate";

const EXAMPLES = [
  "Customer Success Manager",
  "Recruiter who never misses",
  "Founding Engineer",
  "my friend Sara who fixes every crisis",
  "a teacher who makes everyone believe in themselves",
  "a product manager with impossible calendar skills",
] as const;

const BUCKET_ACCENT: Record<PersonaBucket, string> = {
  grand: "#7050c8",
  mythic: "#168a87",
  chaotic: "#ff6b5f",
};

const PERSONA_BUCKET = Object.fromEntries(PERSONAS.map((persona) => [persona.id, persona.bucket])) as Record<
  string,
  PersonaBucket
>;

const LOADING_LINES = [
  "Summoning three compliments from the Department of Excessive Admiration...",
  "Consulting the compliment council...",
  "Inflating the metaphor balloon...",
  "Adding tasteful chaos...",
  "Polishing the crown...",
] as const;

const MAX_CARD_VERSIONS = 50;

type RetryResponse = {
  ok?: true;
  text: string;
  history: string[];
  dramaLevel: number;
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

function isEscalateResponse(value: unknown): value is EscalateResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as EscalateResponse).text === "string" &&
      Array.isArray((value as EscalateResponse).history) &&
      typeof (value as EscalateResponse).dramaLevel === "number",
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

function dramaButtonLabel(level: number): string {
  if (level <= 1) return "Make it more dramatic";
  if (level === 2) return "Make it wildly excessive";
  if (level === 3) return "Summon the prophecy";
  return "Launch it into mythology";
}

function badgeLabel(level: number): string {
  return `DRAMA · ${String(level).padStart(2, "0")}`;
}

function bucketFor(card: ComplimentCardType): PersonaBucket {
  return PERSONA_BUCKET[card.personaId] ?? "grand";
}

function createCardVersion(
  text: string,
  dramaLevel: number,
  kind: ComplimentCardVersion["kind"],
): ComplimentCardVersion {
  return {
    id: crypto.randomUUID(),
    text,
    dramaLevel,
    kind,
    createdAt: new Date().toISOString(),
  };
}

function versionsForCard(card: ComplimentCardType): ComplimentCardVersion[] {
  if (card.versions?.length) return card.versions;
  const versions = card.history.length > 0 ? card.history : card.text ? [card.text] : [];
  return versions.map((text, index) =>
    createCardVersion(text, index === 0 ? 1 : Math.min(card.dramaLevel, index + 1), index === 0 ? "generated" : "dramatic"),
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
  return {
    ...card,
    status: "idle",
    copied: false,
    versions,
    activeVersionId: activeVersionIdFor(card, versions),
  };
}

function hydrateCards(cards: ComplimentCardType[]): ComplimentCardType[] {
  return cards.map(hydrateCard);
}

function styleForCard(card: ComplimentCardType, index = 0): CSSProperties {
  const bucket = bucketFor(card);
  const heat = Math.min(Math.max((card.dramaLevel - 1) / 3, 0), 1);
  return {
    "--bucket-accent": BUCKET_ACCENT[bucket],
    "--heat": heat,
    animationDelay: `${index * 80}ms`,
  } as CSSProperties;
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
    { bucket: "grand" as const, label: "Grand voice" },
    { bucket: "mythic" as const, label: "Mythic voice" },
    { bucket: "chaotic" as const, label: "Chaotic voice" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-raised)] p-5">
        <p className="v2-display text-xl font-semibold text-[var(--text)]">The compliment council is waiting.</p>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-muted)]">
          Add a role or person details, then HypeForge summons three distinct voices: Grand, Mythic, and Chaotic.
        </p>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {previews.map((preview) => (
          <div
            className="min-h-[230px] rounded-[24px] border border-dashed bg-[var(--panel-raised)] p-5"
            key={preview.bucket}
            style={{ borderColor: `${BUCKET_ACCENT[preview.bucket]}66` }}
          >
            <div className="v2-mono text-xs uppercase text-[var(--text-faint)]">{preview.label}</div>
            <div className="mt-8 space-y-3">
              <div className="h-3 rounded-full bg-[var(--muted-fill)]" />
              <div className="h-3 w-10/12 rounded-full bg-[var(--muted-fill)]" />
              <div className="h-3 w-7/12 rounded-full bg-[var(--muted-fill)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingPreview() {
  return (
    <div className="space-y-4">
      <LoadingCopy />
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
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

function V2Card({
  card,
  index,
  onCopy,
  onEscalate,
  onRetry,
  onTweak,
  onSetFeedback,
  onRestoreVersion,
  versionsOpen,
  onToggleVersions,
  tweakOpen,
  tweakValue,
  onToggleTweak,
  onTweakValueChange,
}: {
  card: ComplimentCardType;
  index: number;
  onCopy: (cardId: string, text: string) => void;
  onEscalate: (cardId: string) => void;
  onRetry: (cardId: string) => void;
  onTweak: (cardId: string) => void;
  onSetFeedback: (cardId: string, vote: FeedbackVote) => void;
  onRestoreVersion: (cardId: string, version: ComplimentCardVersion) => void;
  versionsOpen: boolean;
  onToggleVersions: (cardId: string) => void;
  tweakOpen: boolean;
  tweakValue: string;
  onToggleTweak: (cardId: string) => void;
  onTweakValueChange: (cardId: string, value: string) => void;
}) {
  const isLoading = card.status === "loading";
  const hasText = card.text.trim().length > 0;
  const bucket = bucketFor(card);
  const versions = versionsForCard(card);
  const activeVersionId = activeVersionIdFor(card, versions);
  const [expandedVersionIds, setExpandedVersionIds] = useState<Record<string, boolean>>({});

  const toolClass =
    "grid size-9 place-items-center rounded-[12px] border border-[var(--dark-line)] bg-[var(--paper-secondary)] text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-white disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/45";

  return (
    <article
      aria-busy={isLoading}
      className="v2-card v2-card-enter h-fit min-h-[320px] p-5 sm:p-6"
      data-loading={isLoading ? "true" : "false"}
      style={styleForCard(card, index)}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="v2-mono text-[0.68rem] uppercase text-[var(--ink-muted)]">Persona label</p>
          <h2 className="v2-display mt-1 text-xl font-semibold leading-7 text-[var(--ink)]">{card.personaName}</h2>
          <p className="v2-mono mt-2 text-[0.68rem] uppercase" style={{ color: BUCKET_ACCENT[bucket] }}>
            {bucket}
          </p>
        </div>
        <span className="v2-mono inline-flex h-9 shrink-0 items-center rounded-full border border-[var(--dark-line)] bg-[var(--paper-secondary)] px-3 text-xs font-bold text-[var(--ink)]">
          {badgeLabel(card.dramaLevel)}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-[var(--dark-line)] py-3">
        <Tooltip label="Helpful: use more of this feeling">
          <button
            aria-label={`Like ${card.personaName} compliment`}
            aria-pressed={card.feedback === "up"}
            className={`${toolClass} ${card.feedback === "up" ? "border-[#446100] bg-[#d4ff66] text-[#203000]" : ""}`}
            disabled={!hasText || isLoading}
            type="button"
            onClick={() => onSetFeedback(card.id, "up")}
          >
            <ThumbsUp aria-hidden="true" className="size-4" />
          </button>
        </Tooltip>
        <Tooltip label="Not for me: use less of this feeling">
          <button
            aria-label={`Dislike ${card.personaName} compliment`}
            aria-pressed={card.feedback === "down"}
            className={`${toolClass} ${card.feedback === "down" ? "border-[#ff6b5f] bg-[#ff6b5f]/15 text-[#8c2d24]" : ""}`}
            disabled={!hasText || isLoading}
            type="button"
            onClick={() => onSetFeedback(card.id, "down")}
          >
            <ThumbsDown aria-hidden="true" className="size-4" />
          </button>
        </Tooltip>
        <Tooltip label="Version history">
          <button
            aria-expanded={versionsOpen}
            aria-label={`Open ${card.personaName} version history`}
            className={toolClass}
            disabled={versions.length === 0 || isLoading}
            type="button"
            onClick={() => onToggleVersions(card.id)}
          >
            <History aria-hidden="true" className="size-4" />
          </button>
        </Tooltip>
        <Tooltip label="Tweak this card">
          <button
            aria-expanded={tweakOpen}
            aria-label={`Tweak ${card.personaName} compliment`}
            className={toolClass}
            disabled={!hasText || isLoading}
            type="button"
            onClick={() => onToggleTweak(card.id)}
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
          </button>
        </Tooltip>
        {card.feedback ? (
          <span className="ml-1 text-xs font-bold text-[var(--ink-muted)]" role="status">
            {card.feedback === "up" ? "More of this next time" : "Less of this next time"}
          </span>
        ) : null}
      </div>

      <div className="mt-5 space-y-6">
        <div className="space-y-4">
          {hasText ? (
            <p aria-live="polite" className="v2-display text-base font-semibold leading-6 text-[var(--ink)] sm:text-[1.05rem]">
              {card.text}
            </p>
          ) : (
            <div className="rounded-[18px] border border-dashed border-[var(--dark-line)] bg-[var(--paper-secondary)] p-4">
              <p className="text-sm font-bold leading-6 text-[var(--ink-muted)]">
                {card.error ?? "This persona lost the plot for a second. Retry this card."}
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-[14px] bg-[var(--ink)] px-3 py-2 text-sm font-bold text-[var(--paper)]">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Increasing drama...
            </div>
          ) : null}

          {card.error && hasText ? (
            <div className="rounded-[14px] border border-[#ff6b5f]/40 bg-[#ff6b5f]/10 px-3 py-2 text-sm font-bold text-[#7b211b]">
              {card.error}
            </div>
          ) : null}
        </div>

        {versionsOpen ? (
          <section className="rounded-[18px] border border-[var(--dark-line)] bg-[var(--paper-secondary)] p-3" aria-label={`${card.personaName} version history`}>
            <div className="flex items-center justify-between gap-3">
              <p className="v2-mono text-[0.68rem] font-bold uppercase text-[var(--ink-muted)]">Version history</p>
              <span className="text-xs font-bold text-[var(--ink-muted)]">{versions.length} saved</span>
            </div>
            <div className="mt-3 space-y-2">
              {[...versions].reverse().map((version) => {
                const isCurrentVersion = version.id === activeVersionId;
                const isExpanded = Boolean(expandedVersionIds[version.id]);
                return (
                  <div className="rounded-[14px] border border-[var(--dark-line)] bg-[var(--paper)] p-3" key={version.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase text-[var(--ink-muted)]">
                        {version.kind} · Drama {String(version.dramaLevel).padStart(2, "0")}
                      </p>
                      {isCurrentVersion ? (
                        <span className="text-xs font-bold text-[var(--purple)]">Current</span>
                      ) : (
                        <button
                          className="text-xs font-bold text-[var(--purple)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
                          type="button"
                          onClick={() => onRestoreVersion(card.id, version)}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                    <p className={`mt-2 text-sm font-medium leading-5 text-[var(--ink-muted)] ${isExpanded ? "" : "line-clamp-3"}`}>
                      {version.text}
                    </p>
                    <button
                      aria-expanded={isExpanded}
                      className="mt-2 text-xs font-bold text-[var(--ink)] underline decoration-[var(--purple)] decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
                      type="button"
                      onClick={() => setExpandedVersionIds((current) => ({ ...current, [version.id]: !current[version.id] }))}
                    >
                      {isExpanded ? "Show less" : "Read full"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {tweakOpen && hasText ? (
          <section className="rounded-[18px] border border-[var(--dark-line)] bg-[var(--paper-secondary)] p-3" aria-label={`Tweak ${card.personaName} compliment`}>
            <label className="v2-mono text-[0.68rem] uppercase text-[var(--ink-muted)]" htmlFor={`tweak-${card.id}`}>
              What should change?
            </label>
            <textarea
              className="mt-2 min-h-24 w-full resize-y rounded-[14px] border border-[var(--dark-line)] bg-[var(--paper)] px-3 py-3 text-sm font-semibold leading-5 text-[var(--ink)] outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#8b5cf6]/25"
              id={`tweak-${card.id}`}
              maxLength={240}
              placeholder="e.g. shorter, warmer, less cosmic, mention their calm under pressure"
              value={tweakValue}
              onChange={(event) => onTweakValueChange(card.id, event.target.value)}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[var(--ink-muted)]">{tweakValue.length}/240</span>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-[12px] bg-[var(--ink)] px-3 text-sm font-bold text-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/45"
                disabled={isLoading || tweakValue.trim().length < 3}
                type="button"
                onClick={() => onTweak(card.id)}
              >
                {isLoading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
                Regenerate with note
              </button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-2 min-[1500px]:grid-cols-[minmax(0,1fr)_auto]">
          {hasText ? (
            <button
              aria-label={`Make ${card.personaName} compliment more dramatic`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-[var(--dark-line)] bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--paper)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/45"
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
          ) : (
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-[var(--dark-line)] bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--paper)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/45"
              disabled={isLoading}
              type="button"
              onClick={() => onRetry(card.id)}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Retry this card
            </button>
          )}

          <button
            aria-label={`Copy ${card.personaName} compliment`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-[var(--dark-line)] bg-[var(--paper-secondary)] px-4 py-2 text-sm font-bold text-[var(--ink)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/45"
            disabled={!hasText || isLoading}
            type="button"
            onClick={() => onCopy(card.id, card.text)}
          >
            {card.copied ? (
              <Check aria-hidden="true" className="size-4 text-[#446100]" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {card.copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </article>
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
  const canGenerate = useMemo(
    () => trimmedInput.length >= MIN_INPUT_LENGTH && trimmedInput.length <= MAX_INPUT_LENGTH,
    [trimmedInput],
  );
  const tasteContext = useMemo(() => buildSoftPreferenceContext(tasteSignals), [tasteSignals]);

  useEffect(() => {
    console.info("[HypeForge V2 UI] mounted", {
      debugTip: "API calls log grouped request/response/server-debug entries here in development.",
    });
    const timers = copyTimers.current;
    return () => Object.values(timers).forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const storedDecks = loadDeckHistory();
      setDeckHistory(storedDecks);
      setTasteSignals(loadTasteSignals());

      const importSharedDeck = (sharedDeck: SharedDeckSnapshot) => {
        const createdAt = new Date().toISOString();
        const restoredCards = sharedDeck.cards.map((card) => {
          const text = card.text.trim();
          const version = text ? createCardVersion(text, card.dramaLevel, "generated") : undefined;
          return {
            id: crypto.randomUUID(),
            originalInput: card.originalInput || sharedDeck.input,
            personaId: card.personaId,
            personaName: card.personaName,
            text,
            history: text ? [text] : [],
            versions: version ? [version] : [],
            activeVersionId: version?.id,
            dramaLevel: card.dramaLevel,
            status: "idle" as const,
            copied: false,
          };
        });
        const deckId = crypto.randomUUID();
        const entry: DeckHistoryEntry = {
          id: deckId,
          input: sharedDeck.input,
          cards: restoredCards,
          createdAt,
          updatedAt: createdAt,
        };
        setDeckHistory(saveDeckHistory(entry));
        setCurrentDeckId(deckId);
        setInput(sharedDeck.input);
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
            const response = await fetch(`/api/share/${encodeURIComponent(shareSlug)}`);
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
      if (!sharedDeck) return;
      importSharedDeck(sharedDeck);
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
        cards: nextCards.map(hydrateCard),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      setDeckHistory(saveDeckHistory(entry));
      setCurrentDeckId(deckId);
      return deckId;
    },
    [currentDeckId, trimmedInput],
  );

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

    const payload = { input: trimmedInput, preference: tasteContext };
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/generate", {
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
        if (nextCards.length > 0) persistDeck(nextCards, crypto.randomUUID());
        setGlobalError(globalErrorMessage(body));
        return;
      }

      if (!response.ok || !isGenerateResponse(body)) {
        const nextCards = hasVisibleCards(body) ? hydrateCards(body.cards) : [];
        setCards(nextCards);
        if (nextCards.length > 0) persistDeck(nextCards, crypto.randomUUID());
        setGlobalError(globalErrorMessage(body));
        return;
      }

      const nextCards = hydrateCards(body.cards);
      setCards(nextCards);
      persistDeck(nextCards, crypto.randomUUID());
    } catch (error) {
      logApiExchange({ endpoint: "POST /api/generate", payload, startedAt, error });
      setGlobalError("The forge hiccuped. The compliment engine got overwhelmed by your brilliance. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, persistDeck, tasteContext, trimmedInput]);

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
        currentText: card.text,
        history: card.history,
        dramaLevel: card.dramaLevel,
      };
      const startedAt = performance.now();
      try {
        const response = await fetch("/api/escalate", {
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
          const version = createCardVersion(body.text, body.dramaLevel, "dramatic");
          return {
            ...item,
            text: body.text,
            history: body.history,
            versions: appendCardVersion(item, version),
            activeVersionId: version.id,
            dramaLevel: body.dramaLevel,
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

      const payload = { personaId: card.personaId, originalInput: card.originalInput };
      const startedAt = performance.now();
      try {
        const response = await fetch("/api/retry", {
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
          const version = createCardVersion(body.text, body.dramaLevel, "generated");
          return {
            ...item,
            text: body.text,
            history: [...item.history, body.text].slice(-MAX_HISTORY_ITEMS),
            versions: appendCardVersion(item, version),
            activeVersionId: version.id,
            dramaLevel: body.dramaLevel,
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
        currentText: card.text,
        history: card.history,
        dramaLevel: card.dramaLevel,
        feedback,
      };
      const startedAt = performance.now();
      try {
        const response = await fetch("/api/tweak", {
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
          const version = createCardVersion(body.text, body.dramaLevel, "tweaked");
          return {
            ...item,
            text: body.text,
            history: body.history,
            versions: appendCardVersion(item, version),
            activeVersionId: version.id,
            dramaLevel: body.dramaLevel,
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
    setInput(entry.input);
    setCards(hydrateCards(entry.cards));
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
      cards: shareableCards.map((card) => ({
        personaId: card.personaId,
        personaName: card.personaName,
        text: card.text,
        dramaLevel: card.dramaLevel,
        originalInput: card.originalInput,
      })),
    };
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/share", {
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
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareMessage("Share link copied.");
      } else {
        fallbackCopy(url);
        setShareMessage("Share link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      logApiExchange({ endpoint: "POST /api/share", payload: { input: payload.input, cardCount: payload.cards.length }, startedAt, error });
      setShareMessage("Share link could not be copied.");
    }
  }, [cards, trimmedInput]);

  const clearSavedDecks = useCallback(() => {
    clearDeckHistory();
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
        console.groupCollapsed(`[HypeForge V2 UI] copy requested ${cardId}`);
        console.log("Copy text", text);
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          fallbackCopy(text);
        }
        setCardCopied(cardId, true);
        if (copyTimers.current[cardId]) clearTimeout(copyTimers.current[cardId]);
        copyTimers.current[cardId] = setTimeout(() => setCardCopied(cardId, false), 1800);
        console.log("Copy succeeded");
        console.groupEnd();
      } catch {
        try {
          fallbackCopy(text);
          setCardCopied(cardId, true);
          if (copyTimers.current[cardId]) clearTimeout(copyTimers.current[cardId]);
          copyTimers.current[cardId] = setTimeout(() => setCardCopied(cardId, false), 1800);
          console.log("Fallback copy succeeded");
          console.groupEnd();
        } catch (error) {
          console.error("Copy failed", error);
          console.groupEnd();
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
            <p className="v2-mono hidden text-right text-[0.68rem] uppercase text-[var(--text-muted)] sm:block">
              Private saved decks · no sign-in
            </p>
            <Tooltip className="hidden min-[380px]:inline-flex" label="Compliment guide">
              <button
                aria-label="Open compliment guide"
                className="grid size-10 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--text)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
                type="button"
                onClick={() => setGuideOpen(true)}
              >
                <BookOpen aria-hidden="true" className="size-4" />
              </button>
            </Tooltip>
            <Tooltip label="Saved compliment decks">
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
              <Tooltip label="Create a share link">
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
            <Tooltip label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
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
        <section
          className="self-start rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6 lg:sticky lg:top-24"
          style={{ boxShadow: "var(--panel-shadow)" }}
        >
          <p className="v2-mono text-[0.68rem] uppercase text-[var(--cyan)]">AI Compliment Generator</p>
          <h1 className="v2-display mt-4 text-4xl font-semibold leading-none text-[var(--text)] md:text-5xl">
            Turn any person into a <span className="v2-gradient-text">living legend.</span>
          </h1>
          <p className="mt-4 text-sm font-medium leading-6 text-[var(--text-muted)]">
            Type a job title or a few details. HypeForge returns three unreasonably generous compliments, each with
            its own flavor of dramatic chaos.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              generate();
            }}
          >
            <div className="space-y-2">
              <label className="v2-mono text-[0.68rem] uppercase text-[var(--text-muted)]" htmlFor="v2-subject">
                Who are we hyping?
              </label>
              <textarea
                className="min-h-28 w-full resize-none rounded-[24px] border border-[var(--line)] bg-[var(--input-bg)] px-4 py-4 text-base font-semibold leading-7 text-[var(--text)] outline-none transition placeholder:text-[var(--input-placeholder)] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#8b5cf6]/25"
                id="v2-subject"
                maxLength={MAX_INPUT_LENGTH}
                placeholder="e.g. Customer Success Manager, Recruiter, or my friend Sara who fixes every crisis"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    generate();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-[var(--text-faint)]">
                <span>Three voices. One click. Maximum admiration.</span>
                <span>
                  {input.length}/{MAX_INPUT_LENGTH}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(examplesExpanded ? EXAMPLES : EXAMPLES.slice(0, 3)).map((example) => (
                  <button
                    className="min-h-10 rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] px-3 py-2 text-left text-xs font-bold text-[var(--text)] transition hover:-translate-y-0.5 hover:border-[#8b5cf6]/70 hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35 sm:text-sm"
                    key={example}
                    type="button"
                    onClick={() => setInput(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
              <button
                aria-expanded={examplesExpanded}
                className="text-xs font-bold text-[var(--purple)] underline decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
                type="button"
                onClick={() => setExamplesExpanded((current) => !current)}
              >
                {examplesExpanded ? "Show fewer ideas" : `Show ${EXAMPLES.length - 3} more ideas`}
              </button>
            </div>

            <button
              className="v2-gradient-button inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] px-5 py-3 text-base font-bold text-white shadow-lg shadow-[#ff6b5f]/20 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:grayscale focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/45"
              disabled={!canGenerate || isGenerating}
              type="submit"
            >
              {isGenerating ? (
                <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
              ) : (
                <WandSparkles aria-hidden="true" className="size-5" />
              )}
              {!trimmedInput ? "Add someone to hype first" : isGenerating ? "Forging admiration..." : "Forge 3 compliments"}
            </button>
          </form>
        </section>

        <section className="min-w-0 space-y-5" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="v2-mono text-[0.68rem] uppercase text-[var(--purple-soft)]">Compliment deck</p>
              <h2 className="v2-display mt-1 text-3xl font-semibold text-[var(--text)]">Three dramatic voices</h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--text-muted)]">
                Each card keeps its own memory. Escalate one without changing the others.
              </p>
            </div>
            {cards.length > 0 ? (
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] px-4 py-2 text-sm font-bold text-[var(--text)] transition hover:-translate-y-0.5 hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
                type="button"
                onClick={() => {
                  setCards([]);
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
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card, index) => (
                <V2Card
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
