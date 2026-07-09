export type CardStatus = "idle" | "loading" | "error";

export type PersonaBucket = "grand" | "mythic" | "chaotic";

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
  cards: ComplimentCard[];
  debug?: ApiDebug;
};

export type EscalateResponse = {
  text: string;
  history: string[];
  dramaLevel: number;
  debug?: ApiDebug;
};

export type ApiErrorResponse = {
  error: string;
  resetAt?: number;
  debug?: ApiDebug;
};

export type RateLimitState = {
  count: number;
  resetAt: number;
};
