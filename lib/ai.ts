import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type ModelMessage } from "ai";
import { cleanModelText, validateCompliment } from "./safeText";

let googleClient: ReturnType<typeof createGoogleGenerativeAI> | null = null;
let openaiClient: ReturnType<typeof createOpenAI> | null = null;

type ProviderAttempt = {
  provider: "gemini" | "openai";
  modelId: string;
  label: string;
};

function getGoogleClient() {
  if (googleClient) return googleClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  googleClient = createGoogleGenerativeAI({ apiKey });
  return googleClient;
}

function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  openaiClient = createOpenAI({ apiKey });
  return openaiClient;
}

function getModelIds() {
  const main = process.env.GEMINI_MODEL_MAIN ?? process.env.GEMINI_MODEL_BACKUP ?? "gemini-2.5-flash";
  const backup = process.env.GEMINI_MODEL_BACKUP ?? main;
  return { main, backup };
}

function getProviderAttempts(): ProviderAttempt[] {
  const attempts: ProviderAttempt[] = [];
  const gemini = getModelIds();
  if (process.env.GEMINI_API_KEY) {
    attempts.push({ provider: "gemini", modelId: gemini.main, label: `Gemini main ${gemini.main}` });
    if (gemini.backup !== gemini.main) {
      attempts.push({ provider: "gemini", modelId: gemini.backup, label: `Gemini backup ${gemini.backup}` });
    }
  }
  if (process.env.OPENAI_API_KEY) {
    const modelId = process.env.OPENAI_MODEL_MAIN ?? "gpt-4.1-mini";
    attempts.push({ provider: "openai", modelId, label: `OpenAI ${modelId}` });
  }
  if (attempts.length === 0) {
    throw new Error("No LLM API key is set. Add GEMINI_API_KEY or OPENAI_API_KEY.");
  }
  return attempts;
}

function getModel(attempt: ProviderAttempt) {
  if (attempt.provider === "gemini") return getGoogleClient()(attempt.modelId);
  return getOpenAIClient()(attempt.modelId);
}

function providerOptions(attempt: ProviderAttempt) {
  if (attempt.provider !== "gemini") return undefined;
  return {
    google: {
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
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

export function providerErrorMessage(error: unknown): string {
  const message = errorMessage(error);
  if (/No LLM API key/i.test(message)) {
    return "Server configuration is missing.";
  }
  return "The compliment engine got overwhelmed by your brilliance. Try again.";
}

async function tryProviderAttempts<T>(context: string, run: (attempt: ProviderAttempt) => Promise<T>): Promise<T> {
  const failures: Array<{ label: string; provider: ProviderAttempt["provider"]; modelId: string; error: string }> = [];
  for (const attempt of getProviderAttempts()) {
    try {
      return await run(attempt);
    } catch (error) {
      const message = errorMessage(error);
      console.error(`[${context}] ${attempt.label}`, message);
      failures.push({
        label: attempt.label,
        provider: attempt.provider,
        modelId: attempt.modelId,
        error: message,
      });
    }
  }

  const message = failures.map((failure) => `${failure.label} failed: ${failure.error}`).join("; ");
  const error = new Error(message);
  Object.assign(error, { failures });
  throw error;
}

export async function generateCompliment(
  messages: ModelMessage[],
  options: { temperature?: number; maxOutputTokens?: number } = {},
): Promise<string> {
  const prompt = splitSystemMessages(messages);

  return tryProviderAttempts("compliment-model", async (attempt) => {
    const result = await generateText({
      model: getModel(attempt),
      system: prompt.system,
      messages: prompt.messages,
      temperature: options.temperature ?? 1,
      maxOutputTokens: options.maxOutputTokens ?? 260,
      maxRetries: 0,
      providerOptions: providerOptions(attempt),
    });
    if (result.finishReason === "length") {
      throw new Error("Model output was truncated.");
    }
    const text = cleanModelText(result.text);
    validateCompliment(text);
    return text;
  });
}
