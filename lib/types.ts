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

export type GenerateResponse = {
  cards: ComplimentCard[];
};

export type EscalateResponse = {
  text: string;
  history: string[];
  dramaLevel: number;
};

export type ApiErrorResponse = {
  error: string;
  resetAt?: number;
};

export type RateLimitState = {
  count: number;
  resetAt: number;
};
