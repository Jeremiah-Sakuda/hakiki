import { it, expect, vi } from "vitest";
vi.mock("node:child_process", () => ({
  execFileSync: () => {
    throw new Error("Git unavailable");
  },
}));
import { provenance } from "../scripts/provenance";
it("retains source hashes when building a source archive without Git", () => {
  const result = provenance("source-archive test");
  expect(result.sourceCommit).toBeNull();
  expect(result.sourceDirty).toBeNull();
  expect(result.gitMetadata).toContain("unavailable");
  expect(result.inputSha256["src/domain.ts"]).toMatch(/^[0-9a-f]{64}$/);
});
