import "./zod-config";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output, type ModelMessage } from "ai";
import { z } from "zod";
import { GuidelineModelOutputSchema, type GuidelineModelOutput } from "./compliment-guidelines";

let googleClient: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getGoogleClient() {
  if (googleClient) return googleClient;
  // HYPEFORGE_GEMINI_API_KEY wins so a GEMINI_API_KEY exported in the shell
  // (e.g. ~/.zshrc) cannot shadow the key configured in .env.local.
  const apiKey = process.env.HYPEFORGE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("HYPEFORGE_GEMINI_API_KEY / GEMINI_API_KEY is not set.");
  }
  googleClient = createGoogleGenerativeAI({ apiKey });
  return googleClient;
}

function getModelIds() {
  const main = process.env.GEMINI_MODEL_MAIN ?? process.env.GEMINI_MODEL_BACKUP ?? "gemini-3.1-flash-lite";
  const backup = process.env.GEMINI_MODEL_BACKUP ?? main;
  return { main, backup };
}

const MODEL_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 25_000);

export const SemanticEvaluationSchema = z.object({
  noAppearanceReference: z.boolean(),
  metaphorIsWildlyAbsurd: z.boolean(),
  noRealPublicFigureComparison: z.boolean(),
  workplaceAppropriate: z.boolean(),
  meaningfullyMoreDramatic: z.boolean(),
  notes: z.array(z.string().min(1).max(160)).max(5),
});

export type SemanticEvaluation = z.infer<typeof SemanticEvaluationSchema>;

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

export function isQuotaError(error: unknown): boolean {
  return /quota|RESOURCE_EXHAUSTED|429|rate.?limit/i.test(errorMessage(error));
}

export function providerErrorMessage(error: unknown): string {
  const message = errorMessage(error);
  if (/GEMINI_API_KEY|not set|missing/i.test(message)) {
    return "Server configuration is missing.";
  }
  if (isQuotaError(error)) {
    return "Gemini has reached its current quota. Wait a moment, then try again.";
  }
  if (/timeout|timed out|aborted|AbortError/i.test(message)) {
    return "Gemini took too long to answer. Try again in a moment.";
  }
  return "The compliment engine got overwhelmed by your brilliance. Try again.";
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
    backupModel: args.backupModel,
    backupError: args.backupError ? errorMessage(args.backupError) : undefined,
  });
  return error;
}

export async function generateGuidelineCandidate(
  messages: ModelMessage[],
  options: { temperature?: number; maxOutputTokens?: number } = {},
): Promise<GuidelineModelOutput> {
  const google = getGoogleClient();
  const { main, backup } = getModelIds();
  const prompt = splitSystemMessages(messages);

  const tryModel = async (modelId: string) => {
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
  };

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
}): Promise<SemanticEvaluation> {
  const google = getGoogleClient();
  const { main, backup } = getModelIds();
  const validator = process.env.GEMINI_MODEL_VALIDATOR ?? main;
  const prompt = `Audit one workplace compliment against Company Guidelines v2.1.
Return only the structured evaluation. Be conservative: a rule passes only when clearly satisfied.
Do not provide chain-of-thought. Put only short, outcome-focused reasons in notes.

Job/function data: ${JSON.stringify(args.jobFunction)}
Compliment: ${JSON.stringify(args.text)}
${args.previousText ? `Previous version: ${JSON.stringify(args.previousText)}\nAlso decide whether the new compliment is clearly and meaningfully more dramatic, not merely reworded.` : ""}

Set meaningfullyMoreDramatic to true when no previous version is supplied because that comparison is not applicable.

Check for direct or indirect physical appearance references; whether the supplied metaphor is genuinely wildly absurd and connected to the work; direct or indirect comparison to any real public figure; and workplace appropriateness including no sexual, profane, discriminatory, humiliating, threatening, or graphic content.`;

  const tryModel = async (modelId: string) => {
    const result = await generateText({
      model: google(modelId),
      prompt,
      temperature: 0,
      maxOutputTokens: 220,
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
  };

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
