import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/escalate/route";
import { generateCompliantCompliment } from "@/lib/compliant-generation";

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
      expect.objectContaining({ operation: "escalate", subject: "Customer Success Manager" }),
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
});
