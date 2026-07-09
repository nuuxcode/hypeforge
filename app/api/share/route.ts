import { createApiDebug, withDebug } from "@/lib/debug";
import { createSharedDeck } from "@/lib/shared-decks";
import { ShareDeckBodySchema } from "@/lib/validate";

export async function POST(req: Request) {
  const debug = createApiDebug("POST /api/share");
  debug.info("share request received");

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    debug.error("share request body was not valid JSON");
    return Response.json(withDebug({ ok: false, error: "Invalid share request." }, debug.finish()), { status: 400 });
  }

  const body = ShareDeckBodySchema.safeParse(parsed);
  if (!body.success) {
    debug.error("share request failed schema validation", body.error.flatten());
    return Response.json(withDebug({ ok: false, error: "Invalid share request." }, debug.finish()), { status: 400 });
  }

  try {
    const deck = await createSharedDeck(body.data);
    debug.info("share deck created", { slug: deck.slug, cardCount: deck.cards.length });
    return Response.json(withDebug({ ok: true, slug: deck.slug, createdAt: deck.createdAt }, debug.finish()), { status: 201 });
  } catch (error) {
    debug.error("share deck could not be created", error);
    return Response.json(
      withDebug({ ok: false, error: "The share link could not be created. Try again." }, debug.finish()),
      { status: 500 },
    );
  }
}
