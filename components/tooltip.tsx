"use client";

import { useRef, useState, type ReactNode } from "react";

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
  const [open, setOpen] = useState(false);
  const dismissedByPointer = useRef(false);

  return (
    <span
      className={`relative inline-flex ${className}`}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          dismissedByPointer.current = false;
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      onPointerDown={() => {
        dismissedByPointer.current = true;
        setOpen(false);
      }}
      onPointerEnter={() => {
        if (!dismissedByPointer.current) setOpen(true);
      }}
      onPointerLeave={() => {
        dismissedByPointer.current = false;
        setOpen(false);
      }}
    >
      {children}
      <span
        className={`pointer-events-none absolute top-full z-50 mt-2 w-max max-w-56 rounded-[10px] border border-[#2b2430] bg-[#2b2430] px-2.5 py-1.5 text-center text-xs font-bold leading-4 text-[#fffaf0] shadow-lg shadow-black/20 ${open ? "block" : "hidden"} ${alignClass[align]}`}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
