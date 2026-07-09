"use client";

import { Sparkles, WandSparkles } from "lucide-react";
import { ExampleChips } from "./ExampleChips";
import { LoadingState } from "./LoadingState";

type InputPanelProps = {
  input: string;
  maxLength: number;
  examples: readonly string[];
  isGenerating: boolean;
  canGenerate: boolean;
  onInputChange: (value: string) => void;
  onExampleSelect: (value: string) => void;
  onGenerate: () => void;
};

export function InputPanel({
  input,
  maxLength,
  examples,
  isGenerating,
  canGenerate,
  onInputChange,
  onExampleSelect,
  onGenerate,
}: InputPanelProps) {
  return (
    <section className="rounded-[8px] border-2 border-neutral-950 bg-[#fffaf0] p-4 shadow-[6px_6px_0_#151515] sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-[8px] border-2 border-neutral-950 bg-[#db5b2a] text-white">
          <Sparkles aria-hidden="true" className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black uppercase text-[#2f5d50]">HypeForge</p>
          <h1 className="text-3xl font-black leading-tight text-neutral-950 sm:text-4xl">
            Turn any person into a living legend.
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-neutral-700">
            Enter a job title or person details and receive three wildly unnecessary compliments.
          </p>
        </div>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onGenerate();
        }}
      >
        <div className="space-y-2">
          <label className="text-sm font-black text-neutral-950" htmlFor="subject">
            Who are we hyping?
          </label>
          <textarea
            className="min-h-32 w-full resize-none rounded-[8px] border-2 border-neutral-950 bg-white px-3 py-3 text-base font-semibold leading-6 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:ring-4 focus:ring-[#f7c948]"
            id="subject"
            maxLength={maxLength}
            placeholder="e.g. Customer Success Manager, Recruiter, or my friend Sara who fixes every crisis"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
          />
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-neutral-600">
            <span>Minimum 3 characters</span>
            <span>
              {input.length}/{maxLength}
            </span>
          </div>
        </div>

        <ExampleChips examples={examples} onSelect={onExampleSelect} />

        <button
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] border-2 border-neutral-950 bg-neutral-950 px-4 py-3 text-base font-black text-white transition hover:-translate-y-0.5 hover:bg-[#2f5d50] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-neutral-400 focus:outline-none focus:ring-4 focus:ring-[#f7c948]"
          disabled={!canGenerate || isGenerating}
          type="submit"
        >
          <WandSparkles aria-hidden="true" className="size-5" />
          {isGenerating ? "Forging compliments" : "Forge 3 compliments"}
        </button>

        {isGenerating ? <LoadingState compact /> : null}
      </form>
    </section>
  );
}
