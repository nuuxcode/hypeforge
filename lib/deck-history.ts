import type { ComplimentCard, FeedbackVote, SoftPreferenceContext } from "./types";

export type DeckHistoryEntry = {
  id: string;
  input: string;
  jobFunction?: string;
  personDetails?: string;
  cards: ComplimentCard[];
  createdAt: string;
  updatedAt: string;
};

export type TasteSignal = {
  id: string;
  deckId: string;
  cardId: string;
  vote: FeedbackVote;
  text: string;
  personaName: string;
  createdAt: string;
};

export type SharedDeckSnapshot = {
  input: string;
  jobFunction?: string;
  personDetails?: string;
  cards: Array<
    Pick<
      ComplimentCard,
      "personaId" | "personaName" | "text" | "dramaLevel" | "originalInput" | "jobFunction" | "personDetails" | "guidelines"
    >
  >;
};

export const MAX_DECK_HISTORY = 50;
const MAX_TASTE_SIGNALS = 30;
const DECK_HISTORY_KEY = "hypeforge_v2_deck_history";
const TASTE_SIGNAL_KEY = "hypeforge_v2_taste_signals";
const ACTIVE_DECK_KEY = "hypeforge_v2_active_deck";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // History is an enhancement. A full or unavailable storage area should not block the forge.
  }
}

export function loadDeckHistory(): DeckHistoryEntry[] {
  const items = read<unknown>(DECK_HISTORY_KEY, []);
  return Array.isArray(items) ? (items as DeckHistoryEntry[]) : [];
}

export function saveDeckHistory(entry: DeckHistoryEntry): DeckHistoryEntry[] {
  const current = loadDeckHistory();
  const next = [entry, ...current.filter((item) => item.id !== entry.id)]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_DECK_HISTORY);
  write(DECK_HISTORY_KEY, next);
  return next;
}

export function removeDeckHistory(id: string): DeckHistoryEntry[] {
  const next = loadDeckHistory().filter((entry) => entry.id !== id);
  write(DECK_HISTORY_KEY, next);
  return next;
}

export function clearDeckHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DECK_HISTORY_KEY);
}

export function loadActiveDeckId(): string | null {
  const value = read<unknown>(ACTIVE_DECK_KEY, null);
  return typeof value === "string" && value.trim() ? value : null;
}

export function saveActiveDeckId(id: string): void {
  const value = id.trim();
  if (!value) return;
  write(ACTIVE_DECK_KEY, value);
}

export function clearActiveDeckId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_DECK_KEY);
}

export function loadTasteSignals(): TasteSignal[] {
  const items = read<unknown>(TASTE_SIGNAL_KEY, []);
  return Array.isArray(items) ? (items as TasteSignal[]) : [];
}

export function saveTasteSignal(signal: TasteSignal): TasteSignal[] {
  const current = loadTasteSignals();
  const next = [signal, ...current.filter((item) => item.id !== signal.id)]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_TASTE_SIGNALS);
  write(TASTE_SIGNAL_KEY, next);
  return next;
}

export function removeTasteSignal(id: string): TasteSignal[] {
  const next = loadTasteSignals().filter((signal) => signal.id !== id);
  write(TASTE_SIGNAL_KEY, next);
  return next;
}

export function clearTasteSignals(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TASTE_SIGNAL_KEY);
}

export function buildSoftPreferenceContext(signals: TasteSignal[]): SoftPreferenceContext {
  const summary = (vote: FeedbackVote) =>
    signals
      .filter((signal) => signal.vote === vote)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 3)
      .map((signal) => signal.text.replace(/\s+/g, " ").trim().slice(0, 180));

  return { liked: summary("up"), disliked: summary("down") };
}

export function nextFeedbackVote(current: FeedbackVote | undefined, requested: FeedbackVote): FeedbackVote | undefined {
  return current === requested ? undefined : requested;
}

function toBase64Url(value: string): string {
  return btoa(encodeURIComponent(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): string | null {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return decodeURIComponent(atob(padded));
  } catch {
    return null;
  }
}

export function createShareToken(input: string, cards: ComplimentCard[]): string {
  const deck: SharedDeckSnapshot = {
    input,
    jobFunction: cards[0]?.jobFunction,
    personDetails: cards[0]?.personDetails,
    cards: cards
      .filter((card) => card.text.trim())
      .map((card) => ({
        personaId: card.personaId,
        personaName: card.personaName,
        text: card.text,
        dramaLevel: card.dramaLevel,
        originalInput: card.originalInput,
        jobFunction: card.jobFunction,
        personDetails: card.personDetails,
        guidelines: card.guidelines,
      })),
  };
  return toBase64Url(JSON.stringify(deck));
}

export function readShareToken(token: string): SharedDeckSnapshot | null {
  const decoded = fromBase64Url(token);
  if (!decoded) return null;

  try {
    const deck = JSON.parse(decoded) as SharedDeckSnapshot;
    if (!deck || typeof deck.input !== "string" || !Array.isArray(deck.cards) || deck.cards.length === 0) return null;
    if (
      deck.cards.some(
        (card) =>
          !card ||
          typeof card.personaId !== "string" ||
          typeof card.personaName !== "string" ||
          typeof card.text !== "string" ||
          typeof card.dramaLevel !== "number" ||
          (card.guidelines !== undefined && (!card.guidelines || typeof card.guidelines !== "object")),
      )
    ) {
      return null;
    }
    return deck;
  } catch {
    return null;
  }
}
