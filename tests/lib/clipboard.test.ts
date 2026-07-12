// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "@/lib/clipboard";

describe("copyTextToClipboard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the Clipboard API when permission is available", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    await expect(copyTextToClipboard("current dramatic version")).resolves.toBe("clipboard");
    expect(writeText).toHaveBeenCalledWith("current dramatic version");
  });

  it("falls back after a clipboard permission failure", async () => {
    const writeText = vi.fn(async () => Promise.reject(new DOMException("Denied", "NotAllowedError")));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });

    await expect(copyTextToClipboard("latest card text")).resolves.toBe("fallback");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });
});
