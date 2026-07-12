import type { ComplimentCard, ComplimentCardVersion, GuidelineCompliance } from "@/lib/types";

export const MAX_CARD_VERSIONS = 50;

export function createCardVersion(
  text: string,
  dramaLevel: number,
  kind: ComplimentCardVersion["kind"],
  guidelines?: GuidelineCompliance,
): ComplimentCardVersion {
  return {
    id: crypto.randomUUID(),
    text,
    dramaLevel,
    kind,
    createdAt: new Date().toISOString(),
    guidelines,
  };
}

// Decks saved before versions existed only carry text history; rebuild a
// version list from it so old saved decks keep their navigation.
export function versionsForCard(card: ComplimentCard): ComplimentCardVersion[] {
  if (card.versions?.length) return card.versions;
  const versions = card.history.length > 0 ? card.history : card.text ? [card.text] : [];
  return versions.map((text, index) =>
    createCardVersion(
      text,
      index === 0 ? 1 : Math.min(card.dramaLevel, index + 1),
      index === 0 ? "generated" : "dramatic",
      text === card.text ? card.guidelines : undefined,
    ),
  );
}

export function appendCardVersion(card: ComplimentCard, version: ComplimentCardVersion): ComplimentCardVersion[] {
  return [...versionsForCard(card), version].slice(-MAX_CARD_VERSIONS);
}

export function activeVersionIdFor(card: ComplimentCard, versions: ComplimentCardVersion[]): string | undefined {
  if (card.activeVersionId && versions.some((version) => version.id === card.activeVersionId)) return card.activeVersionId;
  return (
    [...versions].reverse().find((version) => version.text === card.text && version.dramaLevel === card.dramaLevel)?.id ??
    versions.at(-1)?.id
  );
}

export function hydrateCard(card: ComplimentCard): ComplimentCard {
  const versions = versionsForCard(card);
  const activeVersionId = activeVersionIdFor(card, versions);
  const activeVersion = versions.find((version) => version.id === activeVersionId);
  return {
    ...card,
    deliveryMode: card.deliveryMode ?? "public",
    status: "idle",
    copied: false,
    versions,
    activeVersionId,
    guidelines: activeVersion?.guidelines,
  };
}

export function hydrateCards(cards: ComplimentCard[]): ComplimentCard[] {
  return cards.map(hydrateCard);
}
