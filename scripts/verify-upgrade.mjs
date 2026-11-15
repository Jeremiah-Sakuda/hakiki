// Run after the live local test, never concurrently with the same persistent profile.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { verifyDeployedPage } from "../tests/e2e/deployed.ts";
import { provenance } from "./provenance.ts";
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
  await page.goto("https://hakiki-hybrid-2026.web.app");
  const deployed = await verifyDeployedPage(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  const offlineScripts = await page
    .locator('script[type="module"][src]')
    .evaluateAll((nodes) =>
      nodes.map((node) => new URL(node.src).pathname).sort(),
    );
  if (JSON.stringify(offlineScripts) !== JSON.stringify(deployed.scriptPaths))
    throw new Error("Offline shell does not match the executing release");
  if (
    (await page
      .getByLabel("Message to check", { exact: true })
      .inputValue()) !== ""
  )
    throw new Error("Offline reopen retained ephemeral message text");
  writeFileSync(
    "docs/evidence/client-upgrade.json",
    JSON.stringify(
      {
        provenance: provenance("node scripts/verify-upgrade.mjs", page.url()),
        deployed,
        offlineScripts,
        offlineReloadPassed: true,
        ephemeralMessageEmpty: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "Existing-profile offline reload matches current deployed scripts.",
  );
} finally {
  await context.close();
}
