"use client";

import { type CSSProperties, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  LoaderCircle,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  WandSparkles,
} from "lucide-react";
import { GuidelineProof } from "@/components/guideline-proof";
import { Tooltip } from "@/components/tooltip";
import { PERSONAS } from "@/lib/personas";
import type { ComplimentCard, ComplimentCardVersion, FeedbackVote, GuidelineCompliance, PersonaBucket } from "@/lib/types";

const BUCKET_ACCENT: Record<PersonaBucket, string> = {
  grand: "#7050c8",
  mythic: "#168a87",
  chaotic: "#ff6b5f",
};

const PERSONA_BUCKET = Object.fromEntries(PERSONAS.map((persona) => [persona.id, persona.bucket])) as Record<string, PersonaBucket>;

function dramaButtonLabel(level: number): string {
  if (level <= 1) return "Make it more dramatic";
  if (level === 2) return "Make it wildly excessive";
  if (level === 3) return "Summon the prophecy";
  return "Launch it into mythology";
}

function badgeLabel(level: number): string {
  return `DRAMA · ${String(level).padStart(2, "0")}`;
}

function bucketFor(card: ComplimentCard): PersonaBucket {
  return PERSONA_BUCKET[card.personaId] ?? "grand";
}

function createCardVersion(
  text: string,
  dramaLevel: number,
  kind: ComplimentCardVersion["kind"],
  guidelines?: GuidelineCompliance,
): ComplimentCardVersion {
  return { id: crypto.randomUUID(), text, dramaLevel, kind, createdAt: new Date().toISOString(), guidelines };
}

function versionsForCard(card: ComplimentCard): ComplimentCardVersion[] {
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

function activeVersionIdFor(card: ComplimentCard, versions: ComplimentCardVersion[]): string | undefined {
  if (card.activeVersionId && versions.some((version) => version.id === card.activeVersionId)) return card.activeVersionId;
  return [...versions].reverse().find((version) => version.text === card.text && version.dramaLevel === card.dramaLevel)?.id ?? versions.at(-1)?.id;
}

function styleForCard(card: ComplimentCard, index = 0): CSSProperties {
  const bucket = bucketFor(card);
  const heat = Math.min(Math.max((card.dramaLevel - 1) / 3, 0), 1);
  return {
    "--bucket-accent": BUCKET_ACCENT[bucket],
    "--heat": heat,
    animationDelay: `${index * 80}ms`,
  } as CSSProperties;
}

export function V2ComplimentCard({
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
  card: ComplimentCard;
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
  const activeVersionIndex = Math.max(versions.findIndex((version) => version.id === activeVersionId), 0);
  const earlierVersion = versions[activeVersionIndex - 1];
  const laterVersion = versions[activeVersionIndex + 1];
  const [expandedVersionIds, setExpandedVersionIds] = useState<Record<string, boolean>>({});

  const toolClass =
    "grid size-9 place-items-center rounded-full text-[var(--ink-muted)] transition hover:bg-[var(--control-hover)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]";

  return (
    <article
      aria-busy={isLoading}
      className="v2-card v2-card-enter flex h-full min-w-0 w-full max-w-full flex-col p-5"
      data-loading={isLoading ? "true" : "false"}
      style={styleForCard(card, index)}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold capitalize" style={{ color: BUCKET_ACCENT[bucket] }}>
            {bucket}
          </p>
          <h2 className="v2-display mt-1 text-lg font-semibold leading-6 text-[var(--ink)]">{card.personaName}</h2>
        </div>
        <div
          aria-label={`${badgeLabel(card.dramaLevel)}, version ${activeVersionIndex + 1} of ${versions.length}`}
          className="v2-mono inline-flex h-8 shrink-0 items-stretch overflow-hidden rounded-full bg-[var(--paper-secondary)] text-[0.68rem] font-semibold text-[var(--ink)]"
          role="group"
        >
          <Tooltip align="end" label="View earlier version">
            <button
              aria-label={
                earlierVersion
                  ? `View earlier ${card.personaName} version, drama ${String(earlierVersion.dramaLevel).padStart(2, "0")}`
                  : `No earlier ${card.personaName} version is available`
              }
              className="grid h-8 w-7 place-items-center transition hover:bg-[var(--control-hover)] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
              disabled={!earlierVersion || isLoading}
              type="button"
              onClick={() => earlierVersion && onRestoreVersion(card.id, earlierVersion)}
            >
              <ChevronDown aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
          <span aria-hidden="true" className="inline-flex items-center border-x border-[var(--dark-line)]/60 px-2.5">
            {badgeLabel(card.dramaLevel)}
          </span>
          <Tooltip align="end" label="View later version">
            <button
              aria-label={
                laterVersion
                  ? `View later ${card.personaName} version, drama ${String(laterVersion.dramaLevel).padStart(2, "0")}`
                  : `No later ${card.personaName} version is available`
              }
              className="grid h-8 w-7 place-items-center transition hover:bg-[var(--control-hover)] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
              disabled={!laterVersion || isLoading}
              type="button"
              onClick={() => laterVersion && onRestoreVersion(card.id, laterVersion)}
            >
              <ChevronUp aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
        </div>
      </header>

      <div className="mt-6 flex flex-1 flex-col space-y-5">
        <div className="space-y-4">
          {hasText ? (
            <>
              <p aria-live="polite" className="v2-display text-base font-medium leading-7 text-[var(--ink)]">
                {card.text}
              </p>
              <GuidelineProof guidelines={card.guidelines} />
            </>
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
                    <p className="mt-2 text-xs font-bold text-[var(--ink-muted)]">
                      {version.guidelines
                        ? `Guidelines v${version.guidelines.version} · ${version.guidelines.checks.filter((item) => item.state === "pass").length}/8 · ${version.guidelines.wordCount}/40 words`
                        : "Generated before Guidelines v2.1 · Not verified"}
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

        <div className="mt-auto grid gap-2 sm:grid-cols-2 lg:grid-cols-1 min-[1500px]:grid-cols-2">
          {hasText ? (
            <button
              aria-label={`Make ${card.personaName} compliment more dramatic`}
              className="v2-secondary-button inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
              className="v2-secondary-button inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
            className="v2-primary-button inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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

        <div className="flex min-h-11 flex-wrap items-center gap-1 border-t border-[var(--dark-line)]/60 pt-3">
          <Tooltip align="start" label="Use more of this style">
            <button
              aria-label={`Like ${card.personaName} compliment`}
              aria-pressed={card.feedback === "up"}
              className={`${toolClass} ${card.feedback === "up" ? "bg-[#e4f7cf] text-[#315b16]" : ""}`}
              disabled={!hasText || isLoading}
              type="button"
              onClick={() => onSetFeedback(card.id, "up")}
            >
              <ThumbsUp aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
          <Tooltip align="start" label="Use less of this style">
            <button
              aria-label={`Dislike ${card.personaName} compliment`}
              aria-pressed={card.feedback === "down"}
              className={`${toolClass} ${card.feedback === "down" ? "bg-[#ffe8e5] text-[#8c2d24]" : ""}`}
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
            <span className="ml-1 text-xs font-medium text-[var(--ink-muted)]" role="status">
              Preference saved
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
