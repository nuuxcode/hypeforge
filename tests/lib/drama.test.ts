import { describe, expect, it } from "vitest";
import { DRAMA_CAP, DRAMA_STAGES, dramaButtonLabel, dramaStage, isAtDramaCap } from "@/lib/drama";

describe("drama cap", () => {
  it("caps at level 6", () => {
    expect(DRAMA_CAP).toBe(6);
    expect(isAtDramaCap(5)).toBe(false);
    expect(isAtDramaCap(6)).toBe(true);
  });

  it("tolerates pre-cap decks saved at higher levels", () => {
    expect(isAtDramaCap(12)).toBe(true);
    expect(dramaButtonLabel(12)).toBe("Maximum drama achieved");
    expect(dramaStage(12).label).toBe("Maximum");
  });

  it("maps every level to a distinct named stage", () => {
    expect(DRAMA_STAGES).toHaveLength(6);
    expect(DRAMA_STAGES.map((stage) => stage.label)).toEqual([
      "Spark",
      "Amplified",
      "Wild",
      "Legendary",
      "Cosmic",
      "Maximum",
    ]);
  });

  it("ramps the button label with the level", () => {
    expect(dramaButtonLabel(1)).toBe("Make it more dramatic");
    expect(dramaButtonLabel(2)).toBe("Make it wildly excessive");
    expect(dramaButtonLabel(3)).toBe("Summon the prophecy");
    expect(dramaButtonLabel(4)).toBe("Launch it into mythology");
    expect(dramaButtonLabel(5)).toBe("Break the drama meter");
    expect(dramaButtonLabel(6)).toBe("Maximum drama achieved");
  });
});
