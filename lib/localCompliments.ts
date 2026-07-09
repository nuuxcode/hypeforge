import { validateCompliment } from "./safeText";
import type { Persona } from "./types";

const GRAND_OPENERS = [
  "The committee has reviewed the evidence and reached a unanimous verdict",
  "After exhaustive deliberation, the room rises to acknowledge the obvious",
  "A formal citation has been drafted in gold ink because ordinary ink gave up",
];

const MYTHIC_OPENERS = [
  "The old stars have checked their ledgers and found a new favorite",
  "Legends are usually written after centuries, but this one filed early",
  "Somewhere, a mountain just stood taller out of professional respect",
];

const CHAOTIC_OPENERS = [
  "Stop everything, because the scoreboard just learned a new emotion",
  "The group chat is typing in all caps because the evidence is overwhelming",
  "The room briefly lost structural integrity from the sheer competence on display",
];

const FINISHERS = [
  "Every task nearby becomes calmer, sharper, and slightly embarrassed by how easy you make it look.",
  "You turn ordinary pressure into proof that excellence can have timing, taste, and a dramatic entrance.",
  "People do not just trust your work; they start making better plans because your standards walked in.",
  "You make complicated moments feel handled before anyone else has even found the right tab.",
  "Your presence upgrades the whole operation from hopeful improvisation to strangely elegant inevitability.",
];

const ESCALATION_OPENERS = [
  "The previous compliment has been reviewed and found insufficiently theatrical",
  "We attempted restraint, but restraint saw your work and quietly resigned",
  "The drama meter has requested a larger office and a ceremonial cape",
];

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick(items: readonly string[], seed: number, offset: number): string {
  return items[(seed + offset) % items.length]!;
}

function openerFor(persona: Persona, seed: number): string {
  if (persona.bucket === "grand") return pick(GRAND_OPENERS, seed, 0);
  if (persona.bucket === "mythic") return pick(MYTHIC_OPENERS, seed, 1);
  return pick(CHAOTIC_OPENERS, seed, 2);
}

function subjectLabel(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (/^(a|an|the|my)\b/i.test(trimmed)) return trimmed;
  return `the ${trimmed}`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function generateLocalCompliment(persona: Persona, input: string): string {
  const seed = hashText(`${persona.id}:${input}`);
  const subject = subjectLabel(input);
  const text = `${openerFor(persona, seed)}: ${subject} is operating at ${persona.name.toLowerCase()} levels. ${pick(
    FINISHERS,
    seed,
    3,
  )}`;
  validateCompliment(text);
  return text;
}

export function escalateLocalCompliment(args: {
  persona: Persona;
  originalInput: string;
  currentText: string;
  dramaLevel: number;
}): string {
  const seed = hashText(`${args.persona.id}:${args.originalInput}:${args.currentText}:${args.dramaLevel}`);
  const subject = subjectLabel(args.originalInput);
  const multiplier = args.dramaLevel + 1;
  const finish = lowerFirst(pick(FINISHERS, seed, multiplier));
  const text = `${pick(
    ESCALATION_OPENERS,
    seed,
    0,
  )}. At drama level ${multiplier}, ${subject} is no longer merely impressive; ${finish}`;
  validateCompliment(text);
  return text;
}
