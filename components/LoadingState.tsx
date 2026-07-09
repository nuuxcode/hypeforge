"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

const MESSAGES = [
  "Summoning three compliments from the Department of Excessive Admiration...",
  "Polishing the crown...",
  "Consulting the compliment council...",
  "Inflating the metaphor balloon...",
  "Adding tasteful chaos...",
] as const;

type LoadingStateProps = {
  compact?: boolean;
};

export function LoadingState({ compact = false }: LoadingStateProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % MESSAGES.length);
    }, 1200);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className={
        compact
          ? "flex items-center gap-2 text-sm font-bold text-[#2f5d50]"
          : "rounded-[8px] border-2 border-neutral-950 bg-white p-4 shadow-[5px_5px_0_#151515]"
      }
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin text-[#db5b2a]" />
        <p className="text-sm font-black text-neutral-950">{MESSAGES[index]}</p>
      </div>
    </div>
  );
}
