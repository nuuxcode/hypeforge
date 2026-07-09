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
    expect(body.cards).toHaveLength(3);
    expect(body.cards[0]).toMatchObject({
      originalInput: "Customer Success Manager",
      dramaLevel: 1,
      status: "idle",
      copied: false,
    });
    expect(body.cards[0].history).toHaveLength(1);
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

    expect(response.status).toBe(400);
    expect(body.error).toContain("Give me a job title");
    expect(generateCompliment).not.toHaveBeenCalled();
  });
});
