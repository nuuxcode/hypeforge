"use client";

import { Settings2, Volume2, X } from "lucide-react";
import { Tooltip } from "@/components/tooltip";
import { saveSoundEnabled, useSoundEnabled } from "@/lib/forge-sound";
import { saveProofStyle, useProofStyle, type ProofHeadlineStyle } from "@/lib/proof-style";
import { useDialogFocus } from "@/lib/use-dialog-focus";

const OPTIONS: Array<{ value: ProofHeadlineStyle; title: string; description: string }> = [
  {
    value: "audited",
    title: "Show check sources",
    description: "Badge reads “8/8 checks passed” and says how many rules were verified in code versus by the independent AI audit.",
  },
  {
    value: "verified",
    title: "Compact verified badge",
    description: "Badge reads “8/8 guidelines verified”. The per-rule source labels stay visible inside the details panel.",
  },
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose);
  const current = useProofStyle();
  const soundEnabled = useSoundEnabled();
  if (!open) return null;

  return (
    <div aria-label="Settings" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog">
      <button aria-label="Close settings" className="absolute inset-0 bg-[#141118]/35 backdrop-blur-[2px]" type="button" onClick={onClose} />
      <section
        aria-labelledby="settings-title"
        className="relative w-full max-w-md rounded-[24px] border border-[var(--line)] bg-[var(--bg)] p-5 shadow-2xl shadow-black/20 sm:p-6"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--coral)]">
              <Settings2 aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="v2-mono text-[0.68rem] uppercase text-[var(--purple-soft)]">Settings</p>
              <h2 className="v2-display mt-1 text-2xl font-semibold text-[var(--text)]" id="settings-title">Experience settings</h2>
            </div>
          </div>
          <Tooltip align="end" label="Close settings">
            <button
              aria-label="Close settings"
              className="grid size-10 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--text)] transition hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
              type="button"
              onClick={onClose}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 rounded-[18px] border border-[var(--line)] bg-[var(--panel-raised)] p-4">
          <div className="flex min-w-0 items-start gap-3">
            <Volume2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--accent)]" />
            <div>
              <p className="text-sm font-bold text-[var(--text)]">Sound effects</p>
              <p className="mt-1 text-sm font-medium leading-5 text-[var(--text-muted)]">Subtle cues when the forge starts and a new version lands.</p>
            </div>
          </div>
          <button
            aria-checked={soundEnabled}
            aria-label="Sound effects"
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] ${soundEnabled ? "bg-[var(--accent)]" : "bg-[var(--muted-fill-strong)]"}`}
            role="switch"
            type="button"
            onClick={() => saveSoundEnabled(!soundEnabled)}
          >
            <span className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${soundEnabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        <fieldset className="mt-6 space-y-3">
          <legend className="mb-3 text-sm font-bold text-[var(--text)]">Compliance badge</legend>
          {OPTIONS.map((option) => (
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-[18px] border p-4 transition ${
                current === option.value
                  ? "border-[var(--coral)] bg-[var(--panel-raised)]"
                  : "border-[var(--line)] bg-[var(--panel-raised)]/60 hover:bg-[var(--panel-raised)]"
              }`}
              key={option.value}
            >
              <input
                checked={current === option.value}
                className="mt-1 size-4 accent-[var(--coral)]"
                name="proof-headline-style"
                type="radio"
                value={option.value}
                onChange={() => saveProofStyle(option.value)}
              />
              <span>
                <span className="block text-sm font-bold text-[var(--text)]">{option.title}</span>
                <span className="mt-1 block text-sm font-medium leading-6 text-[var(--text-muted)]">{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <p className="mt-4 text-xs font-medium leading-5 text-[var(--text-muted)]">
          Both styles show the same 8 rule checks; this only changes how the headline words them. Saved on this device.
        </p>
      </section>
    </div>
  );
}
