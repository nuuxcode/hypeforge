import { describe, expect, it } from "vitest";
import { DRAMA_CAP, dramaButtonLabel, isAtDramaCap } from "@/lib/drama";

describe("drama cap", () => {
  it("caps at level 6", () => {
    expect(DRAMA_CAP).toBe(6);
    expect(isAtDramaCap(5)).toBe(false);
    expect(isAtDramaCap(6)).toBe(true);
  });

  it("tolerates pre-cap decks saved at higher levels", () => {
    expect(isAtDramaCap(12)).toBe(true);
    expect(dramaButtonLabel(12)).toContain("cannot legally");
  });

  it("ramps the button label with the level", () => {
    expect(dramaButtonLabel(1)).toBe("Make it more dramatic");
    expect(dramaButtonLabel(2)).toBe("Make it wildly excessive");
    expect(dramaButtonLabel(3)).toBe("Summon the prophecy");
    expect(dramaButtonLabel(4)).toBe("Launch it into mythology");
    expect(dramaButtonLabel(6)).toBe("This compliment cannot legally get more dramatic");
  });
});
