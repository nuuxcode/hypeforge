import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, type ModelMessage } from "ai";
import { cleanModelText, validateCompliment } from "./safeText";

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
  const main = process.env.GEMINI_MODEL_MAIN ?? process.env.GEMINI_MODEL_BACKUP ?? "gemini-2.5-flash";
  const backup = process.env.GEMINI_MODEL_BACKUP ?? main;
  return { main, backup };
}

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

export async function generateCompliment(
  messages: ModelMessage[],
  options: { temperature?: number; maxOutputTokens?: number } = {},
): Promise<string> {
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
      providerOptions: {
        google: {
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
    });
    if (result.finishReason === "length") {
      throw new Error("Model output was truncated.");
    }
    const text = cleanModelText(result.text);
    validateCompliment(text);
    return text;
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
