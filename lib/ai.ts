import "./zod-config";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, NoObjectGeneratedError, Output, type ModelMessage } from "ai";
import { z } from "zod";
import { GuidelineModelOutputSchema, type GuidelineModelOutput } from "./compliment-guidelines";
import type { ModelSelection } from "./models";
import {
  classifyGeminiFailure,
  runWithGeminiKey,
  type GeminiKeyPoolEvent,
  type GeminiKeyPoolEventHandler,
} from "./gemini-key-pool";

function getModelIds(selection?: ModelSelection) {
  const main = selection?.main ?? process.env.GEMINI_MODEL_MAIN ?? process.env.GEMINI_MODEL_BACKUP ?? "gemini-3.1-flash-lite";
  const backup = selection?.backup ?? process.env.GEMINI_MODEL_BACKUP ?? main;
  return { main, backup };
}

const MODEL_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 25_000);

export const SemanticEvaluationSchema = z.object({
  noAppearanceReference: z.boolean(),
  metaphorIsWildlyAbsurd: z.boolean(),
  // Optional for provider resilience: deterministic KPI guards still run when
  // a model omits this newer opinion field from an otherwise valid audit.
  statisticIsClearlyFictional: z.boolean().optional(),
  noRealPublicFigureComparison: z.boolean(),
  workplaceAppropriate: z.boolean(),
  meaningfullyMoreDramatic: z.boolean(),
  notes: z.array(z.string().min(1).max(160)).max(8),
});

export type SemanticEvaluation = z.infer<typeof SemanticEvaluationSchema>;

export const DeckSemanticEvaluationSchema = z.object({
  genuinelyDifferent: z.boolean(),
  personaVoicesDistinct: z.boolean(),
  humorouslyVaried: z.boolean(),
  repairPersonaId: z.string().min(1).optional(),
  issues: z.array(z.object({
    category: z.enum(["imagery-overlap", "voice-drift", "humor-overlap", "opening-overlap", "other"]),
    personaIds: z.array(z.string().min(1)).max(2),
    reason: z.string().min(1).max(180),
  })).max(5),
});

export type DeckSemanticEvaluation = z.infer<typeof DeckSemanticEvaluationSchema>;

function splitSystemMessages(messages: ModelMessage[]): {
  system?: string;
  messages: ModelMessage[];
} {
  const system = messages
    .filter((message) => message.role === "system" && typeof message.content === "string")
    .map((message) => message.content)
    .join("\n\n");

  return {
    system: system || undefined,
    messages: messages.filter((message) => message.role !== "system"),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function modelErrorDetails(error: unknown): Record<string, unknown> {
  if (NoObjectGeneratedError.isInstance(error)) {
    return {
      name: error.name,
      message: error.message,
      finishReason: error.finishReason,
      rawOutput: error.text,
      usage: error.usage,
      response: error.response,
      cause: error.cause instanceof Error
        ? { name: error.cause.name, message: error.cause.message }
        : error.cause,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: error.cause instanceof Error
        ? { name: error.cause.name, message: error.cause.message }
        : error.cause,
    };
  }
  return { value: String(error) };
}

export function isQuotaError(error: unknown): boolean {
  return classifyGeminiFailure(error) === "quota";
}

export function providerErrorMessage(error: unknown): string {
  const message = errorMessage(error);
  if (/GEMINI_API_KEY|not set|missing/i.test(message)) {
    return "Server configuration is missing.";
  }
  if (classifyGeminiFailure(error) === "credentials") {
    return "Gemini rejected the configured API keys. Check the server key configuration.";
  }
  if (isQuotaError(error)) {
    return "Gemini has reached its current quota. Wait a moment, then try again.";
  }
  if (/timeout|timed out|aborted|AbortError/i.test(message)) {
    return "Gemini took too long to answer. Try again in a moment.";
  }
  return "The compliment engine got overwhelmed by your brilliance. Try again.";
}

function reportKeyPoolEvent(event: GeminiKeyPoolEvent, listener?: GeminiKeyPoolEventHandler) {
  listener?.(event);
  if (event.type === "failure") {
    console.warn(
      `[gemini-key-pool] ${event.reason} on key ${event.keySlot}/${event.keyCount} (${event.keyName}); consecutive failures: ${event.consecutiveFailures}/3${event.rotatesNow ? "; rotating" : ""}`,
    );
    return;
  }
  if (event.type === "rotation") {
    console.warn(
      `[gemini-key-pool] switched from key ${event.keySlot}/${event.keyCount} (${event.keyName}) to key ${event.nextKeySlot}/${event.keyCount} (${event.nextKeyName})`,
    );
    return;
  }
  console.info(`[gemini-key-pool] request recovered on key ${event.keySlot}/${event.keyCount} (${event.keyName})`);
}

function combinedModelError(args: {
  mainModel: string;
  mainError: unknown;
  backupModel?: string;
  backupError?: unknown;
}) {
  const message = args.backupError
    ? `Gemini main ${args.mainModel} failed: ${errorMessage(args.mainError)}; Gemini backup ${args.backupModel} failed: ${errorMessage(args.backupError)}`
    : `Gemini model ${args.mainModel} failed: ${errorMessage(args.mainError)}`;
  const error = new Error(message);
  Object.assign(error, {
    mainModel: args.mainModel,
    mainError: errorMessage(args.mainError),
    mainDetails: modelErrorDetails(args.mainError),
    backupModel: args.backupModel,
    backupError: args.backupError ? errorMessage(args.backupError) : undefined,
    backupDetails: args.backupError ? modelErrorDetails(args.backupError) : undefined,
  });
  return error;
}

export async function generateGuidelineCandidate(
  messages: ModelMessage[],
  options: { temperature?: number; maxOutputTokens?: number; onKeyEvent?: GeminiKeyPoolEventHandler; models?: ModelSelection } = {},
): Promise<GuidelineModelOutput> {
  const { main, backup } = getModelIds(options.models);
  const prompt = splitSystemMessages(messages);

  const tryModel = (modelId: string) => runWithGeminiKey(
    async (apiKey) => {
      const google = createGoogleGenerativeAI({ apiKey });
      const result = await generateText({
        model: google(modelId),
        system: prompt.system,
        messages: prompt.messages,
        temperature: options.temperature ?? 1,
        maxOutputTokens: options.maxOutputTokens ?? 260,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
        providerOptions: {
          google: {
            thinkingConfig: { thinkingBudget: 0 },
          },
        },
        output: Output.object({
          schema: GuidelineModelOutputSchema,
          name: "company_compliment",
          description: "A guideline-compliant workplace compliment with exact rule evidence.",
        }),
      });
      if (result.finishReason === "length") {
        throw new Error("Model output was truncated.");
      }
      if (!result.output) throw new Error("Model returned no structured compliment output.");
      return result.output;
    },
    (event) => reportKeyPoolEvent(event, options.onKeyEvent),
  );

  try {
    return await tryModel(main);
  } catch (error) {
    console.error(`[compliment-model] Gemini main ${main}`, errorMessage(error));
    if (main === backup) throw combinedModelError({ mainModel: main, mainError: error });
    try {
      return await tryModel(backup);
    } catch (backupError) {
      console.error(`[compliment-model] Gemini backup ${backup}`, errorMessage(backupError));
      throw combinedModelError({
        mainModel: main,
        mainError: error,
        backupModel: backup,
        backupError,
      });
    }
  }
}

export async function evaluateGuidelineSemantics(args: {
  text: string;
  jobFunction: string;
  previousText?: string;
  onKeyEvent?: GeminiKeyPoolEventHandler;
  models?: ModelSelection;
}): Promise<SemanticEvaluation> {
  const { main, backup } = getModelIds(args.models);
  const validator = args.models?.validator ?? process.env.GEMINI_MODEL_VALIDATOR ?? main;
  const prompt = `Audit one workplace compliment against Company Guidelines v2.1.
Return only the structured evaluation. Be conservative: a rule passes only when clearly satisfied.
Do not provide chain-of-thought. Put only short, outcome-focused reasons in notes.

Job/function data: ${JSON.stringify(args.jobFunction)}
Compliment: ${JSON.stringify(args.text)}
${args.previousText ? `Previous version: ${JSON.stringify(args.previousText)}\nAlso decide whether the new compliment is clearly and meaningfully more dramatic, not merely reworded.` : ""}

Set meaningfullyMoreDramatic to true when no previous version is supplied because that comparison is not applicable.

Check for direct or indirect physical appearance references; whether the supplied metaphor is genuinely wildly absurd and connected to the work; whether the numeric claim is unmistakably playful and fictional rather than a plausible real performance claim; direct or indirect comparison to any real public figure; and workplace appropriateness including no sexual, profane, discriminatory, humiliating, threatening, or graphic content.`;

  const tryModel = (modelId: string) => runWithGeminiKey(
    async (apiKey) => {
      const google = createGoogleGenerativeAI({ apiKey });
      const result = await generateText({
        model: google(modelId),
        prompt,
        temperature: 0,
        // The audit has six decisions plus concise notes. A 220-token cap was
        // intermittently truncating otherwise valid structured responses.
        maxOutputTokens: 360,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
        providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
        output: Output.object({
          schema: SemanticEvaluationSchema,
          name: "compliment_guideline_audit",
          description: "An independent semantic audit of one workplace compliment.",
        }),
      });
      if (!result.output) throw new Error("Validator returned no structured evaluation.");
      return result.output;
    },
    (event) => reportKeyPoolEvent(event, args.onKeyEvent),
  );

  try {
    return await tryModel(validator);
  } catch (error) {
    const fallback = backup === validator ? main : backup;
    if (fallback === validator) throw combinedModelError({ mainModel: validator, mainError: error });
    try {
      return await tryModel(fallback);
    } catch (backupError) {
      throw combinedModelError({
        mainModel: validator,
        mainError: error,
        backupModel: fallback,
        backupError,
      });
    }
  }
}

/**
 * Audits the deck as one product result. Per-card validation answers "is this
 * compliment allowed?"; this single cross-card call answers "are these three
 * actually different, recognizably voiced, and funny in different ways?".
 */
export async function evaluateDeckSemantics(args: {
  cards: Array<{
    personaId: string;
    personaName: string;
    voice: string;
    imageryDomain: string;
    text: string;
  }>;
  onKeyEvent?: GeminiKeyPoolEventHandler;
  models?: ModelSelection;
}): Promise<DeckSemanticEvaluation> {
  const { main, backup } = getModelIds(args.models);
  const validator = args.models?.validator ?? process.env.GEMINI_MODEL_VALIDATOR ?? main;
  const prompt = `Audit a three-card workplace compliment deck as one result.
Return only the structured evaluation. Do not provide chain-of-thought.

The cards must satisfy all of these cross-card standards:
1. Genuinely different: not paraphrases and not the same central metaphor or imagery domain with different nouns.
2. Persona voices distinct: each card clearly sounds like its named persona and assigned imagery lane.
3. Humorously varied: the joke mechanism or comic framing differs across the three cards, while all remain warm and workplace appropriate.

Be strict about semantic sameness. Three cards about stars, planets, cosmic forces, reality, or the universe are one imagery domain even when their wording differs. Likewise, three ceremonial awards or three sports records are not varied enough.

Every card is required to mention a role, use an absurd comparison, and include a made-up statistic. Do not flag those mandatory ingredients, numeric wording by itself, or normal praise language as overlap. Flag only shared creative concepts, imagery worlds, openings, persona drift, or genuinely repeated joke mechanisms.

When the deck fails, choose exactly one repairPersonaId and return concise issues naming the relevant persona IDs. Omit repairPersonaId and return no issues when all three standards pass.

Cards:
${JSON.stringify(args.cards, null, 2)}`;

  const tryModel = (modelId: string) => runWithGeminiKey(
    async (apiKey) => {
      const google = createGoogleGenerativeAI({ apiKey });
      const result = await generateText({
        model: google(modelId),
        prompt,
        temperature: 0,
        maxOutputTokens: 760,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
        providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
        output: Output.object({
          schema: DeckSemanticEvaluationSchema,
          name: "compliment_deck_semantic_audit",
          description: "A cross-card audit of semantic variety, persona separation, and humor style.",
        }),
      });
      if (!result.output) throw new Error("Deck validator returned no structured evaluation.");
      return result.output;
    },
    (event) => reportKeyPoolEvent(event, args.onKeyEvent),
  );

  try {
    return await tryModel(validator);
  } catch (error) {
    const fallback = backup === validator ? main : backup;
    if (fallback === validator) throw combinedModelError({ mainModel: validator, mainError: error });
    try {
      return await tryModel(fallback);
    } catch (backupError) {
      throw combinedModelError({
        mainModel: validator,
        mainError: error,
        backupModel: fallback,
        backupError,
      });
    }
  }
}
