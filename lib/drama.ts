// The UI's soft ceiling for escalation. The API schema tolerates higher
// levels so decks saved before the cap existed still load and render.
export const DRAMA_CAP = 6;

export type DramaStage = {
  level: number;
  label: string;
  cue: string;
};

export const DRAMA_STAGES: readonly DramaStage[] = [
  { level: 1, label: "Spark", cue: "The opening act" },
  { level: 2, label: "Amplified", cue: "Energy rising" },
  { level: 3, label: "Wild", cue: "Reality bending" },
  { level: 4, label: "Legendary", cue: "Myth in motion" },
  { level: 5, label: "Cosmic", cue: "Universal stakes" },
  { level: 6, label: "Maximum", cue: "Peak legend" },
] as const;

export function dramaStage(level: number): DramaStage {
  const boundedLevel = Math.min(Math.max(Math.floor(level), 1), DRAMA_CAP);
  return DRAMA_STAGES[boundedLevel - 1]!;
}

export function isAtDramaCap(level: number): boolean {
  return level >= DRAMA_CAP;
}

export function dramaButtonLabel(level: number): string {
  if (isAtDramaCap(level)) return "Maximum drama achieved";
  if (level <= 1) return "Make it more dramatic";
  if (level === 2) return "Make it wildly excessive";
  if (level === 3) return "Summon the prophecy";
  if (level === 4) return "Launch it into mythology";
  return "Break the drama meter";
}
