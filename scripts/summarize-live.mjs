import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pairedCases } from "../eval/pairs.ts";
import { extractFeatures, signalsFor } from "../src/domain.ts";
const raw = readFileSync("docs/evidence/paired-live.json", "utf8");
const run = JSON.parse(raw);
if (!run.completedAt)
  throw new Error(
    "The paired run has not completed. Preserve partial outcomes; do not report them as a complete experiment.",
  );
const percentile = (values, q) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)]
    : null;
};
const summarize = (split, variant) => {
  const rows = run.cases.filter((c) => c.split === split);
  const counts = {
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    trueNegative: 0,
    abstentions: 0,
    errors: 0,
    genuine: 0,
    imposter: 0,
    abstentionsByClass: { genuine: 0, imposter: 0 },
    errorsByClass: { genuine: 0, imposter: 0 },
  };
  const latencies = [];
  for (const row of rows) {
    counts[row.label]++;
    const c = pairedCases.find((c) => c.id === row.id);
    const observation =
      variant === "rules"
        ? {
            status: "completed",
            flag: signalsFor(extractFeatures(c.text)).length
              ? "positive"
              : "negative",
          }
        : row.local[variant];
    if (observation.status === "error") {
      counts.errors++;
      counts.errorsByClass[row.label]++;
      continue;
    }
    if (Number.isFinite(observation.result?.elapsedMs))
      latencies.push(observation.result.elapsedMs);
    if (observation.flag === "abstain") {
      counts.abstentions++;
      counts.abstentionsByClass[row.label]++;
      continue;
    }
    if (observation.flag === "positive")
      counts[row.label === "imposter" ? "truePositive" : "falsePositive"]++;
    else counts[row.label === "imposter" ? "falseNegative" : "trueNegative"]++;
  }
  return {
    cases: rows.length,
    ...counts,
    unflaggedImpostersIncludingAbstentionsAndErrors:
      counts.imposter - counts.truePositive,
    catchRate: counts.truePositive / counts.imposter,
    falseAlarmRate: counts.falsePositive / counts.genuine,
    abstentionAndErrorRate: (counts.abstentions + counts.errors) / rows.length,
    medianCompletedMs: percentile(latencies, 0.5),
    p95CompletedMs: percentile(latencies, 0.95),
  };
};
const variants = ["rules", "matched", "omitted", "wrongContact"];
const summary = {
  createdAt: new Date().toISOString(),
  rawRunSha256: createHash("sha256").update(raw).digest("hex"),
  sourceProvenance: run.provenance,
  protocol:
    "Authored synthetic pilot v1; exploratory; fixed mapping in docs/EVALUATION.md; not validated accuracy",
  development: Object.fromEntries(
    variants.map((v) => [v, summarize("development", v)]),
  ),
  evaluation: Object.fromEntries(
    variants.map((v) => [v, summarize("evaluation", v)]),
  ),
  cloud: {
    attempts: run.cases.filter((c) => c.cloud?.features).length,
    completed: run.cases.filter((c) => c.cloud?.status === "completed").length,
    errors: run.cases.filter((c) => c.cloud?.status === "error").length,
    withSources: run.cases.filter((c) => c.cloud?.result?.sources?.length > 0)
      .length,
    medianCompletedMs: percentile(
      run.cases.map((c) => c.cloud?.result?.elapsedMs),
      0.5,
    ),
    p95CompletedMs: percentile(
      run.cases.map((c) => c.cloud?.result?.elapsedMs),
      0.95,
    ),
    classification: "Not rated; no cloud/hybrid detection metrics claimed",
  },
  privacy: run.privacy,
  userWalkthroughs: 0,
  limits: run.limitations,
};
writeFileSync(
  "docs/evidence/paired-summary.json",
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
