import {
  COMPLIMENT_GUIDELINES,
  GUIDELINES_VERSION,
  type GuidelineModelOutput,
} from "@/lib/compliment-guidelines";
import type { GuidelineCompliance } from "@/lib/types";

export const COMPLIANT_TEXT =
  "Customer Success Manager, you are a cosmic air-traffic controller for client chaos, resolving 99.7% of impossible requests before coffee cools and turning every support queue into a perfectly choreographed victory parade across three time zones without disturbing spreadsheets.";

export const COMPLIANT_MODEL_OUTPUT: GuidelineModelOutput = {
  text: COMPLIANT_TEXT,
  satisfiedRuleIds: COMPLIMENT_GUIDELINES.map((rule) => rule.id),
  evidence: {
    functionReference: "Customer Success Manager",
    absurdMetaphor: "a cosmic air-traffic controller for client chaos",
    madeUpStatistic: "99.7% of impossible requests",
  },
  selfChecks: {
    noAppearance: true,
    noPublicFigureComparison: true,
    workplaceAppropriate: true,
  },
};

export const COMPLIANT_GUIDELINES: GuidelineCompliance = {
  version: GUIDELINES_VERSION,
  wordCount: 38,
  verifiedAt: "2026-07-11T20:00:00.000Z",
  checks: COMPLIMENT_GUIDELINES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    state: "pass" as const,
    source:
      rule.verification === "code" ? ("code" as const) : rule.verification === "evidence" ? ("evidence" as const) : ("model" as const),
  })),
};

export const COMPLIANT_RESULT = {
  text: COMPLIANT_TEXT,
  guidelines: COMPLIANT_GUIDELINES,
};
