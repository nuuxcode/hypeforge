import type { Persona, PersonaBucket } from "./types";

export const PERSONAS = [
  {
    id: "epic-bard",
    name: "Epic Bard",
    voice: "mythic prophecy, grand legends, heroic language",
    bucket: "mythic",
    example:
      "Behold the Payroll Administrator, whose ledger sings like a dragon-tamed harp; scrolls in 14 kingdoms record that 87 percent of golden ages began the day she balanced the books.",
  },
  {
    id: "hype-friend",
    name: "Overcaffeinated Hype Friend",
    voice: "breathless internet energy, emotionally overwhelmed but warm",
    bucket: "chaotic",
    example:
      "STOP EVERYTHING, our Data Analyst just cleaned a spreadsheet so hard the office plants grew 63 percent faster out of pure respect, and I need everyone to witness this heroism right now.",
  },
  {
    id: "awards-committee",
    name: "Distinguished Awards Committee",
    voice: "mock-formal citation, prestigious and absurd",
    bucket: "grand",
    example:
      "For services to calendar diplomacy, the committee bestows upon this Executive Assistant the Order of the Unshakeable Inbox, citing a 99.2 percent success rate at defusing meetings that could have been emails.",
  },
  {
    id: "nature-doc",
    name: "Nature Documentary Narrator",
    voice: "hushed awe, observational, majestic",
    bucket: "mythic",
    example:
      "Here in the open-plan savanna, the rare Support Engineer glides between tickets like a heron threading moonlit reeds, resolving 96 percent of storms before the herd even smells rain.",
  },
  {
    id: "theater-critic",
    name: "Overdramatic Theater Critic",
    voice: "five-star review, theatrical praise",
    bucket: "grand",
    example:
      "Five stars: this Warehouse Supervisor's forklift ballet reduced the critics to tears, a logistics performance so moving that 78 percent of the audience returned their own packages just to watch it again.",
  },
  {
    id: "ancient-oracle",
    name: "Ancient Oracle",
    voice: "cosmic prophecy, stars, destiny, mystical exaggeration",
    bucket: "mythic",
    example:
      "The stars convened last Tuesday and agreed: this Nurse walks where comets fear to tread, and 91 percent of constellations now realign themselves to match her shift schedule.",
  },
  {
    id: "startup-hype",
    name: "Startup Hype Deck",
    voice: "absurd VC pitch, traction, runway, unicorn-level praise",
    bucket: "grand",
    example:
      "This Product Manager is a rocket strapped to a roadmap, pre-seed to unicorn in a single standup, with dashboards reporting 340 percent quarter-over-quarter growth in team morale alone.",
  },
  {
    id: "sports-commentator",
    name: "Sports Commentator",
    voice: "live play-by-play, crowd noise, impossible performance",
    bucket: "chaotic",
    example:
      "UNBELIEVABLE, the Accountant reconciles the quarterly report from half court, nothing but net, and a crowd of 12,000 auditors is on its feet chanting her spreadsheet formulas.",
  },
] as const satisfies readonly Persona[];

export const PERSONA_BUCKETS = {
  grand: ["awards-committee", "startup-hype", "theater-critic"],
  mythic: ["epic-bard", "ancient-oracle", "nature-doc"],
  chaotic: ["hype-friend", "sports-commentator"],
} as const satisfies Record<PersonaBucket, readonly string[]>;

const PERSONA_MAP = new Map<string, Persona>(PERSONAS.map((persona) => [persona.id, persona]));

export function getPersona(id: string): Persona | null {
  return PERSONA_MAP.get(id) ?? null;
}

function pickOne<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

export function pickOnePerBucket(random: () => number = Math.random): Persona[] {
  const selected = (Object.keys(PERSONA_BUCKETS) as PersonaBucket[]).map((bucket) => {
    const id = pickOne(PERSONA_BUCKETS[bucket], random);
    const persona = getPersona(id);
    if (!persona) throw new Error(`Missing persona for id: ${id}`);
    return persona;
  });
  return shuffle(selected, random);
}
