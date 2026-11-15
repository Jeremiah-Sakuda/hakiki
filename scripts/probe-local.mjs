import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir(".local", { recursive: true });
const context = await chromium.launchPersistentContext(".local/chrome-probe", {
  channel: "chrome",
  headless: process.env.HEADED !== "1",
  ignoreDefaultArgs: [
    "--disable-component-update",
    "--disable-background-networking",
  ],
  args: ["--enable-features=PromptAPIForGeminiNanoMultimodalInput"],
});
try {
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173");
  const report = await page.evaluate(async () => ({
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
  console.log(JSON.stringify(report, null, 2));
  await writeFile(
    "docs/evidence/local-capability.json",
    JSON.stringify(report, null, 2),
  );
} finally {
  await context.close();
}
