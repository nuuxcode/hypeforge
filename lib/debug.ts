import type { ApiDebug, ApiDebugEvent } from "./types";
import { after } from "next/server";
import { captureApiTrace } from "./ai-failure-log";

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /(api[_-]?key["'\s:=]+)[^"'\s,}]+/gi,
  /(authorization["'\s:=]+bearer\s+)[^"'\s,}]+/gi,
];

export const DEBUG_API_RESPONSES =
  process.env.NODE_ENV !== "production" || process.env.HYPEFORGE_DEBUG === "true";
const DEBUG_STACKS = process.env.HYPEFORGE_DEBUG_STACKS === "true";
const CAPTURE_PRIVATE_STACKS = DEBUG_STACKS && process.env.HYPEFORGE_CAPTURE_AI_FAILURES === "true";

function redact(value: string): string {
  return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, "$1[redacted]"), value);
}

function safeDetails(details: unknown, seen = new WeakSet<object>()): unknown {
  if (details instanceof Error) {
    const extra = Object.fromEntries(
      Object.entries(details).map(([key, value]) => [key, safeDetails(value, seen)]),
    );
    return {
      name: details.name,
      message: redact(details.message),
      stack: (DEBUG_API_RESPONSES || CAPTURE_PRIVATE_STACKS) && details.stack ? redact(details.stack) : undefined,
      ...extra,
    };
  }

  if (typeof details === "string") return redact(details);
  if (details === null || typeof details !== "object") return details;
  if (seen.has(details)) return "[Circular]";
  seen.add(details);

  if (Array.isArray(details)) {
    return details.map((item) => safeDetails(item, seen));
  }

  return Object.fromEntries(
    Object.entries(details as Record<string, unknown>).map(([key, value]) => [key, safeDetails(value, seen)]),
  );
}

export function createApiDebug(route: string) {
  const startedAt = new Date();
  const started = Date.now();
  const debug: ApiDebug = {
    requestId: crypto.randomUUID(),
    route,
    startedAt: startedAt.toISOString(),
    events: [],
  };
  let captureScheduled = false;

  function add(level: ApiDebugEvent["level"], scope: ApiDebugEvent["scope"], message: string, details?: unknown) {
    const event = {
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
      details: details === undefined ? undefined : safeDetails(details),
    };
    debug.events.push(event);
    const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    logger(`[${debug.requestId}] ${route} ${message}`, event.details ?? "");
  }

  return {
    debug,
    info: (message: string, details?: unknown) => add("info", "api", message, details),
    warn: (message: string, details?: unknown) => add("warn", "api", message, details),
    error: (message: string, details?: unknown) => add("error", "api", message, details),
    providerInfo: (message: string, details?: unknown) => add("info", "provider", message, details),
    providerError: (message: string, details?: unknown) => add("error", "provider", message, details),
    finish() {
      debug.elapsedMs = Date.now() - started;
      if (!captureScheduled) {
        captureScheduled = true;
        try {
          after(() => captureApiTrace(debug));
        } catch {
          // Unit tests and non-request callers have no Next.js request lifecycle.
          void captureApiTrace(debug);
        }
      }
      return debug;
    },
  };
}

export function withDebug<T extends object>(body: T, debug: ApiDebug): T & { debug?: ApiDebug } {
  if (!DEBUG_API_RESPONSES) return body;
  return { ...body, debug };
}
