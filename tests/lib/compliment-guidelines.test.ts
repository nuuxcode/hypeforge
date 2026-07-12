import { describe, expect, it } from "vitest";
import {
  countComplimentWords,
  hasFunctionContext,
  verifyGuidelineOutput,
} from "@/lib/compliment-guidelines";
import { COMPLIANT_MODEL_OUTPUT, COMPLIANT_TEXT } from "@/tests/fixtures/guidelines";

describe("Company Compliment Guidelines v2.1", () => {
  it("uses the exact word-count boundary", () => {
    const fortyWords = Array.from({ length: 40 }, (_, index) => `word${index + 1}`).join(" ");
    const fortyOneWords = `${fortyWords} overflow`;

    expect(countComplimentWords(fortyWords)).toBe(40);
    expect(countComplimentWords(fortyOneWords)).toBe(41);
    expect(countComplimentWords("award-winning ... 99.7%")).toBe(2);
  });

  it("accepts both symbol and written percent statistics", () => {
    const writtenPercent = verifyGuidelineOutput(
      {
        ...COMPLIANT_MODEL_OUTPUT,
        text: COMPLIANT_MODEL_OUTPUT.text.replace("99.7%", "482 percent"),
        evidence: { ...COMPLIANT_MODEL_OUTPUT.evidence, madeUpStatistic: "482 percent of impossible requests" },
      },
      "Customer Success Manager",
    );

    expect(writtenPercent.guidelines.checks.find((check) => check.id === "made-up-statistic")?.state).toBe("pass");

    const commaPercent = verifyGuidelineOutput(
      {
        ...COMPLIANT_MODEL_OUTPUT,
        text: COMPLIANT_MODEL_OUTPUT.text.replace("99.7%", "7,000 percent"),
        evidence: { ...COMPLIANT_MODEL_OUTPUT.evidence, madeUpStatistic: "7,000 percent of impossible requests" },
      },
      "Customer Success Manager",
    );
    expect(commaPercent.guidelines.checks.find((check) => check.id === "made-up-statistic")?.state).toBe("pass");
  });

  it("extracts exact statistic evidence from valid compliment text when model evidence drifts", () => {
    const verified = verifyGuidelineOutput(
      {
        ...COMPLIANT_MODEL_OUTPUT,
        evidence: { ...COMPLIANT_MODEL_OUTPUT.evidence, madeUpStatistic: "almost every impossible request" },
      },
      "Customer Success Manager",
    );

    const statistic = verified.guidelines.checks.find((check) => check.id === "made-up-statistic");
    expect(statistic?.state).toBe("pass");
    expect(statistic?.evidence).toBe("99.7%");
  });

  it("accepts a fully grounded compliant compliment", () => {
    const verified = verifyGuidelineOutput(COMPLIANT_MODEL_OUTPUT, "Customer Success Manager");

    expect(verified.passed).toBe(true);
    expect(verified.text).toBe(COMPLIANT_TEXT);
    expect(verified.guidelines.wordCount).toBe(38);
    expect(verified.guidelines.checks).toHaveLength(8);
    expect(verified.guidelines.checks.every((check) => check.state === "pass")).toBe(true);
  });

  it("fails deterministic and evidence rules even when the model claims they passed", () => {
    const text = COMPLIANT_TEXT
      .replace("cosmic", "literally cosmic")
      .replace("99.7% of impossible requests", "an impossible amount of requests");
    const verified = verifyGuidelineOutput(
      {
        ...COMPLIANT_MODEL_OUTPUT,
        text,
        evidence: {
          ...COMPLIANT_MODEL_OUTPUT.evidence,
          absurdMetaphor: "a literally cosmic air-traffic controller for client chaos",
          madeUpStatistic: "an impossible amount",
        },
      },
      "Customer Success Manager",
    );

    expect(verified.passed).toBe(false);
    expect(verified.guidelines.checks.find((check) => check.id === "no-literally")?.state).toBe("fail");
    expect(verified.guidelines.checks.find((check) => check.id === "made-up-statistic")?.state).toBe("fail");
  });

  it("rejects appearance wording and ungrounded function evidence", () => {
    const verified = verifyGuidelineOutput(
      {
        ...COMPLIANT_MODEL_OUTPUT,
        text: COMPLIANT_TEXT.replace("Customer Success Manager", "Beautiful visionary"),
        evidence: { ...COMPLIANT_MODEL_OUTPUT.evidence, functionReference: "Beautiful visionary" },
      },
      "Customer Success Manager",
    );

    expect(verified.passed).toBe(false);
    expect(verified.guidelines.checks.find((check) => check.id === "no-appearance")?.state).toBe("fail");
    expect(verified.guidelines.checks.find((check) => check.id === "job-function")?.state).toBe("fail");
  });

  it("requires enough input context to ground a role or function", () => {
    expect(hasFunctionContext("Recruiter")).toBe(true);
    expect(hasFunctionContext("my friend Sara who fixes every crisis")).toBe(true);
    expect(hasFunctionContext("Sara")).toBe(false);
  });

  it("uses independent semantic results instead of trusting generation self-checks", () => {
    const unsafe = verifyGuidelineOutput(COMPLIANT_MODEL_OUTPUT, "Customer Success Manager", {
      noAppearanceReference: false,
      metaphorIsWildlyAbsurd: false,
      noRealPublicFigureComparison: false,
      workplaceAppropriate: false,
      meaningfullyMoreDramatic: true,
      notes: ["Independent evaluator rejected the semantic rules."],
    });

    expect(unsafe.passed).toBe(false);
    expect(
      unsafe.guidelines.checks
        .filter((check) => check.state === "fail")
        .map((check) => check.id),
    ).toEqual(expect.arrayContaining([
      "no-appearance",
      "absurd-metaphor",
      "no-public-figure",
      "workplace-appropriate",
    ]));
  });

  it("rejects broader appearance and unsafe-workplace wording deterministically", () => {
    const appearanceText = COMPLIANT_TEXT.replace("cosmic", "stylish");
    const appearance = verifyGuidelineOutput(
      {
        ...COMPLIANT_MODEL_OUTPUT,
        text: appearanceText,
        evidence: { ...COMPLIANT_MODEL_OUTPUT.evidence, absurdMetaphor: "a stylish air-traffic controller for client chaos" },
      },
      "Customer Success Manager",
    );
    expect(appearance.guidelines.checks.find((check) => check.id === "no-appearance")?.state).toBe("fail");

    const unsafeText = COMPLIANT_TEXT.replace("cosmic", "murder");
    const unsafe = verifyGuidelineOutput(
      {
        ...COMPLIANT_MODEL_OUTPUT,
        text: unsafeText,
        evidence: { ...COMPLIANT_MODEL_OUTPUT.evidence, absurdMetaphor: "a murder air-traffic controller for client chaos" },
      },
      "Customer Success Manager",
    );
    expect(unsafe.guidelines.checks.find((check) => check.id === "workplace-appropriate")?.state).toBe("fail");
  });
});
