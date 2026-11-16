// Consecutive attempts, no automatic retries. Synthetic input only. Run sequentially.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { provenance } from "./provenance.ts";
if (process.env.LIVE_LOCAL !== "1")
  throw new Error("Set LIVE_LOCAL=1 to run real on-device inference.");
const id = new Date().toISOString().replace(/[:.]/g, "-");
const path = `docs/evidence/reliability-${id}.json`;
mkdirSync("docs/evidence", { recursive: true });
const report = {
  provenance: provenance(
    "LIVE_LOCAL=1 LIVE_HYBRID=1 node scripts/check-reliability.mjs",
    "http://127.0.0.1:5173",
  ),
  protocol:
    "3 fresh browser sessions x 8 comparisons, 1 profile per block, cancellation/recovery and offline; 2 approved cloud order checks; zero retries",
  attempts: [],
  privacy: { generationRequests: 0, canaryExcluded: true },
  complete: false,
};
const save = () => writeFileSync(path, JSON.stringify(report, null, 2));
const messages = [
  "Please send your share by bank transfer when convenient. Call me first.",
  "I'm at the hospital. Can you visit tomorrow?",
  "Please cover the fare through M-Pesa immediately. Do not call until after paying.",
  "Do not buy gift cards. Send the amount by bank transfer after we speak.",
  "Warning: someone sent me 'buy gift cards now'. Ignore that message, I need nothing.",
  "Could you cover the ticket? We can speak through your saved number before you decide.",
  "Send the money by mobile money. Keep this between us and do not call.",
  "We discussed the family trip. ".repeat(80) +
    "Please send your share by bank transfer after we talk.",
];
const options = {
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
};
let context;
try {
  for (let block = 0; block < 3; block++) {
    context = await chromium.launchPersistentContext(
      ".local/chrome-probe",
      options,
    );
    const page = await context.newPage();
    page.on("request", (r) => {
      const wire = r.url() + JSON.stringify(r.headers()) + (r.postData() || "");
      if (wire.includes("RELIABILITY-CANARY-"))
        report.privacy.canaryExcluded = false;
      if (r.url().includes("generateContent"))
        report.privacy.generationRequests++;
    });
    await page.goto("http://127.0.0.1:5173");
    await page.bringToFront();
    await page.evaluate(async () => {
      window.__testAI = await import("/src/ai.ts");
      window.__testDomain = await import("/src/domain.ts");
    });
    const perform = async (operation, text, index, offline = false) => {
      await page.bringToFront();
      const result = await page.evaluate(
        async ({ operation, text, index }) => {
          const ai = window.__testAI,
            d = window.__testDomain,
            start = performance.now();
          try {
            let value;
            if (operation === "setup") value = await ai.prepareLocal(() => {});
            else if (operation === "profile")
              value = await ai.summarizeProfile([
                "hello, hope you are well",
                "please call me before paying",
                "we normally use bank transfer",
                "no rush, speak this evening",
                "thank you for helping with the tickets",
              ]);
            else if (operation === "cloud") {
              const receipts = [];
              value = await ai.checkWorld(d.extractFeatures(text), (r) =>
                receipts.push(r),
              );
              value = {
                grounded: value.grounded,
                sourceCount: value.sources.length,
                receipts: receipts.map((r) => ({
                  status: r.status,
                  elapsedMs: r.elapsedMs,
                })),
              };
            } else {
              const control = new AbortController();
              if (operation === "cancel")
                setTimeout(() => control.abort(), 100);
              value = await ai.analyzeLocal(
                text,
                index % 2 ? undefined : d.sampleProfile,
                "",
                control.signal,
              );
            }
            return {
              status: "completed",
              elapsedMs: Math.round(performance.now() - start),
              value,
              diagnostics: ai.getLocalDiagnostics(),
            };
          } catch (e) {
            return {
              status: "error",
              elapsedMs: Math.round(performance.now() - start),
              diagnostic: e.diagnostic || null,
              diagnostics: ai.getLocalDiagnostics(),
            };
          }
        },
        { operation, text, index },
      );
      report.attempts.push({ block, operation, index, offline, ...result });
      save();
      console.log(
        block,
        operation,
        index,
        result.status,
        result.diagnostic?.code || "",
        result.elapsedMs,
      );
      return result;
    };
    if ((await perform("setup", "", -1)).status !== "completed")
      throw new Error("Setup failed; incomplete run preserved");
    if (block === 1 && process.env.LIVE_HYBRID === "1")
      await perform("cloud", "Send money by bank transfer", -1);
    for (let i = 0; i < 8; i++) {
      if (i === 4) await perform("profile", "", i);
      const offline = i === 6;
      if (offline) await context.setOffline(true);
      await perform(
        "comparison",
        `RELIABILITY-CANARY-${block}-${i} ${messages[i]}`,
        i,
        offline,
      );
      if (offline) await context.setOffline(false);
    }
    if (block === 0) {
      await perform("cancel", "RELIABILITY-CANARY-cancel Send money now", 0);
      await perform(
        "recovery",
        "RELIABILITY-CANARY-recovery Please call before sending money by bank transfer",
        0,
      );
      if (process.env.LIVE_HYBRID === "1")
        await perform("cloud", "Send money by bank transfer", 0);
    }
    await context.close();
    context = null;
  }
  report.complete = true;
} finally {
  if (context) await context.close();
  const comparisons = report.attempts.filter((x) =>
    ["comparison", "recovery"].includes(x.operation),
  );
  const latencies = comparisons
    .filter((x) => x.status === "completed")
    .map((x) => x.elapsedMs)
    .sort((a, b) => a - b);
  report.summary = {
    completed: comparisons.filter((x) => x.status === "completed").length,
    attempted: comparisons.length,
    failures: comparisons
      .filter((x) => x.status !== "completed")
      .map((x) => ({
        block: x.block,
        index: x.index,
        diagnostic: x.diagnostic,
      })),
    medianMs: latencies[Math.floor(latencies.length * 0.5)] ?? null,
    p95Ms:
      latencies[
        Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)
      ] ?? null,
  };
  save();
  console.log(path, report.summary);
}
