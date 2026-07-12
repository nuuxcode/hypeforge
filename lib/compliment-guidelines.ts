import { z } from "zod";
import { cleanModelText, validateCompliment } from "./safeText";
import type { SemanticEvaluation } from "./ai";
import type {
  GuidelineCompliance,
  GuidelineRuleId,
  RuleCheck,
  RuleCheckSource,
} from "./types";

export const GUIDELINES_VERSION = "2.1" as const;

export const GUIDELINE_RULE_IDS = [
  "no-appearance",
  "job-function",
  "absurd-metaphor",
  "made-up-statistic",
  "max-40-words",
  "no-literally",
  "no-public-figure",
  "workplace-appropriate",
] as const satisfies readonly GuidelineRuleId[];

export type GuidelineRule = {
  id: GuidelineRuleId;
  label: string;
  description: string;
  verification: "code" | "evidence" | "model";
};

export const COMPLIMENT_GUIDELINES: readonly GuidelineRule[] = [
  {
    id: "no-appearance",
    label: "No appearance reference",
    description: "Never reference physical appearance in any way.",
    verification: "model",
  },
  {
    id: "job-function",
    label: "References role or function",
    description: "Reference the person's specific job title or function.",
    verification: "evidence",
  },
  {
    id: "absurd-metaphor",
    label: "Absurd metaphor",
    description: "Include at least one wildly absurd metaphor or comparison.",
    verification: "evidence",
  },
  {
    id: "made-up-statistic",
    label: "Made-up statistic",
    description: "Include one playful, obviously made-up statistic written with a numeral.",
    verification: "evidence",
  },
  {
    id: "max-40-words",
    label: "40 words maximum",
    description: "Use no more than 40 words. Target 34 to 38 words.",
    verification: "code",
  },
  {
    id: "no-literally",
    label: "No banned word",
    description: 'Never use the word "literally".',
    verification: "code",
  },
  {
    id: "no-public-figure",
    label: "No public-figure comparison",
    description: "Never compare the person to a celebrity or any real public figure.",
    verification: "model",
  },
  {
    id: "workplace-appropriate",
    label: "Workplace appropriate",
    description: "Keep the compliment workplace appropriate.",
    verification: "model",
  },
] as const;

const RuleIdSchema = z.enum(GUIDELINE_RULE_IDS);

export const RuleCheckSchema = z.object({
  id: RuleIdSchema,
  label: z.string().min(1).max(100),
  state: z.enum(["pass", "fail", "unverified"]),
  source: z.enum(["code", "evidence", "heuristic", "model"]),
  note: z.string().max(240).optional(),
  evidence: z.string().max(420).optional(),
});

export const GuidelineComplianceSchema = z.object({
  version: z.literal(GUIDELINES_VERSION),
  wordCount: z.number().int().min(1).max(40),
  checks: z
    .array(RuleCheckSchema)
    .length(8)
    .refine(
      (checks) =>
        new Set(checks.map((item) => item.id)).size === GUIDELINE_RULE_IDS.length &&
        GUIDELINE_RULE_IDS.every((id) => checks.some((item) => item.id === id)),
      "Every guideline rule must appear exactly once.",
    ),
  verifiedAt: z.string().min(1).max(50),
});

export const VerifiedGuidelineComplianceSchema = GuidelineComplianceSchema.refine(
  (compliance) => compliance.checks.every((item) => item.state === "pass"),
  "Shared guideline proof must contain eight passing checks.",
);

export const GuidelineModelOutputSchema = z.object({
  text: z.string().min(1),
  satisfiedRuleIds: z.array(RuleIdSchema).min(8).max(8),
  evidence: z.object({
    functionReference: z.string().min(1),
    absurdMetaphor: z.string().min(1),
    madeUpStatistic: z.string().min(1),
  }),
  selfChecks: z.object({
    noAppearance: z.boolean(),
    noPublicFigureComparison: z.boolean(),
    workplaceAppropriate: z.boolean(),
  }),
});

export type GuidelineModelOutput = z.infer<typeof GuidelineModelOutputSchema>;

const FUNCTION_CUE_PATTERN =
  /\b(?:ceo|cto|cfo|coo|vp|hr|human resources|pm|manager|engineer|recruiter|teacher|cleaner|designer|developer|founder|leader|lead|coach|analyst|writer|sales|marketing|support|success|operations|product|finance|researcher|scientist|director|executive|officer|specialist|consultant|coordinator|assistant|administrator|editor|producer|strategist|architect|accountant|lawyer|nurse|doctor|chef|mechanic|technician|intern)\b/i;
const FUNCTION_PHRASE_PATTERN =
  /\b(?:who|that)\s+(?:fix(?:es)?|keep(?:s)?|build(?:s)?|lead(?:s)?|manage(?:s)?|teach(?:es)?|design(?:s)?|develop(?:s)?|support(?:s)?|help(?:s)?|organize(?:s)?|solve(?:s)?|handle(?:s)?|run(?:s)?|create(?:s)?|make(?:s)?|turn(?:s)?|protect(?:s)?|coordinate(?:s)?|coach(?:es)?|care(?:s)?|clean(?:s)?|sell(?:s)?|recruit(?:s)?|write(?:s)?|research(?:es)?)\b/i;
const STOP_WORDS = new Set([
  "about",
  "after",
  "always",
  "every",
  "friend",
  "from",
  "makes",
  "person",
  "their",
  "them",
  "they",
  "this",
  "with",
  "without",
]);
const APPEARANCE_PATTERN =
  /\b(?:beautiful|handsome|pretty|gorgeous|attractive|appearance|looks?|eyes?|hair|skin|face|smile|teeth|lips|body|height|weight|tall|short|slim|curvy|clothes?|clothing|outfit|dress(?:ed)?|stylish|beard|makeup|voice)\b/i;
const PUBLIC_FIGURE_COMPARISON_PATTERN =
  /\b(?:like|as|than|version of|rival(?:s|ing)?|outshines?)\s+(?:the\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/;
const UNSAFE_WORKPLACE_PATTERN =
  /\b(?:fuck|shit|bitch|bastard|sexy|naked|nude|kill|murder|slaughter|racial slur|idiot|moron|worthless)\b/i;
const STATISTIC_PATTERN =
  /(?:\b(?:top\s+)?\d+(?:\.\d+)?(?:\s*%|\s+percent\b)|#\s*\d+|\b\d+\s+(?:out of|in)\s+\d+\b|\b(?:ranked?|rating|score)\s+\d+)/i;

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function containsQuote(text: string, evidence: string): boolean {
  const quote = normalize(evidence);
  return quote.length >= 3 && normalize(text).includes(quote);
}

function subjectTokens(input: string): string[] {
  return input
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

export function hasFunctionContext(input: string): boolean {
  return FUNCTION_CUE_PATTERN.test(input) || FUNCTION_PHRASE_PATTERN.test(input);
}

export function countComplimentWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

export function guidelinePromptBlock(): string {
  return `Company Compliment Style Guidelines, Brand Team, v${GUIDELINES_VERSION}. Follow every rule without exception:\n${COMPLIMENT_GUIDELINES.map(
    (rule, index) => `${index + 1}. ${rule.description}`,
  ).join("\n")}

Return a structured object containing the compliment, all eight satisfied rule IDs, exact quotes from the compliment for the role/function, absurd metaphor, and made-up statistic, plus truthful self-checks for appearance, public-figure comparison, and workplace appropriateness. Evidence must be copied exactly from the compliment.`;
}

function check(args: {
  id: GuidelineRuleId;
  state: RuleCheck["state"];
  source: RuleCheckSource;
  note?: string;
  evidence?: string;
}): RuleCheck {
  const rule = COMPLIMENT_GUIDELINES.find((item) => item.id === args.id)!;
  return { label: rule.label, ...args };
}

export function verifyGuidelineOutput(
  raw: GuidelineModelOutput,
  subject: string,
  semantic?: SemanticEvaluation,
): { text: string; guidelines: GuidelineCompliance; passed: boolean } {
  const text = cleanModelText(raw.text);
  let displaySafe = true;
  try {
    validateCompliment(text);
  } catch {
    displaySafe = false;
  }

  const claimed = new Set(raw.satisfiedRuleIds);
  const wordCount = countComplimentWords(text);
  const functionEvidencePresent = containsQuote(text, raw.evidence.functionReference);
  const groundedTokens = subjectTokens(subject);
  const functionGrounded = groundedTokens.some((token) => normalize(raw.evidence.functionReference).includes(token));
  const subjectHasFunction = hasFunctionContext(subject) || subject.trim().split(/\s+/).length >= 2;
  const metaphorEvidencePresent = containsQuote(text, raw.evidence.absurdMetaphor);
  const statisticEvidencePresent = containsQuote(text, raw.evidence.madeUpStatistic);
  const statisticLooksValid = STATISTIC_PATTERN.test(raw.evidence.madeUpStatistic);
  const appearanceGuardClear = !APPEARANCE_PATTERN.test(text);
  const publicFigureGuardClear = !PUBLIC_FIGURE_COMPARISON_PATTERN.test(text);
  const workplaceGuardClear = !UNSAFE_WORKPLACE_PATTERN.test(text);

  const checks: RuleCheck[] = [
    check({
      id: "no-appearance",
      source: appearanceGuardClear ? "model" : "heuristic",
      state:
        claimed.has("no-appearance") &&
        raw.selfChecks.noAppearance &&
        appearanceGuardClear &&
        semantic?.noAppearanceReference !== false
          ? "pass"
          : "fail",
      note: appearanceGuardClear
        ? semantic
          ? "Independent semantic audit"
          : "Model self-check"
        : "Appearance wording detected",
    }),
    check({
      id: "job-function",
      source: "evidence",
      state:
        claimed.has("job-function") && functionEvidencePresent && functionGrounded && subjectHasFunction
          ? "pass"
          : "fail",
      evidence: raw.evidence.functionReference,
      note: functionGrounded ? "Grounded in the subject" : "Function was not grounded in the subject",
    }),
    check({
      id: "absurd-metaphor",
      source: "evidence",
      state:
        claimed.has("absurd-metaphor") &&
        metaphorEvidencePresent &&
        semantic?.metaphorIsWildlyAbsurd !== false
          ? "pass"
          : "fail",
      evidence: raw.evidence.absurdMetaphor,
    }),
    check({
      id: "made-up-statistic",
      source: statisticLooksValid ? "evidence" : "heuristic",
      state:
        claimed.has("made-up-statistic") && statisticEvidencePresent && statisticLooksValid ? "pass" : "fail",
      evidence: raw.evidence.madeUpStatistic,
      note: statisticLooksValid ? "Fictional numeric statistic detected" : "No statistic pattern detected",
    }),
    check({
      id: "max-40-words",
      source: "code",
      state: wordCount <= 40 ? "pass" : "fail",
      note: `${wordCount} / 40 words`,
    }),
    check({
      id: "no-literally",
      source: "code",
      state: /\bliterally\b/i.test(text) ? "fail" : "pass",
      note: /\bliterally\b/i.test(text) ? 'Banned word "literally" detected' : "Banned word absent",
    }),
    check({
      id: "no-public-figure",
      source: publicFigureGuardClear ? "model" : "heuristic",
      state:
        claimed.has("no-public-figure") &&
        raw.selfChecks.noPublicFigureComparison &&
        publicFigureGuardClear &&
        semantic?.noRealPublicFigureComparison !== false
          ? "pass"
          : "fail",
      note: publicFigureGuardClear
        ? semantic
          ? "Independent semantic audit"
          : "Model self-check"
        : "Real-person comparison pattern detected",
    }),
    check({
      id: "workplace-appropriate",
      source: "model",
      state:
        claimed.has("workplace-appropriate") &&
        raw.selfChecks.workplaceAppropriate &&
        workplaceGuardClear &&
        semantic?.workplaceAppropriate !== false
          ? "pass"
          : "fail",
      note: workplaceGuardClear
        ? semantic
          ? "Independent semantic audit"
          : "Model self-check"
        : "Unsafe workplace wording detected",
    }),
  ];

  const guidelines: GuidelineCompliance = {
    version: GUIDELINES_VERSION,
    wordCount,
    checks,
    verifiedAt: new Date().toISOString(),
  };
  return { text, guidelines, passed: displaySafe && checks.every((item) => item.state === "pass") };
}

export function failedGuidelineChecks(compliance: GuidelineCompliance): RuleCheck[] {
  return compliance.checks.filter((item) => item.state !== "pass");
}
