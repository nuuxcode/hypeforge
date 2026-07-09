import { describe, expect, it } from "vitest";
import { PERSONA_BUCKETS, pickOnePerBucket } from "@/lib/personas";

describe("pickOnePerBucket", () => {
  it("returns exactly one persona from every bucket", () => {
    const personas = pickOnePerBucket(() => 0);
    const buckets = new Set(personas.map((persona) => persona.bucket));

    expect(personas).toHaveLength(3);
    expect(buckets).toEqual(new Set(Object.keys(PERSONA_BUCKETS)));
  });

  it("never returns duplicate persona ids", () => {
    const personas = pickOnePerBucket(() => 0.99);
    const ids = new Set(personas.map((persona) => persona.id));

    expect(ids.size).toBe(3);
  });
});
