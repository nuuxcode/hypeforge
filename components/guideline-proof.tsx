"use client";

import { Check, ChevronDown, CircleAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { GuidelineCompliance, RuleCheckSource } from "@/lib/types";

const SOURCE_LABEL: Record<RuleCheckSource, string> = {
  code: "Code",
  evidence: "Evidence",
  heuristic: "Guard",
  model: "Model",
};

const SOURCE_DESCRIPTION: Record<RuleCheckSource, string> = {
  code: "Verified deterministically by server code",
  evidence: "Verified using an exact quote from the compliment",
  heuristic: "Checked with a conservative server-side pattern",
  model: "Verified by the structured Gemini self-check",
};

export function GuidelineProof({
  guidelines,
  className = "",
}: {
  guidelines?: GuidelineCompliance;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!guidelines) {
    return (
      <div
        className={`flex items-center gap-2 rounded-[12px] bg-[var(--paper-secondary)] px-3 py-2 text-xs font-medium text-[var(--ink-muted)] ${className}`}
      >
        <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-[var(--coral)]" />
        Generated before Guidelines v2.1 - not verified
      </div>
    );
  }

  const passed = guidelines.checks.filter((item) => item.state === "pass").length;
  const fullyVerified = passed === 8;

  return (
    <section
      aria-label="Company compliment guideline proof"
      className={`overflow-hidden rounded-[12px] bg-[var(--paper-secondary)] ${className}`}
    >
      <button
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <ShieldCheck
          aria-hidden="true"
          className={`size-4 shrink-0 ${fullyVerified ? "text-[#47751f]" : "text-[var(--coral)]"}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-[var(--ink)]">
            {passed}/8 guidelines verified
          </span>
          <span className="block text-[0.68rem] font-medium text-[var(--ink-muted)]">
            {guidelines.wordCount} words · {open ? "Hide details" : "View details"}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-[var(--ink-muted)] transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul className="border-t border-[var(--dark-line)]/60 px-3 py-1">
          {guidelines.checks.map((item) => (
            <li className="border-b border-[var(--dark-line)] py-2.5 last:border-b-0" key={item.id}>
              <div className="flex items-start gap-2">
                {item.state === "pass" ? (
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#d4ff66] text-[#294000]">
                    <Check aria-hidden="true" className="size-3" />
                  </span>
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--coral)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--ink)]">{item.label}</span>
                    <span
                      className="v2-mono rounded-full border border-[var(--dark-line)] bg-[var(--paper)] px-2 py-0.5 text-[0.6rem] uppercase text-[var(--ink-muted)]"
                      title={SOURCE_DESCRIPTION[item.source]}
                    >
                      {SOURCE_LABEL[item.source]}
                    </span>
                  </div>
                  {item.evidence ? (
                    <blockquote className="mt-1 text-xs font-medium leading-5 text-[var(--ink-muted)]">
                      “{item.evidence}”
                    </blockquote>
                  ) : item.note ? (
                    <p className="mt-1 text-xs font-medium leading-5 text-[var(--ink-muted)]">{item.note}</p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
