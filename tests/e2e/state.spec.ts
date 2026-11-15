import { test, expect } from "@playwright/test";
// UI state tests use an explicitly mocked adapter, never inference evidence.
test.beforeEach(async ({ page }) => {
  test.skip(
    !!process.env.E2E_BASE_URL,
    "Adapter mocks apply only to the development module server.",
  );
  await page.route("https://**", (route) => route.abort());
  await page.route(
    (url) => url.pathname === "/src/ai.ts",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `
 export const cloudConfigured=true,configured=true,cloudModel='mock-test-only';
 export const localAvailability=async()=> 'available';
 export const prepareLocal=async()=>{};
 export const analyzeLocal=async()=>{throw new Error('mock failure')};
 export const summarizeProfile=()=>new Promise(resolve=>{window.completeMockProfile=()=>resolve('Uses short friendly English sentences.');});
 export const checkWorld=async(features,receipt)=>{receipt({id:'test-attempt',at:new Date().toISOString(),model:'mock',endpoint:'mock-no-network',request:features,status:'failed'});throw new Error('Mock cloud failed');};
 export const refreshPlaybook=async()=> '2026-11-15';
 `,
      }),
  );
});
test("deleting profiles invalidates pending local profile writes", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "hakiki.contacts.v1",
      JSON.stringify([
        {
          id: "old",
          name: "Old contact",
          trustedNumber: "",
          style: "Old synthetic writing style.",
          sample: false,
          sampleCount: 5,
        },
      ]),
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Device setup" }).click();
  await page.getByRole("button", { name: "Enable on-device AI" }).click();
  await expect(
    page.getByRole("button", { name: "Local model ready" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: /Your people/ }).click();
  const text = Array.from(
    { length: 5 },
    (_, i) => `11/12/2026, 10:20 AM - New person: synthetic line ${i}`,
  ).join("\n");
  await page.getByLabel("Choose a WhatsApp text export").setInputFiles({
    name: "synthetic.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create local profile" }).click();
  await expect(
    page.getByRole("button", { name: "Building profile on your device" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete all saved profiles" }).click();
  await page.evaluate(() => {
    (
      window as unknown as { completeMockProfile: () => void }
    ).completeMockProfile();
  });
  await expect(
    page.getByRole("heading", { name: "A little context goes a long way." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("hakiki.contacts.v1")),
  ).toBeNull();
});
test("category correction updates observations and failure is not called skipped", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Message to check", { exact: true })
    .fill("Keep this secret. Send money.");
  await page.getByRole("button", { name: "Review this message" }).click();
  await page
    .getByRole("combobox", { name: "Secrecy requested", exact: true })
    .selectOption("false");
  await expect(
    page.getByText("You are being asked to keep the request secret.", {
      exact: false,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Approve & check patterns" }).click();
  await expect(page.getByRole("alert")).toContainText("Mock cloud failed");
  await page
    .getByRole("button", { name: "Continue without the cloud" })
    .click();
  await expect(
    page.getByText("Cloud check unavailable after an approved attempt.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open privacy receipt" }).click();
  await expect(
    page.getByRole("dialog", { name: "Your privacy receipt" }),
  ).toBeVisible();
});

test("profile drafts require review and persist only the edited text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Device setup" }).click();
  await page.getByRole("button", { name: "Enable on-device AI" }).click();
  await expect(
    page.getByRole("button", { name: "Local model ready" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: /Your people/ }).click();
  await page
    .getByLabel("Choose a WhatsApp text export")
    .setInputFiles({
      name: "synthetic.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        Array.from(
          { length: 5 },
          (_, i) => `11/12/2026, 10:20 AM - New person: synthetic line ${i}`,
        ).join("\n"),
      ),
    });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create local profile" }).click();
  await page.evaluate(() =>
    (
      window as unknown as { completeMockProfile: () => void }
    ).completeMockProfile(),
  );
  const draft = page.getByLabel("Writing profile for New person");
  await expect(draft).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("hakiki.contacts.v1")),
  ).toBeNull();
  await draft.fill("Reviewed short informal sentences.");
  await page.getByRole("button", { name: "Save reviewed profile" }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hakiki.contacts.v1") || "[]"),
  );
  expect(saved).toHaveLength(1);
  expect(saved[0].style).toBe("Reviewed short informal sentences.");
});
