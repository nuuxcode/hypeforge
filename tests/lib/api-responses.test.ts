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
        timestamp: "2026-07-12T19:00:00.500Z",
        level: "info" as const,
        scope: "provider" as const,
        message: "guideline validation completed",
        details: {
          attempt: 1,
          accepted: false,
          failedRuleIds: ["made-up-statistic"],
          rejectedCandidate: {
            text: "You coordinate client calm like a cosmic lighthouse without a numeric claim.",
            evidence: { madeUpStatistic: "an impossible amount" },
          },
          failureDetails: [{
            ruleId: "made-up-statistic",
            label: "Made-up statistic",
            reason: "No statistic pattern detected",
            location: "missing",
          }],
        },
      },
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
    expect(diagnostic.failedRuleIds).toEqual(["made-up-statistic"]);
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

  it("prints expanded nontechnical help and provider details for an API failure", () => {
    const group = vi.spyOn(console, "group").mockImplementation(() => undefined);
    const groupCollapsed = vi.spyOn(console, "groupCollapsed").mockImplementation(() => undefined);
    const groupEnd = vi.spyOn(console, "groupEnd").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const table = vi.spyOn(console, "table").mockImplementation(() => undefined);

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
    expect(group).toHaveBeenCalledWith("[HypeForge Technical details] 1 provider error event • request request-123");
    expect(group).toHaveBeenCalledWith("[HypeForge Rejected AI drafts] 1 rejected attempt • request request-123");
    expect(log).toHaveBeenCalledWith("Full Gemini output:", expect.stringContaining("cosmic lighthouse"));
    expect(error).toHaveBeenCalledWith("Failed check: Made-up statistic");
    expect(info).toHaveBeenCalledWith("Where:", "Missing from the output; there is no phrase to highlight.");
    expect(info).toHaveBeenCalledWith("Plain-English meaning:", expect.stringContaining("Final failed checks"));
    expect(group).toHaveBeenCalledWith("Made-up statistic was missing or unreadable • internal key: made-up-statistic");
    expect(info).toHaveBeenCalledWith("Validator:", expect.stringContaining("TypeScript"));
    expect(info).toHaveBeenCalledWith("How to investigate and fix:", expect.any(Array));
    expect(info).toHaveBeenCalledWith("Full diagnostic reference:", expect.stringContaining("/admin/reference?issue=made-up-statistic"));

    group.mockRestore();
    groupCollapsed.mockRestore();
    groupEnd.mockRestore();
    error.mockRestore();
    info.mockRestore();
    log.mockRestore();
    warn.mockRestore();
    table.mockRestore();
  });

  it("does not call a partial deck a success and explains the unavailable persona", () => {
    const group = vi.spyOn(console, "group").mockImplementation(() => undefined);
    const groupCollapsed = vi.spyOn(console, "groupCollapsed").mockImplementation(() => undefined);
    const groupEnd = vi.spyOn(console, "groupEnd").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const table = vi.spyOn(console, "table").mockImplementation(() => undefined);

    logApiExchange({
      endpoint: "POST /api/generate",
      payload: { jobFunction: "Customer Success Manager" },
      status: 200,
      ok: true,
      body: {
        cards: [{ personaName: "Grand", text: "", status: "error", error: "Rule checks failed." }],
        debug: guidelineFailure.debug,
      },
      startedAt: performance.now(),
    });

    expect(group).toHaveBeenCalledWith(expect.stringContaining("COMPLETED WITH 1 CARD ERROR"));
    expect(group).toHaveBeenCalledWith("[HypeForge Help] The deck finished, but 1 card was unavailable");
    expect(error).toHaveBeenCalledWith("Grand:", "Rule checks failed.");
    expect(info).toHaveBeenCalledWith("How to investigate:", expect.stringContaining("/admin"));

    group.mockRestore();
    groupCollapsed.mockRestore();
    groupEnd.mockRestore();
    error.mockRestore();
    info.mockRestore();
    log.mockRestore();
    warn.mockRestore();
    table.mockRestore();
  });
});
