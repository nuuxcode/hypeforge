import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/retry/route";
import { generateCompliantCompliment } from "@/lib/compliant-generation";

vi.mock("@/lib/compliant-generation", async () => {
  const { COMPLIANT_RESULT } = await import("@/tests/fixtures/guidelines");
  return {
    generateCompliantCompliment: vi.fn(async () => COMPLIANT_RESULT),
    isGuidelineComplianceError: (error: unknown) =>
      error instanceof Error && error.name === "GuidelineComplianceError",
  };
});

describe("POST /api/retry", () => {
  beforeEach(() => {
    process.env.RATELIMIT_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    vi.clearAllMocks();
  });

  it("regenerates one persona without exposing prompts", async () => {
    const response = await POST(
      new Request("http://localhost/api/retry", {
        method: "POST",
        body: JSON.stringify({ personaId: "epic-bard", originalInput: "Founding Engineer" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.text).toContain("cosmic air-traffic controller");
    expect(body.history).toEqual([body.text]);
    expect(body.dramaLevel).toBe(1);
    expect(body.guidelines.checks).toHaveLength(8);
    expect(generateCompliantCompliment).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown personas before model calls", async () => {
    const response = await POST(
      new Request("http://localhost/api/retry", {
        method: "POST",
        body: JSON.stringify({ personaId: "unknown", originalInput: "Founding Engineer" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Invalid compliment persona");
    expect(generateCompliantCompliment).not.toHaveBeenCalled();
  });
});
