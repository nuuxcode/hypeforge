import { providerErrorMessage } from "@/lib/ai";
import {
  generateCompliantCompliment,
  isGuidelineComplianceError,
} from "@/lib/compliant-generation";
import { createApiDebug, withDebug } from "@/lib/debug";
import { pickOnePerBucket } from "@/lib/personas";
import { buildInitialMessages } from "@/lib/prompts";
import { checkAndIncrement } from "@/lib/rateLimit";
import type { ComplimentCard, Persona } from "@/lib/types";
import { cleanPreferenceContext, GenerateBodySchema, sanitizeInput } from "@/lib/validate";
import type { SoftPreferenceContext } from "@/lib/types";

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
  preference: SoftPreferenceContext,
  debug: ReturnType<typeof createApiDebug>,
): Promise<Pick<ComplimentCard, "text" | "guidelines">> {
  const messages = buildInitialMessages(persona, input, preference);
  debug.providerInfo("persona generation started", {
    personaId: persona.id,
    personaName: persona.name,
  });
  try {
    const result = await generateCompliantCompliment({
      messages,
      subject: input,
      personaId: persona.id,
      operation: "generate",
      debug,
      temperature: 1,
      maxOutputTokens: 260,
    });
    debug.providerInfo("persona generation succeeded", {
      personaId: persona.id,
      personaName: persona.name,
      characterCount: result.text.length,
      wordCount: result.guidelines.wordCount,
    });
    return result;
  } catch (error) {
    debug.providerError("persona generation failed", {
      personaId: persona.id,
      personaName: persona.name,
      error,
    });
    throw error;
  }
}

function makeCard(
  persona: Persona,
  input: string,
  result: Pick<ComplimentCard, "text" | "guidelines">,
): ComplimentCard {
  return {
    id: crypto.randomUUID(),
    originalInput: input,
    personaId: persona.id,
    personaName: persona.name,
    text: result.text,
    history: [result.text],
    guidelines: result.guidelines,
    dramaLevel: 1,
    status: "idle",
    copied: false,
  };
}

function makeFailedCard(persona: Persona, input: string, error: unknown): ComplimentCard {
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
    error: isGuidelineComplianceError(error)
      ? error.message
      : "The compliment engine got overwhelmed by your brilliance. Try again.",
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
  const preference = cleanPreferenceContext(body.data.preference);
  debug.info("request body parsed", {
    inputLength: body.data.input.length,
    likedSignals: preference.liked.length,
    dislikedSignals: preference.disliked.length,
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
    selected.map(async (persona) => makeCard(persona, input, await generateForPersona(persona, input, preference, debug))),
  );

  const cards = settled.map((result, index) =>
    result.status === "fulfilled" ? result.value : makeFailedCard(selected[index]!, input, result.reason),
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
      withDebug(
        {
          ok: false,
          error:
            settled[0]?.status === "rejected" && isGuidelineComplianceError(settled[0].reason)
              ? settled[0].reason.message
              : providerErrorMessage(settled[0]?.status === "rejected" ? settled[0].reason : undefined),
          cards,
        },
        debug.finish(),
      ),
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
