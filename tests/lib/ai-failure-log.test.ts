import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureAiFailure, captureApiTrace, listObservabilityRecords } from "@/lib/ai-failure-log";
import { COMPLIANT_MODEL_OUTPUT } from "@/tests/fixtures/guidelines";

describe("AI failure logging", () => {
  let directory = "";
  const previousCapture = process.env.HYPEFORGE_CAPTURE_AI_FAILURES;
  const previousPath = process.env.HYPEFORGE_FAILURE_LOG_PATH;
  const previousBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const previousBlobStore = process.env.BLOB_STORE_ID;
  const previousRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "hypeforge-failures-"));
    process.env.HYPEFORGE_CAPTURE_AI_FAILURES = "true";
    process.env.HYPEFORGE_FAILURE_LOG_PATH = path.join(directory, "failures.ndjson");
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(async () => {
    if (previousCapture === undefined) delete process.env.HYPEFORGE_CAPTURE_AI_FAILURES;
    else process.env.HYPEFORGE_CAPTURE_AI_FAILURES = previousCapture;
    if (previousPath === undefined) delete process.env.HYPEFORGE_FAILURE_LOG_PATH;
    else process.env.HYPEFORGE_FAILURE_LOG_PATH = previousPath;
    if (previousBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previousBlobToken;
    if (previousBlobStore === undefined) delete process.env.BLOB_STORE_ID;
    else process.env.BLOB_STORE_ID = previousBlobStore;
    if (previousRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousRedisUrl;
    if (previousRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousRedisToken;
    await rm(directory, { recursive: true, force: true });
  });

  it("keeps rejected output diagnostics without storing the raw subject", async () => {
    const rawSubject = "Mounssif's secret internal customer role";
    await captureAiFailure({
      requestId: "request-123",
      operation: "escalate",
      personaId: "epic-bard",
      deliveryMode: "direct",
      subject: rawSubject,
      attempt: 1,
      maxAttempts: 3,
      outcome: "rejected-candidate",
      candidate: COMPLIANT_MODEL_OUTPUT,
      failedRuleIds: ["made-up-statistic"],
      semanticNotes: ["The statistic was not clearly fictional."],
    });
    const serialized = await readFile(process.env.HYPEFORGE_FAILURE_LOG_PATH!, "utf8");
    const record = JSON.parse(serialized.trim());

    expect(serialized).not.toContain(rawSubject);
    expect(record.subjectFingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(record.candidate.text).toBe(COMPLIANT_MODEL_OUTPUT.text);
    expect(record.failedRuleIds).toEqual(["made-up-statistic"]);
    expect(record.promptVersion).toBe("company-guidelines-v2.1-repair-v3");
  });

  it("lists accepted model attempts and complete API traces from the local store", async () => {
    await captureAiFailure({
      requestId: "request-complete",
      operation: "generate",
      personaId: "epic-bard",
      deliveryMode: "direct",
      subject: "Customer Success Manager",
      attempt: 1,
      maxAttempts: 2,
      outcome: "accepted",
      candidate: COMPLIANT_MODEL_OUTPUT,
    });
    await captureApiTrace({
      requestId: "request-complete",
      route: "POST /api/generate",
      startedAt: "2026-07-12T20:00:00.000Z",
      elapsedMs: 1200,
      events: [{
        timestamp: "2026-07-12T20:00:01.000Z",
        level: "info",
        scope: "provider",
        message: "persona generation succeeded",
        details: { personaId: "epic-bard" },
      }],
    });

    const records = await listObservabilityRecords();
    expect(records).toHaveLength(2);
    expect(records.map((record) => record.kind).sort()).toEqual(["ai-attempt", "api-trace"]);
    expect(records.find((record) => record.kind === "ai-attempt")).toMatchObject({ outcome: "accepted" });
    expect(records.find((record) => record.kind === "api-trace")).toMatchObject({ severity: "success" });
  });
});
