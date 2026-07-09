import type { ReactNode } from "react";

type TooltipAlign = "start" | "center" | "end";

const alignClass: Record<TooltipAlign, string> = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

export function Tooltip({
  label,
  children,
  className = "",
  align = "center",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  align?: TooltipAlign;
}) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        className={`pointer-events-none absolute top-full z-50 mt-2 hidden w-max max-w-56 rounded-[10px] border border-[#2b2430] bg-[#2b2430] px-2.5 py-1.5 text-center text-xs font-bold leading-4 text-[#fffaf0] shadow-lg shadow-black/20 group-hover:block group-focus-within:block ${alignClass[align]}`}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
