export type CardStatus = "idle" | "loading" | "error";
export type CardPendingAction = "escalate" | "retry" | "tweak";
export type EscalationProgressPhase = "generating" | "checking" | "repairing";

export type PipelineFailureDetail = {
  ruleId: string;
  label: string;
  reason: string;
  location: "missing" | "exact-fragment" | "whole-output";
  fragment?: string;
  source?: string;
};

export type EscalationProgress = {
  attempt: number;
  maxAttempts: number;
  phase: EscalationProgressPhase;
  message: string;
  failedRuleIds?: string[];
  failureDetails?: PipelineFailureDetail[];
};

export type EscalationStreamEvent =
  | ({ type: "progress" } & EscalationProgress)
  | { type: "result"; body: unknown };
export type DeliveryMode = "direct" | "public";

export type PersonaBucket = "grand" | "mythic" | "chaotic";

export type FeedbackVote = "up" | "down";

export type CardVersionKind = "generated" | "dramatic" | "tweaked";

export type GuidelineRuleId =
  | "no-appearance"
  | "job-function"
  | "absurd-metaphor"
  | "made-up-statistic"
  | "max-40-words"
  | "no-literally"
  | "no-public-figure"
  | "workplace-appropriate";

export type RuleCheckState = "pass" | "fail" | "unverified";

export type RuleCheckSource = "code" | "evidence" | "heuristic" | "model";

export type RuleCheck = {
  id: GuidelineRuleId;
  label: string;
  state: RuleCheckState;
  source: RuleCheckSource;
  note?: string;
  evidence?: string;
};

export type GuidelineCompliance = {
  version: "2.1";
  wordCount: number;
  checks: RuleCheck[];
  verifiedAt: string;
};

export type ComplimentCardVersion = {
  id: string;
  text: string;
  dramaLevel: number;
  kind: CardVersionKind;
  createdAt: string;
  guidelines?: GuidelineCompliance;
};

export type SoftPreferenceContext = {
  liked: string[];
  disliked: string[];
};

export type Persona = {
  id: string;
  name: string;
  voice: string;
  bucket: PersonaBucket;
  // A persona owns a rhetorical and imagery lane so a deck cannot collapse
  // into three differently worded versions of the same cosmic metaphor.
  imageryDomain: string;
  avoidImagery: string;
  // One guideline-compliant compliment in this persona's voice, used as a
  // few-shot anchor. Written for a person who never appears in real input.
  example: string;
};

export type ComplimentCard = {
  id: string;
  originalInput: string;
  jobFunction?: string;
  personDetails?: string;
  deliveryMode?: DeliveryMode;
  personaId: string;
  personaName: string;
  text: string;
  history: string[];
  dramaLevel: number;
  status: CardStatus;
  copied: boolean;
  error?: string;
  feedback?: FeedbackVote;
  versions?: ComplimentCardVersion[];
  activeVersionId?: string;
  guidelines?: GuidelineCompliance;
};

export type ComplimentSubject = {
  jobFunction: string;
  personDetails?: string;
  deliveryMode?: DeliveryMode;
};

export type ApiDebugEvent = {
  timestamp: string;
  level: "info" | "warn" | "error";
  scope: "api" | "provider" | "client";
  message: string;
  details?: unknown;
};

export type ApiDebug = {
  requestId: string;
  route: string;
  startedAt: string;
  elapsedMs?: number;
  events: ApiDebugEvent[];
};

export type GenerateResponse = {
  ok: true;
  cards: ComplimentCard[];
  debug?: ApiDebug;
};

export type EscalateResponse = {
  ok?: true;
  text: string;
  history: string[];
  dramaLevel: number;
  guidelines: GuidelineCompliance;
  debug?: ApiDebug;
};

export type TweakResponse = {
  ok?: true;
  text: string;
  history: string[];
  dramaLevel: number;
  guidelines: GuidelineCompliance;
  debug?: ApiDebug;
};

export type ApiErrorResponse = {
  ok: false;
  error: string;
  resetAt?: number;
  cards?: ComplimentCard[];
  diagnostics?: {
    attemptCount?: number;
    failedRuleIds?: string[];
    failureDetails?: PipelineFailureDetail[];
    expectedCardCount?: number;
    completedCardCount?: number;
    failedPersonaIds?: string[];
    deckIssues?: string[];
  };
  debug?: ApiDebug;
};

export type RateLimitState = {
  count: number;
  resetAt: number;
};
