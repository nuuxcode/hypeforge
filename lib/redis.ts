import { Redis } from "@upstash/redis";

let client: Redis | null = null;

export function redisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function getRedis(): Redis {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return client;
}

// This Upstash database is shared with other projects, so every HypeForge key
// is namespaced to avoid collisions.
export function hfKey(suffix: string): string {
  return `hypeforge:${suffix}`;
}

// Upstash may return stored JSON as an already-parsed object or as a raw
// string depending on client deserialization; normalize both to an object.
export function asStoredRecord(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
