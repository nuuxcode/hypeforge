import type { Persona, PersonaBucket } from "./types";

export const PERSONAS = [
  {
    id: "epic-bard",
    name: "Epic Bard",
    voice: "mythic prophecy, grand legends, heroic language",
    bucket: "mythic",
  },
  {
    id: "hype-friend",
    name: "Overcaffeinated Hype Friend",
    voice: "breathless internet energy, emotionally overwhelmed but warm",
    bucket: "chaotic",
  },
  {
    id: "awards-committee",
    name: "Distinguished Awards Committee",
    voice: "mock-formal citation, prestigious and absurd",
    bucket: "grand",
  },
  {
    id: "nature-doc",
    name: "Nature Documentary Narrator",
    voice: "hushed awe, observational, majestic",
    bucket: "mythic",
  },
  {
    id: "theater-critic",
    name: "Overdramatic Theater Critic",
    voice: "five-star review, theatrical praise",
    bucket: "grand",
  },
  {
    id: "ancient-oracle",
    name: "Ancient Oracle",
    voice: "cosmic prophecy, stars, destiny, mystical exaggeration",
    bucket: "mythic",
  },
  {
    id: "startup-hype",
    name: "Startup Hype Deck",
    voice: "absurd VC pitch, traction, runway, unicorn-level praise",
    bucket: "grand",
  },
  {
    id: "sports-commentator",
    name: "Sports Commentator",
    voice: "live play-by-play, crowd noise, impossible performance",
    bucket: "chaotic",
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
