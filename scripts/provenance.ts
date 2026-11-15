import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
export function provenance(command: string, target = "local source") {
  const git = (args: string[]) =>
    execFileSync("git", args, { encoding: "utf8" }).trim();
  const files = [
    "src/ai.ts",
    "src/domain.ts",
    "src/App.tsx",
    "src/styles.css",
    "eval/cases.ts",
    "eval/pairs.ts",
    "package-lock.json",
  ];
  return {
    at: new Date().toISOString(),
    command,
    target,
    sourceCommit: git(["rev-parse", "HEAD"]),
    sourceDirty: !!git(["status", "--porcelain"]),
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
