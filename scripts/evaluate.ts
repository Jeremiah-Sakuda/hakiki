import { writeFileSync, mkdirSync } from "node:fs";
import { cases } from "../eval/cases";
import { pairedCases } from "../eval/pairs";
import { extractFeatures, signalsFor } from "../src/domain";
import { provenance } from "./provenance";
const summarize = (split: "development" | "evaluation") => {
  const rows = cases
    .filter((c) => c.split === split)
    .map((c) => ({
      ...c,
      flag: signalsFor(extractFeatures(c.text)).length > 0,
    }));
  const counts = {
    truePositive: 0,
    falseNegative: 0,
    falsePositive: 0,
    trueNegative: 0,
    abstained: 0,
  };
  for (const c of rows) {
    if (c.label === "imposter")
      c.flag ? counts.truePositive++ : counts.falseNegative++;
    else c.flag ? counts.falsePositive++ : counts.trueNegative++;
  }
  return {
    cases: rows.length,
    ...counts,
    catchRate:
      counts.truePositive / (counts.truePositive + counts.falseNegative),
    falseAlarmRate:
      counts.falsePositive / (counts.falsePositive + counts.trueNegative),
    outcomes: rows.map((c) => ({
      id: c.id,
      label: c.label,
      flag: c.flag,
      features: extractFeatures(c.text),
    })),
  };
};
const report = {
  provenance: provenance("npm run evaluate"),
  protocol:
    "v1 authored scenarios, exploratory rerun after code review; not blind or real-world validation",
  source: "80 synthetic English scenarios: 20 development and 60 evaluation",
  rules: {
    development: summarize("development"),
    evaluation: summarize("evaluation"),
  },
  localOnly: {
    status: "not attempted in this rules-only run",
    historicalEvidence: "docs/evidence/local-capability.json",
  },
  cloudOnly: {
    status: "not attempted in this rules-only run",
    historicalEvidence: "docs/evidence/cloud-transport.json",
  },
  hybrid: { status: "not measured" },
  profileAblation: { status: "not measured" },
  pairedPilot: {
    version: "pairs-v1",
    cases: pairedCases.length,
    status: "prepared; no model evaluation performed",
    fixtures: "eval/pairs.ts",
    variants: ["matched", "omitted", "wrongContact"],
    limitations:
      "Small authored pilot; no linguistic split independence or real-world validity established.",
  },
  userWalkthroughs: { participants: 0, status: "not conducted" },
  interpretation:
    "Rules are pressure cues, not identity detection. Deliberately genuine emergencies trigger false alarms, and style-mimicking imposters can be missed. No personal-context advantage has been established.",
};
mkdirSync("docs/evidence", { recursive: true });
writeFileSync("docs/evidence/evaluation.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      ...report,
      rules: Object.fromEntries(
        Object.entries(report.rules).map(([key, { outcomes, ...summary }]) => [
          key,
          summary,
        ]),
      ),
    },
    null,
    2,
  ),
);
