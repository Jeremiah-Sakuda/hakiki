import { test, expect, chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { provenance } from "../../scripts/provenance";
test("real on-device comparison and profile import keep raw content local", async () => {
  test.skip(
    process.env.LIVE_LOCAL !== "1",
    "Opt-in real Chrome model download and inference; never a mocked result.",
  );
  test.setTimeout(900000);
  const context = await chromium.launchPersistentContext(
    ".local/chrome-probe",
    {
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
    },
  );
  try {
    const page = await context.newPage();
    const outgoing: string[] = [];
    page.on("request", (r) =>
      outgoing.push(r.url() + " " + (r.postData() || "")),
    );
    await page.goto(process.env.E2E_BASE_URL || "http://127.0.0.1:5173");
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const lm = (
              globalThis as unknown as {
                LanguageModel?: {
                  availability: (options: unknown) => Promise<string>;
                };
              }
            ).LanguageModel;
            return lm
              ? await lm.availability({
                  expectedInputs: [{ type: "text", languages: ["en"] }],
                  expectedOutputs: [{ type: "text", languages: ["en"] }],
                })
              : "unavailable";
          }),
        { timeout: 45000, intervals: [1000, 5000] },
      )
      .not.toBe("unavailable");
    await page.getByRole("button", { name: "Device setup" }).click();
    await page.getByRole("button", { name: "Enable on-device AI" }).click();
    const progress = setInterval(
      async () =>
        console.log(
          "Local model:",
          await page
            .locator("dialog .primary")
            .innerText()
            .catch(() => "initializing"),
        ),
      20000,
    );
    try {
      await expect(
        page.getByRole("button", { name: "Local model ready" }),
      ).toBeVisible({ timeout: 780000 });
    } finally {
      clearInterval(progress);
    }
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page
      .getByRole("button", { name: "A new number", exact: false })
      .click();
    await page
      .getByLabel("Message to check", { exact: true })
      .fill(
        "LOCAL-CANARY-91 hey cuz, can you send your share for the gift? no rush, call me tonight.",
      );
    await page.getByRole("button", { name: "Review this message" }).click();
    await expect(
      page.getByText("On-device AI + text rules", { exact: true }),
    ).toBeVisible({ timeout: 35000 });
    expect(outgoing.join(" ")).not.toContain("LOCAL-CANARY-91");
    expect(outgoing.filter((x) => x.includes("generateContent"))).toHaveLength(
      0,
    );
    const observations = await page.locator(".personal").innerText();
    await page.screenshot({
      path: "docs/evidence/local-result.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Your people", exact: false })
      .click();
    const history = [
      "hello cousin, hope your day is good.",
      "thanks for visiting last week.",
      "can we talk about the family gift?",
      "no rush, call me later.",
      "thanks cousin, see you this weekend.",
      "LOCAL-IMPORT-CANARY-62 hello again, have a lovely day.",
    ];
    await page
      .getByLabel("Choose a WhatsApp text export")
      .setInputFiles({
        name: "fictional-local.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(
          history
            .map(
              (m, i) => `11/12/2026, 10:${20 + i} AM - Synthetic cousin: ${m}`,
            )
            .join("\n"),
        ),
      });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create local profile" }).click();
    await expect(
      page.getByLabel("Who does it claim to be from?", { exact: false }),
    ).toHaveValue(/.+/, { timeout: 35000 });
    const profiles = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("hakiki.contacts.v1") || "[]"),
    );
    expect(
      profiles.some(
        (p: { name: string; sampleCount: number }) =>
          p.name === "Synthetic cousin" && p.sampleCount === 6,
      ),
    ).toBeTruthy();
    expect(outgoing.join(" ")).not.toContain("LOCAL-IMPORT-CANARY-62");
    expect(outgoing.filter((x) => x.includes("generateContent"))).toHaveLength(
      0,
    );
    writeFileSync(
      "docs/evidence/local-inference.json",
      JSON.stringify(
        {
          provenance: provenance("LIVE_LOCAL=1 npm run test:e2e", page.url()),
          browser: await page.evaluate(() => navigator.userAgent),
          execution:
            "Firebase ONLY_ON_DEVICE; adapter required ON_DEVICE response",
          comparisonSucceeded: true,
          profileImportSucceeded: true,
          observations,
          syntheticProfile: profiles.find(
            (p: { name: string }) => p.name === "Synthetic cousin",
          ),
          rawCanariesExcluded: true,
          cloudGenerationRequests: 0,
        },
        null,
        2,
      ),
    );
    await page
      .getByRole("button", { name: "Your people", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Delete all saved profiles" })
      .click();
  } finally {
    await context.close();
  }
});
