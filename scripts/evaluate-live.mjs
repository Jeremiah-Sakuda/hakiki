// Explicit opt-in synthetic pilot. Uses real Firebase adapters; never substitutes model outputs.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { pairedCases } from "../eval/pairs.ts";
import { provenance } from "./provenance.ts";
if (process.env.LIVE_EVAL !== "1")
  throw new Error(
    "Set LIVE_EVAL=1 to permit real model inference and billed cloud calls on the configured project.",
  );
const context = await chromium.launchPersistentContext(".local/chrome-probe", {
  channel: "chrome",
  headless: false,
  ignoreDefaultArgs: [
    "--disable-component-update",
    "--disable-background-networking",
    "--disable-field-trial-config",
    "--disable-component-extensions-with-background-pages",
  ],
  args: [
    "--disable-features=Translate",
    "--enable-features=PromptAPIForGeminiNanoMultimodalInput",
  ],
});
const report = {
  provenance: provenance(
    "LIVE_EVAL=1 node scripts/evaluate-live.mjs",
    "http://127.0.0.1:5173",
  ),
  protocol:
    "Paired pilot v1; authored English synthetic fixtures, exploratory; no human outcomes",
  classification: "docs/EVALUATION.md Frozen pilot mapping v1",
  model: {},
  profiles: [],
  cases: [],
  privacy: { rawFixtureTextExcluded: false },
  limitations: [
    "12 authored scenarios are not real-world validation.",
    "Cloud/hybrid flags remain unrated until independent blinded raters apply the frozen rubric.",
    "Local positives combine rules and style differences, never an identity verdict.",
  ],
};
const save = () =>
  writeFileSync(
    "docs/evidence/paired-live.json",
    JSON.stringify(report, null, 2),
  );
try {
  const page = await context.newPage();
  const outgoing = [];
  page.on("request", (r) =>
    outgoing.push(r.url() + " " + (r.postData() || "")),
  );
  await page.goto("http://127.0.0.1:5173");
  await page.evaluate(async () => {
    const ai = await import("/src/ai.ts");
    const domain = await import("/src/domain.ts");
    await ai.prepareLocal(() => {});
    window.__pilot = { ai, domain };
  });
  report.model = await page.evaluate(() => ({
    cloudModel: window.__pilot.ai.cloudModel,
    provider: window.__pilot.ai.cloudProvider,
    local: "Chrome Prompt API through Firebase ONLY_ON_DEVICE",
    browser: navigator.userAgent,
  }));
  const profiles = new Map();
  for (const c of pairedCases) {
    if (profiles.has(c.contactId)) continue;
    const style = await page.evaluate(
      (history) => window.__pilot.ai.summarizeProfile(history),
      c.history,
    );
    const profile = {
      id: c.contactId,
      name: `Fictional ${c.contactId}`,
      style,
      trustedNumber: "",
      sample: true,
      sampleCount: c.history.length,
    };
    profiles.set(c.contactId, profile);
    report.profiles.push(profile);
    console.log("Prepared real local profile", c.contactId);
    save();
  }
  let cloudFailures = 0;
  for (const c of pairedCases) {
    const row = {
      id: c.id,
      split: c.split,
      label: c.label,
      local: {},
      cloud: null,
      cloudClassification: "not rated",
      hybridClassification: "not rated",
    };
    for (const variant of ["matched", "omitted", "wrongContact"]) {
      const profile =
        variant === "matched"
          ? profiles.get(c.contactId)
          : variant === "wrongContact"
            ? profiles.get(c.wrongContactId)
            : null;
      row.local[variant] = await page.evaluate(
        async ({ text, profile }) => {
          try {
            const result = await window.__pilot.ai.analyzeLocal(
              text,
              profile || undefined,
              "",
            );
            const p = result.personal;
            const flag =
              result.signals.length > 0 ||
              p?.languageMatch === "different" ||
              p?.toneMatch === "different"
                ? "positive"
                : p?.languageMatch === "consistent" &&
                    p?.toneMatch === "consistent"
                  ? "negative"
                  : "abstain";
            return { status: "completed", flag, result };
          } catch {
            return { status: "error", flag: "error" };
          }
        },
        { text: c.text, profile },
      );
    }
    if (cloudFailures < 3) {
      row.cloud = await page.evaluate(async (text) => {
        const { ai, domain } = window.__pilot;
        const features = domain.extractFeatures(text);
        const receipts = [];
        try {
          return {
            status: "completed",
            features,
            result: await ai.checkWorld(features, (r) => receipts.push(r)),
            receipts,
          };
        } catch {
          return { status: "error", features, receipts };
        }
      }, c.text);
      cloudFailures = row.cloud.status === "error" ? cloudFailures + 1 : 0;
    } else
      row.cloud = {
        status: "not attempted after three consecutive service failures",
      };
    report.cases.push(row);
    save();
    console.log(
      "Completed pilot case",
      c.id,
      "local",
      Object.values(row.local)
        .map((x) => x.status)
        .join("/"),
      "cloud",
      row.cloud.status,
    );
  }
  const raw = [
    ...pairedCases.map((c) => c.text),
    ...pairedCases.flatMap((c) => c.history),
  ];
  report.privacy.rawFixtureTextExcluded = raw.every(
    (text) => !outgoing.some((request) => request.includes(text)),
  );
  report.privacy.generationRequests = outgoing.filter((x) =>
    x.includes("generateContent"),
  ).length;
  if (!report.privacy.rawFixtureTextExcluded)
    throw new Error(
      "A raw synthetic fixture appeared in outgoing traffic. Review required.",
    );
  report.completedAt = new Date().toISOString();
  save();
} finally {
  save();
  await context.close();
}
