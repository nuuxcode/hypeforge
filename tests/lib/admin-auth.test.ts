import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  adminAccessConfigured,
  createAdminSession,
  verifyAdminCode,
  verifyAdminSession,
} from "@/lib/admin-auth";

describe("admin session authentication", () => {
  const previousCode = process.env.HYPEFORGE_ADMIN_CODE;
  const previousSecret = process.env.HYPEFORGE_ADMIN_SESSION_SECRET;

  beforeEach(() => {
    process.env.HYPEFORGE_ADMIN_CODE = "private-admin-code";
    process.env.HYPEFORGE_ADMIN_SESSION_SECRET = "a-long-independent-session-secret";
  });

  afterEach(() => {
    if (previousCode === undefined) delete process.env.HYPEFORGE_ADMIN_CODE;
    else process.env.HYPEFORGE_ADMIN_CODE = previousCode;
    if (previousSecret === undefined) delete process.env.HYPEFORGE_ADMIN_SESSION_SECRET;
    else process.env.HYPEFORGE_ADMIN_SESSION_SECRET = previousSecret;
  });

  it("accepts the configured code and signs a persistent session", () => {
    expect(adminAccessConfigured()).toBe(true);
    expect(verifyAdminCode("private-admin-code")).toBe(true);
    expect(verifyAdminCode("wrong-code")).toBe(false);
    const session = createAdminSession();
    expect(session.maxAge).toBe(60 * 60 * 24 * 30);
    expect(verifyAdminSession(session.value)).toBe(true);
  });

  it("rejects tampered and expired-looking sessions", () => {
    const session = createAdminSession();
    expect(verifyAdminSession(`${session.value}tampered`)).toBe(false);
    expect(verifyAdminSession(`1.${session.value.split(".")[1]}`)).toBe(false);
  });
});
