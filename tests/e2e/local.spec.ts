import { test, expect, chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { provenance } from "../../scripts/provenance";
import { verifyDeployedPage } from "./deployed";
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
    const deployed = process.env.E2E_BASE_URL
      ? await verifyDeployedPage(page)
      : null;
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
    ).toBeVisible({ timeout: 75000 });
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
      .getByRole("button", { name: "Continue without the cloud" })
      .click();
    await page
      .getByRole("button", { name: "Clear this check & start again" })
      .click();
    await context.setOffline(true);
    await page
      .getByLabel("Message to check", { exact: true })
      .fill("OFFLINE-LOCAL-CANARY-44 send money now, please call me first.");
    await page.getByRole("button", { name: "Review this message" }).click();
    await expect(
      page.getByText("On-device AI + text rules", { exact: true }),
    ).toBeVisible({ timeout: 75000 });
    await expect(
      page.getByRole("button", { name: "Approve & check patterns" }),
    ).toBeDisabled();
    await context.setOffline(false);
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
    await page.getByLabel("Choose a WhatsApp text export").setInputFiles({
      name: "fictional-local.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        history
          .map((m, i) => `11/12/2026, 10:${20 + i} AM - Synthetic cousin: ${m}`)
          .join("\n"),
      ),
    });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create local profile" }).click();
    const draft = page.getByLabel("Writing profile for Synthetic cousin");
    await expect(draft).toBeVisible({ timeout: 75000 });
    const generatedProfileDraft = await draft.inputValue();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("hakiki.contacts.v1") || "[]").some(
          (p: { name: string }) => p.name === "Synthetic cousin",
        ),
      ),
    ).toBe(false);
    await draft.fill(
      "Uses informal English, short sentences, friendly greetings, and relaxed punctuation.",
    );
    await page.getByRole("button", { name: "Save reviewed profile" }).click();
    await expect(
      page.getByLabel("Who does it claim to be from?", { exact: false }),
    ).toHaveValue(/.+/, { timeout: 75000 });
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
    let hybridCompleted = false;
    if (process.env.LIVE_HYBRID === "1") {
      await page
        .getByLabel("Message to check", { exact: true })
        .fill(
          "HYBRID-LOCAL-CANARY-73 new number, send money now and do not call.",
        );
      await page.getByRole("button", { name: "Review this message" }).click();
      await expect(
        page.getByText("On-device AI + text rules", { exact: true }),
      ).toBeVisible({ timeout: 75000 });
      await page
        .getByRole("button", { name: "Approve & check patterns" })
        .click();
      await expect(
        page.getByRole("heading", { name: "What the cloud found" }),
      ).toBeVisible({ timeout: 45000 });
      await page.getByRole("button", { name: "Open privacy receipt" }).click();
      await expect(page.getByRole("dialog")).toContainText("completed");
      await page.getByRole("button", { name: "Close dialog" }).click();
      if (
        await page.locator('iframe[title="Google Search suggestions"]').count()
      )
        await expect(
          page
            .frameLocator('iframe[title="Google Search suggestions"]')
            .locator(".chip")
            .first(),
        ).toBeVisible();
      await page.screenshot({
        path: "docs/evidence/hybrid-result.png",
        fullPage: true,
      });
      hybridCompleted = true;
    }
    for (const canary of [
      "LOCAL-CANARY-91",
      "LOCAL-IMPORT-CANARY-62",
      "OFFLINE-LOCAL-CANARY-44",
      "HYBRID-LOCAL-CANARY-73",
    ])
      expect(outgoing.join(" ")).not.toContain(canary);
    writeFileSync(
      "docs/evidence/local-inference.json",
      JSON.stringify(
        {
          provenance: provenance(
            `LIVE_LOCAL=1 ${process.env.LIVE_HYBRID === "1" ? "LIVE_HYBRID=1 " : ""}npm run test:e2e -- tests/e2e/local.spec.ts`,
            page.url(),
          ),
          browser: await page.evaluate(() => navigator.userAgent),
          deployed,
          execution:
            "Firebase ONLY_ON_DEVICE; adapter required ON_DEVICE response",
          comparisonSucceeded: true,
          offlineComparisonSucceeded: true,
          hybridCompleted,
          profileImportSucceeded: true,
          generatedProfileDraft,
          reviewedBeforePersistence: true,
          observations,
          syntheticProfile: profiles.find(
            (p: { name: string }) => p.name === "Synthetic cousin",
          ),
          rawCanariesExcluded: true,
          cloudGenerationRequests: outgoing.filter((x) =>
            x.includes("generateContent"),
          ).length,
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
