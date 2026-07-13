import type { EscalationProgress, EscalationStreamEvent } from "./types";

export const CLIENT_REQUEST_TIMEOUT_MS = 35_000;
export const GENERATION_REQUEST_TIMEOUT_MS = 60_000;
export const ESCALATION_STREAM_TIMEOUT_MS = 90_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = CLIENT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    timeoutMs,
  );
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function isEscalationStreamEvent(value: unknown): value is EscalationStreamEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<EscalationStreamEvent>;
  if (event.type === "result") return "body" in event;
  return event.type === "progress" && typeof event.attempt === "number" && typeof event.maxAttempts === "number";
}

export async function fetchEscalationWithProgress(
  input: RequestInfo | URL,
  init: RequestInit,
  onProgress: (progress: EscalationProgress) => void,
): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(new DOMException("Escalation stream timed out", "TimeoutError")),
    ESCALATION_STREAM_TIMEOUT_MS,
  );
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(input, {
      ...init,
      headers: { ...Object.fromEntries(new Headers(init.headers)), accept: "application/x-ndjson" },
      signal: controller.signal,
    });
    if (!response.headers.get("content-type")?.includes("application/x-ndjson") || !response.body) {
      return { response, body: await response.json().catch(() => ({})) };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let resultBody: unknown;

    const consumeLine = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line) as unknown;
      if (!isEscalationStreamEvent(event)) return;
      if (event.type === "progress") onProgress(event);
      if (event.type === "result") resultBody = event.body;
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(consumeLine);
      if (done) break;
    }
    consumeLine(buffer);
    return { response, body: resultBody ?? {} };
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}
