import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_CATALOG,
  diagnosticReferenceHref,
  getDiagnosticEntry,
  inferDiagnosticKey,
} from "@/lib/diagnostic-catalog";

describe("diagnostic catalog", () => {
  it("documents unique keys with repair steps and code ownership", () => {
    const keys = DIAGNOSTIC_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining([
      "dramatic-escalation",
      "delivery-mode",
      "structured-output",
      "provider-error",
      "quota",
      "credentials",
    ]));
    for (const entry of DIAGNOSTIC_CATALOG) {
      expect(entry.summary.length).toBeGreaterThan(30);
      expect(entry.fixes.length).toBeGreaterThan(0);
      expect(entry.locations.length).toBeGreaterThan(0);
    }
  });

  it("explains dramatic escalation without requiring knowledge of the internal key", () => {
    const entry = getDiagnosticEntry("dramatic-escalation");
    expect(entry.title).toBe("Rewrite was not clearly more dramatic");
    expect(entry.summary).toContain("scale, stakes");
    expect(entry.validator).toContain("Gemini semantic comparison");
    expect(entry.locations.map((location) => location.path)).toEqual(expect.arrayContaining([
      "lib/prompts.ts",
      "lib/compliant-generation.ts",
      "lib/ai.ts",
      "tests/lib/compliant-generation.test.ts",
    ]));
    expect(diagnosticReferenceHref(entry.key)).toContain("issue=dramatic-escalation");
  });

  it("maps provider messages to actionable reference keys", () => {
    expect(inferDiagnosticKey("429 RESOURCE_EXHAUSTED quota exceeded")).toBe("quota");
    expect(inferDiagnosticKey("API key unauthorized")).toBe("credentials");
    expect(inferDiagnosticKey("Validator returned no structured output")).toBe("structured-output");
    expect(inferDiagnosticKey("AbortError timed out")).toBe("timeout");
  });

  it("gives future unknown keys a safe investigation path", () => {
    const entry = getDiagnosticEntry("new-validator-key");
    expect(entry.title).toBe("Uncatalogued diagnostic key");
    expect(entry.fixes.join(" ")).toContain("Search the repository");
  });
});
