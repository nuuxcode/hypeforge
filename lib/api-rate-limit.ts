import { checkAndIncrement } from "./rateLimit";

const COOKIE_NAME = "hypeforge_rl";

function getCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const pair of header.split(";")) {
    const [key, value] = pair.trim().split("=");
    if (key === COOKIE_NAME) return decodeURIComponent(value);
  }
  return undefined;
}

export function readRateLimit(request: Request): ReturnType<typeof checkAndIncrement> {
  return checkAndIncrement(getCookie(request));
}

export function rateLimitCookie(value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`;
}

export function rateLimitHeaders(
  state: ReturnType<typeof checkAndIncrement>,
): Record<string, string> {
  return {
    "Set-Cookie": rateLimitCookie(state.newCookie),
    "X-RateLimit-Remaining": String(state.remaining),
    "X-RateLimit-Reset": String(state.resetAt),
  };
}
