// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "@/lib/client-fetch";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts a request that exceeds its deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        }),
      ),
    );

    const request = fetchWithTimeout("/api/generate", {}, 10);
    const rejection = expect(request).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(11);
    await rejection;
  });
});
