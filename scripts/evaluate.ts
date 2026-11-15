import { writeFileSync, mkdirSync } from "node:fs";
import { cases } from "../eval/cases";
import { extractFeatures, signalsFor } from "../src/domain";
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
  };
};
const report = {
  createdAt: new Date().toISOString(),
  protocol:
    "v1 synthetic authored scenarios; not a blind or real-world validation",
  source: "80 synthetic English scenarios: 20 development and 60 evaluation",
  rules: {
    development: summarize("development"),
    evaluation: summarize("evaluation"),
  },
  localOnly: {
    status: "not measured",
    reason:
      "Chrome reports the on-device model unavailable on the tested machine.",
  },
  cloudOnly: {
    status: "not measured",
    reason:
      "Live endpoint returned quota exceeded; do not replace with invented outputs.",
  },
  hybrid: { status: "not measured" },
  profileAblation: { status: "not measured" },
  userWalkthroughs: { participants: 0, status: "not conducted" },
  interpretation:
    "Rules are pressure cues, not identity detection. Deliberately genuine emergencies trigger false alarms, and style-mimicking imposters can be missed. No personal-context advantage has been established.",
};
mkdirSync("docs/evidence", { recursive: true });
writeFileSync("docs/evidence/evaluation.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
