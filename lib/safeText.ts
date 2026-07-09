const LEAK_PATTERNS = [
  /system prompt/i,
  /developer message/i,
  /these instructions/i,
  /as an ai/i,
  /api key/i,
  /gemini/i,
  /language model/i,
];

export const MAX_COMPLIMENT_LENGTH = 420;

export function cleanModelText(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateCompliment(text: string): void {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (text.length < 24) {
    throw new Error("The compliment came back too short to display.");
  }
  if (wordCount < 10) {
    throw new Error("The compliment came back too short to display.");
  }
  if (text.length > MAX_COMPLIMENT_LENGTH) {
    throw new Error("The compliment came back too long to display.");
  }
  if (!/[.!?]$/.test(text)) {
    throw new Error("The compliment came back too chaotic to display.");
  }
  if (LEAK_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error("The compliment came back too chaotic to display.");
  }
}
