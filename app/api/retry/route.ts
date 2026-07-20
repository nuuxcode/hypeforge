import { providerErrorMessage } from "@/lib/ai";
import { rateLimitCookie, rateLimitHeaders, readRateLimit } from "@/lib/api-rate-limit";
import { generateCompliantCompliment, isGuidelineComplianceError } from "@/lib/compliant-generation";
import { createApiDebug, withDebug } from "@/lib/debug";
import { sanitizeModelSelection } from "@/lib/models";
import { getPersona } from "@/lib/personas";
import { buildInitialMessages } from "@/lib/prompts";
import { resolveSubject, RetryBodySchema } from "@/lib/validate";

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
    rl = readRateLimit(req);
  } catch (error) {
    debug.error("rate-limit configuration failed", error);
    return Response.json(withDebug({ error: "Server configuration is missing." }, debug.finish()), { status: 500 });
  }

  const setCookie = rateLimitCookie(rl.newCookie);
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

  let subject: { jobFunction: string; personDetails?: string; displayInput: string };
  try {
    subject = resolveSubject({
      jobFunction: body.data.jobFunction,
      personDetails: body.data.personDetails,
      legacyInput: body.data.originalInput,
    });
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
    const result = await generateCompliantCompliment({
      messages: buildInitialMessages(persona, { ...subject, deliveryMode: body.data.deliveryMode }),
      subject: subject.jobFunction,
      personaId: persona.id,
      operation: "retry",
      deliveryMode: body.data.deliveryMode,
      debug,
      models: sanitizeModelSelection(body.data.models),
      temperature: 1,
      maxOutputTokens: 260,
    });
    debug.providerInfo("persona retry generation succeeded", {
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
          history: [result.text],
          dramaLevel: 1,
          guidelines: result.guidelines,
        },
        debug.finish(),
      ),
      {
        headers: rateLimitHeaders(rl),
      },
    );
  } catch (error) {
    debug.providerError("persona retry generation failed", error);
    const diagnostics = isGuidelineComplianceError(error)
      ? { attemptCount: error.attemptCount, failedRuleIds: error.failedRuleIds, failureDetails: error.failureDetails }
      : undefined;
    return Response.json(
      withDebug(
        { ok: false, error: isGuidelineComplianceError(error) ? error.message : providerErrorMessage(error), diagnostics },
        debug.finish(),
      ),
      { headers: { "Set-Cookie": setCookie } },
    );
  }
}
