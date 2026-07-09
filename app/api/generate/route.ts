import { generateCompliment, isQuotaError, providerErrorMessage } from "@/lib/ai";
import { createApiDebug, withDebug } from "@/lib/debug";
import { pickOnePerBucket } from "@/lib/personas";
import { buildInitialMessages } from "@/lib/prompts";
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

async function generateForPersona(
  persona: Persona,
  input: string,
  debug: ReturnType<typeof createApiDebug>,
): Promise<string> {
  const messages = buildInitialMessages(persona, input);
  debug.providerInfo("persona generation started", {
    personaId: persona.id,
    personaName: persona.name,
  });
  try {
    const text = await generateCompliment(messages, { temperature: 1, maxOutputTokens: 260 });
    debug.providerInfo("persona generation succeeded", {
      personaId: persona.id,
      personaName: persona.name,
      characterCount: text.length,
    });
    return text;
  } catch (error) {
    debug.providerError("persona generation failed", {
      personaId: persona.id,
      personaName: persona.name,
      error,
    });
    if (isQuotaError(error)) {
      debug.providerInfo("skipping retry: provider quota exhausted, retry would fail too", {
        personaId: persona.id,
        personaName: persona.name,
      });
      throw error;
    }
    debug.providerInfo("retrying persona generation once", {
      personaId: persona.id,
      personaName: persona.name,
    });
    try {
      const text = await generateCompliment(messages, { temperature: 1, maxOutputTokens: 260 });
      debug.providerInfo("persona retry succeeded", {
        personaId: persona.id,
        personaName: persona.name,
        characterCount: text.length,
      });
      return text;
    } catch (retryError) {
      debug.providerError("persona retry failed", {
        personaId: persona.id,
        personaName: persona.name,
        error: retryError,
      });
      throw retryError;
    }
  }
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

function makeFailedCard(persona: Persona, input: string): ComplimentCard {
  return {
    id: crypto.randomUUID(),
    originalInput: input,
    personaId: persona.id,
    personaName: persona.name,
    text: "",
    history: [],
    dramaLevel: 1,
    status: "error",
    copied: false,
    error: "The compliment engine got overwhelmed by your brilliance. Try again.",
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

  const settled = await Promise.allSettled(
    selected.map(async (persona) => makeCard(persona, input, await generateForPersona(persona, input, debug))),
  );

  const cards = settled.map((result, index) =>
    result.status === "fulfilled" ? result.value : makeFailedCard(selected[index]!, input),
  );
  debug.info("persona settlement complete", {
    successCount: cards.filter((card) => card.status === "idle").length,
    errorCount: cards.filter((card) => card.status === "error").length,
  });

  if (cards.every((card) => card.status === "error")) {
    debug.error("all personas failed", settled.map((result, index) => ({
      personaId: selected[index]?.id,
      reason: result.status === "rejected" ? result.reason : undefined,
    })));
    return Response.json(
      withDebug({ ok: false, error: providerErrorMessage(settled[0]?.status === "rejected" ? settled[0].reason : undefined), cards }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }

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
