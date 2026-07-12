import type {
  ApiDebug,
  ApiErrorResponse,
  ComplimentCard,
  EscalateResponse,
  GenerateResponse,
  GuidelineCompliance,
  TweakResponse,
} from "@/lib/types";
import type { SharedDeckSnapshot } from "@/lib/deck-history";

export const CLIENT_DEBUG = process.env.NODE_ENV !== "production";

export type RetryResponse = {
  ok?: true;
  text: string;
  history: string[];
  dramaLevel: number;
  guidelines: GuidelineCompliance;
  debug?: ApiDebug;
};

export type ShareResponse = {
  ok?: true;
  slug: string;
  createdAt: string;
  debug?: ApiDebug;
};

export type SharedDeckResponse = {
  ok?: true;
  deck: SharedDeckSnapshot;
};

export function isGenerateResponse(value: unknown): value is GenerateResponse {
  return Boolean(value && typeof value === "object" && Array.isArray((value as GenerateResponse).cards));
}

export function isGuidelineCompliance(value: unknown): value is GuidelineCompliance {
  if (!value || typeof value !== "object") return false;
  const compliance = value as GuidelineCompliance;
  return (
    compliance.version === "2.1" &&
    typeof compliance.wordCount === "number" &&
    compliance.wordCount <= 40 &&
    Array.isArray(compliance.checks) &&
    compliance.checks.length === 8 &&
    compliance.checks.every((item) => item.state === "pass")
  );
}

export function isEscalateResponse(value: unknown): value is EscalateResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as EscalateResponse).text === "string" &&
      Array.isArray((value as EscalateResponse).history) &&
      typeof (value as EscalateResponse).dramaLevel === "number" &&
      isGuidelineCompliance((value as EscalateResponse).guidelines),
  );
}

export function isRetryResponse(value: unknown): value is RetryResponse {
  return isEscalateResponse(value);
}

export function isTweakResponse(value: unknown): value is TweakResponse {
  return isEscalateResponse(value);
}

export function isShareResponse(value: unknown): value is ShareResponse {
  return Boolean(value && typeof value === "object" && typeof (value as ShareResponse).slug === "string");
}

export function isSharedDeckResponse(value: unknown): value is SharedDeckResponse {
  if (!value || typeof value !== "object") return false;
  const deck = (value as SharedDeckResponse).deck;
  return Boolean(deck && typeof deck.input === "string" && Array.isArray(deck.cards));
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as ApiErrorResponse).ok === false &&
      typeof (value as ApiErrorResponse).error === "string",
  );
}

export function hasVisibleCards(value: unknown): value is { cards: ComplimentCard[] } {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { cards?: unknown }).cards) &&
      (value as { cards: ComplimentCard[] }).cards.length > 0,
  );
}

export function getDebug(value: unknown): ApiDebug | undefined {
  if (value && typeof value === "object" && "debug" in value) {
    return (value as { debug?: ApiDebug }).debug;
  }
  return undefined;
}

export function globalErrorMessage(body: unknown): string {
  if (isApiErrorResponse(body) && body.error.includes("Too much brilliance")) {
    return "Too much brilliance at once. Give it a second.";
  }
  if (isApiErrorResponse(body) && body.error.includes("Add someone")) {
    return "Add someone to hype first.";
  }
  return "The forge hiccuped. The compliment engine got overwhelmed by your brilliance. Try again.";
}

export function cardErrorMessage(body: unknown): string {
  if (isApiErrorResponse(body) && body.error.includes("Too much brilliance")) {
    return "Too much brilliance at once. Give it a second.";
  }
  return "This persona lost the plot for a second. Retry this card.";
}

// Dev-only structured console logging for every API exchange; production
// builds compile this to a no-op via CLIENT_DEBUG.
export function logApiExchange(args: {
  endpoint: string;
  payload: unknown;
  status?: number;
  ok?: boolean;
  body?: unknown;
  startedAt: number;
  error?: unknown;
}) {
  if (!CLIENT_DEBUG) return;
  const elapsedMs = Math.round(performance.now() - args.startedAt);
  const debug = getDebug(args.body);
  const requestId = debug?.requestId ?? "no-request-id";
  const statusLabel = args.status ? `${args.status}` : "network-error";
  const okLabel = args.ok ? "ok" : "failed";
  const providerFailures =
    debug?.events.filter((event) => event.scope === "provider" && event.level === "error") ?? [];

  console.groupCollapsed(`[HypeForge API] ${args.endpoint} ${statusLabel} ${okLabel} ${requestId} ${elapsedMs}ms`);
  console.log("Request payload", args.payload);
  if (args.body !== undefined) console.log("Response body", args.body);
  if (args.error) console.error("Network/client error", args.error);
  if (debug) {
    console.log("Server debug", debug);
    console.table(
      debug.events.map((event) => ({
        time: event.timestamp,
        level: event.level,
        scope: event.scope,
        message: event.message,
      })),
    );
  }
  if (!args.ok) console.warn("Handled API failure", { status: args.status, body: args.body, error: args.error });
  console.groupEnd();

  // Keep raw-but-redacted Gemini failures visible without expanding the request group.
  for (const event of providerFailures) {
    console.error(`[HypeForge Gemini] ${event.message}`, {
      requestId,
      route: debug?.route,
      details: event.details,
    });
  }
}
