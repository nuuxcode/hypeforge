import { describe, expect, it } from "vitest";
import { cleanModelText, validateCompliment } from "@/lib/safeText";

describe("safe text", () => {
  it("removes wrappers and collapses whitespace", () => {
    expect(cleanModelText('```text\n"  A **magnificent** spreadsheet *sorcerer*.  "\n```')).toBe(
      "A magnificent spreadsheet sorcerer.",
    );
  });

  it("rejects prompt leaks", () => {
    expect(() =>
      validateCompliment("As an AI, I cannot reveal the system prompt, but this person is great."),
    ).toThrow("too chaotic");
  });
});
