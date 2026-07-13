// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CardCompletionPulse,
  useCardCompletionPulses,
} from "@/hooks/use-card-completion-pulses";

let container: HTMLDivElement | undefined;

afterEach(() => {
  container?.remove();
  container = undefined;
  vi.useRealTimers();
});

describe("useCardCompletionPulses", () => {
  it("expires a success treatment without requiring a page refresh", async () => {
    vi.useFakeTimers();
    let announce: ((cardId: string, action: "escalate", dramaLevel: number) => void) | undefined;
    let pulses: Record<string, CardCompletionPulse | undefined> = {};

    function Harness() {
      const completion = useCardCompletionPulses(2_000);
      announce = completion.announce;
      pulses = completion.pulses;
      return null;
    }

    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));

    await act(async () => announce?.("grand", "escalate", 2));
    expect(pulses.grand?.dramaLevel).toBe(2);

    await act(async () => vi.advanceTimersByTime(2_001));
    expect(pulses.grand).toBeUndefined();
    await act(async () => root.unmount());
  });

  it("clears an expired treatment when a throttled tab regains focus", async () => {
    vi.useFakeTimers();
    let announce: ((cardId: string, action: "escalate", dramaLevel: number) => void) | undefined;
    let pulses: Record<string, CardCompletionPulse | undefined> = {};

    function Harness() {
      const completion = useCardCompletionPulses(2_000);
      announce = completion.announce;
      pulses = completion.pulses;
      return null;
    }

    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    await act(async () => announce?.("grand", "escalate", 2));

    vi.setSystemTime(Date.now() + 2_500);
    await act(async () => window.dispatchEvent(new Event("focus")));

    expect(pulses.grand).toBeUndefined();
    await act(async () => root.unmount());
  });
});
