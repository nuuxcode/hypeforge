import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureAiFailure } from "@/lib/ai-failure-log";
import { COMPLIANT_MODEL_OUTPUT } from "@/tests/fixtures/guidelines";

describe("AI failure logging", () => {
  let directory = "";
  const previousCapture = process.env.HYPEFORGE_CAPTURE_AI_FAILURES;
  const previousPath = process.env.HYPEFORGE_FAILURE_LOG_PATH;
  const previousBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const previousBlobStore = process.env.BLOB_STORE_ID;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "hypeforge-failures-"));
    process.env.HYPEFORGE_CAPTURE_AI_FAILURES = "true";
    process.env.HYPEFORGE_FAILURE_LOG_PATH = path.join(directory, "failures.ndjson");
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
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
    expect(record.promptVersion).toBe("company-guidelines-v2.1-repair-v2");
  });
});
