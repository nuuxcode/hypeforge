import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";
import { generateCompliantCompliment } from "@/lib/compliant-generation";

vi.mock("@/lib/compliant-generation", async () => {
  const { COMPLIANT_GUIDELINES } = await import("@/tests/fixtures/guidelines");
  const texts: Record<string, string> = {
    "epic-bard": "Hear this: the Customer Success Manager is a legendary compass steering 91.2% of bewildered client voyages toward golden harbors, while every support obstacle politely lowers its drawbridge before your calm command.",
    "hype-friend": "Okay, everyone: this Customer Success Manager is a confetti-powered control tower turning 89.5% of panicked messages into happy dance breaks before anyone can type help, and the whole office should cheer.",
    "awards-committee": "By unanimous decree, this Customer Success Manager conducts a platinum orchestra where 94.1% of client concerns arrive as noise and depart as standing ovations, complete with imaginary medals for extraordinary calm.",
    "nature-doc": "Observe the Customer Success Manager, a lighthouse teaching client storms to file orderly paperwork, with 97.3% of support hurricanes becoming calm picnics whenever your judgment enters the queue.",
    "theater-critic": "Five stars: this Customer Success Manager delivers a five-act triumph where 88.4% of impossible tickets bow, apologize for the interruption, and leave the stage carrying thank-you flowers.",
    "sports-commentator": "Breaking news: this Customer Success Manager quarterbacks customer calm like a stadium-sized strategy engine, converting 93.6% of last-minute chaos into victory laps before the imaginary crowd finishes its first cheer.",
    "ancient-oracle": "The stars report this Customer Success Manager turns 92.8% of customer thunderclouds into harmless desk lamps, proving your support instincts could negotiate peace between rival constellations.",
    "startup-hype": "Board update: this Customer Success Manager operates a rocket-fueled empathy engine with 96.4% imaginary retention velocity, transforming every difficult conversation into enough trust to make the directors request another chart.",
  };
  return {
    generateCompliantCompliment: vi.fn(async ({ personaId }: { personaId: string }) => ({
      text: texts[personaId] ?? texts["nature-doc"],
      guidelines: COMPLIANT_GUIDELINES,
    })),
    isGuidelineComplianceError: (error: unknown) =>
      error instanceof Error && error.name === "GuidelineComplianceError",
  };
});

describe("POST /api/generate", () => {
  beforeEach(() => {
    process.env.RATELIMIT_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    vi.clearAllMocks();
  });

  it("returns three direct-message compliment cards by default", async () => {
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
      deliveryMode: "direct",
    });
    expect(body.cards[0].history).toHaveLength(1);
    expect(body.cards[0].guidelines).toMatchObject({ version: "2.1", wordCount: 38 });
    expect(body.cards[0].guidelines.checks).toHaveLength(8);
    expect(body.debug.requestId).toEqual(expect.any(String));
    expect(body.debug.events.some((event: { message: string }) => event.message === "selected personas")).toBe(true);
    expect(generateCompliantCompliment).toHaveBeenCalledTimes(3);
  });

  it("preserves public-post delivery mode through every generated card", async () => {
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: JSON.stringify({ jobFunction: "Customer Success Manager", deliveryMode: "public" }),
      }),
    );
    const body = await response.json();

    expect(body.cards.every((card: { deliveryMode: string }) => card.deliveryMode === "public")).toBe(true);
    expect(generateCompliantCompliment).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryMode: "public" }),
    );
  });

  it("keeps a required function and optional details separate throughout the card contract", async () => {
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: JSON.stringify({
          jobFunction: "Customer Success Manager",
          personDetails: "calmed a difficult client call",
        }),
      }),
    );
    const body = await response.json();

    expect(body.cards).toHaveLength(3);
    expect(body.cards.every((card: { jobFunction: string }) => card.jobFunction === "Customer Success Manager")).toBe(true);
    expect(body.cards.every((card: { personDetails: string }) => card.personDetails === "calmed a difficult client call")).toBe(true);
    expect(body.cards[0].originalInput).toBe("Customer Success Manager - calmed a difficult client call");
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
