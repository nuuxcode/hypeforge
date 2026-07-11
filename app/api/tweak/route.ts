import { providerErrorMessage } from "@/lib/ai";
import { generateCompliantCompliment, isGuidelineComplianceError } from "@/lib/compliant-generation";
import { createApiDebug, withDebug } from "@/lib/debug";
import { getPersona } from "@/lib/personas";
import { buildTweakMessages } from "@/lib/prompts";
import { checkAndIncrement } from "@/lib/rateLimit";
import { cleanModelText, validateCompliment } from "@/lib/safeText";
import { appendHistory, cleanHistory, sanitizeInput, sanitizeTweakFeedback, TweakBodySchema } from "@/lib/validate";

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
  const debug = createApiDebug("POST /api/tweak");
  debug.info("request received");

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    debug.error("request body was not valid JSON");
    return Response.json(withDebug({ error: "Invalid request body." }, debug.finish()), { status: 400 });
  }

  const body = TweakBodySchema.safeParse(parsed);
  if (!body.success) {
    debug.error("request body failed schema validation", body.error.flatten());
    return Response.json(withDebug({ error: "Invalid request body." }, debug.finish()), { status: 400 });
  }

  let rateLimit;
  try {
    rateLimit = checkAndIncrement(getCookie(req, COOKIE_NAME));
  } catch (error) {
    debug.error("rate-limit configuration failed", error);
    return Response.json(withDebug({ error: "Server configuration is missing." }, debug.finish()), { status: 500 });
  }

  const setCookie = cookieHeader(rateLimit.newCookie);
  if (!rateLimit.ok) {
    debug.warn("request blocked by rate limit", { resetAt: rateLimit.resetAt });
    return Response.json(
      withDebug(
        { ok: false, error: "Too much brilliance at once. Wait a moment and retry.", resetAt: rateLimit.resetAt },
        debug.finish(),
      ),
      { headers: { "Set-Cookie": setCookie } },
    );
  }

  const persona = getPersona(body.data.personaId);
  if (!persona) {
    debug.error("unknown persona requested", { personaId: body.data.personaId });
    return Response.json(
      withDebug({ ok: false, error: "Invalid compliment persona." }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }

  let originalInput: string;
  let feedback: string;
  try {
    originalInput = sanitizeInput(body.data.originalInput);
    feedback = sanitizeTweakFeedback(body.data.feedback);
  } catch (error) {
    debug.error("tweak inputs failed validation", error);
    return Response.json(
      withDebug({ ok: false, error: (error as Error).message }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }

  const currentText = cleanModelText(body.data.currentText);
  const history = cleanHistory(body.data.history);
  try {
    validateCompliment(currentText);
  } catch {
    debug.error("current compliment failed validation before tweak", { currentTextLength: currentText.length });
    return Response.json(
      withDebug({ ok: false, error: "The current compliment is too chaotic to tweak. Try generating again." }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }

  try {
    debug.providerInfo("tweak generation started", { personaId: persona.id, personaName: persona.name });
    const result = await generateCompliantCompliment({
      messages: buildTweakMessages({
        persona,
        originalInput,
        currentText,
        history,
        dramaLevel: body.data.dramaLevel,
        feedback,
      }),
      subject: originalInput,
      personaId: persona.id,
      operation: "tweak",
      debug,
      temperature: 1,
      maxOutputTokens: 260,
    });
    debug.providerInfo("tweak generation succeeded", {
      personaId: persona.id,
      characterCount: result.text.length,
      wordCount: result.guidelines.wordCount,
    });

    return Response.json(
      withDebug(
        {
          ok: true,
          text: result.text,
          history: appendHistory(history, result.text),
          dramaLevel: body.data.dramaLevel,
          guidelines: result.guidelines,
        },
        debug.finish(),
      ),
      {
        headers: {
          "Set-Cookie": setCookie,
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(rateLimit.resetAt),
        },
      },
    );
  } catch (error) {
    debug.providerError("tweak generation failed", error);
    return Response.json(
      withDebug(
        { ok: false, error: isGuidelineComplianceError(error) ? error.message : providerErrorMessage(error) },
        debug.finish(),
      ),
      { headers: { "Set-Cookie": setCookie } },
    );
  }
}
