import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "hypeforge_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function adminCode(): string {
  return process.env.HYPEFORGE_ADMIN_CODE ?? "";
}

function sessionSecret(): string {
  return process.env.HYPEFORGE_ADMIN_SESSION_SECRET ?? adminCode();
}

function signature(expiresAt: string): string {
  return createHmac("sha256", sessionSecret()).update(`hypeforge-admin:${expiresAt}`).digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function adminAccessConfigured(): boolean {
  return adminCode().length >= 8 && (process.env.HYPEFORGE_ADMIN_SESSION_SECRET?.length ?? 0) >= 32;
}

export function verifyAdminCode(candidate: string): boolean {
  return adminAccessConfigured() && constantTimeEqual(candidate, adminCode());
}

export function createAdminSession(): { value: string; maxAge: number } {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  return { value: `${expiresAt}.${signature(expiresAt)}`, maxAge: SESSION_TTL_SECONDS };
}

export function verifyAdminSession(value?: string): boolean {
  if (!adminAccessConfigured() || !value) return false;
  const [expiresAt, suppliedSignature, ...rest] = value.split(".");
  if (!expiresAt || !suppliedSignature || rest.length > 0 || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  return constantTimeEqual(suppliedSignature, signature(expiresAt));
}

export function adminCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

// Lets API routes honor privileged options (like model overrides) only when
// the request carries a valid admin session cookie.
export function requestHasAdminSession(req: Request): boolean {
  const header = req.headers.get("cookie") ?? "";
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  if (!match) return false;
  return verifyAdminSession(decodeURIComponent(match.slice(ADMIN_SESSION_COOKIE.length + 1)));
}
