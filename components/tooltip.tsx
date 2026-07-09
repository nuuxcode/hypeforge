import type { ReactNode } from "react";

export function Tooltip({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-56 -translate-x-1/2 rounded-[10px] border border-[#2b2430] bg-[#2b2430] px-2.5 py-1.5 text-center text-xs font-bold leading-4 text-[#fffaf0] opacity-0 shadow-lg shadow-black/20 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 invisible"
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
