import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiDebug } from "@/lib/debug";
import { COMPLIANT_MODEL_OUTPUT } from "@/tests/fixtures/guidelines";
import { generateGuidelineCandidate } from "@/lib/ai";
import { generateCompliantCompliment, GuidelineComplianceError } from "@/lib/compliant-generation";

vi.mock("@/lib/ai", () => ({
  generateGuidelineCandidate: vi.fn(),
  isQuotaError: (error: unknown) => error instanceof Error && /quota|429|RESOURCE_EXHAUSTED/i.test(error.message),
}));

const baseArgs = () => ({
  messages: [{ role: "user" as const, content: "Write the compliment." }],
  subject: "Customer Success Manager",
  personaId: "epic-bard",
  operation: "generate" as const,
  debug: createApiDebug("TEST /guidelines"),
});

describe("generateCompliantCompliment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a verified candidate without repair", async () => {
    vi.mocked(generateGuidelineCandidate).mockResolvedValue(COMPLIANT_MODEL_OUTPUT);

    const result = await generateCompliantCompliment(baseArgs());

    expect(result.guidelines.checks.every((check) => check.state === "pass")).toBe(true);
    expect(generateGuidelineCandidate).toHaveBeenCalledTimes(1);
  });

  it("repairs one invalid candidate and verifies the replacement", async () => {
    vi.mocked(generateGuidelineCandidate)
      .mockResolvedValueOnce({
        ...COMPLIANT_MODEL_OUTPUT,
        text: COMPLIANT_MODEL_OUTPUT.text.replace("cosmic", "literally cosmic"),
        evidence: {
          ...COMPLIANT_MODEL_OUTPUT.evidence,
          absurdMetaphor: "a literally cosmic air-traffic controller for client chaos",
        },
      })
      .mockResolvedValueOnce(COMPLIANT_MODEL_OUTPUT);

    const result = await generateCompliantCompliment(baseArgs());

    expect(result.guidelines.checks.every((check) => check.state === "pass")).toBe(true);
    expect(generateGuidelineCandidate).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateGuidelineCandidate).mock.calls[1]?.[0]).toHaveLength(2);
  });

  it("fails closed after the repaired candidate remains invalid", async () => {
    const invalid = {
      ...COMPLIANT_MODEL_OUTPUT,
      text: COMPLIANT_MODEL_OUTPUT.text.replace("cosmic", "literally cosmic"),
      evidence: {
        ...COMPLIANT_MODEL_OUTPUT.evidence,
        absurdMetaphor: "a literally cosmic air-traffic controller for client chaos",
      },
    };
    vi.mocked(generateGuidelineCandidate).mockResolvedValue(invalid);

    await expect(generateCompliantCompliment(baseArgs())).rejects.toBeInstanceOf(GuidelineComplianceError);
    expect(generateGuidelineCandidate).toHaveBeenCalledTimes(2);
  });

  it("repairs malformed output once but skips repair for quota failures", async () => {
    vi.mocked(generateGuidelineCandidate)
      .mockRejectedValueOnce(new Error("structured output parse failed"))
      .mockResolvedValueOnce(COMPLIANT_MODEL_OUTPUT);
    await expect(generateCompliantCompliment(baseArgs())).resolves.toMatchObject({
      guidelines: { version: "2.1" },
    });
    expect(generateGuidelineCandidate).toHaveBeenCalledTimes(2);

    vi.clearAllMocks();
    vi.mocked(generateGuidelineCandidate).mockRejectedValue(new Error("429 quota exhausted"));
    await expect(generateCompliantCompliment(baseArgs())).rejects.toThrow("quota exhausted");
    expect(generateGuidelineCandidate).toHaveBeenCalledTimes(1);
  });
});
