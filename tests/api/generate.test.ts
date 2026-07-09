import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";
import { generateCompliment } from "@/lib/ai";

vi.mock("@/lib/ai", () => ({
  generateCompliment: vi.fn(async () => "This person is a blazing comet of competence with excellent timing."),
  isQuotaError: (error: unknown) =>
    error instanceof Error && /quota|RESOURCE_EXHAUSTED|429|rate.?limit/i.test(error.message),
  providerErrorMessage: (error: unknown) =>
    error instanceof Error && /No LLM API key/i.test(error.message)
      ? "Server configuration is missing."
      : "The compliment engine got overwhelmed by your brilliance. Try again.",
}));

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
    expect(body.debug.requestId).toEqual(expect.any(String));
    expect(body.debug.events.some((event: { message: string }) => event.message === "selected personas")).toBe(true);
    expect(generateCompliment).toHaveBeenCalledTimes(3);
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
    expect(generateCompliment).not.toHaveBeenCalled();
  });

  it("returns backend debug details when the LLM provider fails", async () => {
    vi.mocked(generateCompliment).mockRejectedValue(new Error("quota exceeded for gemini-2.5-flash"));

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
    expect(generateCompliment).toHaveBeenCalledTimes(3);
    expect(body.debug.events.some((event: { message: string }) => event.message === "persona generation failed")).toBe(
      true,
    );
    expect(
      body.debug.events.some(
        (event: { message: string }) => event.message === "skipping retry: provider quota exhausted, retry would fail too",
      ),
    ).toBe(true);
    expect(JSON.stringify(body.debug)).toContain("quota exceeded");
  });

  it("retries once when the provider fails for a non-quota reason", async () => {
    vi.mocked(generateCompliment).mockRejectedValue(new Error("Model output was truncated."));

    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: JSON.stringify({ input: "Recruiter who never misses" }),
      }),
    );
    const body = await response.json();

    expect(body.ok).toBe(false);
    expect(generateCompliment).toHaveBeenCalledTimes(6);
    expect(body.debug.events.some((event: { message: string }) => event.message === "persona retry failed")).toBe(true);
  });
});
