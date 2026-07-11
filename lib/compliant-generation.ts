import type { ModelMessage } from "ai";
import { generateGuidelineCandidate, isQuotaError } from "./ai";
import {
  failedGuidelineChecks,
  hasFunctionContext,
  verifyGuidelineOutput,
} from "./compliment-guidelines";
import type { createApiDebug } from "./debug";
import type { GuidelineCompliance } from "./types";

type DebugLogger = ReturnType<typeof createApiDebug>;

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
}): ModelMessage {
  const failures = args.guidelines
    ? failedGuidelineChecks(args.guidelines)
        .map((item) => `- ${item.id}: ${item.note ?? "rule did not pass"}`)
        .join("\n")
    : `- structured-output: ${args.schemaFailure ?? "return valid structured output"}`;

  return {
    role: "user",
    content: `Your previous attempt did not clear the Company Compliment Guidelines v2.1.
Subject: ${args.subject}
${args.previousText ? `Previous compliment: ${args.previousText}\n` : ""}Fix these failures:
${failures}

Rewrite the compliment. Preserve the requested persona and operation, target 34 to 38 words, and return the complete structured object with fresh exact evidence. Do not explain the correction.`,
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
}): Promise<{ text: string; guidelines: GuidelineCompliance }> {
  if (!hasFunctionContext(args.subject)) {
    throw new GuidelineComplianceError("Add the person's job title or what they do so every compliment can name their function.");
  }

  let repair: ModelMessage | undefined;
  let latestCompliance: GuidelineCompliance | undefined;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    args.debug.providerInfo("guideline generation attempt started", {
      operation: args.operation,
      personaId: args.personaId,
      attempt,
      repaired: attempt > 1,
    });
    try {
      const candidate = await generateGuidelineCandidate(
        repair ? [...args.messages, repair] : args.messages,
        { temperature: args.temperature, maxOutputTokens: args.maxOutputTokens },
      );
      const verified = verifyGuidelineOutput(candidate, args.subject);
      latestCompliance = verified.guidelines;
      const failures = failedGuidelineChecks(verified.guidelines);
      args.debug.providerInfo("guideline validation completed", {
        operation: args.operation,
        personaId: args.personaId,
        attempt,
        accepted: verified.passed,
        wordCount: verified.guidelines.wordCount,
        failedRuleIds: failures.map((item) => item.id),
        failures: failures.map((item) => ({
          id: item.id,
          source: item.source,
          note: item.note,
          evidence: item.evidence,
        })),
      });

      if (verified.passed) return { text: verified.text, guidelines: verified.guidelines };
      repair = repairInstruction({
        subject: args.subject,
        previousText: verified.text,
        guidelines: verified.guidelines,
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
