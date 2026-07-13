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
import {
  diagnosticReferenceHref,
  getDiagnosticEntry,
  inferDiagnosticKey,
} from "@/lib/diagnostic-catalog";

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
    const failedIds = body.diagnostics?.failedRuleIds ?? [];
    if (operation === "escalate" && failedIds.length === 1 && failedIds[0] === "dramatic-escalation") {
      return "All 3 rewrites passed the company rules but were not clearly more dramatic, so we kept this version. Try again or tweak the direction.";
    }
    const failedLabels = failedIds.map((id) => getDiagnosticEntry(id).title);
    if (operation === "escalate") {
      return failedLabels.length > 0
        ? `All 3 rewrites were rejected (${failedLabels.join(", ")}), so we kept this valid compliment. Try increasing the drama again.`
        : "All 3 automatic attempts missed a company rule, so we kept this valid compliment. You can try increasing the drama again.";
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
  failedRuleIds: string[];
} {
  const debug = getDebug(args.body);
  const responseDiagnostics = args.body && typeof args.body === "object"
    ? (args.body as ApiErrorResponse).diagnostics
    : undefined;
  const ruleIds = responseDiagnostics?.failedRuleIds?.length
    ? responseDiagnostics.failedRuleIds
    : failedRules(debug);
  const ruleHelp = ruleIds.map(getDiagnosticEntry);
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
      failedRuleIds: ["network"],
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
      failedRuleIds: ["quota"],
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
      failedRuleIds: ["timeout"],
    };
  }

  if (ruleHelp.length > 0 || /did not clear every Brand Team rule/i.test(responseError)) {
    return {
      title: "The AI draft was rejected by the company rules",
      whatHappened: `Gemini wrote a draft, but HypeForge refused to ${action} because the draft did not pass all 8 required checks.`,
      why: ruleHelp.length > 0
        ? ruleHelp.map((item) => `${item.title}: ${item.summary}`).join(" ")
        : "The draft still missed at least one required guideline after automatic repair attempts.",
      howToFix: args.endpoint.includes("/escalate")
        ? "Click the drama button again. If it repeats, restore the prior version or use Tweak with a short note such as “keep the statistic explicit”."
        : "Try the action again. HypeForge will ask Gemini for a fresh draft.",
      existingContentSafe: args.endpoint.includes("/generate") ? undefined : "Your existing valid compliment was preserved unchanged.",
      failedRuleLabels: ruleHelp.map((item) => item.title),
      failedRuleIds: ruleIds,
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
      failedRuleIds: ["rate-limit"],
    };
  }

  if (/clear job title|what the person does at work/i.test(responseError)) {
    return {
      title: "A job or workplace function is missing",
      whatHappened: "HypeForge has a name, but not enough work context to ground the compliment.",
      why: responseError,
      howToFix: "Add their role or what they do, for example: “Sara, Customer Success Manager” or “Sara, who keeps every client calm”.",
      failedRuleLabels: ["Job or function reference"],
      failedRuleIds: ["job-function"],
    };
  }

  return {
    title: "HypeForge could not finish this action",
    whatHappened: `The app could not ${action}.`,
    why: responseError || `The server returned ${args.status ?? "an unknown response"}, or the response was not in the expected format.`,
    howToFix: "Try the action again. Use the request reference below if the problem repeats.",
    existingContentSafe: args.endpoint.includes("/generate") ? undefined : "Your existing compliment was not changed.",
    failedRuleLabels: [],
    failedRuleIds: [inferDiagnosticKey(responseError)],
  };
}

function failedCardsIn(body: unknown): Array<{ persona: string; message: string }> {
  if (!body || typeof body !== "object" || !("cards" in body)) return [];
  const cards = (body as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) return [];
  return cards.flatMap((card) => {
    if (!card || typeof card !== "object") return [];
    const value = card as { status?: unknown; text?: unknown; personaName?: unknown; personaId?: unknown; error?: unknown };
    if (value.status !== "error" && (typeof value.text !== "string" || value.text.trim())) return [];
    return [{
      persona: typeof value.personaName === "string" ? value.personaName : typeof value.personaId === "string" ? value.personaId : "Unknown persona",
      message: typeof value.error === "string" ? value.error : "The card did not produce a valid compliment.",
    }];
  });
}

function nestedErrorMessages(value: unknown, seen = new WeakSet<object>()): string[] {
  if (value instanceof Error) return [value.message];
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  const record = value as Record<string, unknown>;
  return [record.message, record.error, record.mainError, record.backupError, record.cause]
    .flatMap((item) => nestedErrorMessages(item, seen))
    .filter((item, index, all) => item.trim() && all.indexOf(item) === index);
}

function providerEventExplanation(event: ApiDebug["events"][number]): string {
  const details = detailsRecord(event.details);
  const messages = nestedErrorMessages(details?.error ?? event.details);
  if (/failed closed/i.test(event.message)) {
    const rules = Array.isArray(details?.failedRuleIds)
      ? details.failedRuleIds.map((id) => getDiagnosticEntry(String(id)).title).join(", ")
      : "one or more company rules";
    return `All automatic drafts were rejected. Final failed checks: ${rules}.`;
  }
  if (/persona generation failed/i.test(event.message)) {
    return `This persona could not produce a valid card. ${messages[0] ?? "See the attempt records in /admin for the rejected output."}`;
  }
  if (/attempt failed/i.test(event.message)) {
    return `Gemini failed before HypeForge received a usable structured draft. ${messages[0] ?? "The provider returned an unknown error."}`;
  }
  return messages[0] ?? "The provider stage reported an error. Expand the details object below.";
}

function diagnosticUrl(key: string): string {
  const path = diagnosticReferenceHref(key);
  return typeof window === "undefined" ? path : new URL(path, window.location.origin).href;
}

function logDiagnosticDefinition(key: string) {
  const entry = getDiagnosticEntry(key);
  console.group(`${entry.title} • internal key: ${entry.key}`);
  console.info("What this means:", entry.summary);
  console.info("What HypeForge does:", entry.decision);
  console.info("Validator:", entry.validator);
  console.info("Pipeline stage:", entry.stage);
  console.info("Likely causes:", entry.likelyCauses);
  console.info("How to investigate and fix:", entry.fixes);
  console.table(entry.locations.map((location) => ({
    file: location.path,
    responsibility: location.purpose,
  })));
  console.info("Full diagnostic reference:", diagnosticUrl(key));
  console.groupEnd();
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
  const providerFailures =
    debug?.events.filter((event) => event.scope === "provider" && event.level === "error") ?? [];
  const rejectedAttempts =
    debug?.events.filter((event) => {
      const details = detailsRecord(event.details);
      return event.message === "guideline validation completed" && details?.accepted === false;
    }) ?? [];
  const failedCards = failedCardsIn(args.body);
  const responseDiagnostics = args.body && typeof args.body === "object"
    ? (args.body as ApiErrorResponse).diagnostics
    : undefined;
  const attemptCount = responseDiagnostics?.attemptCount ??
    debug?.events.filter((event) => event.scope === "provider" && event.message === "guideline generation attempt started").length ?? 0;
  const requestAction = actionLabel(args.endpoint);
  const requestActionTitle = requestAction.charAt(0).toUpperCase() + requestAction.slice(1);
  const resultLabel = !args.ok
    ? "REJECTED"
    : failedCards.length > 0
      ? `COMPLETED WITH ${failedCards.length} CARD ERROR${failedCards.length === 1 ? "" : "S"}`
      : providerFailures.length > 0
        ? "COMPLETED AFTER AUTOMATIC RECOVERY"
        : "SUCCEEDED";
  const requestGroup = !args.ok || failedCards.length > 0 || providerFailures.length > 0
    ? console.group
    : console.groupCollapsed;

  requestGroup(`[HypeForge Request] ${requestActionTitle} • ${resultLabel} • ${elapsedMs}ms`);
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
    console.group("Diagnostic definitions and repair locations");
    for (const key of [...new Set(diagnostic.failedRuleIds)]) logDiagnosticDefinition(key);
    console.groupEnd();
    console.groupEnd();
  }

  if (args.ok && failedCards.length > 0) {
    console.group(`[HypeForge Help] The deck finished, but ${failedCards.length} card${failedCards.length === 1 ? " was" : "s were"} unavailable`);
    console.warn("What happened:", `The API returned normally, but ${failedCards.length} persona pipeline${failedCards.length === 1 ? "" : "s"} did not produce a compliment that passed every company rule.`);
    for (const card of failedCards) console.error(`${card.persona}:`, card.message);
    console.info("What still worked:", "Every other valid card is safe to use. The unavailable card can be retried by itself.");
    console.info("How to investigate:", "Open /admin for the rejected model output, failed rules, Gemini errors, key rotation, and full server timeline.");
    console.info("Request reference:", { requestId, endpoint: args.endpoint, status: statusLabel, elapsedMs });
    console.groupEnd();
  } else if (args.ok && providerFailures.length > 0) {
    console.group(`[HypeForge Help] Gemini stumbled, then HypeForge recovered automatically`);
    console.warn("What happened:", `${providerFailures.length} provider stage${providerFailures.length === 1 ? "" : "s"} failed during this request, but a later attempt produced the visible result.`);
    console.info("What you need to do:", "Nothing for this request. Open /admin if this repeats and you want to inspect the provider messages and rejected drafts.");
    console.info("Request reference:", { requestId, endpoint: args.endpoint, status: statusLabel, elapsedMs });
    console.groupEnd();
  }

  if (rejectedAttempts.length > 0) {
    console.group(`[HypeForge Rejected AI drafts] ${rejectedAttempts.length} rejected attempt${rejectedAttempts.length === 1 ? "" : "s"} • request ${requestId}`);
    for (const event of rejectedAttempts) {
      const details = detailsRecord(event.details);
      const attempt = typeof details?.attempt === "number" ? details.attempt : "?";
      const candidate = detailsRecord(details?.rejectedCandidate);
      const acceptedBaseline = typeof details?.acceptedBaseline === "string" ? details.acceptedBaseline : undefined;
      const failureDetails = Array.isArray(details?.failureDetails)
        ? details.failureDetails.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        : [];
      console.group(`Attempt ${attempt}/${attemptCount || "?"}`);
      console.log("Full Gemini output:", candidate?.text ?? "No candidate text was returned.");
      console.log("Structured Gemini response:", candidate ?? "No structured candidate was returned.");
      if (acceptedBaseline) console.log("Accepted baseline used for comparison:", acceptedBaseline);
      if (failureDetails.length === 0) {
        console.error("Why it failed:", "No structured failure location was returned. Inspect the technical event payload below.");
      }
      for (const failure of failureDetails) {
        console.error(`Failed check: ${String(failure.label ?? failure.ruleId ?? "Unknown rule")}`);
        console.info("Why:", String(failure.reason ?? "No reason was supplied."));
        console.info(
          "Where:",
          failure.location === "exact-fragment"
            ? `Exact rejected fragment: “${String(failure.fragment ?? "")}”`
            : failure.location === "missing"
              ? "Missing from the output; there is no phrase to highlight."
              : "The evaluator judged the complete output against the previous version.",
        );
        if (typeof failure.ruleId === "string") logDiagnosticDefinition(failure.ruleId);
      }
      console.groupEnd();
    }
    console.groupEnd();
  }

  // Provider failures stay expanded: these are exactly the events developers need
  // when the visible UI says that a card was preserved or could not be generated.
  if (providerFailures.length > 0) {
    console.group(`[HypeForge Technical details] ${providerFailures.length} provider error event${providerFailures.length === 1 ? "" : "s"} • request ${requestId}`);
    for (const [index, event] of providerFailures.entries()) {
      console.error(`${index + 1}. ${event.message}`);
      console.info("Plain-English meaning:", providerEventExplanation(event));
      console.log("Redacted technical payload:", { requestId, route: debug?.route, timestamp: event.timestamp, details: event.details });
      const details = detailsRecord(event.details);
      const keys = Array.isArray(details?.failedRuleIds)
        ? details.failedRuleIds.filter((item): item is string => typeof item === "string")
        : [inferDiagnosticKey(nestedErrorMessages(event.details).join(" ") || event.message)];
      for (const key of [...new Set(keys)]) logDiagnosticDefinition(key);
    }
    const diagnosticsPath = `/admin?request=${encodeURIComponent(requestId)}`;
    const diagnosticsUrl = typeof window === "undefined"
      ? diagnosticsPath
      : new URL(diagnosticsPath, window.location.origin).href;
    console.info("Persistent diagnostics:", diagnosticsUrl);
    console.groupEnd();
  }
}
