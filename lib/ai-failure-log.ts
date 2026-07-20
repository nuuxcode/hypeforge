import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { get, list, put } from "@vercel/blob";
import type { GuidelineModelOutput } from "./compliment-guidelines";
import type { ApiDebug, DeliveryMode, GuidelineCompliance, PipelineFailureDetail } from "./types";

export type AiAttemptOutcome = "accepted" | "rejected-candidate" | "provider-error" | "recovered";

export type AiFailureLogInput = {
  requestId: string;
  operation: "generate" | "retry" | "escalate" | "tweak";
  personaId: string;
  deliveryMode?: DeliveryMode;
  subject: string;
  attempt: number;
  maxAttempts: number;
  outcome: AiAttemptOutcome;
  candidate?: GuidelineModelOutput;
  baselineText?: string;
  compliance?: GuidelineCompliance;
  failedRuleIds?: string[];
  semanticNotes?: string[];
  dramaticFailure?: string;
  modeFailure?: string;
  failureDetails?: PipelineFailureDetail[];
  error?: unknown;
};

const LOG_PREFIX = "hypeforge-ai-failures";
const TRACE_PREFIX = "hypeforge-api-traces";
const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /(api[_ -]?key[^\s:=]*[\s:=]+)[^\s,;]+/gi,
  /(authorization[\s:=]+bearer\s+)[^\s,;]+/gi,
];

function loggingEnabled(): boolean {
  if (process.env.HYPEFORGE_CAPTURE_AI_FAILURES !== undefined) {
    return process.env.HYPEFORGE_CAPTURE_AI_FAILURES === "true";
  }
  return process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";
}

function usesBlobStore(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function redact(value: string): string {
  return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, "$1[redacted]"), value);
}

function safeError(error: unknown): { name: string; message: string; stack?: string } | undefined {
  if (error === undefined) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redact(error.message).slice(0, 4_000),
      stack: process.env.HYPEFORGE_DEBUG_STACKS === "true" && error.stack
        ? redact(error.stack).slice(0, 12_000)
        : undefined,
    };
  }
  return { name: "UnknownError", message: redact(String(error)).slice(0, 2_000) };
}

function subjectFingerprint(subject: string): string {
  return createHash("sha256").update(subject.trim().toLowerCase()).digest("hex").slice(0, 16);
}

function localLogPath(): string {
  return process.env.HYPEFORGE_FAILURE_LOG_PATH ?? path.join(".data", "hypeforge-ai-failures.ndjson");
}

export async function captureAiFailure(input: AiFailureLogInput): Promise<void> {
  if (!loggingEnabled()) return;

  const createdAt = new Date().toISOString();
  const record: AiAttemptLogRecord = {
    kind: "ai-attempt",
    version: 1,
    id: randomUUID(),
    createdAt,
    requestId: input.requestId,
    promptVersion: "company-guidelines-v2.1-repair-v3",
    models: {
      main: process.env.GEMINI_MODEL_MAIN ?? "gemini-3.1-flash-lite",
      backup: process.env.GEMINI_MODEL_BACKUP ?? "gemini-3-flash-preview",
      validator: process.env.GEMINI_MODEL_VALIDATOR ?? process.env.GEMINI_MODEL_MAIN ?? "gemini-3.1-flash-lite",
    },
    operation: input.operation,
    personaId: input.personaId,
    deliveryMode: input.deliveryMode,
    subjectFingerprint: subjectFingerprint(input.subject),
    subjectWordCount: input.subject.trim().split(/\s+/).filter(Boolean).length,
    attempt: input.attempt,
    maxAttempts: input.maxAttempts,
    outcome: input.outcome,
    candidate: input.candidate,
    baselineText: input.baselineText,
    compliance: input.compliance,
    failedRuleIds: input.failedRuleIds ?? [],
    semanticNotes: input.semanticNotes ?? [],
    dramaticFailure: input.dramaticFailure,
    modeFailure: input.modeFailure,
    failureDetails: input.failureDetails ?? [],
    error: safeError(input.error),
  };
  const serialized = JSON.stringify(record);

  try {
    if (usesBlobStore()) {
      const date = createdAt.slice(0, 10);
      await put(`${LOG_PREFIX}/${date}/${input.requestId}-${input.attempt}-${record.id}.json`, serialized, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    } else {
      const target = localLogPath();
      await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
      await fs.appendFile(/*turbopackIgnore: true*/ target, `${serialized}\n`, "utf8");
    }
    console.info("[ai-failure-log] captured prompt-improvement record", {
      requestId: input.requestId,
      operation: input.operation,
      personaId: input.personaId,
      attempt: input.attempt,
      outcome: input.outcome,
      failedRuleIds: input.failedRuleIds ?? [],
    });
  } catch (error) {
    console.error("[ai-failure-log] capture failed without blocking the request", safeError(error));
  }
}

export type AiAttemptLogRecord = {
  kind: "ai-attempt";
  version: number;
  id: string;
  createdAt: string;
  requestId: string;
  promptVersion: string;
  models: { main: string; backup: string; validator: string };
  operation: AiFailureLogInput["operation"];
  personaId: string;
  deliveryMode?: DeliveryMode;
  subjectFingerprint: string;
  subjectWordCount: number;
  attempt: number;
  maxAttempts: number;
  outcome: AiAttemptOutcome;
  candidate?: GuidelineModelOutput;
  baselineText?: string;
  compliance?: GuidelineCompliance;
  failedRuleIds: string[];
  semanticNotes: string[];
  dramaticFailure?: string;
  modeFailure?: string;
  failureDetails?: PipelineFailureDetail[];
  error?: { name: string; message: string; stack?: string };
};

export type ApiTraceLogRecord = {
  kind: "api-trace";
  version: 1;
  id: string;
  createdAt: string;
  requestId: string;
  route: string;
  severity: "success" | "warning" | "error";
  debug: ApiDebug;
};

export type ObservabilityLogRecord = AiAttemptLogRecord | ApiTraceLogRecord;

function traceSeverity(debug: ApiDebug): ApiTraceLogRecord["severity"] {
  const errors = debug.events.filter((event) => event.level === "error");
  if (errors.some((event) => event.scope === "api" || /all personas failed|failed closed/i.test(event.message))) {
    return "error";
  }
  return errors.length > 0 ? "warning" : "success";
}

export async function captureApiTrace(debug: ApiDebug): Promise<void> {
  if (!loggingEnabled()) return;
  const record: ApiTraceLogRecord = {
    kind: "api-trace",
    version: 1,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    requestId: debug.requestId,
    route: debug.route,
    severity: traceSeverity(debug),
    debug,
  };
  const serialized = JSON.stringify(record);

  try {
    if (usesBlobStore()) {
      const date = record.createdAt.slice(0, 10);
      await put(`${TRACE_PREFIX}/${date}/${record.requestId}-${record.id}.json`, serialized, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    } else {
      const target = localLogPath();
      await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
      await fs.appendFile(/*turbopackIgnore: true*/ target, `${serialized}\n`, "utf8");
    }
  } catch (error) {
    console.error("[api-trace-log] capture failed without blocking the request", safeError(error));
  }
}

function normalizeObservabilityRecord(value: unknown): ObservabilityLogRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.requestId !== "string" || typeof record.createdAt !== "string") {
    return null;
  }
  if (record.kind === "api-trace") return record as ApiTraceLogRecord;
  if (record.kind === "ai-attempt") return record as AiAttemptLogRecord;
  // Records captured before the admin dashboard shipped did not include a kind.
  if (typeof record.outcome === "string" && typeof record.personaId === "string") {
    return { ...record, kind: "ai-attempt" } as AiAttemptLogRecord;
  }
  return null;
}

async function readBlobRecord(pathname: string): Promise<ObservabilityLogRecord | null> {
  try {
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const value = JSON.parse(await new Response(result.stream).text());
    return normalizeObservabilityRecord(value);
  } catch {
    // A private store can list blob metadata but reject content reads with the
    // read-write token (403); treat an unreadable record as absent rather than
    // failing the whole dashboard.
    return null;
  }
}

async function listBlobRecords(limit: number): Promise<ObservabilityLogRecord[]> {
  const [attempts, traces] = await Promise.all([
    list({ prefix: `${LOG_PREFIX}/`, limit: Math.min(limit, 500) }),
    list({ prefix: `${TRACE_PREFIX}/`, limit: Math.min(limit, 500) }),
  ]);
  const blobs = [...attempts.blobs, ...traces.blobs]
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
    .slice(0, limit);
  const records: ObservabilityLogRecord[] = [];
  for (let index = 0; index < blobs.length; index += 12) {
    const batch = await Promise.all(blobs.slice(index, index + 12).map((blob) => readBlobRecord(blob.pathname)));
    records.push(...batch.filter((item): item is ObservabilityLogRecord => Boolean(item)));
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function listLocalRecords(limit: number): Promise<ObservabilityLogRecord[]> {
  try {
    const raw = await fs.readFile(/*turbopackIgnore: true*/ localLogPath(), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return null;
        }
      })
      .map(normalizeObservabilityRecord)
      .filter((item): item is ObservabilityLogRecord => Boolean(item))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function listObservabilityRecords(limit = 250): Promise<ObservabilityLogRecord[]> {
  if (!loggingEnabled()) return [];
  return usesBlobStore() ? listBlobRecords(limit) : listLocalRecords(limit);
}
