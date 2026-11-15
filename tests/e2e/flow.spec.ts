import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { provenance } from "../../scripts/provenance";
import { safeSourceUrl } from "../../src/domain";
test("hosted app reopens offline without cached user content", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.E2E_BASE_URL,
    "Production service worker is enabled only in built releases.",
  );
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page
    .getByLabel("Message to check", { exact: true })
    .fill("EPHEMERAL-OFFLINE-CANARY");
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByLabel("Message to check", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByText("You’re offline · local tools still work"),
  ).toBeVisible();
  await page
    .getByLabel("Message to check", { exact: true })
    .fill("send money now");
  await page.getByRole("button", { name: "Review this message" }).click();
  await expect(
    page.getByRole("button", { name: "Approve & check patterns" }),
  ).toBeDisabled();
});
test("local first check sends no raw data and can skip the cloud", async ({
  page,
  baseURL,
}) => {
  const outgoing: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(baseURL!))
      outgoing.push(r.url() + " " + (r.postData() || ""));
  });
  await page.goto("/");
  await page
    .getByLabel("Message to check", { exact: true })
    .fill("CANARY-X9 Please send money now. Do not call.");
  await page.getByRole("button", { name: "Review this message" }).click();
  await expect(
    page.getByRole("heading", { name: "A moment to look closer." }),
  ).toBeVisible();
  await expect(
    page.getByText("Text rules · no AI comparison", { exact: true }),
  ).toBeVisible();
  expect(outgoing.join(" ")).not.toContain("CANARY-X9");
  expect(outgoing).toHaveLength(0);
  await page
    .getByRole("button", { name: "Continue without the cloud" })
    .click();
  await page.getByRole("button", { name: "Open privacy receipt" }).click();
  await expect(
    page.getByText("Nothing sent to cloud AI", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Clear this check & start again" })
    .click();
  await expect(
    page.getByLabel("Message to check", { exact: true }),
  ).toHaveValue("");
});
test("offline result stays partial and reconnect never automatically transmits", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await context.setOffline(true);
  await page
    .getByLabel("Message to check", { exact: true })
    .fill("Can you help with rent?");
  await page.getByRole("button", { name: "Review this message" }).click();
  await expect(
    page.getByRole("button", { name: "Approve & check patterns" }),
  ).toBeDisabled();
  await context.setOffline(false);
  await expect(
    page.getByText("No cloud AI request sent", { exact: true }),
  ).toBeVisible();
});
test("contact import stays local and rejects malformed exports", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Your people", exact: true }).click();
  await page.getByLabel("Choose a WhatsApp text export").setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("a private message without export format"),
  });
  await expect(page.getByRole("alert")).toContainText("No chat messages found");
});
test("mobile layout has no horizontal overflow and supports keyboard dialog dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "docs/evidence/mobile.png", fullPage: true });
});
test("desktop layout and real cloud request exclude raw message content", async ({
  page,
}) => {
  test.skip(
    process.env.LIVE_AI !== "1" && process.env.LIVE_TRANSPORT !== "1",
    "Opt-in integration test uses the real configured Firebase project.",
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.screenshot({ path: "docs/evidence/desktop.png", fullPage: true });
  const bodies: string[] = [];
  const outgoing: string[] = [];
  page.on("request", (r) => {
    outgoing.push(
      r.url() + " " + JSON.stringify(r.headers()) + " " + (r.postData() || ""),
    );
    if (r.url().includes("generateContent")) bodies.push(r.postData() || "");
  });
  await page
    .getByLabel("Message to check", { exact: true })
    .fill(
      "CANARY-REAL-X9 my account is 123456789. Send money urgently. New number. Don't call.",
    );
  await page.getByRole("button", { name: "Review this message" }).click();
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("generateContent"),
    { timeout: 35000 },
  );
  await page.getByRole("button", { name: "Approve & check patterns" }).click();
  const response = await responsePromise;
  expect(bodies).toHaveLength(1);
  expect(outgoing.join(" ")).not.toContain("CANARY-REAL-X9");
  expect(outgoing.join(" ")).not.toContain("123456789");
  const payload = await response.json();
  const validation = {
    inferenceCompleted: false,
    nonemptyText: false,
    sourceCount: 0,
    attributionRendered: false,
  };
  if (response.ok()) {
    await expect(
      page.getByRole("heading", { name: "What the cloud found" }),
    ).toBeVisible();
    expect(
      (await page.locator(".world-text").innerText()).trim().length,
    ).toBeGreaterThan(0);
    validation.nonemptyText = true;
    const chunks =
      payload.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    validation.sourceCount = chunks
      .filter(
        (c: { web?: { uri?: string } }) =>
          c.web?.uri && safeSourceUrl(c.web.uri),
      )
      .slice(0, 8).length;
    await expect(page.locator(".sources a")).toHaveCount(
      validation.sourceCount,
    );
    if (validation.sourceCount === 0)
      await expect(
        page.getByText("General model response · no search sources returned"),
      ).toBeVisible();
    validation.attributionRendered = true;
    await page.getByRole("button", { name: "Open privacy receipt" }).click();
    await expect(page.getByRole("dialog")).toContainText("completed");
    validation.inferenceCompleted = true; // Adapter requires Firebase IN_CLOUD before completed.
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
  const deployedBuild = process.env.E2E_BASE_URL
    ? await page.request
        .get("/build-info.json")
        .then((r) => r.json())
        .catch(() => null)
    : null;
  writeFileSync(
    "docs/evidence/cloud-transport.json",
    JSON.stringify(
      {
        provenance: provenance(
          process.env.LIVE_AI === "1"
            ? "LIVE_AI=1 npm run test:e2e"
            : "LIVE_TRANSPORT=1 npm run test:e2e",
          page.url(),
        ),
        origin: new URL(response.url()).origin,
        status: response.status(),
        rawCanariesExcluded: true,
        validation,
        deployedBuild,
        request: JSON.parse(bodies[0]),
        response: payload,
      },
      null,
      2,
    ),
  );
  if (response.ok())
    await expect(
      page.getByRole("heading", { name: "What the cloud found" }),
    ).toBeVisible();
  else {
    await expect(page.getByRole("alert")).toContainText(
      "The cloud check could not finish",
    );
    await page
      .getByRole("button", { name: "Inspect the request receipt" })
      .click();
    await expect(page.getByRole("dialog")).toContainText("failed");
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
  await page.screenshot({
    path: response.ok()
      ? "docs/evidence/cloud-result.png"
      : "docs/evidence/cloud-unavailable.png",
    fullPage: true,
  });
  if (process.env.LIVE_AI === "1")
    expect(
      response.ok(),
      "Live model inference must succeed; transport privacy alone is not inference success.",
    ).toBeTruthy();
});
