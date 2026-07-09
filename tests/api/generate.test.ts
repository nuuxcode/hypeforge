import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";
import { generateComplimentDeck } from "@/lib/ai";

vi.mock("@/lib/ai", () => ({
  generateComplimentDeck: vi.fn(async (personas: Array<{ id: string; name: string }>) =>
    Object.fromEntries(
      personas.map((persona) => [
        persona.id,
        `${persona.name} declares this person a blazing comet of competence with excellent timing.`,
      ]),
    ),
  ),
  providerErrorMessage: (error: unknown) =>
    error instanceof Error && /quota/i.test(error.message)
      ? "Gemini quota is exhausted right now. HypeForge is LLM-only, so add billing, wait for quota reset, or update GEMINI_API_KEY."
      : "The LLM provider failed. Open the console for the real provider error.",
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
    expect(generateComplimentDeck).toHaveBeenCalledTimes(1);
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
    expect(generateComplimentDeck).not.toHaveBeenCalled();
  });

  it("returns backend debug details when the LLM provider fails", async () => {
    vi.mocked(generateComplimentDeck).mockRejectedValue(new Error("quota exceeded for gemini-2.5-flash"));

    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: JSON.stringify({ input: "Recruiter who never misses" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Gemini quota is exhausted");
    expect(body.cards).toBeUndefined();
    expect(body.debug.events.some((event: { message: string }) => event.message === "deck generation failed")).toBe(true);
    expect(JSON.stringify(body.debug)).toContain("quota exceeded");
  });
});
