import { providerErrorMessage } from "@/lib/ai";
import { rateLimitCookie, rateLimitHeaders, readRateLimit } from "@/lib/api-rate-limit";
import {
  generateCompliantCompliment,
  isGuidelineComplianceError,
} from "@/lib/compliant-generation";
import { createApiDebug, withDebug } from "@/lib/debug";
import { distinctnessIssues } from "@/lib/deck-distinctness";
import { pickOnePerBucket } from "@/lib/personas";
import { buildInitialMessages } from "@/lib/prompts";
import type { ComplimentCard, ComplimentSubject, DeliveryMode, Persona } from "@/lib/types";
import { cleanPreferenceContext, GenerateBodySchema, resolveSubject } from "@/lib/validate";
import type { SoftPreferenceContext } from "@/lib/types";

async function generateForPersona(
  persona: Persona,
  subject: ComplimentSubject,
  preference: SoftPreferenceContext,
  debug: ReturnType<typeof createApiDebug>,
  avoidCompliments: string[] = [],
): Promise<Pick<ComplimentCard, "text" | "guidelines">> {
  const messages = buildInitialMessages(persona, subject, preference, avoidCompliments);
  debug.providerInfo("persona generation started", {
    personaId: persona.id,
    personaName: persona.name,
  });
  try {
    const result = await generateCompliantCompliment({
      messages,
      subject: subject.jobFunction,
      personaId: persona.id,
      operation: "generate",
      deliveryMode: subject.deliveryMode,
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
  subject: { jobFunction: string; personDetails?: string; displayInput: string },
  deliveryMode: DeliveryMode,
  result: Pick<ComplimentCard, "text" | "guidelines">,
): ComplimentCard {
  return {
    id: crypto.randomUUID(),
    originalInput: subject.displayInput,
    jobFunction: subject.jobFunction,
    personDetails: subject.personDetails,
    deliveryMode,
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

function makeFailedCard(
  persona: Persona,
  subject: { jobFunction: string; personDetails?: string; displayInput: string },
  deliveryMode: DeliveryMode,
  error: unknown,
): ComplimentCard {
  return {
    id: crypto.randomUUID(),
    originalInput: subject.displayInput,
    jobFunction: subject.jobFunction,
    personDetails: subject.personDetails,
    deliveryMode,
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

  const selected = pickOnePerBucket();
  debug.info("selected personas", selected.map((persona) => ({
    personaId: persona.id,
    personaName: persona.name,
    bucket: persona.bucket,
  })));

  const settled = await Promise.allSettled(
    selected.map(async (persona) =>
      makeCard(
        persona,
        subject,
        body.data.deliveryMode,
        await generateForPersona(persona, { ...subject, deliveryMode: body.data.deliveryMode }, preference, debug),
      ),
    ),
  );

  const cards = settled.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : makeFailedCard(selected[index]!, subject, body.data.deliveryMode, result.reason),
  );

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index]!;
    if (card.status === "error") continue;
    const accepted = cards.slice(0, index).filter((item) => item.status !== "error" && item.text);
    const issues = distinctnessIssues(card, accepted);
    if (issues.length === 0) continue;

    debug.warn("deck distinctness repair started", { personaId: card.personaId, issues });
    try {
      const replacement = makeCard(
        selected[index]!,
        subject,
        body.data.deliveryMode,
        await generateForPersona(
          selected[index]!,
          { ...subject, deliveryMode: body.data.deliveryMode },
          preference,
          debug,
          accepted.map((item) => item.text),
        ),
      );
      const remainingIssues = distinctnessIssues(replacement, accepted);
      cards[index] = remainingIssues.length === 0
        ? replacement
        : makeFailedCard(
            selected[index]!,
            subject,
            body.data.deliveryMode,
            new Error(`Distinctness failed: ${remainingIssues.join(", ")}`),
          );
    } catch (error) {
      cards[index] = makeFailedCard(selected[index]!, subject, body.data.deliveryMode, error);
    }
  }
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
      headers: rateLimitHeaders(rl),
    },
  );
}
