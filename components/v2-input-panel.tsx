"use client";

import { LoaderCircle, WandSparkles } from "lucide-react";
import { MAX_DETAILS_LENGTH, MAX_INPUT_LENGTH } from "@/lib/validate";

export const V2_EXAMPLES = [
  "Customer Success Manager",
  "Recruiter who never misses",
  "Founding Engineer",
  "my friend Sara who fixes every crisis",
  "a teacher who makes everyone believe in themselves",
  "a product manager with impossible calendar skills",
] as const;

export function V2InputPanel({
  jobFunction,
  personDetails,
  canGenerate,
  isGenerating,
  examplesExpanded,
  onJobFunctionChange,
  onPersonDetailsChange,
  onGenerate,
  onToggleExamples,
  onChooseExample,
}: {
  jobFunction: string;
  personDetails: string;
  canGenerate: boolean;
  isGenerating: boolean;
  examplesExpanded: boolean;
  onJobFunctionChange: (value: string) => void;
  onPersonDetailsChange: (value: string) => void;
  onGenerate: () => void;
  onToggleExamples: () => void;
  onChooseExample: (value: string) => void;
}) {
  return (
    <section
      className="self-start rounded-[24px] border border-[var(--line-strong)] bg-[var(--panel)] p-5 sm:p-6 lg:sticky lg:top-24"
      style={{ boxShadow: "var(--panel-shadow)" }}
    >
      <p className="v2-mono text-[0.68rem] uppercase text-[var(--cyan)]">Step 1 · Start here</p>
      <h1 className="v2-display mt-3 text-3xl font-semibold leading-tight text-[var(--text)] sm:text-4xl">
        Create three <span className="v2-gradient-text">distinct compliments.</span>
      </h1>
      <p className="mt-4 text-sm font-medium leading-6 text-[var(--text-muted)]">
        Start with their job or workplace function, then add an optional detail or recent win.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onGenerate();
        }}
      >
        <div className="space-y-2">
          <label className="v2-mono text-[0.68rem] uppercase text-[var(--text-muted)]" htmlFor="v2-subject">
            Job title or workplace function <span aria-hidden="true">*</span>
          </label>
          <textarea
            aria-describedby="v2-subject-help"
            className="min-h-24 w-full resize-none rounded-[18px] border border-[var(--line-strong)] bg-[var(--input-bg)] px-4 py-4 text-base font-semibold leading-7 text-[var(--text)] outline-none transition placeholder:text-[var(--input-placeholder)] focus:border-[var(--purple)] focus:ring-4 focus:ring-[#8b5cf6]/20"
            id="v2-subject"
            maxLength={MAX_INPUT_LENGTH}
            placeholder="e.g. Customer Success Manager"
            required
            value={jobFunction}
            onChange={(event) => onJobFunctionChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                onGenerate();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-[var(--text-faint)]" id="v2-subject-help">
            <span>Required. Use a title or a clear phrase describing what they do.</span>
            <span>{jobFunction.length}/{MAX_INPUT_LENGTH}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="v2-mono text-[0.68rem] uppercase text-[var(--text-muted)]" htmlFor="v2-details">
            Optional details
          </label>
          <textarea
            aria-describedby="v2-details-help"
            className="min-h-20 w-full resize-none rounded-[18px] border border-[var(--line)] bg-[var(--input-bg)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--text)] outline-none transition placeholder:text-[var(--input-placeholder)] focus:border-[var(--purple)] focus:ring-4 focus:ring-[#8b5cf6]/20"
            id="v2-details"
            maxLength={MAX_DETAILS_LENGTH}
            placeholder="e.g. calmed a difficult client call and helped the whole team"
            value={personDetails}
            onChange={(event) => onPersonDetailsChange(event.target.value)}
          />
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-[var(--text-faint)]" id="v2-details-help">
            <span>A name, recent win, or specific quality makes the praise more personal.</span>
            <span>{personDetails.length}/{MAX_DETAILS_LENGTH}</span>
          </div>
        </div>

        <button
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--ink)] px-5 py-3 text-base font-bold text-[var(--paper)] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#2a2530] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#a69d99] disabled:text-[#f9f4ec] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
          disabled={!canGenerate || isGenerating}
          type="submit"
        >
          {isGenerating ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <WandSparkles aria-hidden="true" className="size-5" />}
          {isGenerating ? "Creating your compliments..." : "Generate 3 compliments"}
        </button>
        <p className="text-center text-xs font-semibold text-[var(--text-faint)]" role="status">
          {canGenerate ? "Three distinct versions, ready in a few seconds." : "Add a workplace function above to enable generation."}
        </p>

        <div className="border-t border-[var(--line)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-[var(--text-muted)]">Need an idea?</p>
            <button
              aria-expanded={examplesExpanded}
              className="text-xs font-bold text-[var(--purple)] underline decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
              type="button"
              onClick={onToggleExamples}
            >
              {examplesExpanded ? "Show fewer" : `Show ${V2_EXAMPLES.length - 3} more`}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(examplesExpanded ? V2_EXAMPLES : V2_EXAMPLES.slice(0, 3)).map((example) => (
              <button
                className="min-h-9 rounded-[12px] border border-[var(--line)] bg-[var(--control-bg)] px-3 py-2 text-left text-xs font-bold text-[var(--text)] transition hover:border-[var(--purple)] hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/25"
                key={example}
                type="button"
                onClick={() => onChooseExample(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </form>
    </section>
  );
}
