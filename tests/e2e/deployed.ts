import { expect, type Page } from "@playwright/test";

// Verify the executing release, including upgrades from an existing browser cache.
export async function verifyDeployedPage(page: Page) {
  const response = await page.request.get(page.url(), {
    headers: { "Cache-Control": "no-cache" },
  });
  const html = await response.text();
  const expected = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((match) => new URL(match[1], page.url()).pathname)
    .sort();
  const loaded = () =>
    page
      .locator('script[type="module"][src]')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => new URL((node as HTMLScriptElement).src).pathname)
          .sort(),
      );
  const before = await loaded();
  if (JSON.stringify(before) !== JSON.stringify(expected)) {
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      const worker = registration.installing || registration.waiting;
      if (worker && worker.state !== "activated")
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Updated service worker did not activate")),
            30000,
          );
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") {
              clearTimeout(timer);
              resolve();
            }
            if (worker.state === "redundant") {
              clearTimeout(timer);
              reject(new Error("Updated service worker failed"));
            }
          });
        });
    });
    await page.reload();
  }
  expect(expected.length).toBeGreaterThan(0);
  expect(
    await loaded(),
    "Executing scripts must match the freshly fetched release HTML",
  ).toEqual(expected);
  const build = await page.request
    .get(new URL("/build-info.json", page.url()).href)
    .then((r) => r.json());
  return {
    build,
    scriptPaths: expected,
    initialScriptPaths: before,
    upgradedExistingClient: JSON.stringify(before) !== JSON.stringify(expected),
  };
}
