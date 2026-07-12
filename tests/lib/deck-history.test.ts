import { describe, expect, it } from "vitest";
import { buildSoftPreferenceContext, createShareToken, nextFeedbackVote, readShareToken, truncateHistoryAt, type TasteSignal } from "@/lib/deck-history";
import type { ComplimentCard } from "@/lib/types";
import { COMPLIANT_GUIDELINES } from "@/tests/fixtures/guidelines";

const card: ComplimentCard = {
  id: "card-1",
  originalInput: "Customer Success Manager",
  personaId: "epic-bard",
  personaName: "Epic Bard",
  text: "You turn every customer concern into a calm, confident success story.",
  history: ["You turn every customer concern into a calm, confident success story."],
  dramaLevel: 2,
  status: "idle",
  copied: false,
  guidelines: COMPLIANT_GUIDELINES,
};

const signals: TasteSignal[] = [
  {
    id: "old-like",
    deckId: "deck-1",
    cardId: "card-1",
    vote: "up",
    text: "Older liked wording",
    personaName: "Epic Bard",
    createdAt: "2026-07-09T09:00:00.000Z",
  },
  {
    id: "new-like",
    deckId: "deck-1",
    cardId: "card-2",
    vote: "up",
    text: "Newer liked wording",
    personaName: "Startup Hype Deck",
    createdAt: "2026-07-09T10:00:00.000Z",
  },
  {
    id: "dislike",
    deckId: "deck-1",
    cardId: "card-3",
    vote: "down",
    text: "Too much cosmic language",
    personaName: "Overcaffeinated Hype Friend",
    createdAt: "2026-07-09T11:00:00.000Z",
  },
];

describe("deck history helpers", () => {
  it("round-trips a shareable deck without exposing card history or preference data", () => {
    const token = createShareToken(card.originalInput, [card]);
    const shared = readShareToken(token);

    expect(shared).toEqual({
      input: "Customer Success Manager",
      cards: [
        {
          personaId: "epic-bard",
          personaName: "Epic Bard",
          text: card.text,
          dramaLevel: 2,
          originalInput: "Customer Success Manager",
          guidelines: COMPLIANT_GUIDELINES,
        },
      ],
    });
    expect(token).not.toContain("history");
    expect(readShareToken("not-a-deck")).toBeNull();
  });

  it("keeps recent likes and dislikes as small, separate soft signals", () => {
    expect(buildSoftPreferenceContext(signals)).toEqual({
      liked: ["Newer liked wording", "Older liked wording"],
      disliked: ["Too much cosmic language"],
    });
  });

  it("keeps exactly one vote per card and toggles the selected vote off", () => {
    expect(nextFeedbackVote("down", "up")).toBe("up");
    expect(nextFeedbackVote("up", "down")).toBe("down");
    expect(nextFeedbackVote("up", "up")).toBeUndefined();
  });
});

describe("truncateHistoryAt", () => {
  const v1 = "Version one.";
  const v2 = "Version two.";
  const v3 = "Version three.";

  it("cuts everything after the restored version", () => {
    expect(truncateHistoryAt([v1, v2, v3], v1)).toEqual([v1]);
    expect(truncateHistoryAt([v1, v2, v3], v2)).toEqual([v1, v2]);
  });

  it("keeps a full history when the newest version is restored", () => {
    expect(truncateHistoryAt([v1, v2, v3], v3)).toEqual([v1, v2, v3]);
  });

  it("uses the last occurrence when a text repeats", () => {
    expect(truncateHistoryAt([v1, v2, v1, v3], v1)).toEqual([v1, v2, v1]);
  });

  it("falls back to the restored text alone when history diverged", () => {
    expect(truncateHistoryAt([v1, v2], "A version from a retry.")).toEqual(["A version from a retry."]);
  });
});
