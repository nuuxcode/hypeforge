"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CardPendingAction } from "@/lib/types";

const DEFAULT_PULSE_MS = 2_000;

export type CardCompletionPulse = {
  action: CardPendingAction;
  dramaLevel: number;
  expiresAt: number;
};

export function useCardCompletionPulses(durationMs = DEFAULT_PULSE_MS) {
  const [pulses, setPulses] = useState<Record<string, CardCompletionPulse | undefined>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  const clear = useCallback((cardId: string, expiresAt?: number) => {
    const timer = timers.current[cardId];
    if (timer) clearTimeout(timer);
    delete timers.current[cardId];
    setPulses((current) => {
      if (expiresAt && current[cardId]?.expiresAt !== expiresAt) return current;
      if (!current[cardId]) return current;
      const next = { ...current };
      delete next[cardId];
      return next;
    });
  }, []);

  const announce = useCallback((cardId: string, action: CardPendingAction, dramaLevel: number) => {
    const previousTimer = timers.current[cardId];
    if (previousTimer) clearTimeout(previousTimer);

    const expiresAt = Date.now() + durationMs;
    setPulses((current) => ({ ...current, [cardId]: { action, dramaLevel, expiresAt } }));
    timers.current[cardId] = setTimeout(() => clear(cardId, expiresAt), durationMs);
  }, [clear, durationMs]);

  useEffect(() => {
    const clearExpired = () => {
      const now = Date.now();
      setPulses((current) => {
        const expiredIds = Object.entries(current)
          .filter(([, pulse]) => pulse && pulse.expiresAt <= now)
          .map(([cardId]) => cardId);
        if (expiredIds.length === 0) return current;
        const next = { ...current };
        expiredIds.forEach((cardId) => {
          const timer = timers.current[cardId];
          if (timer) clearTimeout(timer);
          delete timers.current[cardId];
          delete next[cardId];
        });
        return next;
      });
    };
    const clearExpiredWhenVisible = () => {
      if (document.visibilityState === "visible") clearExpired();
    };
    window.addEventListener("focus", clearExpired);
    document.addEventListener("visibilitychange", clearExpiredWhenVisible);
    return () => {
      window.removeEventListener("focus", clearExpired);
      document.removeEventListener("visibilitychange", clearExpiredWhenVisible);
      Object.values(timers.current).forEach((timer) => timer && clearTimeout(timer));
      timers.current = {};
    };
  }, []);

  return { pulses, announce, clear };
}
