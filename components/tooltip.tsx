"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipAlign = "start" | "center" | "end";
type TooltipPosition = { left: number; top: number; placement: "above" | "below" };

const VIEWPORT_GAP = 8;
const TRIGGER_GAP = 8;

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
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const dismissedByPointer = useRef(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  const closeTooltip = () => {
    setOpen(false);
    setPosition(null);
  };

  const openTooltip = () => {
    setPosition(null);
    setOpen(true);
  };

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const triggerBox = trigger.getBoundingClientRect();
    const tooltipBox = tooltip.getBoundingClientRect();
    const preferredLeft = align === "start"
      ? triggerBox.left
      : align === "end"
        ? triggerBox.right - tooltipBox.width
        : triggerBox.left + (triggerBox.width - tooltipBox.width) / 2;
    const maxLeft = Math.max(VIEWPORT_GAP, window.innerWidth - tooltipBox.width - VIEWPORT_GAP);
    const left = Math.min(Math.max(preferredLeft, VIEWPORT_GAP), maxLeft);
    const roomBelow = window.innerHeight - triggerBox.bottom;
    const roomAbove = triggerBox.top;
    const placement = roomBelow < tooltipBox.height + TRIGGER_GAP && roomAbove > roomBelow
      ? "above"
      : "below";
    const preferredTop = placement === "above"
      ? triggerBox.top - tooltipBox.height - TRIGGER_GAP
      : triggerBox.bottom + TRIGGER_GAP;
    const maxTop = Math.max(VIEWPORT_GAP, window.innerHeight - tooltipBox.height - VIEWPORT_GAP);
    const top = Math.min(Math.max(preferredTop, VIEWPORT_GAP), maxTop);

    setPosition({ left, top, placement });
  }, [align]);

  useEffect(() => {
    if (!open) return;

    let frame = requestAnimationFrame(updatePosition);
    const reposition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, updatePosition]);

  return (
    <span
      aria-describedby={open ? tooltipId : undefined}
      className={`inline-flex ${className}`}
      ref={triggerRef}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          dismissedByPointer.current = false;
          closeTooltip();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") closeTooltip();
      }}
      onFocusCapture={(event) => {
        const focusTarget = event.target;
        if (
          !dismissedByPointer.current &&
          focusTarget instanceof HTMLElement &&
          focusTarget.matches(":focus-visible")
        ) {
          openTooltip();
        }
      }}
      onPointerDown={() => {
        dismissedByPointer.current = true;
        closeTooltip();
      }}
      onPointerEnter={() => {
        if (!dismissedByPointer.current) openTooltip();
      }}
      onPointerLeave={() => {
        dismissedByPointer.current = false;
        closeTooltip();
      }}
    >
      {children}
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              className="pointer-events-none fixed w-max max-w-[calc(100vw-16px)] rounded-[10px] border border-[#2b2430] bg-[#2b2430] px-2.5 py-1.5 text-center text-xs font-bold leading-4 text-[#fffaf0] shadow-lg shadow-black/20"
              data-placement={position?.placement}
              id={tooltipId}
              ref={tooltipRef}
              role="tooltip"
              style={{
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                visibility: position ? "visible" : "hidden",
                zIndex: 10_000,
              }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
