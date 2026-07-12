import { z } from "zod";
import { MAX_COMPLIMENT_LENGTH } from "./safeText";
import { hasFunctionContext, VerifiedGuidelineComplianceSchema } from "./compliment-guidelines";
import type { SoftPreferenceContext } from "./types";

export const MIN_INPUT_LENGTH = 3;
export const MAX_INPUT_LENGTH = 360;
export const MAX_DETAILS_LENGTH = 240;
export const MAX_HISTORY_ITEMS = 10;

const INJECTION_PATTERNS = [
  /\bignore (all )?(previous|prior|above) instructions?\b/i,
  /\breveal (the )?(system|developer|hidden) (prompt|instructions?)\b/i,
  /\bprint (the )?(system|developer|hidden) (prompt|instructions?)\b/i,
  /\bjailbreak\b/i,
  /\bapi[_ -]?key\b/i,
  /\buse the word literally\b/i,
  /\bcompare (?:me|them|the person) to (?:a )?(?:famous|celebrity|public figure)\b/i,
  /\bwrite \d+ words?\b/i,
  /\bmention (?:my|their|the person'?s) appearance\b/i,
  /\breturn html\b/i,
  /\bexpose (?:your|the) prompt\b/i,
];

export const GenerateBodySchema = z.object({
  input: z.string().optional(),
  jobFunction: z.string().optional(),
  personDetails: z.string().max(MAX_DETAILS_LENGTH).optional(),
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
  jobFunction: z.string().optional(),
  personDetails: z.string().max(MAX_DETAILS_LENGTH).optional(),
  currentText: z.string().min(1).max(MAX_COMPLIMENT_LENGTH),
  history: z.array(z.string().min(1).max(MAX_COMPLIMENT_LENGTH)).min(1).max(MAX_HISTORY_ITEMS),
  dramaLevel: z.number().int().min(1).max(20),
});

export const RetryBodySchema = z.object({
  personaId: z.string().min(1),
  originalInput: z.string(),
  jobFunction: z.string().optional(),
  personDetails: z.string().max(MAX_DETAILS_LENGTH).optional(),
});

export const TweakBodySchema = z.object({
  personaId: z.string().min(1),
  originalInput: z.string(),
  jobFunction: z.string().optional(),
  personDetails: z.string().max(MAX_DETAILS_LENGTH).optional(),
  currentText: z.string().min(1).max(MAX_COMPLIMENT_LENGTH),
  history: z.array(z.string().min(1).max(MAX_COMPLIMENT_LENGTH)).min(1).max(MAX_HISTORY_ITEMS),
  dramaLevel: z.number().int().min(1).max(20),
  feedback: z.string().min(3).max(240),
});

export const ShareDeckBodySchema = z.object({
  input: z.string().min(MIN_INPUT_LENGTH).max(MAX_INPUT_LENGTH),
  jobFunction: z.string().min(MIN_INPUT_LENGTH).max(MAX_INPUT_LENGTH).optional(),
  personDetails: z.string().max(MAX_DETAILS_LENGTH).optional(),
  cards: z
    .array(
      z.object({
        personaId: z.string().min(1).max(80),
        personaName: z.string().min(1).max(100),
        text: z.string().min(24).max(MAX_COMPLIMENT_LENGTH),
        dramaLevel: z.number().int().min(1).max(20),
        originalInput: z.string().max(MAX_INPUT_LENGTH),
        jobFunction: z.string().min(MIN_INPUT_LENGTH).max(MAX_INPUT_LENGTH).optional(),
        personDetails: z.string().max(MAX_DETAILS_LENGTH).optional(),
        guidelines: VerifiedGuidelineComplianceSchema.optional(),
      }),
    )
    .min(1)
    .max(3),
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
  if (!hasFunctionContext(normalized)) {
    throw new Error("Add the person's job title or what they do so every compliment can name their function.");
  }
  return normalized;
}

export function sanitizeJobFunction(value: string): string {
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length < MIN_INPUT_LENGTH) {
    throw new Error("Give me a job title or workplace function first.");
  }
  if (normalized.length > MAX_INPUT_LENGTH) {
    throw new Error("That is a lot of greatness. Try a shorter job or function.");
  }
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new Error("That looks more like instructions than a workplace function.");
  }
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!hasFunctionContext(normalized) && words.length < 2) {
    throw new Error("Add a clear job title or describe what the person does at work.");
  }
  return normalized;
}

export function sanitizePersonDetails(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  if (normalized.length > MAX_DETAILS_LENGTH) {
    throw new Error("Keep the optional details under 240 characters.");
  }
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new Error("That looks more like instructions than person details. Describe a real win or quality instead.");
  }
  return normalized;
}

export function resolveSubject(args: {
  jobFunction?: string;
  personDetails?: string;
  legacyInput?: string;
}): { jobFunction: string; personDetails?: string; displayInput: string } {
  const jobFunction = args.jobFunction
    ? sanitizeJobFunction(args.jobFunction)
    : sanitizeInput(args.legacyInput ?? "");
  const personDetails = sanitizePersonDetails(args.personDetails);
  return {
    jobFunction,
    personDetails,
    displayInput: personDetails ? `${jobFunction} - ${personDetails}` : jobFunction,
  };
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
