import {
  evaluateDeckSemantics,
  type DeckSemanticEvaluation,
} from "./ai";
import {
  generateCompliantCompliment,
  isGuidelineComplianceError,
} from "./compliant-generation";
import { distinctnessIssues } from "./deck-distinctness";
import type { createApiDebug } from "./debug";
import type { GeminiKeyPoolEvent } from "./gemini-key-pool";
import type { ModelSelection } from "./models";
import { fallbackPersonasFor, pickOnePerBucket } from "./personas";
import { buildInitialMessages } from "./prompts";
import type {
  ComplimentCard,
  DeliveryMode,
  Persona,
  SoftPreferenceContext,
} from "./types";

type DebugLogger = ReturnType<typeof createApiDebug>;
type ResolvedSubject = {
  jobFunction: string;
  personDetails?: string;
  displayInput: string;
};

const EXPECTED_CARD_COUNT = 3;
const MAX_SLOT_ATTEMPTS = 2;
const MAX_DECK_REPAIRS = 2;

function keyEventLogger(debug: DebugLogger) {
  return (event: GeminiKeyPoolEvent) => {
    if (event.type === "failure") {
      debug.providerInfo("Gemini key failure recorded during deck audit", {
        keySlot: event.keySlot,
        keyCount: event.keyCount,
        keyName: event.keyName,
        reason: event.reason,
        consecutiveFailures: event.consecutiveFailures,
        rotatesNow: event.rotatesNow,
      });
      return;
    }
    if (event.type === "rotation") {
      debug.providerInfo("Gemini API key rotated during deck audit", {
        fromKeySlot: event.keySlot,
        toKeySlot: event.nextKeySlot,
        reason: event.reason,
      });
      return;
    }
    debug.providerInfo("Deck audit recovered after key rotation", {
      keySlot: event.keySlot,
      attemptedKeys: event.attemptedKeys,
    });
  };
}

function makeCard(
  persona: Persona,
  subject: ResolvedSubject,
  deliveryMode: DeliveryMode,
  result: Pick<ComplimentCard, "text" | "guidelines">,
): ComplimentCard {
  return {
    id: crypto.randomUUID(),
    originalInput: subject.displayInput,
    jobFunction: subject.jobFunction,
    personDetails: subject.personDetails,
    deliveryMode,
    personaId: persona.id,
    personaName: persona.name,
    text: result.text,
    history: [result.text],
    guidelines: result.guidelines,
    dramaLevel: 1,
    status: "idle",
    copied: false,
  };
}

async function generateCard(args: {
  persona: Persona;
  subject: ResolvedSubject;
  deliveryMode: DeliveryMode;
  preference: SoftPreferenceContext;
  debug: DebugLogger;
  models?: ModelSelection;
  avoidCompliments?: string[];
  diversityFeedback?: string[];
}): Promise<ComplimentCard> {
  const messages = buildInitialMessages(
    args.persona,
    { ...args.subject, deliveryMode: args.deliveryMode },
    args.preference,
    args.avoidCompliments,
    args.diversityFeedback,
  );
  args.debug.providerInfo("persona generation started", {
    personaId: args.persona.id,
    personaName: args.persona.name,
    bucket: args.persona.bucket,
    imageryDomain: args.persona.imageryDomain,
  });
  try {
    const result = await generateCompliantCompliment({
      messages,
      subject: args.subject.jobFunction,
      personaId: args.persona.id,
      operation: "generate",
      deliveryMode: args.deliveryMode,
      debug: args.debug,
      models: args.models,
      temperature: 1,
      maxOutputTokens: 260,
    });
    args.debug.providerInfo("persona generation succeeded", {
      personaId: args.persona.id,
      personaName: args.persona.name,
      characterCount: result.text.length,
      wordCount: result.guidelines.wordCount,
    });
    return makeCard(args.persona, args.subject, args.deliveryMode, result);
  } catch (error) {
    args.debug.providerError("persona generation failed", {
      personaId: args.persona.id,
      personaName: args.persona.name,
      error,
    });
    throw error;
  }
}

async function fillPersonaSlot(args: {
  primary: Persona;
  subject: ResolvedSubject;
  deliveryMode: DeliveryMode;
  preference: SoftPreferenceContext;
  debug: DebugLogger;
  models?: ModelSelection;
}): Promise<{ card: ComplimentCard; persona: Persona; attemptedPersonaIds: string[] }> {
  const candidates = [args.primary, ...fallbackPersonasFor(args.primary)].slice(0, MAX_SLOT_ATTEMPTS);
  const attemptedPersonaIds: string[] = [];
  let latestError: unknown;

  for (const [index, persona] of candidates.entries()) {
    attemptedPersonaIds.push(persona.id);
    if (index > 0) {
      args.debug.warn("persona slot recovery started", {
        bucket: args.primary.bucket,
        failedPersonaId: args.primary.id,
        fallbackPersonaId: persona.id,
        attempt: index + 1,
        maxAttempts: candidates.length,
      });
    }
    try {
      return {
        card: await generateCard({ ...args, persona }),
        persona,
        attemptedPersonaIds,
      };
    } catch (error) {
      latestError = error;
    }
  }

  throw Object.assign(new Error(`No ${args.primary.bucket} persona produced a valid card.`), {
    cause: latestError,
    bucket: args.primary.bucket,
    attemptedPersonaIds,
  });
}

function deterministicDeckIssues(cards: ComplimentCard[]): string[] {
  return cards.flatMap((card, index) =>
    distinctnessIssues(card, cards.filter((_, otherIndex) => otherIndex !== index))
      .map((issue) => `${card.personaId}: ${issue}`),
  );
}

function semanticDeckIssues(audit: DeckSemanticEvaluation): string[] {
  const issues: string[] = [];
  if (!audit.genuinelyDifferent) issues.push("The three cards are not genuinely different in concept or imagery.");
  if (!audit.personaVoicesDistinct) issues.push("At least one card does not sound recognizably like its persona.");
  if (!audit.humorouslyVaried) issues.push("The cards repeat the same comic framing or joke mechanism.");
  issues.push(...audit.issues.map((issue) => `${issue.personaIds.join(" and ") || "deck"}: ${issue.reason}`));
  return [...new Set(issues)];
}

function repairIndex(cards: ComplimentCard[], audit: DeckSemanticEvaluation): number {
  if (audit.repairPersonaId) {
    const index = cards.findIndex((card) => card.personaId === audit.repairPersonaId);
    if (index >= 0) return index;
  }
  for (const issue of audit.issues) {
    const requested = issue.personaIds.find((id) => cards.some((card) => card.personaId === id));
    if (requested) return cards.findIndex((card) => card.personaId === requested);
  }
  return cards.length - 1;
}

export class CompleteDeckError extends Error {
  readonly completedCardCount: number;
  readonly failedPersonaIds: string[];
  readonly deckIssues: string[];
  readonly firstFailure?: unknown;

  constructor(args: {
    message: string;
    completedCardCount: number;
    failedPersonaIds?: string[];
    deckIssues?: string[];
    firstFailure?: unknown;
  }) {
    super(args.message);
    this.name = "CompleteDeckError";
    this.completedCardCount = args.completedCardCount;
    this.failedPersonaIds = args.failedPersonaIds ?? [];
    this.deckIssues = args.deckIssues ?? [];
    this.firstFailure = args.firstFailure;
  }
}

export function isCompleteDeckError(error: unknown): error is CompleteDeckError {
  return error instanceof CompleteDeckError;
}

/**
 * Builds one atomic three-card result. Every slot may recover once with a
 * same-bucket persona, then the finished deck passes deterministic and one
 * consolidated semantic audit. No partial deck is returned as success.
 */
export async function generateCompleteDeck(args: {
  subject: ResolvedSubject;
  deliveryMode: DeliveryMode;
  preference: SoftPreferenceContext;
  debug: DebugLogger;
  models?: ModelSelection;
}): Promise<ComplimentCard[]> {
  const selected = pickOnePerBucket();
  args.debug.info("selected personas", selected.map((persona) => ({
    personaId: persona.id,
    personaName: persona.name,
    bucket: persona.bucket,
    imageryDomain: persona.imageryDomain,
  })));

  const settled = await Promise.allSettled(selected.map((primary) => fillPersonaSlot({ ...args, primary })));
  const successful = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const failed = settled.flatMap((result, index) => result.status === "rejected"
    ? [{ primary: selected[index]!, error: result.reason }]
    : []);

  if (successful.length !== EXPECTED_CARD_COUNT) {
    args.debug.error("complete deck contract failed during persona generation", {
      expectedCardCount: EXPECTED_CARD_COUNT,
      completedCardCount: successful.length,
      failures: failed.map(({ primary, error }) => ({ personaId: primary.id, bucket: primary.bucket, error })),
    });
    throw new CompleteDeckError({
      message: "HypeForge could not complete all three distinct compliment voices.",
      completedCardCount: successful.length,
      failedPersonaIds: failed.map(({ primary }) => primary.id),
      firstFailure: failed[0]?.error,
    });
  }

  const cards = successful.map((result) => result.card);
  const personas = successful.map((result) => result.persona);

  for (let index = 0; index < cards.length; index += 1) {
    const accepted = cards.slice(0, index);
    const issues = distinctnessIssues(cards[index]!, accepted);
    if (issues.length === 0) continue;
    args.debug.warn("deterministic deck repair started", { personaId: cards[index]!.personaId, issues });
    try {
      const replacement = await generateCard({
        ...args,
        persona: personas[index]!,
        avoidCompliments: accepted.map((item) => item.text),
        diversityFeedback: issues,
      });
      const remainingIssues = distinctnessIssues(replacement, accepted);
      if (remainingIssues.length > 0) {
        throw new Error(`Distinctness repair failed: ${remainingIssues.join(", ")}`);
      }
      cards[index] = replacement;
    } catch (error) {
      throw new CompleteDeckError({
        message: "HypeForge could not make all three compliment voices distinct.",
        completedCardCount: cards.length - 1,
        failedPersonaIds: [personas[index]!.id],
        deckIssues: issues,
        firstFailure: error,
      });
    }
  }

  let latestIssues = deterministicDeckIssues(cards);
  for (let auditAttempt = 1; auditAttempt <= MAX_DECK_REPAIRS + 1; auditAttempt += 1) {
    if (latestIssues.length > 0) {
      args.debug.warn("deterministic deck audit found unresolved overlap", { auditAttempt, issues: latestIssues });
    }
    let audit: DeckSemanticEvaluation;
    try {
      audit = await evaluateDeckSemantics({
        cards: cards.map((card, index) => ({
          personaId: card.personaId,
          personaName: card.personaName,
          voice: personas[index]!.voice,
          imageryDomain: personas[index]!.imageryDomain,
          text: card.text,
        })),
        onKeyEvent: keyEventLogger(args.debug),
        models: args.models,
      });
    } catch (error) {
      const deterministicIssues = deterministicDeckIssues(cards);
      args.debug.providerError("deck semantic audit unavailable", {
        auditAttempt,
        error,
        deterministicIssues,
        priorSemanticIssues: latestIssues,
      });
      if (deterministicIssues.length === 0) {
        args.debug.warn("deterministic diversity fallback accepted complete deck", {
          reason: "The optional cross-card semantic judge was unavailable after model and key fallback.",
          cardCount: cards.length,
          personaIds: cards.map((card) => card.personaId),
          imageryDomains: personas.map((persona) => persona.imageryDomain),
        });
        return cards;
      }
      throw new CompleteDeckError({
        message: "HypeForge could not verify that all three voices were genuinely different.",
        completedCardCount: cards.length,
        deckIssues: deterministicIssues,
        firstFailure: error,
      });
    }

    const semanticIssues = semanticDeckIssues(audit);
    latestIssues = [...new Set([...deterministicDeckIssues(cards), ...semanticIssues])];
    const passed = latestIssues.length === 0;
    args.debug.providerInfo("deck semantic audit completed", {
      auditAttempt,
      passed,
      genuinelyDifferent: audit.genuinelyDifferent,
      personaVoicesDistinct: audit.personaVoicesDistinct,
      humorouslyVaried: audit.humorouslyVaried,
      repairPersonaId: audit.repairPersonaId,
      semanticIssues: audit.issues,
      issues: latestIssues,
      deckTexts: passed ? undefined : cards.map((card) => ({ personaId: card.personaId, text: card.text })),
    });
    if (passed) return cards;
    if (auditAttempt > MAX_DECK_REPAIRS) break;

    const index = repairIndex(cards, audit);
    const otherCards = cards.filter((_, otherIndex) => otherIndex !== index);
    args.debug.warn("semantic deck repair started", {
      auditAttempt,
      personaId: cards[index]!.personaId,
      issues: latestIssues,
    });
    try {
      cards[index] = await generateCard({
        ...args,
        persona: personas[index]!,
        avoidCompliments: otherCards.map((card) => card.text),
        diversityFeedback: latestIssues,
      });
    } catch (error) {
      throw new CompleteDeckError({
        message: "HypeForge could not repair the deck's semantic variety.",
        completedCardCount: cards.length - 1,
        failedPersonaIds: [personas[index]!.id],
        deckIssues: latestIssues,
        firstFailure: error,
      });
    }
  }

  throw new CompleteDeckError({
    message: "HypeForge could not make all three voices genuinely different after automatic repair.",
    completedCardCount: cards.length,
    deckIssues: latestIssues,
  });
}

export function underlyingDeckFailure(error: CompleteDeckError): unknown {
  if (isGuidelineComplianceError(error.firstFailure)) return error.firstFailure;
  const cause = error.firstFailure && typeof error.firstFailure === "object" && "cause" in error.firstFailure
    ? (error.firstFailure as { cause?: unknown }).cause
    : undefined;
  return cause ?? error.firstFailure;
}
