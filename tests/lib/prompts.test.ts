import { describe, expect, it } from "vitest";
import { getPersona } from "@/lib/personas";
import { buildEscalationMessages, buildInitialMessages } from "@/lib/prompts";

describe("prompts", () => {
  const persona = getPersona("epic-bard");

  it("builds a persona-specific initial prompt", () => {
    expect(persona).not.toBeNull();
    const messages = buildInitialMessages(persona!, "Founding Engineer");

    expect(messages[0]?.content).toContain("Epic Bard");
    expect(messages[1]?.content).toContain("Founding Engineer");
    expect(messages[1]?.content).toContain("exactly 2 compact sentences");
    expect(messages[1]?.content).toContain("Output only the compliment text");
  });

  it("uses feedback as a soft, non-copying taste signal", () => {
    const messages = buildInitialMessages(persona!, "Founding Engineer", {
      liked: ["Warm, specific praise with an unexpected metaphor."],
      disliked: ["Long, generic praise with repeated cosmic imagery."],
    });

    expect(messages[1]?.content).toContain("Soft taste signals");
    expect(messages[1]?.content).toContain("Never copy wording");
  });

  it("passes prior public versions into escalation", () => {
    expect(persona).not.toBeNull();
    const messages = buildEscalationMessages({
      persona: persona!,
      originalInput: "Recruiter who never misses",
      currentText: "They spot talent before the resume has finished loading.",
      history: [
        "They spot talent before the resume has finished loading.",
        "They make hiring pipelines feel like victory parades.",
      ],
      dramaLevel: 2,
    });

    expect(messages[1]?.content).toContain("Previous versions");
    expect(messages[1]?.content).toContain("They make hiring pipelines feel like victory parades.");
    expect(messages[1]?.content).toContain("Do not reuse exact metaphors");
    expect(messages[1]?.content).toContain("No markdown");
    expect(messages[1]?.content).toContain("Exactly 2 compact sentences");
    expect(messages[1]?.content).not.toContain("40%");
  });
});
