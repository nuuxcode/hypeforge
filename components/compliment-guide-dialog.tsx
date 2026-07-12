"use client";

import { ArrowRight, ExternalLink, HeartHandshake, X } from "lucide-react";
import { Tooltip } from "@/components/tooltip";
import { useDialogFocus } from "@/lib/use-dialog-focus";

export function ComplimentGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose);
  if (!open) return null;

  const startWriting = () => {
    onClose();
    window.setTimeout(() => document.getElementById("v2-subject")?.focus(), 0);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-label="Compliment guide" aria-modal="true">
      <button aria-label="Close compliment guide" className="absolute inset-0 bg-[#141118]/35 backdrop-blur-[2px]" type="button" onClick={onClose} />
      <section
        aria-labelledby="compliment-guide-title"
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--bg)] shadow-2xl shadow-black/20"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5 sm:p-6">
          <div className="flex gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--coral)]">
              <HeartHandshake aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="v2-mono text-[0.68rem] uppercase text-[var(--purple-soft)]">A practical guide</p>
              <h2 className="v2-display mt-1 text-2xl font-semibold text-[var(--text)]" id="compliment-guide-title">Give praise that lands</h2>
            </div>
          </div>
          <Tooltip align="end" label="Close guide">
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

        <div className="overflow-y-auto p-5 sm:p-6">
          <p className="max-w-2xl text-sm font-medium leading-6 text-[var(--text-muted)]">
            A sincere compliment usually lands better than the giver expects. Keep it specific, name the difference it made, and say it while the moment is fresh.
          </p>

          <section className="mt-5 border-y border-[var(--line)] py-5">
            <p className="v2-mono text-[0.68rem] font-bold uppercase text-[var(--purple-soft)]">The 20-second formula</p>
            <ol className="mt-3 grid gap-4 sm:grid-cols-3">
              <li className="text-sm font-medium leading-6 text-[var(--text-muted)]"><strong className="block text-[var(--text)]">1. Notice</strong> Name the real action, choice, or skill.</li>
              <li className="text-sm font-medium leading-6 text-[var(--text-muted)]"><strong className="block text-[var(--text)]">2. Name the impact</strong> Say what became easier or better.</li>
              <li className="text-sm font-medium leading-6 text-[var(--text-muted)]"><strong className="block text-[var(--text)]">3. Deliver it</strong> Be plain, warm, and timely.</li>
            </ol>
          </section>

          <section className="py-5">
            <h3 className="v2-display text-lg font-semibold text-[var(--text)]">Make “great job” mean something</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[0.75fr_1.25fr]">
              <div className="rounded-[14px] bg-[var(--paper-secondary)] p-3 text-sm font-medium leading-6 text-[var(--text-muted)]">
                <span className="v2-mono block text-[0.65rem] uppercase">Instead of</span>
                “Great job on that call.”
              </div>
              <div className="rounded-[14px] bg-[var(--accent-soft)] p-3 text-sm font-medium leading-6 text-[var(--text)]">
                <span className="v2-mono block text-[0.65rem] font-bold uppercase text-[var(--text)]">Try</span>
                “You stayed calm during that client call and gave the team a clear next step. That steadiness mattered.”
              </div>
            </div>
          </section>

          <div className="grid gap-5 border-t border-[var(--line)] py-5 sm:grid-cols-2">
            <section>
              <h3 className="v2-display text-base font-semibold text-[var(--text)]">Match the setting</h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-muted)]"><strong className="text-[var(--text)]">Direct:</strong> use “you” and speak to the person.</p>
              <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-muted)]"><strong className="text-[var(--text)]">Public:</strong> name their role and share only details they would be comfortable seeing repeated.</p>
            </section>
            <section>
              <h3 className="v2-display text-base font-semibold text-[var(--text)]">When you receive one</h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-muted)]">Say thank you without deflecting. Save the words for a hard day, then pass the generosity on when you notice good work.</p>
            </section>
          </div>

          <section className="border-t border-[var(--line)] pt-5">
            <h3 className="v2-display text-base font-semibold text-[var(--text)]">Why it is worth saying</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-muted)]">
              Across several experiments, people underestimated how positive recipients would feel and overestimated how awkward compliments would be. A separate lab study also found praise acted as a social reward during motor-skill learning.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
              <a className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline" href="https://pubmed.ncbi.nlm.nih.gov/34636586/" rel="noreferrer" target="_blank">Compliment expectations study <ExternalLink aria-hidden="true" className="size-3" /></a>
              <a className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline" href="https://pubmed.ncbi.nlm.nih.gov/32856538/" rel="noreferrer" target="_blank">Giving compliments study <ExternalLink aria-hidden="true" className="size-3" /></a>
              <a className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline" href="https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0048174" rel="noreferrer" target="_blank">Praise and learning study <ExternalLink aria-hidden="true" className="size-3" /></a>
            </div>
          </section>

          <button
            className="v2-primary-button mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold"
            type="button"
            onClick={startWriting}
          >
            Write one now
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
