import { test, expect } from "@playwright/test";
test("local first check sends no raw data and can skip the cloud", async ({
  page,
}) => {
  const outgoing: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1"))
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
  await page
    .getByLabel("Choose a WhatsApp text export")
    .setInputFiles({
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
    process.env.LIVE_AI !== "1",
    "Opt-in integration test uses the real configured Firebase project.",
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.screenshot({ path: "docs/evidence/desktop.png", fullPage: true });
  const bodies: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("generateContent")) bodies.push(r.postData() || "");
  });
  page.on("response", async (r) => {
    if (r.url().includes("generateContent") && !r.ok())
      console.log(
        "AI response failure",
        r.status(),
        (await r.text()).slice(0, 1200),
      );
  });
  await page
    .getByLabel("Message to check", { exact: true })
    .fill(
      "CANARY-REAL-X9 my account is 123456789. Send money urgently. New number. Don't call.",
    );
  await page.getByRole("button", { name: "Review this message" }).click();
  await page.getByRole("button", { name: "Approve & check patterns" }).click();
  await expect(
    page.getByRole("heading", { name: "What the cloud found" }),
  ).toBeVisible({ timeout: 40000 });
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).not.toContain("CANARY-REAL-X9");
  expect(bodies[0]).not.toContain("123456789");
  await page.screenshot({
    path: "docs/evidence/cloud-result.png",
    fullPage: true,
  });
});
