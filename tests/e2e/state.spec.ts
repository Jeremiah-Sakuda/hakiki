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
 export const prepareLocal=async()=>{if(window.holdSetup)await new Promise(resolve=>window.finishSetup=resolve)};
 export const analyzeLocal=async()=>{if(window.holdLocal)return new Promise(resolve=>window.finishLocal=()=>resolve({kind:'model',signals:[],number:'unknown',note:'mock result',elapsedMs:1}));const e=new Error('mock failure');e.diagnostic={code:'invalid_schema'};throw e;};
 export const summarizeProfile=()=>new Promise(resolve=>{window.completeMockProfile=()=>resolve('Uses short friendly English sentences.');});
 export const checkWorld=async(features,receipt)=>{receipt({id:'test-attempt',at:new Date().toISOString(),model:'mock',endpoint:'mock-no-network',request:features,status:'failed'});throw new Error('Mock cloud failed');};
 export const refreshPlaybook=async()=> '2026-11-15';
 export const getLocalDiagnostics=()=>[];
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
  await page
    .getByRole("checkbox", { name: /I have permission to use this chat/ })
    .check();
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
  await page.getByLabel("Choose a WhatsApp text export").setInputFiles({
    name: "synthetic.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      Array.from(
        { length: 5 },
        (_, i) => `11/12/2026, 10:20 AM - New person: synthetic line ${i}`,
      ).join("\n"),
    ),
  });
  await page
    .getByRole("checkbox", { name: /I have permission to use this chat/ })
    .check();
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

test("manual arrangements work without AI, can be corrected, edited and deleted", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Your people/ }).click();
  await page.getByLabel("Person’s name").fill("Confirmed cousin");
  await page
    .getByLabel("Money requests by message")
    .selectOption("no_message_requests_confirmed");
  await page
    .getByRole("checkbox", { name: "mobile money", exact: true })
    .check();
  await page
    .getByLabel("Our verification agreement")
    .selectOption("speak_before_sending");
  await page
    .getByRole("checkbox", { name: /I reviewed these details/ })
    .check();
  await page.getByRole("button", { name: "Save reviewed contact" }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hakiki.contacts.v1") || "[]"),
  );
  expect(saved[0].style).toBe("");
  expect(saved[0].context.confirmedAt).toBeTruthy();
  await page
    .getByLabel("Message to check", { exact: true })
    .fill("Send money by bank transfer. Do not call.");
  await page.getByRole("button", { name: "Review this message" }).click();
  await expect(
    page.locator('[data-context-code="different_payment_method"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-context-code="verification_discouraged"]'),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Payment", exact: true })
    .selectOption("mobile_money");
  await page
    .getByRole("combobox", { name: "Discourages verification", exact: true })
    .selectOption("false");
  await expect(
    page.locator('[data-context-code="different_payment_method"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-context-code="verification_discouraged"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Your people/ }).click();
  await page.getByRole("button", { name: "Edit Confirmed cousin" }).click();
  await page.getByLabel("Money requests by message").selectOption("unknown");
  await page
    .getByRole("checkbox", { name: /I reviewed these details/ })
    .check();
  await page.getByRole("button", { name: "Save reviewed changes" }).click();
  await page.getByRole("button", { name: /Your people/ }).click();
  await page
    .getByRole("button", { name: "Delete Confirmed cousin", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little context goes a long way." }),
  ).toBeVisible();
});

test("cancelled setup cannot become ready after a late completion", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as unknown as { holdSetup: boolean }).holdSetup = true;
  });
  await page.getByRole("button", { name: "Device setup" }).click();
  await page.getByRole("button", { name: "Enable on-device AI" }).click();
  await page.getByRole("button", { name: "Cancel model setup" }).click();
  await page.evaluate(() => {
    (window as unknown as { finishSetup: () => void }).finishSetup();
  });
  await expect(
    page.getByRole("button", { name: "Enable on-device AI" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Local model ready" }),
  ).toHaveCount(0);
});

test("local failure offers redacted retry and cancellation ignores late results", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Device setup" }).click();
  await page.getByRole("button", { name: "Enable on-device AI" }).click();
  await expect(
    page.getByRole("button", { name: "Local model ready" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByLabel("Message to check", { exact: true })
    .fill("Please send money.");
  await page.getByRole("button", { name: "Review this message" }).click();
  await expect(page.getByText(/Code: invalid_schema/)).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { holdLocal: boolean }).holdLocal = true;
  });
  await page
    .getByRole("button", { name: "Retry local interpretation" })
    .click();
  await page.getByRole("button", { name: "Cancel local operation" }).click();
  await page.evaluate(() => {
    (window as unknown as { finishLocal: () => void }).finishLocal();
  });
  await expect(
    page.getByText("Text rules · no AI comparison", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("On-device AI + text rules", { exact: true }),
  ).toHaveCount(0);
});
