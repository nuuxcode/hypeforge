import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/retry/route";
import { generateCompliment } from "@/lib/ai";

vi.mock("@/lib/ai", () => ({
  generateCompliment: vi.fn(async () => "This person is a blazing comet of competence with excellent timing."),
  providerErrorMessage: () => "The compliment engine got overwhelmed by your brilliance. Try again.",
}));

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
    expect(body.text).toContain("blazing comet");
    expect(body.history).toEqual([body.text]);
    expect(body.dramaLevel).toBe(1);
    expect(generateCompliment).toHaveBeenCalledTimes(1);
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
    expect(generateCompliment).not.toHaveBeenCalled();
  });
});
