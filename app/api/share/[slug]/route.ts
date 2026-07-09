import { getSharedDeck } from "@/lib/shared-decks";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deck = await getSharedDeck(slug);
  if (!deck) return Response.json({ ok: false, error: "Shared deck not found." }, { status: 404 });

  return Response.json(
    { ok: true, deck: { input: deck.input, cards: deck.cards } },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
