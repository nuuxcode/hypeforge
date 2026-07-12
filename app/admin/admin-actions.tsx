"use client";

import { LogOut, RefreshCw } from "lucide-react";

export function AdminActions() {
  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.assign("/admin/login");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="grid size-10 place-items-center rounded-xl border border-black/10 bg-white text-[#3a3a3f] transition hover:bg-[#f5f5f7]"
        aria-label="Refresh diagnostics"
        title="Refresh diagnostics"
        type="button"
        onClick={() => window.location.reload()}
      >
        <RefreshCw aria-hidden="true" className="size-4" />
      </button>
      <button
        aria-label="Sign out"
        className="grid size-10 place-items-center rounded-xl border border-black/10 bg-white text-sm font-semibold text-[#3a3a3f] transition hover:bg-[#f5f5f7] sm:flex sm:w-auto sm:px-3"
        type="button"
        onClick={signOut}
      >
        <LogOut aria-hidden="true" className="size-4" /> <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}
