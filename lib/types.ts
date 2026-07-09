export type CardStatus = "idle" | "loading" | "error";

export type PersonaBucket = "grand" | "mythic" | "chaotic";

export type FeedbackVote = "up" | "down";

export type CardVersionKind = "generated" | "dramatic" | "tweaked";

export type ComplimentCardVersion = {
  id: string;
  text: string;
  dramaLevel: number;
  kind: CardVersionKind;
  createdAt: string;
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
  debug?: ApiDebug;
};

export type TweakResponse = {
  ok?: true;
  text: string;
  history: string[];
  dramaLevel: number;
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
