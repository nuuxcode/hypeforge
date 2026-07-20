import { providerErrorMessage } from "@/lib/ai";
import { rateLimitCookie, rateLimitHeaders, readRateLimit } from "@/lib/api-rate-limit";
import { isGuidelineComplianceError } from "@/lib/compliant-generation";
import {
  generateCompleteDeck,
  isCompleteDeckError,
  underlyingDeckFailure,
} from "@/lib/deck-generation";
import { createApiDebug, withDebug } from "@/lib/debug";
import { sanitizeModelSelection } from "@/lib/models";
import { cleanPreferenceContext, GenerateBodySchema, resolveSubject } from "@/lib/validate";

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
    jobFunctionLength: (body.data.jobFunction ?? body.data.input ?? "").length,
    personDetailsLength: body.data.personDetails?.length ?? 0,
    deliveryMode: body.data.deliveryMode,
    likedSignals: preference.liked.length,
    dislikedSignals: preference.disliked.length,
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

  let subject: { jobFunction: string; personDetails?: string; displayInput: string };
  try {
    subject = resolveSubject({
      jobFunction: body.data.jobFunction,
      personDetails: body.data.personDetails,
      legacyInput: body.data.input,
    });
  } catch (error) {
    debug.error("input sanitization failed", error);
    return Response.json(
      withDebug({ ok: false, error: (error as Error).message }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }
  debug.info("subject sanitized", {
    jobFunctionLength: subject.jobFunction.length,
    personDetailsLength: subject.personDetails?.length ?? 0,
  });

  let cards: Awaited<ReturnType<typeof generateCompleteDeck>>;
  try {
    cards = await generateCompleteDeck({
      subject,
      deliveryMode: body.data.deliveryMode,
      preference,
      debug,
      models: sanitizeModelSelection(body.data.models),
    });
  } catch (error) {
    if (!isCompleteDeckError(error)) {
      debug.error("unexpected complete deck failure", error);
      return Response.json(
        withDebug({ ok: false, error: providerErrorMessage(error) }, debug.finish()),
        { headers: { "Set-Cookie": setCookie } },
      );
    }

    const underlying = underlyingDeckFailure(error);
    const guidelineFailure = isGuidelineComplianceError(underlying) ? underlying : undefined;
    const providerMessage = providerErrorMessage(underlying);
    const userMessage = guidelineFailure
      ? guidelineFailure.message
      : providerMessage.includes("overwhelmed by your brilliance")
        ? error.message
        : providerMessage;
    const qualityFailureIds = error.completedCardCount < 3
      ? ["complete-deck"]
      : error.deckIssues.length > 0
        ? ["deck-semantic-diversity"]
        : [];
    const diagnostics = {
      attemptCount: guidelineFailure?.attemptCount,
      failedRuleIds: guidelineFailure?.failedRuleIds?.length
        ? guidelineFailure.failedRuleIds
        : qualityFailureIds,
      failureDetails: guidelineFailure?.failureDetails,
      expectedCardCount: 3,
      completedCardCount: error.completedCardCount,
      failedPersonaIds: error.failedPersonaIds,
      deckIssues: error.deckIssues,
    };
    debug.error("complete deck generation failed", {
      message: error.message,
      diagnostics,
      underlying,
    });
    return Response.json(
      withDebug({ ok: false, error: userMessage, diagnostics }, debug.finish()),
      { headers: { "Set-Cookie": setCookie } },
    );
  }

  debug.info("complete deck contract passed", {
    expectedCardCount: 3,
    completedCardCount: cards.length,
    personaIds: cards.map((card) => card.personaId),
  });

  return Response.json(
    withDebug({ ok: true, cards }, debug.finish()),
    {
      headers: rateLimitHeaders(rl),
    },
  );
}
