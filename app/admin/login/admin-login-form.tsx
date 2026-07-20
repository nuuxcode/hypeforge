"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";

export function AdminLoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [opening, setOpening] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        setError(body.error ?? "Admin sign-in failed.");
        setPending(false);
        return;
      }
      // Stay in the pending state through the client-side navigation so the
      // button never looks idle while the dashboard loads its records.
      setOpening(true);
      router.push("/admin");
    } catch {
      setError("The server could not be reached. Check that HypeForge is running.");
      setPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={submit}>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[#3a3a3f]">Access code</span>
        <input
          autoComplete="current-password"
          autoFocus
          className="min-h-12 w-full rounded-xl border border-black/10 bg-[#f5f5f7] px-4 text-base text-[#1d1d1f] outline-none transition focus:border-[#6e5ae6] focus:ring-4 focus:ring-[#6e5ae6]/15"
          disabled={!configured || pending}
          name="code"
          placeholder="Enter your private code"
          type="password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>
      {error ? <p className="rounded-xl bg-[#e45c54]/10 px-4 py-3 text-sm font-medium text-[#8f2924]" role="alert">{error}</p> : null}
      {!configured ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="alert">
          Set HYPEFORGE_ADMIN_CODE and HYPEFORGE_ADMIN_SESSION_SECRET on the server first.
        </p>
      ) : null}
      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] px-4 font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!configured || code.length < 1 || pending}
        type="submit"
      >
        {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <LockKeyhole aria-hidden="true" className="size-4" />}
        {opening ? "Opening diagnostics…" : pending ? "Checking code…" : "Open diagnostics"}
        {!pending ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
      </button>
    </form>
  );
}
