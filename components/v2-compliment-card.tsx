"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Crown,
  Download,
  History,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  copyComplimentForPlatform,
  downloadComplimentPng,
  shareComplimentNatively,
  type ComplimentShareData,
  type SharePlatform,
} from "@/lib/card-sharing";
import { GuidelineProof } from "@/components/guideline-proof";
import { Tooltip } from "@/components/tooltip";
import { activeVersionIdFor, versionsForCard } from "@/lib/card-versions";
import { DRAMA_CAP, DRAMA_STAGES, dramaButtonLabel, dramaStage, isAtDramaCap } from "@/lib/drama";
import { playForgeSound } from "@/lib/forge-sound";
import { PERSONAS } from "@/lib/personas";
import type {
  CardPendingAction,
  ComplimentCard,
  ComplimentCardVersion,
  EscalationProgress,
  FeedbackVote,
  PersonaBucket,
} from "@/lib/types";

const BUCKET_ACCENT: Record<PersonaBucket, string> = {
  grand: "#7050c8",
  mythic: "#168a87",
  chaotic: "#ff6b5f",
};

const PERSONA_BUCKET = Object.fromEntries(PERSONAS.map((persona) => [persona.id, persona.bucket])) as Record<string, PersonaBucket>;

function badgeLabel(level: number): string {
  return `DRAMA · ${String(level).padStart(2, "0")}`;
}

function bucketFor(card: ComplimentCard): PersonaBucket {
  return PERSONA_BUCKET[card.personaId] ?? "grand";
}

function styleForCard(card: ComplimentCard, index = 0): CSSProperties {
  const bucket = bucketFor(card);
  return {
    "--bucket-accent": BUCKET_ACCENT[bucket],
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
  shareOpen,
  speaking,
  tweakValue,
  pendingAction,
  escalationProgress,
  onToggleTweak,
  onToggleShare,
  onToggleSpeech,
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
  shareOpen: boolean;
  speaking: boolean;
  tweakValue: string;
  pendingAction?: CardPendingAction;
  escalationProgress?: EscalationProgress;
  onToggleTweak: (cardId: string) => void;
  onToggleShare: (cardId: string) => void;
  onToggleSpeech: (cardId: string, text: string) => void;
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
  const atDramaCap = isAtDramaCap(card.dramaLevel);
  const currentStage = dramaStage(card.dramaLevel);
  const nextStage = dramaStage(card.dramaLevel + 1);
  const showAutomaticRepair = Boolean(
    escalationProgress && (escalationProgress.phase === "repairing" || escalationProgress.attempt > 1),
  );
  const [powerUpComplete, setPowerUpComplete] = useState(false);
  const [levelUpNotice, setLevelUpNotice] = useState(false);
  const wasLoading = useRef(isLoading);
  const lastPendingAction = useRef<CardPendingAction | undefined>(pendingAction);
  const shareStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const shareData: ComplimentShareData = {
    text: card.text,
    jobFunction: card.jobFunction ?? card.originalInput,
    personaName: card.personaName,
    bucket,
    dramaLevel: card.dramaLevel,
    deliveryMode: card.deliveryMode,
  };

  const announceShareStatus = (message: string) => {
    setShareStatus(message);
    if (shareStatusTimer.current) clearTimeout(shareStatusTimer.current);
    shareStatusTimer.current = setTimeout(() => setShareStatus(null), 2_400);
  };

  const copyForPlatform = async (platform: SharePlatform) => {
    try {
      announceShareStatus(await copyComplimentForPlatform(platform, shareData));
    } catch (error) {
      console.error(`[HypeForge card share] Copy for ${platform} failed`, error);
      announceShareStatus("That format could not be copied.");
    }
  };

  const nativeShare = async () => {
    try {
      const result = await shareComplimentNatively(shareData);
      if (result === "shared") announceShareStatus("Share sheet opened.");
      if (result === "copied") announceShareStatus("Native sharing is unavailable, so the compliment was copied.");
    } catch (error) {
      console.error("[HypeForge card share] Share failed", error);
      announceShareStatus("This compliment could not be shared.");
    }
  };

  const downloadPng = async () => {
    try {
      await downloadComplimentPng(shareData);
      announceShareStatus("PNG card downloaded.");
    } catch (error) {
      console.error("[HypeForge card share] PNG download failed", error);
      announceShareStatus("The PNG card could not be created.");
    }
  };

  useEffect(() => {
    if (pendingAction) lastPendingAction.current = pendingAction;
  }, [pendingAction]);

  useEffect(() => {
    if (wasLoading.current && !isLoading && card.status === "idle" && hasText) {
      const completedAction = lastPendingAction.current;
      setPowerUpComplete(true);
      setLevelUpNotice(completedAction === "escalate");
      playForgeSound(completedAction === "escalate" ? "level-up" : "complete", card.dramaLevel);
      const timer = window.setTimeout(() => {
        setPowerUpComplete(false);
        setLevelUpNotice(false);
      }, 2_000);
      lastPendingAction.current = undefined;
      wasLoading.current = isLoading;
      return () => window.clearTimeout(timer);
    }
    wasLoading.current = isLoading;
  }, [card.dramaLevel, card.status, hasText, isLoading]);

  useEffect(() => () => {
    if (shareStatusTimer.current) clearTimeout(shareStatusTimer.current);
  }, []);

  // One confetti burst the moment a card reaches the drama cap, never on
  // remounts of an already-capped card (e.g. restored decks).
  const [celebrating, setCelebrating] = useState(false);
  const previousDramaLevel = useRef(card.dramaLevel);
  useEffect(() => {
    if (!isAtDramaCap(previousDramaLevel.current) && isAtDramaCap(card.dramaLevel)) {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 1700);
      previousDramaLevel.current = card.dramaLevel;
      return () => clearTimeout(timer);
    }
    previousDramaLevel.current = card.dramaLevel;
  }, [card.dramaLevel]);

  const toolClass =
    "grid size-9 place-items-center rounded-full text-[var(--ink-muted)] transition hover:bg-[var(--control-hover)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]";

  return (
    <article
      aria-busy={isLoading}
      className="v2-card v2-card-enter flex h-full min-w-0 w-full max-w-full flex-col p-5"
      data-loading={isLoading ? "true" : "false"}
      data-action={pendingAction}
      data-power-up={powerUpComplete ? "true" : "false"}
      data-drama-level={currentStage.level}
      data-max-drama={atDramaCap ? "true" : "false"}
      data-celebrating={celebrating ? "true" : "false"}
      style={styleForCard(card, index)}
    >
      {celebrating ? (
        <span aria-hidden="true" className="v2-confetti">
          {Array.from({ length: 22 }, (_, particle) => (
            <i key={particle} style={{ "--particle": particle } as CSSProperties} />
          ))}
        </span>
      ) : null}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold capitalize" style={{ color: BUCKET_ACCENT[bucket] }}>
            {bucket}
          </p>
          <h2 className="v2-display mt-1 text-lg font-semibold leading-6 text-[var(--ink)]">{card.personaName}</h2>
        </div>
        <div
          aria-label={`${badgeLabel(card.dramaLevel)}, version ${activeVersionIndex + 1} of ${versions.length}`}
          className="v2-drama-badge v2-mono inline-flex h-8 shrink-0 items-stretch overflow-hidden rounded-full bg-[var(--paper-secondary)] text-[0.68rem] font-semibold text-[var(--ink)]"
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

      <div
        aria-label={`Drama level ${currentStage.level} of ${DRAMA_CAP}: ${currentStage.label}. ${currentStage.cue}.`}
        aria-valuemax={DRAMA_CAP}
        aria-valuemin={1}
        aria-valuenow={currentStage.level}
        className="v2-drama-meter mt-4"
        role="progressbar"
      >
        <div className="flex items-center justify-between gap-3 text-[0.68rem] font-semibold">
          <p className="min-w-0 truncate text-[var(--ink)]"><span className="v2-mono uppercase text-[var(--ink-muted)]">Drama</span> · {currentStage.label} <span className="text-[var(--ink-muted)]">{currentStage.cue}</span></p>
          <span className="v2-mono shrink-0 text-[var(--ink-muted)]">{currentStage.level} / {DRAMA_CAP}</span>
        </div>
        <div aria-hidden="true" className="mt-2 grid grid-cols-6 gap-1.5">
          {DRAMA_STAGES.map((stage) => {
            const state = stage.level < currentStage.level ? "complete" : stage.level === currentStage.level ? "current" : "upcoming";
            const charging = pendingAction === "escalate" && stage.level === Math.min(currentStage.level + 1, DRAMA_CAP);
            return <span className="v2-drama-meter-step" data-charging={charging ? "true" : "false"} data-state={state} key={stage.level} />;
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-1 flex-col space-y-5">
        <div className="space-y-4">
          {hasText ? (
            <>
              <p aria-live="polite" className="v2-card-copy v2-display text-base font-medium leading-7 text-[var(--ink)]" data-revealing={powerUpComplete ? "true" : "false"}>
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

          {card.error && hasText ? (
            <div className="rounded-[14px] border border-[#ff6b5f]/40 bg-[#ff6b5f]/10 px-3 py-2 text-sm font-bold text-[#7b211b]">
              {card.error}
            </div>
          ) : null}

          {pendingAction === "escalate" && escalationProgress && !showAutomaticRepair ? (
            <div aria-live="polite" className="flex min-h-6 items-center gap-2 text-xs font-medium text-[var(--ink-muted)]" role="status">
              <LoaderCircle aria-hidden="true" className="size-3.5 shrink-0 animate-spin" style={{ color: BUCKET_ACCENT[bucket] }} />
              <span>{escalationProgress.message}</span>
            </div>
          ) : null}

          {pendingAction === "escalate" && escalationProgress && showAutomaticRepair ? (
            <div
              aria-live="polite"
              className="rounded-[14px] border px-3 py-2.5"
              role="status"
              style={{
                borderColor: `color-mix(in srgb, ${BUCKET_ACCENT[bucket]} 38%, var(--line))`,
                background: `color-mix(in srgb, ${BUCKET_ACCENT[bucket]} 8%, var(--paper-secondary))`,
              }}
            >
              <div className="flex items-center justify-between gap-3 text-xs font-bold">
                <span style={{ color: BUCKET_ACCENT[bucket] }}>Automatic rule repair</span>
                <span className="v2-mono text-[var(--ink-muted)]">
                  Attempt {escalationProgress.attempt}/{escalationProgress.maxAttempts}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold leading-5 text-[var(--ink)]">{escalationProgress.message}</p>
              {escalationProgress.failureDetails?.length ? (
                <p className="mt-1 text-xs font-medium leading-5 text-[var(--ink-muted)]">
                  Fixing: {escalationProgress.failureDetails.map((failure) => failure.label).join(", ")}
                </p>
              ) : null}
              <div aria-hidden="true" className="mt-2 grid grid-cols-3 gap-1.5">
                {Array.from({ length: escalationProgress.maxAttempts }, (_, attemptIndex) => (
                  <span
                    className="h-1 rounded-full"
                    key={attemptIndex}
                    style={{
                      background: attemptIndex < escalationProgress.attempt
                        ? BUCKET_ACCENT[bucket]
                        : "var(--muted-fill-strong)",
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-auto grid gap-2 sm:grid-cols-2 lg:grid-cols-1 min-[1500px]:grid-cols-2">
          {hasText ? (
            <button
              aria-label={
                levelUpNotice
                  ? `${card.personaName} unlocked drama ${String(currentStage.level).padStart(2, "0")}, ${currentStage.label}`
                  : atDramaCap
                  ? `${card.personaName} compliment reached maximum drama`
                  : `Make ${card.personaName} compliment more dramatic`
              }
              className={`v2-secondary-button v2-drama-button relative inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed ${levelUpNotice ? "v2-drama-unlocked" : atDramaCap ? "v2-drama-max" : "disabled:opacity-50"}`}
              disabled={isLoading || levelUpNotice || atDramaCap}
              type="button"
              onClick={() => {
                playForgeSound("charge");
                onEscalate(card.id);
              }}
            >
              {pendingAction === "escalate" ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : levelUpNotice ? (
                atDramaCap ? <Crown aria-hidden="true" className="size-4" /> : <Check aria-hidden="true" className="size-4" />
              ) : atDramaCap ? (
                <Crown aria-hidden="true" className="size-4" />
              ) : (
                <WandSparkles aria-hidden="true" className="size-4" />
              )}
              {pendingAction === "escalate"
                ? escalationProgress
                  ? showAutomaticRepair
                    ? `Repairing automatically · ${escalationProgress.attempt}/${escalationProgress.maxAttempts}`
                    : `Working on ${nextStage.label}…`
                  : `Charging ${nextStage.label}…`
                : levelUpNotice
                  ? atDramaCap
                    ? "Maximum drama unlocked"
                    : `Drama ${String(currentStage.level).padStart(2, "0")} · ${currentStage.label} unlocked`
                  : dramaButtonLabel(card.dramaLevel)}
            </button>
          ) : (
            <button
              className="v2-secondary-button v2-retry-button inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              type="button"
              onClick={() => {
                playForgeSound("charge");
                onRetry(card.id);
              }}
            >
              {pendingAction === "retry" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <RotateCcw aria-hidden="true" className="size-4" />}
              {pendingAction === "retry" ? "Reforging this card…" : "Retry this card"}
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
            <span className="sr-only" role="status">
              {card.copied ? `${card.personaName} compliment copied to clipboard` : ""}
            </span>
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
              className={`${toolClass} ${versionsOpen ? "bg-[var(--accent-soft)] text-[var(--accent)]" : ""}`}
              disabled={versions.length === 0 || isLoading}
              type="button"
              onClick={() => onToggleVersions(card.id)}
            >
              <History aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
          <Tooltip label={speaking ? "Stop reading aloud" : "Read aloud"}>
            <button
              aria-label={speaking ? `Stop reading ${card.personaName} compliment` : `Read ${card.personaName} compliment aloud`}
              aria-pressed={speaking}
              className={`${toolClass} ${speaking ? "bg-[var(--accent-soft)] text-[var(--accent)]" : ""}`}
              disabled={!hasText || isLoading}
              type="button"
              onClick={() => onToggleSpeech(card.id, card.text)}
            >
              {speaking ? <Square aria-hidden="true" className="size-3.5 fill-current" /> : <Volume2 aria-hidden="true" className="size-4" />}
            </button>
          </Tooltip>
          <Tooltip label="Tweak this card">
            <button
              aria-expanded={tweakOpen}
              aria-label={`Tweak ${card.personaName} compliment`}
              className={`${toolClass} ${tweakOpen ? "bg-[var(--accent-soft)] text-[var(--accent)]" : ""}`}
              disabled={!hasText || isLoading}
              type="button"
              onClick={() => onToggleTweak(card.id)}
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
          <Tooltip label="Share this card">
            <button
              aria-expanded={shareOpen}
              aria-label={`Share ${card.personaName} compliment`}
              className={`${toolClass} ${shareOpen ? "bg-[var(--accent-soft)] text-[var(--accent)]" : ""}`}
              disabled={!hasText || isLoading}
              type="button"
              onClick={() => onToggleShare(card.id)}
            >
              <Share2 aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
          {card.feedback ? (
            <span className="ml-1 text-xs font-medium text-[var(--ink-muted)]" role="status">
              Preference saved
            </span>
          ) : null}
        </div>

        {versionsOpen ? (
          <section className="rounded-[18px] border border-[var(--dark-line)] bg-[var(--paper-secondary)] p-3" aria-label={`${card.personaName} version history`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <p className="v2-mono text-[0.68rem] font-bold uppercase text-[var(--ink-muted)]">Version history</p>
                <span className="text-xs font-semibold text-[var(--ink-muted)]">{versions.length} saved</span>
              </div>
              <button
                aria-label={`Close ${card.personaName} version history`}
                className="grid size-8 shrink-0 place-items-center rounded-[10px] text-[var(--ink-muted)] transition hover:bg-[var(--control-hover)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
                type="button"
                onClick={() => onToggleVersions(card.id)}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
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
                        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-[10px] bg-[var(--accent-soft)] px-2.5 text-xs font-semibold text-[var(--accent)]">
                          <Check aria-hidden="true" className="size-3.5" />
                          Current
                        </span>
                      ) : (
                        <button
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-[10px] border border-[var(--line-strong)] bg-[var(--control-bg)] px-2.5 text-xs font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
                          type="button"
                          onClick={() => onRestoreVersion(card.id, version)}
                        >
                          <RotateCcw aria-hidden="true" className="size-3.5" />
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
            <div className="flex items-center justify-between gap-3">
              <label className="v2-mono text-[0.68rem] uppercase text-[var(--ink-muted)]" htmlFor={`tweak-${card.id}`}>
                What should change?
              </label>
              <button
                aria-label={`Close ${card.personaName} tweak panel`}
                className="grid size-8 shrink-0 place-items-center rounded-[10px] text-[var(--ink-muted)] transition hover:bg-[var(--control-hover)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
                type="button"
                onClick={() => onToggleTweak(card.id)}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
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
                className="v2-tweak-submit inline-flex min-h-10 items-center gap-2 rounded-[12px] bg-[var(--ink)] px-3 text-sm font-bold text-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/45"
                disabled={isLoading || tweakValue.trim().length < 3}
                type="button"
                onClick={() => {
                  playForgeSound("charge");
                  onTweak(card.id);
                }}
              >
                {pendingAction === "tweak" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
                {pendingAction === "tweak" ? "Applying your note…" : "Regenerate with note"}
              </button>
            </div>
          </section>
        ) : null}

        {shareOpen && hasText ? (
          <section className="rounded-[18px] border border-[var(--dark-line)] bg-[var(--paper-secondary)] p-3" aria-label={`Share ${card.personaName} compliment options`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="v2-mono text-[0.68rem] font-bold uppercase text-[var(--ink-muted)]">Share this card</p>
                <p className="mt-1 text-xs font-medium leading-5 text-[var(--ink-muted)]">Send it, copy a platform-ready version, or save a square image.</p>
              </div>
              <button
                aria-label={`Close ${card.personaName} share options`}
                className="grid size-8 shrink-0 place-items-center rounded-[10px] text-[var(--ink-muted)] transition hover:bg-[var(--control-hover)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
                type="button"
                onClick={() => onToggleShare(card.id)}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 min-[1500px]:grid-cols-2">
              <button className="v2-secondary-button inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold" type="button" onClick={nativeShare}>
                <Share2 aria-hidden="true" className="size-4" />
                Device share
              </button>
              <button className="v2-secondary-button inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold" type="button" onClick={() => copyForPlatform("x")}>
                <span aria-hidden="true" className="v2-mono text-sm font-bold">X</span>
                Copy for X
              </button>
              <button className="v2-secondary-button inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold" type="button" onClick={() => copyForPlatform("linkedin")}>
                <BriefcaseBusiness aria-hidden="true" className="size-4" />
                Copy for LinkedIn
              </button>
              <button className="v2-secondary-button inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold" type="button" onClick={() => copyForPlatform("whatsapp")}>
                <MessageCircle aria-hidden="true" className="size-4" />
                Copy for WhatsApp
              </button>
              <button className="v2-secondary-button inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold sm:col-span-2 lg:col-span-1 min-[1500px]:col-span-2" type="button" onClick={downloadPng}>
                <Download aria-hidden="true" className="size-4" />
                Download PNG card
              </button>
            </div>
            <p className="mt-3 min-h-5 text-xs font-semibold text-[var(--accent)]" role="status">{shareStatus}</p>
          </section>
        ) : null}
      </div>
    </article>
  );
}
