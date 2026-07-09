import { generateCompliment } from "@/lib/ai";
import { getPersona } from "@/lib/personas";
import { buildEscalationMessages } from "@/lib/prompts";
import { checkAndIncrement } from "@/lib/rateLimit";
import { cleanModelText, validateCompliment } from "@/lib/safeText";
import { cleanHistory, EscalateBodySchema, sanitizeInput } from "@/lib/validate";

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
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const body = EscalateBodySchema.safeParse(parsed);
  if (!body.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  let rl;
  try {
    rl = checkAndIncrement(getCookie(req, COOKIE_NAME));
  } catch (error) {
    console.error("[rate-limit]", (error as Error).message);
    return Response.json({ error: "Server configuration is missing." }, { status: 500 });
  }

  const setCookie = cookieHeader(rl.newCookie);
  if (!rl.ok) {
    return Response.json(
      { error: "Too much brilliance at once. Wait a moment and retry.", resetAt: rl.resetAt },
      { status: 429, headers: { "Set-Cookie": setCookie } },
    );
  }

  const persona = getPersona(body.data.personaId);
  if (!persona) {
    return Response.json(
      { error: "Invalid compliment persona." },
      { status: 400, headers: { "Set-Cookie": setCookie } },
    );
  }

  let originalInput: string;
  try {
    originalInput = sanitizeInput(body.data.originalInput);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 400, headers: { "Set-Cookie": setCookie } },
    );
  }

  const currentText = cleanModelText(body.data.currentText);
  const history = cleanHistory(body.data.history);
  try {
    validateCompliment(currentText);
  } catch {
    return Response.json(
      { error: "The current compliment is too chaotic to escalate. Try generating again." },
      { status: 400, headers: { "Set-Cookie": setCookie } },
    );
  }

  try {
    const text = await generateCompliment(
      buildEscalationMessages({
        persona,
        originalInput,
        currentText,
        history,
        dramaLevel: body.data.dramaLevel,
      }),
      { temperature: 1.05, maxOutputTokens: 280 },
    );

    return Response.json(
      {
        text,
        history: [...history, text],
        dramaLevel: body.data.dramaLevel + 1,
      },
      {
        headers: {
          "Set-Cookie": setCookie,
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      },
    );
  } catch (error) {
    console.error("[escalate]", (error as Error).message);
    return Response.json(
      { error: "The compliment engine got overwhelmed by your brilliance. Try again." },
      { status: 502, headers: { "Set-Cookie": setCookie } },
    );
  }
}
