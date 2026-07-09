import { generateCompliment } from "@/lib/ai";
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

function shouldRetry(error: unknown): boolean {
  const message = (error as Error).message ?? "";
  return !/(quota|billing|denied access|api key|rate.?limit)/i.test(message);
}

async function generateForPersona(persona: Persona, input: string): Promise<string> {
  const messages = buildInitialMessages(persona, input);
  try {
    return await generateCompliment(messages, { temperature: 1, maxOutputTokens: 260 });
  } catch (error) {
    if (!shouldRetry(error)) throw error;
    console.error(`[persona-retry:${persona.id}]`, (error as Error).message);
    return generateCompliment(messages, { temperature: 1, maxOutputTokens: 260 });
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
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const body = GenerateBodySchema.safeParse(parsed);
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

  let input: string;
  try {
    input = sanitizeInput(body.data.input);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 400, headers: { "Set-Cookie": setCookie } },
    );
  }

  const selected = pickOnePerBucket();
  const settled = await Promise.allSettled(
    selected.map(async (persona) => makeCard(persona, input, await generateForPersona(persona, input))),
  );

  const cards = settled.map((result, index) =>
    result.status === "fulfilled" ? result.value : makeFailedCard(selected[index]!, input),
  );

  if (cards.every((card) => card.status === "error")) {
    return Response.json(
      { error: "The compliment engine got overwhelmed by your brilliance. Try again.", cards },
      { status: 502, headers: { "Set-Cookie": setCookie } },
    );
  }

  return Response.json(
    { cards },
    {
      headers: {
        "Set-Cookie": setCookie,
        "X-RateLimit-Remaining": String(rl.remaining),
        "X-RateLimit-Reset": String(rl.resetAt),
      },
    },
  );
}
