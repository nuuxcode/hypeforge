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
  if (isApiErrorResponse(body) && /clear job title|what the person does at work/i.test(body.error)) {
    return body.error;
  }
  if (isApiErrorResponse(body) && /quota/i.test(body.error)) return body.error;
  if (isApiErrorResponse(body) && /too long/i.test(body.error)) return body.error;
  if (isApiErrorResponse(body) && /configuration/i.test(body.error)) {
    return "HypeForge is missing a server setting. Check the API key configuration.";
  }
  if (isApiErrorResponse(body) && /did not clear every Brand Team rule/i.test(body.error)) {
    return "One or more drafts missed a company rule, so they were not shown. Generate again for a fresh set.";
  }
  return "The forge hiccuped. The compliment engine got overwhelmed by your brilliance. Try again.";
}

type CardOperation = "escalate" | "retry" | "tweak";

export function cardErrorMessage(body: unknown, operation: CardOperation = "retry"): string {
  if (isApiErrorResponse(body) && body.error.includes("Too much brilliance")) {
    return "Too much brilliance at once. Give it a second.";
  }
  if (isApiErrorResponse(body) && (/quota/i.test(body.error) || /too long/i.test(body.error))) return body.error;
  if (isApiErrorResponse(body) && /did not clear every Brand Team rule/i.test(body.error)) {
    if (operation === "escalate") {
      return "The new version missed a company rule, so we kept this valid compliment. Try increasing the drama again.";
    }
    if (operation === "tweak") {
      return "The rewrite missed a company rule, so we kept this valid compliment. Adjust your note or try again.";
    }
    return "The new draft missed a company rule. Retry this card.";
  }
  if (operation === "escalate") {
    return "We could not increase the drama, so this valid compliment stayed unchanged. Try again.";
  }
  if (operation === "tweak") {
    return "We could not apply that tweak, so this valid compliment stayed unchanged. Try again.";
  }
  return "This persona could not finish a new draft. Retry this card.";
}

const RULE_HELP: Record<string, { label: string; explanation: string }> = {
  "no-appearance": { label: "No appearance references", explanation: "The draft may have described physical appearance." },
  "job-function": { label: "Job or function reference", explanation: "The draft did not clearly name the person's role or function." },
  "absurd-metaphor": { label: "Absurd metaphor", explanation: "The comparison was missing or not wildly absurd enough." },
  "made-up-statistic": { label: "Made-up statistic", explanation: "The draft lacked a clearly formatted fictional number, such as “97 percent of ...”." },
  "max-40-words": { label: "40-word maximum", explanation: "The draft was longer than 40 words." },
  "no-literally": { label: "Banned word", explanation: "The draft used the banned word “literally”." },
  "no-public-figure": { label: "No public-figure comparison", explanation: "The draft may have compared the person to a real public figure." },
  "workplace-appropriate": { label: "Workplace appropriate", explanation: "The independent safety audit did not clearly approve the wording." },
};

function detailsRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function failedRules(debug?: ApiDebug): string[] {
  const events = debug?.events ?? [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const details = detailsRecord(events[index]?.details);
    if (Array.isArray(details?.failedRuleIds)) {
      return details.failedRuleIds.filter((item): item is string => typeof item === "string");
    }
  }
  return [];
}

function actionLabel(endpoint: string): string {
  if (endpoint.includes("/escalate")) return "increase the drama";
  if (endpoint.includes("/tweak")) return "apply the tweak";
  if (endpoint.includes("/retry")) return "retry the card";
  if (endpoint.includes("/generate")) return "generate the compliment deck";
  if (endpoint.includes("/share")) return "create the share link";
  return "complete the request";
}

export function apiFailureDiagnostic(args: {
  endpoint: string;
  status?: number;
  body?: unknown;
  error?: unknown;
}): {
  title: string;
  whatHappened: string;
  why: string;
  howToFix: string;
  existingContentSafe?: string;
  failedRuleLabels: string[];
} {
  const debug = getDebug(args.body);
  const ruleIds = failedRules(debug);
  const ruleHelp = ruleIds.map((id) => RULE_HELP[id]).filter((item): item is { label: string; explanation: string } => Boolean(item));
  const responseError = isApiErrorResponse(args.body) ? args.body.error : "";
  const action = actionLabel(args.endpoint);

  if (args.error) {
    return {
      title: "The browser could not reach HypeForge",
      whatHappened: `HypeForge could not ${action} because the request did not complete.`,
      why: args.error instanceof Error ? args.error.message : String(args.error),
      howToFix: "Check that the local server is running and your connection is online, then try the action again.",
      existingContentSafe: args.endpoint.includes("/generate") ? undefined : "Your existing compliment was not changed.",
      failedRuleLabels: [],
    };
  }

  if (/quota/i.test(responseError)) {
    return {
      title: "Gemini quota is temporarily exhausted",
      whatHappened: `HypeForge reached Gemini, but Gemini would not ${action} because the current API quota is used up.`,
      why: responseError,
      howToFix: "Wait for the Gemini quota window to reset or configure a key with available quota, then try again.",
      existingContentSafe: args.endpoint.includes("/generate") ? undefined : "Your existing compliment was not changed.",
      failedRuleLabels: [],
    };
  }

  if (/too long/i.test(responseError)) {
    return {
      title: "Gemini took too long to answer",
      whatHappened: `HypeForge stopped waiting before it could ${action}.`,
      why: "The model or network exceeded the configured request timeout.",
      howToFix: "Try once more. If it repeats, check the network and Gemini service status.",
      existingContentSafe: args.endpoint.includes("/generate") ? undefined : "Your existing compliment was not changed.",
      failedRuleLabels: [],
    };
  }

  if (ruleHelp.length > 0 || /did not clear every Brand Team rule/i.test(responseError)) {
    return {
      title: "The AI draft was rejected by the company rules",
      whatHappened: `Gemini wrote a draft, but HypeForge refused to ${action} because the draft did not pass all 8 required checks.`,
      why: ruleHelp.length > 0
        ? ruleHelp.map((item) => `${item.label}: ${item.explanation}`).join(" ")
        : "The draft still missed at least one required guideline after automatic repair attempts.",
      howToFix: args.endpoint.includes("/escalate")
        ? "Click the drama button again. If it repeats, restore the prior version or use Tweak with a short note such as “keep the statistic explicit”."
        : "Try the action again. HypeForge will ask Gemini for a fresh draft.",
      existingContentSafe: args.endpoint.includes("/generate") ? undefined : "Your existing valid compliment was preserved unchanged.",
      failedRuleLabels: ruleHelp.map((item) => item.label),
    };
  }

  if (/Too much brilliance/i.test(responseError)) {
    return {
      title: "The temporary request limit was reached",
      whatHappened: `HypeForge paused before it could ${action}.`,
      why: "Too many AI requests were sent during the current rate-limit window.",
      howToFix: "Wait a moment, then try again.",
      existingContentSafe: args.endpoint.includes("/generate") ? undefined : "Your existing compliment was not changed.",
      failedRuleLabels: [],
    };
  }

  if (/clear job title|what the person does at work/i.test(responseError)) {
    return {
      title: "A job or workplace function is missing",
      whatHappened: "HypeForge has a name, but not enough work context to ground the compliment.",
      why: responseError,
      howToFix: "Add their role or what they do, for example: “Sara, Customer Success Manager” or “Sara, who keeps every client calm”.",
      failedRuleLabels: ["Job or function reference"],
    };
  }

  return {
    title: "HypeForge could not finish this action",
    whatHappened: `The app could not ${action}.`,
    why: responseError || `The server returned ${args.status ?? "an unknown response"}, or the response was not in the expected format.`,
    howToFix: "Try the action again. Use the request reference below if the problem repeats.",
    existingContentSafe: args.endpoint.includes("/generate") ? undefined : "Your existing compliment was not changed.",
    failedRuleLabels: [],
  };
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
  const attemptCount =
    debug?.events.filter((event) => event.scope === "provider" && event.message === "guideline generation attempt started").length ?? 0;
  const requestAction = actionLabel(args.endpoint);
  const requestActionTitle = requestAction.charAt(0).toUpperCase() + requestAction.slice(1);

  console.groupCollapsed(`[HypeForge Request] ${requestActionTitle} • ${okLabel === "ok" ? "SUCCEEDED" : "REJECTED"} • ${elapsedMs}ms`);
  console.log("Request reference", { requestId, endpoint: args.endpoint, httpStatus: statusLabel });
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

  if (!args.ok) {
    const diagnostic = apiFailureDiagnostic(args);
    console.group(`[HypeForge Help] ${diagnostic.title}`);
    console.error("What happened:", diagnostic.whatHappened);
    console.info("Why:", diagnostic.why);
    if (diagnostic.existingContentSafe) console.info("What was protected:", diagnostic.existingContentSafe);
    console.info("How to fix it:", diagnostic.howToFix);
    if (args.status === 200) {
      console.info("Connection status:", "The server answered normally. This is not a connection failure.");
    }
    if (attemptCount > 0) console.info("Automatic attempts made:", attemptCount);
    if (diagnostic.failedRuleLabels.length > 0) console.info("Rules that failed:", diagnostic.failedRuleLabels);
    console.info("Request reference:", { requestId, endpoint: args.endpoint, status: statusLabel, elapsedMs });
    console.groupEnd();
  }

  // Preserve redacted provider data for developers without flooding the main console.
  if (providerFailures.length > 0) {
    console.groupCollapsed(`[HypeForge Technical details] ${providerFailures.length} provider error event${providerFailures.length === 1 ? "" : "s"}`);
    for (const event of providerFailures) {
      console.log(event.message, { requestId, route: debug?.route, details: event.details });
    }
    console.groupEnd();
  }
}
