import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";
import { generateCompliantCompliment } from "@/lib/compliant-generation";

vi.mock("@/lib/compliant-generation", async () => {
  const { COMPLIANT_RESULT } = await import("@/tests/fixtures/guidelines");
  return {
    generateCompliantCompliment: vi.fn(async () => COMPLIANT_RESULT),
    isGuidelineComplianceError: (error: unknown) =>
      error instanceof Error && error.name === "GuidelineComplianceError",
  };
});

describe("POST /api/generate", () => {
  beforeEach(() => {
    process.env.RATELIMIT_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    vi.clearAllMocks();
  });

  it("returns three public compliment cards", async () => {
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: JSON.stringify({ input: "Customer Success Manager" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.cards).toHaveLength(3);
    expect(body.cards[0]).toMatchObject({
      originalInput: "Customer Success Manager",
      dramaLevel: 1,
      status: "idle",
      copied: false,
    });
    expect(body.cards[0].history).toHaveLength(1);
    expect(body.cards[0].guidelines).toMatchObject({ version: "2.1", wordCount: 38 });
    expect(body.cards[0].guidelines.checks).toHaveLength(8);
    expect(body.debug.requestId).toEqual(expect.any(String));
    expect(body.debug.events.some((event: { message: string }) => event.message === "selected personas")).toBe(true);
    expect(generateCompliantCompliment).toHaveBeenCalledTimes(3);
  });

  it("rejects invalid input before model calls", async () => {
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: JSON.stringify({ input: "" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Give me a job title");
    expect(body.debug.events.some((event: { message: string }) => event.message === "input sanitization failed")).toBe(
      true,
    );
    expect(generateCompliantCompliment).not.toHaveBeenCalled();
  });

  it("returns backend debug details without exposing failed compliment text", async () => {
    vi.mocked(generateCompliantCompliment).mockRejectedValue(new Error("quota exceeded for gemini"));

    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: JSON.stringify({ input: "Recruiter who never misses" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("overwhelmed");
    expect(body.cards).toHaveLength(3);
    expect(body.cards.every((card: { text: string }) => card.text === "")).toBe(true);
    expect(generateCompliantCompliment).toHaveBeenCalledTimes(3);
    expect(body.debug.events.some((event: { message: string }) => event.message === "persona generation failed")).toBe(
      true,
    );
    expect(JSON.stringify(body.debug)).toContain("quota exceeded");
  });

  it("returns the guideline failure message when every persona fails closed", async () => {
    const error = Object.assign(new Error("This compliment did not clear every Brand Team rule. Try this card again."), {
      name: "GuidelineComplianceError",
    });
    vi.mocked(generateCompliantCompliment).mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: JSON.stringify({ input: "Recruiter who never misses" }),
      }),
    );
    const body = await response.json();

    expect(body.ok).toBe(false);
    expect(body.error).toContain("Brand Team rule");
    expect(body.cards.every((card: { text: string }) => card.text === "")).toBe(true);
    expect(generateCompliantCompliment).toHaveBeenCalledTimes(3);
  });
});
