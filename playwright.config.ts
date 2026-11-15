import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:5173",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm.cmd run dev",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: true,
      },
});
