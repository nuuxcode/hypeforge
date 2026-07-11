import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { MAX_COMPLIMENT_LENGTH } from "./safeText";
import { VerifiedGuidelineComplianceSchema } from "./compliment-guidelines";
import type { GuidelineCompliance } from "./types";
import { MAX_INPUT_LENGTH } from "./validate";

export type SharedDeckCard = {
  personaId: string;
  personaName: string;
  text: string;
  dramaLevel: number;
  originalInput: string;
  guidelines?: GuidelineCompliance;
};

export type SharedDeckSnapshot = {
  input: string;
  cards: SharedDeckCard[];
};

export type PublishedDeck = SharedDeckSnapshot & {
  slug: string;
  createdAt: string;
};

type SharedDeckStore = {
  version: 1;
  decks: PublishedDeck[];
};

const MAX_SHARED_DECKS = 500;
const SLUG_PATTERN = /^[A-Za-z0-9_-]{8,20}$/;

function storePath(): string {
  return process.env.HYPEFORGE_SHARE_STORE_PATH ?? path.join(".data", "hypeforge-shares.json");
}

function emptyStore(): SharedDeckStore {
  return { version: 1, decks: [] };
}

function normalizeSnapshot(snapshot: SharedDeckSnapshot): SharedDeckSnapshot {
  const input = snapshot.input.replace(/\s+/g, " ").trim();
  if (input.length < 3 || input.length > MAX_INPUT_LENGTH) throw new Error("The shared deck needs a valid subject.");
  if (snapshot.cards.length < 1 || snapshot.cards.length > 3) throw new Error("A shared deck needs one to three compliments.");

  const cards = snapshot.cards.map((card) => {
    const personaId = card.personaId.trim();
    const personaName = card.personaName.replace(/\s+/g, " ").trim();
    const text = card.text.replace(/\s+/g, " ").trim();
    const originalInput = card.originalInput.replace(/\s+/g, " ").trim();
    if (!personaId || personaId.length > 80 || !personaName || personaName.length > 100) {
      throw new Error("The shared deck contains an invalid persona.");
    }
    if (text.length < 24 || text.length > MAX_COMPLIMENT_LENGTH) {
      throw new Error("The shared deck contains an invalid compliment.");
    }
    if (!Number.isInteger(card.dramaLevel) || card.dramaLevel < 1 || card.dramaLevel > 20) {
      throw new Error("The shared deck contains an invalid drama level.");
    }
    const guidelines = card.guidelines ? VerifiedGuidelineComplianceSchema.parse(card.guidelines) : undefined;
    return {
      personaId,
      personaName,
      text,
      dramaLevel: card.dramaLevel,
      originalInput: originalInput || input,
      guidelines,
    };
  });

  return { input, cards };
}

function isPublishedDeck(value: unknown): value is PublishedDeck {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<PublishedDeck>;
  if (!deck.slug || !SLUG_PATTERN.test(deck.slug) || typeof deck.createdAt !== "string") return false;
  try {
    normalizeSnapshot({ input: deck.input ?? "", cards: deck.cards ?? [] });
    return true;
  } catch {
    return false;
  }
}

async function readStore(): Promise<SharedDeckStore> {
  try {
    const raw = await fs.readFile(/*turbopackIgnore: true*/ storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<SharedDeckStore>;
    if (parsed.version !== 1 || !Array.isArray(parsed.decks)) return emptyStore();
    return { version: 1, decks: parsed.decks.filter(isPublishedDeck) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
    throw error;
  }
}

async function writeStore(store: SharedDeckStore): Promise<void> {
  const target = storePath();
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(/*turbopackIgnore: true*/ temporary, JSON.stringify(store), "utf8");
  await fs.rename(/*turbopackIgnore: true*/ temporary, target);
}

function nextSlug(existing: Set<string>): string {
  let slug = "";
  do {
    slug = randomBytes(6).toString("base64url");
  } while (existing.has(slug));
  return slug;
}

export async function createSharedDeck(snapshot: SharedDeckSnapshot): Promise<PublishedDeck> {
  const clean = normalizeSnapshot(snapshot);
  const store = await readStore();
  const deck: PublishedDeck = {
    ...clean,
    slug: nextSlug(new Set(store.decks.map((item) => item.slug))),
    createdAt: new Date().toISOString(),
  };
  store.decks = [deck, ...store.decks].slice(0, MAX_SHARED_DECKS);
  await writeStore(store);
  return deck;
}

export async function getSharedDeck(slug: string): Promise<PublishedDeck | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const store = await readStore();
  return store.decks.find((deck) => deck.slug === slug) ?? null;
}
