"use client";

import Link, { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";

function PendingSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-[#6e5ae6]" />;
}

// Filter-tab link that shows an inline spinner while the server re-renders the
// log list, so switching views never feels frozen.
export function TabLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? "bg-white shadow-sm" : "text-[#4b4b50] hover:text-[#1d1d1f]"}`}
      href={href}
    >
      {children}
      <PendingSpinner />
    </Link>
  );
}
