import { z } from "zod";
import { MAX_COMPLIMENT_LENGTH } from "./safeText";
import type { SoftPreferenceContext } from "./types";

export const MIN_INPUT_LENGTH = 3;
export const MAX_INPUT_LENGTH = 360;
export const MAX_HISTORY_ITEMS = 10;

const INJECTION_PATTERNS = [
  /\bignore (all )?(previous|prior|above) instructions?\b/i,
  /\breveal (the )?(system|developer|hidden) (prompt|instructions?)\b/i,
  /\bprint (the )?(system|developer|hidden) (prompt|instructions?)\b/i,
  /\bjailbreak\b/i,
  /\bapi[_ -]?key\b/i,
];

export const GenerateBodySchema = z.object({
  input: z.string(),
  preference: z
    .object({
      liked: z.array(z.string().max(180)).max(3).default([]),
      disliked: z.array(z.string().max(180)).max(3).default([]),
    })
    .optional(),
});

export const EscalateBodySchema = z.object({
  personaId: z.string().min(1),
  originalInput: z.string(),
  currentText: z.string().min(1).max(MAX_COMPLIMENT_LENGTH),
  history: z.array(z.string().min(1).max(MAX_COMPLIMENT_LENGTH)).min(1).max(MAX_HISTORY_ITEMS),
  dramaLevel: z.number().int().min(1).max(20),
});

export const RetryBodySchema = z.object({
  personaId: z.string().min(1),
  originalInput: z.string(),
});

export const TweakBodySchema = z.object({
  personaId: z.string().min(1),
  originalInput: z.string(),
  currentText: z.string().min(1).max(MAX_COMPLIMENT_LENGTH),
  history: z.array(z.string().min(1).max(MAX_COMPLIMENT_LENGTH)).min(1).max(MAX_HISTORY_ITEMS),
  dramaLevel: z.number().int().min(1).max(20),
  feedback: z.string().min(3).max(240),
});

export function sanitizeInput(value: string): string {
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("Give me a job title or person details first.");
  }
  if (normalized.length < MIN_INPUT_LENGTH) {
    throw new Error("Give me a job title or person details first.");
  }
  if (normalized.length > MAX_INPUT_LENGTH) {
    throw new Error("That is a lot of greatness. Try a shorter version.");
  }
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new Error("That looks more like instructions than a person. Try a name, role, or short description.");
  }
  return normalized;
}

export function cleanHistory(history: string[]): string[] {
  return history.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean).slice(-MAX_HISTORY_ITEMS);
}

export function appendHistory(history: string[], nextText: string): string[] {
  return [...cleanHistory(history), nextText.replace(/\s+/g, " ").trim()].filter(Boolean).slice(-MAX_HISTORY_ITEMS);
}

export function cleanPreferenceContext(value: SoftPreferenceContext | undefined): SoftPreferenceContext {
  const clean = (items: string[]) =>
    items
      .map((item) => item.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180))
      .filter((item) => item.length >= 12 && !INJECTION_PATTERNS.some((pattern) => pattern.test(item)))
      .slice(0, 3);

  return { liked: clean(value?.liked ?? []), disliked: clean(value?.disliked ?? []) };
}

export function sanitizeTweakFeedback(value: string): string {
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length < 3) throw new Error("Tell the forge what to change first.");
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new Error("Describe the compliment change instead of giving the forge instructions.");
  }
  return normalized;
}
