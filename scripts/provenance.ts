import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
export function provenance(command: string, target = "local source") {
  const git = (args: string[]) => {
    try {
      return execFileSync("git", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch {
      return null;
    }
  };
  const sourceCommit = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain"]);
  const files = [
    "src/ai.ts",
    "src/domain.ts",
    "src/App.tsx",
    "src/styles.css",
    "eval/cases.ts",
    "eval/pairs.ts",
    "package-lock.json",
    "scripts/evaluate.ts",
    "scripts/evaluate-live.mjs",
    "scripts/summarize-live.mjs",
    "scripts/probe-local.mjs",
    "scripts/provenance.ts",
    "vite.config.ts",
    "tests/e2e/flow.spec.ts",
    "tests/e2e/local.spec.ts",
  ];
  return {
    at: new Date().toISOString(),
    command,
    target,
    sourceCommit,
    sourceDirty: status === null ? null : !!status,
    gitMetadata:
      sourceCommit && status !== null
        ? "available"
        : "unavailable; source archive or Git missing",
    node: process.version,
    platform: process.platform,
    inputSha256: Object.fromEntries(
      files
        .filter(existsSync)
        .map((p) => [
          p,
          createHash("sha256").update(readFileSync(p)).digest("hex"),
        ]),
    ),
  };
}
