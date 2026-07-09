import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, type ModelMessage } from "ai";
import { cleanModelText, validateCompliment } from "./safeText";

let googleClient: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getGoogleClient() {
  if (googleClient) return googleClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
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
    console.error("[main-compliment-model]", (error as Error).message);
    if (main === backup) throw error;
    return tryModel(backup);
  }
}
