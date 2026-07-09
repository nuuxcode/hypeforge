import { createHmac } from "node:crypto";
import type { RateLimitState } from "./types";

export const LIMIT = Number(process.env.DAILY_LIMIT ?? 20);
const WINDOW_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.RATELIMIT_SECRET;
  if (!secret) throw new Error("RATELIMIT_SECRET is not set.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function buildCookie(state: RateLimitState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseCookie(raw: string | undefined): RateLimitState | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (sign(payload) !== signature) return null;

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const state = JSON.parse(json) as RateLimitState;
    if (typeof state.count !== "number" || typeof state.resetAt !== "number") return null;
    return state;
  } catch {
    return null;
  }
}

export function checkAndIncrement(rawCookie: string | undefined): {
  ok: boolean;
  remaining: number;
  resetAt: number;
  newCookie: string;
} {
  const now = Date.now();
  let state = parseCookie(rawCookie);
  if (!state || now > state.resetAt) {
    state = { count: 0, resetAt: now + WINDOW_MS };
  }
  if (state.count >= LIMIT) {
    return { ok: false, remaining: 0, resetAt: state.resetAt, newCookie: buildCookie(state) };
  }

  const next = { count: state.count + 1, resetAt: state.resetAt };
  return {
    ok: true,
    remaining: Math.max(0, LIMIT - next.count),
    resetAt: next.resetAt,
    newCookie: buildCookie(next),
  };
}
