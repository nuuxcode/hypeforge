import { describe, expect, it, vi } from "vitest";
import { apiFailureDiagnostic, cardErrorMessage, globalErrorMessage, logApiExchange } from "@/lib/api-responses";

const guidelineFailure = {
  ok: false as const,
  error: "This compliment did not clear every Brand Team rule. Try this card again.",
  debug: {
    requestId: "request-123",
    route: "POST /api/escalate",
    startedAt: "2026-07-12T19:00:00.000Z",
    events: [
      {
        timestamp: "2026-07-12T19:00:01.000Z",
        level: "error" as const,
        scope: "provider" as const,
        message: "guideline compliance failed closed",
        details: { operation: "escalate", failedRuleIds: ["made-up-statistic"] },
      },
    ],
  },
};

describe("plain-language API diagnostics", () => {
  it("explains a rejected escalation and preserves the valid card", () => {
    const diagnostic = apiFailureDiagnostic({
      endpoint: "POST /api/escalate",
      status: 200,
      body: guidelineFailure,
    });

    expect(diagnostic.title).toBe("The AI draft was rejected by the company rules");
    expect(diagnostic.why).toContain("Made-up statistic");
    expect(diagnostic.howToFix).toContain("drama button again");
    expect(diagnostic.existingContentSafe).toContain("preserved unchanged");
  });

  it("uses action-accurate card copy instead of telling escalation users to find a retry button", () => {
    expect(cardErrorMessage(guidelineFailure, "escalate")).toContain("kept this valid compliment");
    expect(cardErrorMessage(guidelineFailure, "escalate")).toContain("increasing the drama again");
  });

  it("surfaces quota and configuration problems without playful ambiguity", () => {
    expect(globalErrorMessage({ ok: false, error: "Gemini has reached its current quota." })).toContain("quota");
    expect(globalErrorMessage({ ok: false, error: "Server configuration is missing." })).toContain("API key");
  });

  it("uses the server's actionable job-context error on the page and in console help", () => {
    const body = { ok: false as const, error: "Add a clear job title or describe what the person does at work." };
    expect(globalErrorMessage(body)).toBe(body.error);
    expect(apiFailureDiagnostic({ endpoint: "POST /api/generate", status: 200, body })).toMatchObject({
      title: "A job or workplace function is missing",
      howToFix: expect.stringContaining("Sara, Customer Success Manager"),
    });
  });

  it("prints an expanded nontechnical help group plus collapsed technical details", () => {
    const group = vi.spyOn(console, "group").mockImplementation(() => undefined);
    const groupCollapsed = vi.spyOn(console, "groupCollapsed").mockImplementation(() => undefined);
    const groupEnd = vi.spyOn(console, "groupEnd").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logApiExchange({
      endpoint: "POST /api/escalate",
      payload: { personaId: "epic-bard" },
      status: 200,
      ok: false,
      body: guidelineFailure,
      startedAt: performance.now(),
    });

    expect(group).toHaveBeenCalledWith("[HypeForge Help] The AI draft was rejected by the company rules");
    expect(error).toHaveBeenCalledWith("What happened:", expect.stringContaining("did not pass all 8 required checks"));
    expect(info).toHaveBeenCalledWith("How to fix it:", expect.stringContaining("drama button again"));
    expect(groupCollapsed).toHaveBeenCalledWith("[HypeForge Technical details] 1 provider error event");

    group.mockRestore();
    groupCollapsed.mockRestore();
    groupEnd.mockRestore();
    error.mockRestore();
    info.mockRestore();
    log.mockRestore();
    warn.mockRestore();
  });
});
