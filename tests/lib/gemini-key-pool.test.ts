import { describe, expect, it, vi } from "vitest";
import {
  classifyGeminiFailure,
  configuredGeminiKeyEntries,
  GeminiKeyPool,
  GeminiKeyPoolExhaustedError,
  type GeminiKeyPoolEvent,
} from "@/lib/gemini-key-pool";

const KEYS = [
  { envName: "GEMINI_API_KEY", apiKey: "key-one" },
  { envName: "GEMINI_API_KEY_4", apiKey: "key-two" },
  { envName: "GEMINI_API_KEY_7", apiKey: "key-three" },
];

describe("GeminiKeyPool", () => {
  it("rotates immediately on quota and retries the same operation", async () => {
    const pool = new GeminiKeyPool(KEYS);
    const operation = vi.fn(async (key: string) => {
      if (key === "key-one") throw new Error("429 RESOURCE_EXHAUSTED quota exceeded");
      return key;
    });
    const events: GeminiKeyPoolEvent[] = [];

    await expect(pool.run(operation, (event) => events.push(event))).resolves.toBe("key-two");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(events).toContainEqual(expect.objectContaining({ type: "rotation", reason: "quota", keySlot: 1, nextKeySlot: 2 }));
    expect(events).toContainEqual(expect.objectContaining({ type: "recovered", keySlot: 2, attemptedKeys: 2 }));
  });

  it("rotates immediately when a key is invalid", async () => {
    const pool = new GeminiKeyPool(KEYS);
    const operation = vi.fn(async (key: string) => {
      if (key === "key-one") throw Object.assign(new Error("API_KEY_INVALID"), { statusCode: 403 });
      return "ok";
    });

    await expect(pool.run(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenNthCalledWith(2, "key-two", expect.objectContaining({ keySlot: 2 }));
  });

  it("rotates only after three consecutive ordinary provider errors", async () => {
    const pool = new GeminiKeyPool(KEYS);
    const failing = vi.fn(async () => { throw new Error("socket disconnected"); });

    await expect(pool.run(failing)).rejects.toThrow("socket disconnected");
    await expect(pool.run(failing)).rejects.toThrow("socket disconnected");
    const third = vi.fn(async (key: string) => key === "key-one" ? Promise.reject(new Error("socket disconnected")) : "recovered");
    await expect(pool.run(third)).resolves.toBe("recovered");
    expect(third).toHaveBeenCalledTimes(2);
  });

  it("resets a key failure streak after a successful call", async () => {
    const pool = new GeminiKeyPool(KEYS);
    await expect(pool.run(async () => { throw new Error("temporary"); })).rejects.toThrow("temporary");
    await expect(pool.run(async () => "ok")).resolves.toBe("ok");
    await expect(pool.run(async () => { throw new Error("temporary"); })).rejects.toThrow("temporary");
    await expect(pool.run(async () => { throw new Error("temporary"); })).rejects.toThrow("temporary");
  });

  it("fails clearly after every configured key hits quota", async () => {
    const pool = new GeminiKeyPool(KEYS);
    await expect(pool.run(async () => { throw new Error("quota exhausted"); })).rejects.toBeInstanceOf(GeminiKeyPoolExhaustedError);
  });
});

describe("Gemini key configuration", () => {
  it("uses the named pool in order and removes duplicate key values", () => {
    expect(configuredGeminiKeyEntries({
      GEMINI_API_KEY: "same",
      GEMINI_API_KEY_2: "same",
      GEMINI_API_KEY_4: "different",
      HYPEFORGE_GEMINI_API_KEY: "legacy",
    })).toEqual([
      { envName: "GEMINI_API_KEY", apiKey: "same" },
      { envName: "GEMINI_API_KEY_4", apiKey: "different" },
    ]);
  });

  it("keeps the old HypeForge key as a fallback for existing deployments", () => {
    expect(configuredGeminiKeyEntries({ HYPEFORGE_GEMINI_API_KEY: "legacy" })).toEqual([
      { envName: "HYPEFORGE_GEMINI_API_KEY", apiKey: "legacy" },
    ]);
  });

  it("classifies nested status codes", () => {
    expect(classifyGeminiFailure({ cause: { statusCode: 429 } })).toBe("quota");
    expect(classifyGeminiFailure({ cause: { status: 401 } })).toBe("credentials");
    expect(classifyGeminiFailure(new Error("API key not valid. Please pass a valid API key."))).toBe("credentials");
    expect(classifyGeminiFailure(new Error("connection reset"))).toBe("provider-error");
  });
});
