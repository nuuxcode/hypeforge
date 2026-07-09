import { describe, expect, it } from "vitest";
import { buildSoftPreferenceContext, createShareToken, nextFeedbackVote, readShareToken, type TasteSignal } from "@/lib/deck-history";
import type { ComplimentCard } from "@/lib/types";

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
