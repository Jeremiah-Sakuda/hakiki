import { describe, it, expect } from "vitest";
import { pairedCases } from "../eval/pairs";
describe("paired pilot integrity, not model efficacy", () => {
  it("keeps contact and family identifiers within one split", () => {
    for (const key of ["contactId", "templateFamilyId"] as const) {
      const splits = new Map<string, string>();
      for (const c of pairedCases) {
        expect(splits.get(c[key]) || c.split).toBe(c.split);
        splits.set(c[key], c.split);
      }
    }
  });
  it("separates requests from history and defines each ablation", () => {
    expect(pairedCases).toHaveLength(12);
    expect(new Set(pairedCases.map((c) => c.id)).size).toBe(12);
    for (const c of pairedCases) {
      expect(c.history).not.toContain(c.text);
      expect(c.history.length).toBeGreaterThanOrEqual(5);
      expect(c.variants.omitted).toBeNull();
      expect(c.wrongContactId).not.toBe(c.contactId);
      expect(c.labelRationale.length).toBeGreaterThan(20);
    }
  });
});
