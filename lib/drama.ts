// The UI's soft ceiling for escalation. The API schema tolerates higher
// levels so decks saved before the cap existed still load and render.
export const DRAMA_CAP = 6;

export function isAtDramaCap(level: number): boolean {
  return level >= DRAMA_CAP;
}

export function dramaButtonLabel(level: number): string {
  if (isAtDramaCap(level)) return "This compliment cannot legally get more dramatic";
  if (level <= 1) return "Make it more dramatic";
  if (level === 2) return "Make it wildly excessive";
  if (level === 3) return "Summon the prophecy";
  return "Launch it into mythology";
}
