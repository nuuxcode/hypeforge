import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";
import { generateCompliment } from "@/lib/ai";

vi.mock("@/lib/ai", () => ({
  generateCompliment: vi.fn(async () => "This person is a blazing comet of competence with excellent timing."),
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

  it("falls back to local compliments and returns backend debug details when provider calls fail", async () => {
    vi.mocked(generateCompliment).mockRejectedValue(new Error("quota exceeded for gemini-2.5-flash"));

    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: JSON.stringify({ input: "Recruiter who never misses" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.cards).toHaveLength(3);
    expect(body.cards.every((card: { status: string; text: string }) => card.status === "idle" && card.text.length > 0)).toBe(
      true,
    );
    expect(body.debug.events.some((event: { message: string }) => event.message === "persona generation failed")).toBe(
      true,
    );
    expect(body.debug.events.some((event: { message: string }) => event.message === "local compliment fallback generated")).toBe(
      true,
    );
    expect(JSON.stringify(body.debug)).toContain("quota exceeded");
  });
});
