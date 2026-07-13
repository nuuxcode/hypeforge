import type { ModelMessage } from "ai";
import { evaluateGuidelineSemantics, generateGuidelineCandidate, isQuotaError } from "./ai";
import { captureAiFailure } from "./ai-failure-log";
import type { GeminiKeyPoolEvent } from "./gemini-key-pool";
import {
  failedGuidelineChecks,
  hasFunctionContext,
  verifyGuidelineOutput,
} from "./compliment-guidelines";
import type { GuidelineModelOutput } from "./compliment-guidelines";
import type { createApiDebug } from "./debug";
import type { DeliveryMode, GuidelineCompliance, PipelineFailureDetail, RuleCheck } from "./types";

type DebugLogger = ReturnType<typeof createApiDebug>;
export type ComplianceProgress = {
  attempt: number;
  maxAttempts: number;
  phase: "generating" | "checking" | "repairing";
  message: string;
  failedRuleIds?: string[];
  failureDetails?: PipelineFailureDetail[];
};
const SECOND_PERSON_PATTERN = /\b(?:you|your|yours|yourself|you're|you've|you'll|you\u2019re|you\u2019ve|you\u2019ll)\b/i;

function deliveryModeFailure(text: string, mode: DeliveryMode): string | undefined {
  const hasSecondPerson = SECOND_PERSON_PATTERN.test(text);
  if (mode === "direct" && !hasSecondPerson) {
    return 'delivery-mode: direct messages must address the recipient with "you" or "your"';
  }
  if (mode === "public" && hasSecondPerson) {
    return 'delivery-mode: public posts must describe the person without addressing them as "you" or "your"';
  }
  return undefined;
}

function includesFragment(text: string, fragment?: string): fragment is string {
  return Boolean(fragment && text.toLocaleLowerCase().includes(fragment.toLocaleLowerCase()));
}

function buildFailureDetails(args: {
  candidate: GuidelineModelOutput;
  failures: RuleCheck[];
  semanticNotes?: string[];
  dramaticFailure?: string;
  modeFailure?: string;
}): PipelineFailureDetail[] {
  const semanticReason = args.semanticNotes?.join(" ");
  const details: PipelineFailureDetail[] = args.failures.map((failure) => {
    const fragment = includesFragment(args.candidate.text, failure.evidence) ? failure.evidence : undefined;
    const semanticJudgment = failure.source === "model";
    return {
      ruleId: failure.id,
      label: failure.label,
      reason: semanticJudgment && semanticReason ? semanticReason : failure.note ?? "The rule did not pass.",
      location: fragment ? "exact-fragment" : semanticJudgment ? "whole-output" : "missing",
      fragment,
      source: failure.source,
    };
  });

  if (args.dramaticFailure) {
    details.push({
      ruleId: "dramatic-escalation",
      label: "Meaningfully more dramatic",
      reason: semanticReason ?? "The rewrite changed words but did not clearly increase the scale, stakes, ceremony, consequences, or emotional intensity.",
      location: "whole-output",
      source: "model",
    });
  }
  if (args.modeFailure) {
    const secondPerson = args.candidate.text.match(SECOND_PERSON_PATTERN)?.[0];
    details.push({
      ruleId: "delivery-mode",
      label: "Correct delivery point of view",
      reason: args.modeFailure.replace(/^delivery-mode:\s*/, ""),
      location: secondPerson ? "exact-fragment" : "missing",
      fragment: secondPerson,
      source: "code",
    });
  }
  return details;
}

export class GuidelineComplianceError extends Error {
  readonly guidelines?: GuidelineCompliance;
  readonly failedRuleIds: string[];
  readonly failureDetails: PipelineFailureDetail[];
  readonly attemptCount: number;

  constructor(
    message: string,
    guidelines?: GuidelineCompliance,
    diagnostics: { failedRuleIds?: string[]; failureDetails?: PipelineFailureDetail[]; attemptCount?: number } = {},
  ) {
    super(message);
    this.name = "GuidelineComplianceError";
    this.guidelines = guidelines;
    this.failedRuleIds = diagnostics.failedRuleIds ?? [];
    this.failureDetails = diagnostics.failureDetails ?? [];
    this.attemptCount = diagnostics.attemptCount ?? 0;
  }
}

export function isGuidelineComplianceError(error: unknown): error is GuidelineComplianceError {
  return error instanceof GuidelineComplianceError;
}

function repairInstruction(args: {
  subject: string;
  acceptedBaseline?: string;
  rejectedDraft?: string;
  guidelines?: GuidelineCompliance;
  schemaFailure?: string;
  extraFailures?: string[];
}): ModelMessage {
  const failedRuleIds = args.guidelines
    ? failedGuidelineChecks(args.guidelines).map((item) => item.id)
    : [];
  const guidelineFailures = args.guidelines
    ? failedGuidelineChecks(args.guidelines)
        .map((item) => `- ${item.id}: ${item.note ?? "rule did not pass"}`)
        .join("\n")
    : `- structured-output: ${args.schemaFailure ?? "return valid structured output"}`;
  const failures = [guidelineFailures, ...(args.extraFailures ?? []).map((item) => `- ${item}`)]
    .filter(Boolean)
    .join("\n");
  const targetedHints = [
    failedRuleIds.includes("made-up-statistic")
      ? '- For made-up-statistic: include a numeral using the exact format "97 percent of ..." in an obviously impossible context, then copy that exact phrase into evidence.madeUpStatistic. It must read as a joke, never as a plausible KPI.'
      : undefined,
    failedRuleIds.includes("job-function")
      ? "- For job-function: repeat the supplied title or workplace function verbatim, then quote it exactly in evidence.functionReference."
      : undefined,
    failedRuleIds.includes("max-40-words")
      ? "- For max-40-words: rewrite to 34-38 whitespace-separated words before returning the object."
      : undefined,
  ].filter((item): item is string => Boolean(item));
  const repeatedCosmicImagery = /\b(?:cosmic|galactic|nebula|supernova|planet|orbit|universe|reality|entropy|star|sun|moon|celestial)\b/i.test(
    `${args.acceptedBaseline ?? ""} ${args.rejectedDraft ?? ""}`,
  );
  const escalationHint = args.extraFailures?.some((failure) => failure.startsWith("dramatic-escalation"))
    ? [
        "- For dramatic-escalation: the accepted baseline below is the score to beat. The rejected draft is only an example of what did not improve enough.",
        "- Increase at least two dimensions: scale, stakes, impossible consequences, mock ceremony, or emotional intensity.",
        "- Use a genuinely different metaphor category and a different statistic; do not paraphrase either prior version.",
        repeatedCosmicImagery
          ? "- Do not use space, stars, planets, cosmic forces, time, reality, or entropy in this repair. Switch domains completely, such as courtroom, engineering, music, sports, weather, or mythology."
          : "- Do not reuse the dominant imagery from either prior version; switch metaphor domains completely.",
      ]
    : [];

  return {
    role: "user",
    content: `Your previous attempt did not clear the Company Compliment Guidelines v2.1.
Subject: ${args.subject}
${args.acceptedBaseline ? `Accepted baseline that must be clearly surpassed: ${args.acceptedBaseline}\n` : ""}${args.rejectedDraft ? `Rejected draft that did not pass: ${args.rejectedDraft}\n` : ""}Fix these failures:
${failures}
${targetedHints.length + escalationHint.length > 0 ? `\nUse these exact repair instructions:\n${[...targetedHints, ...escalationHint].join("\n")}\n` : ""}

Rewrite the compliment. Preserve the requested persona and operation, target 34 to 38 words, and return the complete structured object with fresh exact evidence.
Do not explain the correction.`,
  };
}

export async function generateCompliantCompliment(args: {
  messages: ModelMessage[];
  subject: string;
  personaId: string;
  operation: "generate" | "retry" | "escalate" | "tweak";
  debug: DebugLogger;
  temperature?: number;
  maxOutputTokens?: number;
  previousText?: string;
  deliveryMode?: DeliveryMode;
  onProgress?: (progress: ComplianceProgress) => void;
}): Promise<{ text: string; guidelines: GuidelineCompliance }> {
  if (!hasFunctionContext(args.subject) && args.subject.trim().split(/\s+/).length < 2) {
    throw new GuidelineComplianceError("Add the person's job title or what they do so every compliment can name their function.");
  }

  let repair: ModelMessage | undefined;
  let latestCompliance: GuidelineCompliance | undefined;
  let latestRejectedRuleIds: string[] = [];
  let latestFailureDetails: PipelineFailureDetail[] = [];
  let latestCandidate: GuidelineModelOutput | undefined;
  let latestProviderError: unknown;
  const onKeyEvent = (event: GeminiKeyPoolEvent) => {
    if (event.type === "failure") {
      args.debug.providerInfo("Gemini key failure recorded", {
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
      args.debug.providerInfo("Gemini API key rotated automatically", {
        fromKeySlot: event.keySlot,
        toKeySlot: event.nextKeySlot,
        keyCount: event.keyCount,
        reason: event.reason,
        consecutiveFailures: event.consecutiveFailures,
      });
      return;
    }
    args.debug.providerInfo("Gemini request recovered after key rotation", {
      keySlot: event.keySlot,
      keyCount: event.keyCount,
      attemptedKeys: event.attemptedKeys,
    });
  };
  const maxAttempts = args.operation === "escalate" ? 3 : 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    args.onProgress?.({
      attempt,
      maxAttempts,
      phase: "generating",
      message: attempt === 1 ? "Generating a stronger version…" : "Generating the repaired version…",
    });
    args.debug.providerInfo("guideline generation attempt started", {
      operation: args.operation,
      personaId: args.personaId,
      attempt,
      repaired: attempt > 1,
    });
    try {
      const candidate = await generateGuidelineCandidate(
        repair ? [...args.messages, repair] : args.messages,
        {
          temperature: attempt === 1 ? args.temperature : Math.min(args.temperature ?? 1, 0.75),
          maxOutputTokens: args.maxOutputTokens,
          onKeyEvent,
        },
      );
      args.onProgress?.({
        attempt,
        maxAttempts,
        phase: "checking",
        message: "Checking all 8 company rules…",
      });
      const preliminary = verifyGuidelineOutput(candidate, args.subject);
      const semantic = failedGuidelineChecks(preliminary.guidelines).length === 0
        ? await evaluateGuidelineSemantics({
            text: preliminary.text,
            jobFunction: args.subject,
            previousText: args.operation === "escalate" ? args.previousText : undefined,
            onKeyEvent,
          })
        : undefined;
      const verified = semantic ? verifyGuidelineOutput(candidate, args.subject, semantic) : preliminary;
      latestCompliance = verified.guidelines;
      const failures = failedGuidelineChecks(verified.guidelines);
      const dramaticFailure =
        args.operation === "escalate" && semantic?.meaningfullyMoreDramatic === false
          ? "dramatic-escalation: the revision was not meaningfully more dramatic than the previous version"
          : undefined;
      const modeFailure = deliveryModeFailure(verified.text, args.deliveryMode ?? "direct");
      const accepted = verified.passed && !dramaticFailure && !modeFailure;
      const failureDetails = buildFailureDetails({
        candidate,
        failures,
        semanticNotes: semantic?.notes,
        dramaticFailure,
        modeFailure,
      });
      args.debug.providerInfo("guideline validation completed", {
        operation: args.operation,
        personaId: args.personaId,
        attempt,
        accepted,
        wordCount: verified.guidelines.wordCount,
        failedRuleIds: failures.map((item) => item.id),
        failures: failures.map((item) => ({
          id: item.id,
          source: item.source,
          note: item.note,
          evidence: item.evidence,
        })),
        semanticNotes: semantic?.notes,
        dramaticFailure,
        modeFailure,
        acceptedBaseline: args.operation === "escalate" ? args.previousText : undefined,
        failureDetails,
        baselineText: args.operation === "escalate" ? args.previousText : undefined,
        rejectedCandidate: accepted ? undefined : candidate,
      });

      if (accepted) {
        await captureAiFailure({
          requestId: args.debug.debug.requestId,
          operation: args.operation,
          personaId: args.personaId,
          deliveryMode: args.deliveryMode,
          subject: args.subject,
          attempt,
          maxAttempts,
          outcome: attempt > 1 ? "recovered" : "accepted",
          candidate,
          compliance: verified.guidelines,
          semanticNotes: semantic?.notes,
        });
        return { text: verified.text, guidelines: verified.guidelines };
      }
      const rejectedRuleIds = [
        ...failures.map((item) => item.id),
        ...(dramaticFailure ? ["dramatic-escalation"] : []),
        ...(modeFailure ? ["delivery-mode"] : []),
      ];
      latestRejectedRuleIds = rejectedRuleIds;
      latestFailureDetails = failureDetails;
      latestCandidate = candidate;
      await captureAiFailure({
        requestId: args.debug.debug.requestId,
        operation: args.operation,
        personaId: args.personaId,
        deliveryMode: args.deliveryMode,
        subject: args.subject,
        attempt,
        maxAttempts,
        outcome: "rejected-candidate",
        candidate,
        baselineText: args.operation === "escalate" ? args.previousText : undefined,
        compliance: verified.guidelines,
        failedRuleIds: rejectedRuleIds,
        semanticNotes: semantic?.notes,
        dramaticFailure,
        modeFailure,
        failureDetails,
      });
      if (attempt < maxAttempts) {
        args.onProgress?.({
          attempt,
          maxAttempts,
          phase: "repairing",
          message: `Attempt ${attempt} missed ${rejectedRuleIds.length === 1 ? "1 rule" : `${rejectedRuleIds.length} rules`}. Repairing automatically…`,
          failedRuleIds: rejectedRuleIds,
          failureDetails,
        });
      }
      repair = repairInstruction({
        subject: args.subject,
        acceptedBaseline: args.operation === "escalate" ? args.previousText : undefined,
        rejectedDraft: verified.text,
        guidelines: verified.guidelines,
        extraFailures: [dramaticFailure, modeFailure].filter((item): item is string => Boolean(item)),
      });
    } catch (error) {
      latestProviderError = error;
      args.debug.providerError("guideline generation attempt failed", {
        operation: args.operation,
        personaId: args.personaId,
        attempt,
        error,
      });
      if (isQuotaError(error) || isGuidelineComplianceError(error)) throw error;
      await captureAiFailure({
        requestId: args.debug.debug.requestId,
        operation: args.operation,
        personaId: args.personaId,
        deliveryMode: args.deliveryMode,
        subject: args.subject,
        attempt,
        maxAttempts,
        outcome: "provider-error",
        error,
      });
      if (attempt < maxAttempts) {
        args.onProgress?.({
          attempt,
          maxAttempts,
          phase: "repairing",
          message: `Gemini stumbled on attempt ${attempt}. Retrying automatically…`,
        });
      }
      repair = repairInstruction({ subject: args.subject, schemaFailure: error instanceof Error ? error.message : String(error) });
    }
  }

  if (!latestCandidate && latestProviderError) throw latestProviderError;

  args.debug.providerError("guideline compliance failed closed", {
    operation: args.operation,
    personaId: args.personaId,
    failedRuleIds: latestRejectedRuleIds,
    failureDetails: latestFailureDetails,
    rejectedCandidate: latestCandidate,
    acceptedBaseline: args.operation === "escalate" ? args.previousText : undefined,
  });
  throw new GuidelineComplianceError(
    "This compliment did not clear every Brand Team rule. Try this card again.",
    latestCompliance,
    { failedRuleIds: latestRejectedRuleIds, failureDetails: latestFailureDetails, attemptCount: maxAttempts },
  );
}
