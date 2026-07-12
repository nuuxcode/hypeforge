export type CardStatus = "idle" | "loading" | "error";

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
};

export type ComplimentCard = {
  id: string;
  originalInput: string;
  jobFunction?: string;
  personDetails?: string;
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
  ok?: true;
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
  debug?: ApiDebug;
};

export type RateLimitState = {
  count: number;
  resetAt: number;
};
