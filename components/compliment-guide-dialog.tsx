"use client";

import { HeartHandshake, X } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

export function ComplimentGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-label="Compliment guide" aria-modal="true">
      <button aria-label="Close compliment guide" className="absolute inset-0 bg-[#141118]/35 backdrop-blur-[2px]" type="button" onClick={onClose} />
      <section className="relative w-full max-w-xl rounded-[24px] border border-[var(--line)] bg-[var(--bg)] p-5 shadow-2xl shadow-black/20 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--coral)]">
              <HeartHandshake aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="v2-mono text-[0.68rem] uppercase text-[var(--purple-soft)]">A small guide</p>
              <h2 className="v2-display mt-1 text-2xl font-semibold text-[var(--text)]">Give praise that lands</h2>
            </div>
          </div>
          <Tooltip label="Close guide">
            <button
              aria-label="Close compliment guide"
              className="grid size-10 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--text)] transition hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
              type="button"
              onClick={onClose}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-[18px] border border-[var(--line)] bg-[var(--panel-raised)] p-4">
            <h3 className="v2-display text-lg font-semibold text-[var(--text)]">When you give one</h3>
            <ol className="mt-3 space-y-3 text-sm font-medium leading-6 text-[var(--text-muted)]">
              <li><span className="font-bold text-[var(--text)]">1. Notice a detail.</span> Name something they actually did.</li>
              <li><span className="font-bold text-[var(--text)]">2. Name the impact.</span> Say what changed because of it.</li>
              <li><span className="font-bold text-[var(--text)]">3. Keep it human.</span> Specific beats grand every time.</li>
            </ol>
          </section>
          <section className="rounded-[18px] border border-[var(--line)] bg-[var(--panel-raised)] p-4">
            <h3 className="v2-display text-lg font-semibold text-[var(--text)]">When you receive one</h3>
            <ol className="mt-3 space-y-3 text-sm font-medium leading-6 text-[var(--text-muted)]">
              <li><span className="font-bold text-[var(--text)]">1. Let it land.</span> A simple “thank you” is enough.</li>
              <li><span className="font-bold text-[var(--text)]">2. Keep the evidence.</span> Save words that steady you on harder days.</li>
              <li><span className="font-bold text-[var(--text)]">3. Pass it on.</span> Return praise when you notice good work.</li>
            </ol>
          </section>
        </div>
      </section>
    </div>
  );
}
