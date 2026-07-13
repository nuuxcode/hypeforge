import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/escalate/route";
import { generateCompliantCompliment } from "@/lib/compliant-generation";
import { COMPLIANT_RESULT } from "@/tests/fixtures/guidelines";

vi.mock("@/lib/compliant-generation", async () => {
  const { COMPLIANT_RESULT } = await import("@/tests/fixtures/guidelines");
  return {
    generateCompliantCompliment: vi.fn(async () => COMPLIANT_RESULT),
    isGuidelineComplianceError: (error: unknown) =>
      error instanceof Error && error.name === "GuidelineComplianceError",
  };
});

const currentText = "You turn every customer concern into a calm, confident success story.";

describe("POST /api/escalate", () => {
  beforeEach(() => {
    process.env.RATELIMIT_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    vi.clearAllMocks();
  });

  it("returns a newly verified higher-drama version", async () => {
    const response = await POST(
      new Request("http://localhost/api/escalate", {
        method: "POST",
        body: JSON.stringify({
          personaId: "epic-bard",
          originalInput: "Customer Success Manager",
          currentText,
          history: [currentText],
          dramaLevel: 1,
          deliveryMode: "public",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.dramaLevel).toBe(2);
    expect(body.history).toEqual([currentText, body.text]);
    expect(body.guidelines).toMatchObject({ version: "2.1", wordCount: 38 });
    expect(body.guidelines.checks).toHaveLength(8);
    expect(generateCompliantCompliment).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "escalate", subject: "Customer Success Manager", deliveryMode: "public" }),
    );
  });

  it("does not call Gemini for an unknown persona", async () => {
    const response = await POST(
      new Request("http://localhost/api/escalate", {
        method: "POST",
        body: JSON.stringify({
          personaId: "unknown",
          originalInput: "Customer Success Manager",
          currentText,
          history: [currentText],
          dramaLevel: 1,
        }),
      }),
    );
    const body = await response.json();

    expect(body.ok).toBe(false);
    expect(body.error).toContain("Invalid compliment persona");
    expect(generateCompliantCompliment).not.toHaveBeenCalled();
  });

  it("compounds levels using only the selected card history", async () => {
    const levelTwoResponse = await POST(
      new Request("http://localhost/api/escalate", {
        method: "POST",
        body: JSON.stringify({
          personaId: "epic-bard",
          originalInput: "Customer Success Manager - calmed a difficult client call",
          jobFunction: "Customer Success Manager",
          personDetails: "calmed a difficult client call",
          currentText,
          history: [currentText],
          dramaLevel: 1,
        }),
      }),
    );
    const levelTwo = await levelTwoResponse.json();

    const levelThreeResponse = await POST(
      new Request("http://localhost/api/escalate", {
        method: "POST",
        body: JSON.stringify({
          personaId: "epic-bard",
          originalInput: "Customer Success Manager - calmed a difficult client call",
          jobFunction: "Customer Success Manager",
          personDetails: "calmed a difficult client call",
          currentText: levelTwo.text,
          history: levelTwo.history,
          dramaLevel: levelTwo.dramaLevel,
        }),
      }),
    );
    const levelThree = await levelThreeResponse.json();

    expect(levelTwo.dramaLevel).toBe(2);
    expect(levelThree.dramaLevel).toBe(3);
    expect(levelThree.history).toHaveLength(3);
    expect(generateCompliantCompliment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        operation: "escalate",
        subject: "Customer Success Manager",
        previousText: levelTwo.text,
      }),
    );
    const secondCall = vi.mocked(generateCompliantCompliment).mock.calls[1]?.[0];
    expect(JSON.stringify(secondCall?.messages)).toContain("calmed a difficult client call");
    expect(JSON.stringify(secondCall?.messages)).toContain(currentText);
  });

  it("streams real attempt progress before the final result", async () => {
    vi.mocked(generateCompliantCompliment).mockImplementationOnce(async (args) => {
      args.onProgress?.({ attempt: 1, maxAttempts: 3, phase: "generating", message: "Generating…" });
      args.onProgress?.({ attempt: 1, maxAttempts: 3, phase: "checking", message: "Checking…" });
      args.onProgress?.({ attempt: 1, maxAttempts: 3, phase: "repairing", message: "Repairing…", failedRuleIds: ["made-up-statistic"] });
      args.onProgress?.({ attempt: 2, maxAttempts: 3, phase: "generating", message: "Generating repair…" });
      return COMPLIANT_RESULT;
    });
    const response = await POST(
      new Request("http://localhost/api/escalate", {
        method: "POST",
        headers: { accept: "application/x-ndjson" },
        body: JSON.stringify({
          personaId: "epic-bard",
          originalInput: "Customer Success Manager",
          currentText,
          history: [currentText],
          dramaLevel: 1,
          deliveryMode: "direct",
        }),
      }),
    );
    const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));

    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(events.filter((event) => event.type === "progress")).toHaveLength(4);
    expect(events.at(-1)).toMatchObject({ type: "result", body: { ok: true, dramaLevel: 2 } });
  });

  it("returns safe exact failure diagnostics when all rewrites are rejected", async () => {
    const error = Object.assign(new Error("This compliment did not clear every Brand Team rule. Try this card again."), {
      name: "GuidelineComplianceError",
      attemptCount: 3,
      failedRuleIds: ["dramatic-escalation"],
      failureDetails: [{
        ruleId: "dramatic-escalation",
        label: "Meaningfully more dramatic",
        reason: "The rewrite was only a paraphrase.",
        location: "whole-output",
      }],
    });
    vi.mocked(generateCompliantCompliment).mockRejectedValueOnce(error);

    const response = await POST(new Request("http://localhost/api/escalate", {
      method: "POST",
      body: JSON.stringify({
        personaId: "epic-bard",
        originalInput: "Customer Success Manager",
        currentText,
        history: [currentText],
        dramaLevel: 1,
        deliveryMode: "direct",
      }),
    }));
    const body = await response.json();

    expect(body).toMatchObject({
      ok: false,
      diagnostics: {
        attemptCount: 3,
        failedRuleIds: ["dramatic-escalation"],
        failureDetails: [expect.objectContaining({ location: "whole-output" })],
      },
    });
  });
});
