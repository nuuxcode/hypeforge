export const GEMINI_MODEL_IDS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
] as const;

export type GeminiModelId = (typeof GEMINI_MODEL_IDS)[number];

export const GEMINI_MODEL_OPTIONS: ReadonlyArray<{ id: GeminiModelId; label: string }> = [
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite (default, fastest)" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (newest flash)" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview (strongest, slower)" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

export type ModelSelection = {
  main?: GeminiModelId;
  backup?: GeminiModelId;
  validator?: GeminiModelId;
};

const MODEL_ID_SET = new Set<string>(GEMINI_MODEL_IDS);

function allowlistedId(value: unknown): GeminiModelId | undefined {
  return typeof value === "string" && MODEL_ID_SET.has(value) ? (value as GeminiModelId) : undefined;
}

// Keeps only allowlisted ids so an unexpected value from storage or a request
// body can never reach the provider. Used server-side on top of Zod.
export function sanitizeModelSelection(value: unknown): ModelSelection {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const selection: ModelSelection = {};
  const main = allowlistedId(record.main);
  const backup = allowlistedId(record.backup);
  const validator = allowlistedId(record.validator);
  if (main) selection.main = main;
  if (backup) selection.backup = backup;
  if (validator) selection.validator = validator;
  return selection;
}
