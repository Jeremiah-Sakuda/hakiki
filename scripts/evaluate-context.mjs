import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { provenance } from "./provenance.ts";
if (process.env.LIVE_EVAL !== "1")
  throw new Error(
    "Set LIVE_EVAL=1 for real local inference and optionally LIVE_HYBRID=1 for six billed cloud checks.",
  );
const fixtures = JSON.parse(
  readFileSync("eval/context-heldout-v1.json", "utf8"),
);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const path = `docs/evidence/context-${stamp}.json`;
const report = {
  provenance: provenance(
    `LIVE_EVAL=1 ${process.env.LIVE_HYBRID === "1" ? "LIVE_HYBRID=1 " : ""}node scripts/evaluate-context.mjs`,
    "http://127.0.0.1:5173",
  ),
  fixtureSha256: createHash("sha256")
    .update(JSON.stringify(fixtures))
    .digest("hex"),
  protocol:
    "Confirmed arrangements v1; 48 synthetic English cases; first attempt; same extracted facts reused for context ablations; first case per stratum receives one shared cloud result",
  cases: [],
  cloudHttp: [],
  privacy: { canaryExcluded: true, generationRequests: 0 },
  complete: false,
};
const save = () => writeFileSync(path, JSON.stringify(report, null, 2));
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
try {
  const page = await context.newPage();
  const pending = [];
  page.on("request", (r) => {
    const wire = r.url() + JSON.stringify(r.headers()) + (r.postData() || "");
    if (wire.includes("CONTEXT-CANARY-")) report.privacy.canaryExcluded = false;
    if (r.url().includes("generateContent"))
      report.privacy.generationRequests++;
  });
  page.on("response", (r) => {
    if (r.url().includes("generateContent"))
      pending.push(
        r
          .json()
          .catch(() => ({}))
          .then((body) =>
            report.cloudHttp.push({
              status: r.status(),
              modelVersion: body.modelVersion,
              errorCode: body.error?.status,
            }),
          ),
      );
  });
  await page.goto("http://127.0.0.1:5173");
  await page.bringToFront();
  await page.evaluate(async () => {
    window.__eval = {
      ai: await import("/src/ai.ts"),
      domain: await import("/src/domain.ts"),
      context: await import("/src/context.ts"),
    };
    await window.__eval.ai.prepareLocal(() => {});
  });
  const cloudStrata = new Set();
  for (let index = 0; index < fixtures.length; index++) {
    const fixture = fixtures[index];
    await page.bringToFront();
    const useCloud =
      process.env.LIVE_HYBRID === "1" && !cloudStrata.has(fixture.stratum);
    cloudStrata.add(fixture.stratum);
    const row = await page.evaluate(
      async ({ fixture, wrongProfile, useCloud }) => {
        const { ai, domain, context } = window.__eval;
        const raw = `CONTEXT-CANARY-${fixture.id}\n${fixture.text}`;
        const rules = domain.extractFeatures(raw);
        const row = {
          id: fixture.id,
          rules: {
            features: rules,
            genericSignals: domain.signalsFor(rules),
            observations: context.compareContext(
              rules,
              fixture.profile?.context,
            ),
          },
          local: null,
          cloud: null,
        };
        try {
          const result = await ai.analyzeLocal(
            raw,
            fixture.profile,
            "",
            undefined,
          );
          const features = result.suggestedFeatures;
          row.local = {
            status: "completed",
            result,
            observations: context.compareContext(
              features,
              fixture.profile?.context,
            ),
            omitted: context.compareContext(features, undefined),
            wrongProfile: {
              id: wrongProfile?.id,
              observations: context.compareContext(
                features,
                wrongProfile?.context,
              ),
            },
          };
        } catch (e) {
          row.local = { status: "error", diagnostic: e.diagnostic || null };
        }
        if (useCloud) {
          const receipts = [];
          try {
            row.cloud = {
              status: "completed",
              input: row.local.result?.suggestedFeatures || rules,
              result: await ai.checkWorld(
                row.local.result?.suggestedFeatures || rules,
                (r) => receipts.push(r),
              ),
              receipts,
            };
          } catch {
            row.cloud = { status: "error", receipts };
          }
        }
        return row;
      },
      {
        fixture,
        wrongProfile: fixtures[(index + 13) % fixtures.length].profile,
        useCloud,
      },
    );
    report.cases.push(row);
    save();
    console.log(
      index + 1,
      fixture.id,
      row.local.status,
      row.local.diagnostic?.code || "",
    );
  }
  await Promise.all(pending);
  report.complete = true;
} finally {
  await context.close();
  save();
  console.log(path);
}
