import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft } from "lucide-react";
import { AdminLoginForm } from "./admin-login-form";
import { ADMIN_SESSION_COOKIE, adminAccessConfigured, verifyAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  if (verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/admin");

  return (
    <main className="min-h-dvh bg-[#f5f5f7] px-4 py-8 text-[#1d1d1f] sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.08)] sm:p-8">
        <div className="flex items-center justify-between">
          <Image alt="HypeForge" className="h-8 w-auto" height={200} priority src="/brand/hypeforge-logo-light.png" width={620} />
          <Activity aria-hidden="true" className="size-5 text-[#6e5ae6]" />
        </div>
        <p className="mt-10 text-xs font-semibold uppercase text-[#6e5ae6]">Private operations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">System diagnostics</h1>
        <p className="mt-3 text-sm leading-6 text-[#6e6e73]">
          Review AI attempts, rule failures, provider errors, repairs, and request timelines. Your signed session stays active for 30 days on this browser.
        </p>
        <AdminLoginForm configured={adminAccessConfigured()} />
        <Link className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#6e6e73] hover:text-[#1d1d1f]" href="/">
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to HypeForge
        </Link>
      </section>
    </main>
  );
}
