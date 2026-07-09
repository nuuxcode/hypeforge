import { generateComplimentDeck, providerErrorMessage } from "@/lib/ai";
import { createApiDebug, withDebug } from "@/lib/debug";
import { pickOnePerBucket } from "@/lib/personas";
import { checkAndIncrement } from "@/lib/rateLimit";
import type { ComplimentCard, Persona } from "@/lib/types";
import { GenerateBodySchema, sanitizeInput } from "@/lib/validate";

const COOKIE_NAME = "hypeforge_rl";

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const pair of header.split(";")) {
    const [key, value] = pair.trim().split("=");
    if (key === name) return decodeURIComponent(value);
  }
  return undefined;
}

function cookieHeader(value: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

function makeCard(persona: Persona, input: string, text: string): ComplimentCard {
  return {
    id: crypto.randomUUID(),
    originalInput: input,
    personaId: persona.id,
    personaName: persona.name,
    text,
    history: [text],
    dramaLevel: 1,
    status: "idle",
    copied: false,
  };
}

export async function POST(req: Request) {
  const debug = createApiDebug("POST /api/generate");
  debug.info("request received");

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    debug.error("request body was not valid JSON");
    return Response.json(withDebug({ error: "Invalid request body." }, debug.finish()), { status: 400 });
  }

  const body = GenerateBodySchema.safeParse(parsed);
  if (!body.success) {
    debug.error("request body failed schema validation", body.error.flatten());
    return Response.json(withDebug({ error: "Invalid request body." }, debug.finish()), { status: 400 });
  }
  debug.info("request body parsed", { inputLength: body.data.input.length });

  let rl;
  try {
    rl = checkAndIncrement(getCookie(req, COOKIE_NAME));
  } catch (error) {
    debug.error("rate-limit configuration failed", error);
    return Response.json(withDebug({ error: "Server configuration is missing." }, debug.finish()), { status: 500 });
  }

  const setCookie = cookieHeader(rl.newCookie);
  if (!rl.ok) {
    debug.warn("request blocked by rate limit", { resetAt: rl.resetAt });
    return Response.json(
      withDebug(
        { ok: false, error: "Too much brilliance at once. Wait a moment and retry.", resetAt: rl.resetAt },
        debug.finish(),
      ),
      { headers: { "Set-Cookie": setCookie } },
    );
  }
  debug.info("rate-limit passed", { remaining: rl.remaining, resetAt: rl.resetAt });

  let input: string;
  try {
    input = sanitizeInput(body.data.input);
  } catch (error) {
    debug.error("input sanitization failed", error);
    return Response.json(
      withDebug({ ok: false, error: (error as Error).message }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }
  debug.info("input sanitized", { input });

  const selected = pickOnePerBucket();
  debug.info("selected personas", selected.map((persona) => ({
    personaId: persona.id,
    personaName: persona.name,
    bucket: persona.bucket,
  })));

  let deck: Record<string, string>;
  try {
    debug.providerInfo("deck generation started", {
      personaIds: selected.map((persona) => persona.id),
    });
    deck = await generateComplimentDeck(selected, input, { temperature: 1, maxOutputTokens: 900 });
    debug.providerInfo("deck generation succeeded", {
      personaIds: selected.map((persona) => persona.id),
      characterCounts: selected.map((persona) => deck[persona.id]?.length ?? 0),
    });
  } catch (error) {
    debug.providerError("deck generation failed", error);
    return Response.json(
      withDebug({ ok: false, error: providerErrorMessage(error) }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }

  const cards = selected.map((persona) => makeCard(persona, input, deck[persona.id]!));
  debug.info("persona settlement complete", {
    successCount: cards.length,
    errorCount: 0,
  });

  return Response.json(
    withDebug({ ok: true, cards }, debug.finish()),
    {
      headers: {
        "Set-Cookie": setCookie,
        "X-RateLimit-Remaining": String(rl.remaining),
        "X-RateLimit-Reset": String(rl.resetAt),
      },
    },
  );
}
