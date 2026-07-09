import { generateCompliment, providerErrorMessage } from "@/lib/ai";
import { createApiDebug, withDebug } from "@/lib/debug";
import { getPersona } from "@/lib/personas";
import { buildInitialMessages } from "@/lib/prompts";
import { checkAndIncrement } from "@/lib/rateLimit";
import { RetryBodySchema, sanitizeInput } from "@/lib/validate";

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

export async function POST(req: Request) {
  const debug = createApiDebug("POST /api/retry");
  debug.info("request received");

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    debug.error("request body was not valid JSON");
    return Response.json(withDebug({ error: "Invalid request body." }, debug.finish()), { status: 400 });
  }

  const body = RetryBodySchema.safeParse(parsed);
  if (!body.success) {
    debug.error("request body failed schema validation", body.error.flatten());
    return Response.json(withDebug({ error: "Invalid request body." }, debug.finish()), { status: 400 });
  }
  debug.info("request body parsed", {
    personaId: body.data.personaId,
    originalInputLength: body.data.originalInput.length,
  });

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

  const persona = getPersona(body.data.personaId);
  if (!persona) {
    debug.error("unknown persona requested", { personaId: body.data.personaId });
    return Response.json(
      withDebug({ ok: false, error: "Invalid compliment persona." }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }

  let originalInput: string;
  try {
    originalInput = sanitizeInput(body.data.originalInput);
  } catch (error) {
    debug.error("original input sanitization failed", error);
    return Response.json(
      withDebug({ ok: false, error: (error as Error).message }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }

  try {
    debug.providerInfo("persona retry generation started", {
      personaId: persona.id,
      personaName: persona.name,
    });
    const text = await generateCompliment(buildInitialMessages(persona, originalInput), {
      temperature: 1,
      maxOutputTokens: 150,
    });
    debug.providerInfo("persona retry generation succeeded", {
      personaId: persona.id,
      personaName: persona.name,
      characterCount: text.length,
    });

    return Response.json(
      withDebug({ ok: true, text, history: [text], dramaLevel: 1 }, debug.finish()),
      {
        headers: {
          "Set-Cookie": setCookie,
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      },
    );
  } catch (error) {
    debug.providerError("persona retry generation failed", error);
    return Response.json(
      withDebug({ ok: false, error: providerErrorMessage(error) }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }
}
