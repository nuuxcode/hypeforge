import { describe, expect, it } from "vitest";
import { distinctnessIssues, isDistinctCompliment } from "@/lib/deck-distinctness";
import { COMPLIANT_GUIDELINES } from "@/tests/fixtures/guidelines";

const withEvidence = (text: string, metaphor: string, statistic: string) => ({
  text,
  guidelines: {
    ...COMPLIANT_GUIDELINES,
    checks: COMPLIANT_GUIDELINES.checks.map((check) =>
      check.id === "absurd-metaphor"
        ? { ...check, evidence: metaphor }
        : check.id === "made-up-statistic"
          ? { ...check, evidence: statistic }
          : check,
    ),
  },
});

describe("deck distinctness", () => {
  const first = withEvidence(
    "Teacher, you are a lighthouse guiding 92% of algebra storms toward a calm harbor before lunch.",
    "a lighthouse guiding algebra storms",
    "92% of algebra storms",
  );

  it("rejects exact and near-duplicate wording", () => {
    expect(distinctnessIssues(first, [first])).toContain("exact duplicate text");
    expect(
      distinctnessIssues(
        withEvidence(
          "Teacher, you are a lighthouse guiding 93% of algebra storms toward a calm harbor before lunch.",
          "a lighthouse guiding algebra storms",
          "93% of algebra storms",
        ),
        [first],
      ),
    ).toEqual(expect.arrayContaining(["near-duplicate wording", "repeated metaphor"]));
  });

  it("rejects repeated statistics but accepts a genuinely different card", () => {
    expect(
      distinctnessIssues(
        withEvidence(
          "Teacher, your lessons are a moon-sized map that makes 92% of algebra storms ask for directions.",
          "a moon-sized map",
          "92% of algebra storms",
        ),
        [first],
      ),
    ).toContain("repeated statistic");

    expect(
      isDistinctCompliment(
        withEvidence(
          "Teacher, your patience is a time machine helping 87.4% of nervous questions return as confident discoveries.",
          "a time machine",
          "87.4% of nervous questions",
        ),
        [first],
      ),
    ).toBe(true);
  });
});
