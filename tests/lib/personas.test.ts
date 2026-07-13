import { describe, expect, it } from "vitest";
import { fallbackPersonasFor, PERSONA_BUCKETS, pickOnePerBucket } from "@/lib/personas";

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

  it("gives every persona an explicit, non-empty imagery lane and bounded same-bucket fallbacks", () => {
    for (const persona of pickOnePerBucket(() => 0)) {
      expect(persona.imageryDomain.length).toBeGreaterThan(20);
      expect(persona.avoidImagery.length).toBeGreaterThan(20);
      expect(fallbackPersonasFor(persona).every((fallback) => fallback.bucket === persona.bucket)).toBe(true);
      expect(fallbackPersonasFor(persona).every((fallback) => fallback.id !== persona.id)).toBe(true);
    }
  });
});
