export const GEMINI_KEY_ENV_NAMES = [
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_2",
  "GEMINI_API_KEY_3",
  "GEMINI_API_KEY_4",
  "GEMINI_API_KEY_5",
  "GEMINI_API_KEY_6",
  "GEMINI_API_KEY_7",
] as const;

const LEGACY_KEY_ENV_NAME = "HYPEFORGE_GEMINI_API_KEY";
const FAILURE_THRESHOLD = 3;

export type GeminiFailureReason = "quota" | "credentials" | "provider-error";

export type GeminiKeyEntry = {
  envName: string;
  apiKey: string;
};

export type GeminiKeyMetadata = {
  keySlot: number;
  keyCount: number;
  keyName: string;
};

export type GeminiKeyPoolEvent =
  | ({ type: "failure"; reason: GeminiFailureReason; consecutiveFailures: number; rotatesNow: boolean } & GeminiKeyMetadata)
  | ({ type: "rotation"; reason: GeminiFailureReason; consecutiveFailures: number; nextKeySlot: number; nextKeyName: string } & GeminiKeyMetadata)
  | ({ type: "recovered"; attemptedKeys: number } & GeminiKeyMetadata);

export type GeminiKeyPoolEventHandler = (event: GeminiKeyPoolEvent) => void;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function statusCodes(error: unknown, seen = new WeakSet<object>()): number[] {
  if (!error || typeof error !== "object" || seen.has(error)) return [];
  seen.add(error);
  const record = error as Record<string, unknown>;
  const ownCodes = [record.status, record.statusCode]
    .map((value) => typeof value === "number" ? value : Number(value))
    .filter((value) => Number.isFinite(value));
  return [...ownCodes, ...statusCodes(record.cause, seen), ...statusCodes(record.lastError, seen)];
}

export function classifyGeminiFailure(error: unknown): GeminiFailureReason {
  const message = errorMessage(error);
  const codes = statusCodes(error);
  if (codes.includes(429) || /quota|RESOURCE_EXHAUSTED|rate.?limit|too many requests/i.test(message)) {
    return "quota";
  }
  if (
    codes.some((code) => code === 401 || code === 403) ||
    /API_KEY_INVALID|invalid api key|api key (?:is )?not valid|permission.?denied|unauthenticated|forbidden|credential/i.test(message)
  ) {
    return "credentials";
  }
  return "provider-error";
}

function uniqueEntries(entries: GeminiKeyEntry[]): GeminiKeyEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.apiKey.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    entry.apiKey = key;
    return true;
  });
}

export function configuredGeminiKeyEntries(
  env: Record<string, string | undefined> = process.env,
): GeminiKeyEntry[] {
  const pooled = uniqueEntries(
    GEMINI_KEY_ENV_NAMES.map((envName) => ({ envName, apiKey: env[envName] ?? "" })),
  );
  if (pooled.length > 0) return pooled;

  return uniqueEntries([
    { envName: LEGACY_KEY_ENV_NAME, apiKey: env[LEGACY_KEY_ENV_NAME] ?? "" },
  ]);
}

export class GeminiKeyPoolExhaustedError extends Error {
  readonly attemptedKeys: number;
  readonly lastReason: GeminiFailureReason;

  constructor(lastError: unknown, attemptedKeys: number) {
    const lastReason = classifyGeminiFailure(lastError);
    super(`All ${attemptedKeys} configured Gemini API keys failed after automatic rotation. Last provider error: ${errorMessage(lastError)}`);
    this.name = "GeminiKeyPoolExhaustedError";
    this.attemptedKeys = attemptedKeys;
    this.lastReason = lastReason;
    Object.assign(this, { cause: lastError });
  }
}

export class GeminiKeyPool {
  private activeIndex = 0;
  private readonly failureStreaks: number[];

  constructor(private readonly entries: GeminiKeyEntry[]) {
    if (entries.length === 0) {
      throw new Error(`No Gemini API keys are configured. Set one of: ${GEMINI_KEY_ENV_NAMES.join(", ")}.`);
    }
    this.failureStreaks = entries.map(() => 0);
  }

  private metadata(index: number): GeminiKeyMetadata {
    return {
      keySlot: index + 1,
      keyCount: this.entries.length,
      keyName: this.entries[index]!.envName,
    };
  }

  private nextUnattemptedIndex(index: number, attempted: Set<number>): number | undefined {
    for (let offset = 1; offset <= this.entries.length; offset += 1) {
      const candidate = (index + offset) % this.entries.length;
      if (!attempted.has(candidate)) return candidate;
    }
    return undefined;
  }

  async run<T>(
    operation: (apiKey: string, metadata: GeminiKeyMetadata) => Promise<T>,
    onEvent?: GeminiKeyPoolEventHandler,
  ): Promise<T> {
    const attempted = new Set<number>();
    let index = this.activeIndex;
    let lastError: unknown;

    while (attempted.size < this.entries.length) {
      attempted.add(index);
      const entry = this.entries[index]!;
      const metadata = this.metadata(index);

      try {
        const result = await operation(entry.apiKey, metadata);
        this.failureStreaks[index] = 0;
        if (attempted.size > 1) onEvent?.({ type: "recovered", attemptedKeys: attempted.size, ...metadata });
        return result;
      } catch (error) {
        lastError = error;
        const reason = classifyGeminiFailure(error);
        const consecutiveFailures = this.failureStreaks[index] + 1;
        this.failureStreaks[index] = consecutiveFailures;
        const rotatesNow = reason !== "provider-error" || consecutiveFailures >= FAILURE_THRESHOLD;
        onEvent?.({ type: "failure", reason, consecutiveFailures, rotatesNow, ...metadata });
        if (!rotatesNow) throw error;

        const nextIndex = this.activeIndex !== index && !attempted.has(this.activeIndex)
          ? this.activeIndex
          : this.nextUnattemptedIndex(index, attempted);
        if (nextIndex === undefined) break;

        if (this.activeIndex === index) this.activeIndex = nextIndex;
        const nextMetadata = this.metadata(nextIndex);
        onEvent?.({
          type: "rotation",
          reason,
          consecutiveFailures,
          nextKeySlot: nextMetadata.keySlot,
          nextKeyName: nextMetadata.keyName,
          ...metadata,
        });
        index = nextIndex;
      }
    }

    throw new GeminiKeyPoolExhaustedError(lastError, attempted.size);
  }
}

let globalPool: GeminiKeyPool | undefined;
let globalPoolSignature = "";

function currentPool(): GeminiKeyPool {
  const entries = configuredGeminiKeyEntries();
  const signature = entries.map((entry) => `${entry.envName}:${entry.apiKey}`).join("|");
  if (!globalPool || signature !== globalPoolSignature) {
    globalPool = new GeminiKeyPool(entries);
    globalPoolSignature = signature;
  }
  return globalPool;
}

export function runWithGeminiKey<T>(
  operation: (apiKey: string, metadata: GeminiKeyMetadata) => Promise<T>,
  onEvent?: GeminiKeyPoolEventHandler,
): Promise<T> {
  return currentPool().run(operation, onEvent);
}
