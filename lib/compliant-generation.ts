import type { ModelMessage } from "ai";
import { evaluateGuidelineSemantics, generateGuidelineCandidate, isQuotaError } from "./ai";
import {
  failedGuidelineChecks,
  hasFunctionContext,
  verifyGuidelineOutput,
} from "./compliment-guidelines";
import type { createApiDebug } from "./debug";
import type { DeliveryMode, GuidelineCompliance } from "./types";

type DebugLogger = ReturnType<typeof createApiDebug>;
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

export class GuidelineComplianceError extends Error {
  readonly guidelines?: GuidelineCompliance;

  constructor(message: string, guidelines?: GuidelineCompliance) {
    super(message);
    this.name = "GuidelineComplianceError";
    this.guidelines = guidelines;
  }
}

export function isGuidelineComplianceError(error: unknown): error is GuidelineComplianceError {
  return error instanceof GuidelineComplianceError;
}

function repairInstruction(args: {
  subject: string;
  previousText?: string;
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
      ? '- For made-up-statistic: include a numeral using the exact format "97 percent of ...", then copy that exact phrase into evidence.madeUpStatistic.'
      : undefined,
    failedRuleIds.includes("job-function")
      ? "- For job-function: repeat the supplied title or workplace function verbatim, then quote it exactly in evidence.functionReference."
      : undefined,
    failedRuleIds.includes("max-40-words")
      ? "- For max-40-words: rewrite to 34-38 whitespace-separated words before returning the object."
      : undefined,
  ].filter((item): item is string => Boolean(item));

  return {
    role: "user",
    content: `Your previous attempt did not clear the Company Compliment Guidelines v2.1.
Subject: ${args.subject}
${args.previousText ? `Previous compliment: ${args.previousText}\n` : ""}Fix these failures:
${failures}
${targetedHints.length > 0 ? `\nUse these exact repair instructions:\n${targetedHints.join("\n")}\n` : ""}

Rewrite the compliment. Preserve the requested persona and operation, target 34 to 38 words, and return the complete structured object with fresh exact evidence.
If dramatic-escalation failed, do not merely swap imagery: increase at least two of scale, stakes, impossible consequences, mock ceremony, or emotional intensity, and use a different metaphor category and statistic. Do not explain the correction.`,
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
}): Promise<{ text: string; guidelines: GuidelineCompliance }> {
  if (!hasFunctionContext(args.subject) && args.subject.trim().split(/\s+/).length < 2) {
    throw new GuidelineComplianceError("Add the person's job title or what they do so every compliment can name their function.");
  }

  let repair: ModelMessage | undefined;
  let latestCompliance: GuidelineCompliance | undefined;
  const maxAttempts = args.operation === "escalate" ? 3 : 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
        },
      );
      const preliminary = verifyGuidelineOutput(candidate, args.subject);
      const semantic = failedGuidelineChecks(preliminary.guidelines).length === 0
        ? await evaluateGuidelineSemantics({
            text: preliminary.text,
            jobFunction: args.subject,
            previousText: args.operation === "escalate" ? args.previousText : undefined,
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
      args.debug.providerInfo("guideline validation completed", {
        operation: args.operation,
        personaId: args.personaId,
        attempt,
        accepted: verified.passed && !dramaticFailure && !modeFailure,
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
      });

      if (verified.passed && !dramaticFailure && !modeFailure) {
        return { text: verified.text, guidelines: verified.guidelines };
      }
      repair = repairInstruction({
        subject: args.subject,
        previousText: verified.text,
        guidelines: verified.guidelines,
        extraFailures: [dramaticFailure, modeFailure].filter((item): item is string => Boolean(item)),
      });
    } catch (error) {
      args.debug.providerError("guideline generation attempt failed", {
        operation: args.operation,
        personaId: args.personaId,
        attempt,
        error,
      });
      if (isQuotaError(error) || isGuidelineComplianceError(error)) throw error;
      repair = repairInstruction({ subject: args.subject, schemaFailure: error instanceof Error ? error.message : String(error) });
    }
  }

  args.debug.providerError("guideline compliance failed closed", {
    operation: args.operation,
    personaId: args.personaId,
    failedRuleIds: latestCompliance ? failedGuidelineChecks(latestCompliance).map((item) => item.id) : [],
  });
  throw new GuidelineComplianceError(
    "This compliment did not clear every Brand Team rule. Try this card again.",
    latestCompliance,
  );
}
