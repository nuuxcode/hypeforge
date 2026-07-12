import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import type { GuidelineModelOutput } from "./compliment-guidelines";
import type { DeliveryMode, GuidelineCompliance } from "./types";

type FailureOutcome = "rejected-candidate" | "provider-error" | "recovered";

export type AiFailureLogInput = {
  requestId: string;
  operation: "generate" | "retry" | "escalate" | "tweak";
  personaId: string;
  deliveryMode?: DeliveryMode;
  subject: string;
  attempt: number;
  maxAttempts: number;
  outcome: FailureOutcome;
  candidate?: GuidelineModelOutput;
  compliance?: GuidelineCompliance;
  failedRuleIds?: string[];
  semanticNotes?: string[];
  dramaticFailure?: string;
  modeFailure?: string;
  error?: unknown;
};

const LOG_PREFIX = "hypeforge-ai-failures";
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

function safeError(error: unknown): { name: string; message: string } | undefined {
  if (error === undefined) return undefined;
  if (error instanceof Error) return { name: error.name, message: redact(error.message).slice(0, 2_000) };
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
  const record = {
    version: 1,
    id: randomUUID(),
    createdAt,
    requestId: input.requestId,
    promptVersion: "company-guidelines-v2.1-repair-v2",
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
    compliance: input.compliance,
    failedRuleIds: input.failedRuleIds ?? [],
    semanticNotes: input.semanticNotes ?? [],
    dramaticFailure: input.dramaticFailure,
    modeFailure: input.modeFailure,
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
