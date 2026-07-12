import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminAccessConfigured,
  adminCookieOptions,
  createAdminSession,
  verifyAdminCode,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!adminAccessConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Admin access is not configured on this server." },
      { status: 503 },
    );
  }

  let code = "";
  try {
    const body = await request.json() as { code?: unknown };
    code = typeof body.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Enter the admin access code." }, { status: 400 });
  }

  if (!verifyAdminCode(code)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return NextResponse.json({ ok: false, error: "That access code is not valid." }, { status: 401 });
  }

  const session = createAdminSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, session.value, adminCookieOptions(session.maxAge));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", adminCookieOptions(0));
  return response;
}
