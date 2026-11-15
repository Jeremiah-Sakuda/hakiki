import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { provenance } from "./provenance.ts";
await mkdir(".local", { recursive: true });
const context = await chromium.launchPersistentContext(".local/chrome-probe", {
  channel: "chrome",
  headless: process.env.HEADED !== "1",
  ignoreDefaultArgs: [
    "--disable-component-update",
    "--disable-background-networking",
    "--disable-field-trial-config",
    "--disable-component-extensions-with-background-pages",
  ],
  // Restore OptimizationHints normally disabled by Playwright, so Chrome can fetch model eligibility.
  args: [
    "--disable-features=Translate",
    "--enable-features=PromptAPIForGeminiNanoMultimodalInput",
  ],
});
try {
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173");
  const capability = await page.evaluate(async () => ({
    browser: navigator.userAgent,
    promptApi: "LanguageModel" in globalThis,
    availability:
      "LanguageModel" in globalThis
        ? await globalThis.LanguageModel.availability({
            expectedInputs: [{ type: "text", languages: ["en"] }],
            expectedOutputs: [{ type: "text", languages: ["en"] }],
          })
        : "unavailable",
  }));
  const headed = process.env.HEADED === "1";
  const report = {
    ...provenance(
      `${headed ? "HEADED=1 " : ""}node scripts/probe-local.mjs`,
      page.url(),
    ),
    profile:
      "isolated Playwright chrome-probe profile, not the user’s regular browser profile",
    mode: headed ? "headed" : "headless",
    ...capability,
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.env.LOCAL_DIAGNOSTIC === "1") {
    const diagnostic = await context.newPage();
    await diagnostic.goto("chrome://on-device-internals");
    await diagnostic.waitForLoadState("networkidle");
    await diagnostic
      .getByText("Loading...", { exact: true })
      .waitFor({ state: "hidden", timeout: 60000 })
      .catch(() => {});
    let snapshot = await diagnostic.locator("body").ariaSnapshot();
    await diagnostic.getByRole("tab", { name: "Broker State" }).click();
    await diagnostic.waitForLoadState("networkidle");
    snapshot +=
      "\nBroker state:\n" + (await diagnostic.locator("body").ariaSnapshot());
    await writeFile(".local/model-diagnostic.txt", snapshot);
    console.log(snapshot.slice(0, 6000));
  }
  await writeFile(
    headed
      ? "docs/evidence/local-capability-headed.json"
      : "docs/evidence/local-capability.json",
    JSON.stringify(report, null, 2),
  );
} finally {
  await context.close();
}
