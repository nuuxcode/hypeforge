"use client";

import { ChevronDown, LoaderCircle, WandSparkles } from "lucide-react";
import { useState } from "react";
import { MAX_DETAILS_LENGTH, MAX_INPUT_LENGTH } from "@/lib/validate";

// One chip is a person-details description on purpose: it shows the input
// takes more than bare job titles.
const EXAMPLES = [
  "Customer Success Manager",
  "Founding Engineer",
  "My friend Sara who fixes every crisis",
  "Night-shift nurse",
] as const;

export function V2InputPanel({
  jobFunction,
  personDetails,
  canGenerate,
  isGenerating,
  compact,
  onJobFunctionChange,
  onPersonDetailsChange,
  onGenerate,
  onChooseExample,
}: {
  jobFunction: string;
  personDetails: string;
  canGenerate: boolean;
  isGenerating: boolean;
  compact: boolean;
  onJobFunctionChange: (value: string) => void;
  onPersonDetailsChange: (value: string) => void;
  onGenerate: () => void;
  onChooseExample: (value: string) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const showDetails = detailsOpen || personDetails.length > 0;

  return (
    <section className={`v2-composer self-start ${compact ? "hidden p-5 lg:sticky lg:top-24 lg:block" : "p-6 sm:p-8"}`}>
      <h1 className={`v2-display font-semibold text-[var(--text)] ${compact ? "text-xl" : "text-4xl sm:text-5xl"}`}>
        {compact ? "New deck" : "Make someone’s day."}
      </h1>
      {!compact ? (
        <p className="mt-4 max-w-xl text-base font-medium leading-7 text-[var(--text-muted)]">
          Tell us what they do. Get three thoughtful, delightfully over-the-top compliments.
        </p>
      ) : null}

      <form
        className={compact ? "mt-5 space-y-4" : "mt-8 space-y-5"}
        onSubmit={(event) => {
          event.preventDefault();
          onGenerate();
        }}
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--text)]" htmlFor="v2-subject">
            Their job or role
          </label>
          <textarea
            aria-describedby="v2-subject-help"
            className={`v2-input w-full resize-none px-4 text-base font-medium leading-7 text-[var(--text)] outline-none ${compact ? "min-h-20 py-3" : "min-h-24 py-4"}`}
            id="v2-subject"
            maxLength={MAX_INPUT_LENGTH}
            placeholder="Customer Success Manager"
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
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-[var(--text-faint)]" id="v2-subject-help">
            <span>Required</span>
            <span>{jobFunction.length}/{MAX_INPUT_LENGTH}</span>
          </div>
        </div>

        <div>
          <button
            aria-expanded={showDetails}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
            type="button"
            onClick={() => setDetailsOpen((current) => !current)}
          >
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
            {showDetails ? "Hide personal detail" : "Add a personal detail"}
          </button>

          {showDetails ? (
            <div className="mt-2 space-y-2">
              <label className="sr-only" htmlFor="v2-details">Optional details</label>
              <textarea
                aria-describedby="v2-details-help"
                className="v2-input min-h-20 w-full resize-none px-4 py-3 text-sm font-medium leading-6 text-[var(--text)] outline-none"
                id="v2-details"
                maxLength={MAX_DETAILS_LENGTH}
                placeholder="A recent win or something they do especially well"
                value={personDetails}
                onChange={(event) => onPersonDetailsChange(event.target.value)}
              />
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-[var(--text-faint)]" id="v2-details-help">
                <span>Optional</span>
                <span>{personDetails.length}/{MAX_DETAILS_LENGTH}</span>
              </div>
            </div>
          ) : null}
        </div>

        <button
          className="v2-primary-button inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!canGenerate || isGenerating}
          type="submit"
        >
          {isGenerating ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <WandSparkles aria-hidden="true" className="size-5" />}
          {isGenerating ? "Creating compliments…" : "Generate 3 compliments"}
        </button>
        <p className="sr-only" role="status">
          {canGenerate ? "Ready to generate three compliments." : "Add a job or role to enable generation."}
        </p>

        {!compact ? (
          <div className="pt-1">
            <p className="text-xs font-medium text-[var(--text-faint)]">Try an example</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  className="v2-chip min-h-9 px-3 py-2 text-left text-xs font-medium"
                  key={example}
                  type="button"
                  onClick={() => onChooseExample(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
