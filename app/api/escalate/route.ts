import { providerErrorMessage } from "@/lib/ai";
import { rateLimitCookie, rateLimitHeaders, readRateLimit } from "@/lib/api-rate-limit";
import {
  generateCompliantCompliment,
  isGuidelineComplianceError,
  type ComplianceProgress,
} from "@/lib/compliant-generation";
import { createApiDebug, withDebug } from "@/lib/debug";
import { getPersona } from "@/lib/personas";
import { buildEscalationMessages } from "@/lib/prompts";
import { cleanModelText, validateCompliment } from "@/lib/safeText";
import { appendHistory, cleanHistory, EscalateBodySchema, resolveSubject } from "@/lib/validate";

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
  debug.info("persona resolved", { personaId: persona.id, personaName: persona.name });

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

  const runEscalation = async (onProgress?: (progress: ComplianceProgress) => void) => {
    try {
      debug.providerInfo("escalation generation started", {
        personaId: persona.id,
        personaName: persona.name,
        dramaLevel: body.data.dramaLevel,
      });
      const result = await generateCompliantCompliment({
        messages: buildEscalationMessages({
          persona,
          originalInput: subject.displayInput,
          jobFunction: subject.jobFunction,
          personDetails: subject.personDetails,
          deliveryMode: body.data.deliveryMode,
          currentText,
          history,
          dramaLevel: body.data.dramaLevel,
        }),
        subject: subject.jobFunction,
        personaId: persona.id,
        operation: "escalate",
        deliveryMode: body.data.deliveryMode,
        previousText: currentText,
        debug,
        temperature: 1.05,
        maxOutputTokens: 260,
        onProgress,
      });
      debug.providerInfo("escalation generation succeeded", {
        personaId: persona.id,
        personaName: persona.name,
        characterCount: result.text.length,
        wordCount: result.guidelines.wordCount,
      });

      return withDebug(
        {
          ok: true,
          text: result.text,
          history: appendHistory(history, result.text),
          dramaLevel: body.data.dramaLevel + 1,
          guidelines: result.guidelines,
        },
        debug.finish(),
      );
    } catch (error) {
      debug.providerError("escalation generation failed", error);
      return withDebug(
        { ok: false as const, error: isGuidelineComplianceError(error) ? error.message : providerErrorMessage(error) },
        debug.finish(),
      );
    }
  };

  if (!req.headers.get("accept")?.includes("application/x-ndjson")) {
    return Response.json(await runEscalation(), { headers: rateLimitHeaders(rl) });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const result = await runEscalation((progress) => send({ type: "progress", ...progress }));
      send({ type: "result", body: result });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      ...rateLimitHeaders(rl),
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
