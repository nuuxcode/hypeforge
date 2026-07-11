import { providerErrorMessage } from "@/lib/ai";
import { generateCompliantCompliment, isGuidelineComplianceError } from "@/lib/compliant-generation";
import { createApiDebug, withDebug } from "@/lib/debug";
import { getPersona } from "@/lib/personas";
import { buildEscalationMessages } from "@/lib/prompts";
import { checkAndIncrement } from "@/lib/rateLimit";
import { cleanModelText, validateCompliment } from "@/lib/safeText";
import { appendHistory, cleanHistory, EscalateBodySchema, sanitizeInput } from "@/lib/validate";

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
  const debug = createApiDebug("POST /api/escalate");
  debug.info("request received");

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    debug.error("request body was not valid JSON");
    return Response.json(withDebug({ error: "Invalid request body." }, debug.finish()), { status: 400 });
  }

  const body = EscalateBodySchema.safeParse(parsed);
  if (!body.success) {
    debug.error("request body failed schema validation", body.error.flatten());
    return Response.json(withDebug({ error: "Invalid request body." }, debug.finish()), { status: 400 });
  }
  debug.info("request body parsed", {
    personaId: body.data.personaId,
    originalInputLength: body.data.originalInput.length,
    historyCount: body.data.history.length,
    dramaLevel: body.data.dramaLevel,
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
  debug.info("persona resolved", { personaId: persona.id, personaName: persona.name });

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

  const currentText = cleanModelText(body.data.currentText);
  const history = cleanHistory(body.data.history);
  try {
    validateCompliment(currentText);
  } catch {
    debug.error("current compliment failed validation before escalation", {
      currentTextLength: currentText.length,
      historyCount: history.length,
    });
    return Response.json(
      withDebug(
        { ok: false, error: "The current compliment is too chaotic to escalate. Try generating again." },
        debug.finish(),
      ),
      { headers: { "Set-Cookie": setCookie } },
    );
  }
  debug.info("escalation prompt inputs prepared", {
    currentTextLength: currentText.length,
    historyCount: history.length,
  });

  try {
    debug.providerInfo("escalation generation started", {
      personaId: persona.id,
      personaName: persona.name,
      dramaLevel: body.data.dramaLevel,
    });
    const result = await generateCompliantCompliment({
      messages: buildEscalationMessages({
        persona,
        originalInput,
        currentText,
        history,
        dramaLevel: body.data.dramaLevel,
      }),
      subject: originalInput,
      personaId: persona.id,
      operation: "escalate",
      debug,
      temperature: 1.05,
      maxOutputTokens: 260,
    });
    debug.providerInfo("escalation generation succeeded", {
      personaId: persona.id,
      personaName: persona.name,
      characterCount: result.text.length,
      wordCount: result.guidelines.wordCount,
    });

    return Response.json(
      withDebug(
        {
          ok: true,
          text: result.text,
          history: appendHistory(history, result.text),
          dramaLevel: body.data.dramaLevel + 1,
          guidelines: result.guidelines,
        },
        debug.finish(),
      ),
      {
        headers: {
          "Set-Cookie": setCookie,
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      },
    );
  } catch (error) {
    debug.providerError("escalation generation failed", error);
    return Response.json(
      withDebug(
        { ok: false, error: isGuidelineComplianceError(error) ? error.message : providerErrorMessage(error) },
        debug.finish(),
      ),
      { headers: { "Set-Cookie": setCookie } },
    );
  }
}
