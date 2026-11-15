// Owner-operated setup using the authenticated Firebase CLI. Never prints credentials.
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const root = path.join(
  process.env.APPDATA,
  "npm/node_modules/firebase-tools/lib",
);
const load = (p) => require(path.join(root, p));
const [project, projectNumber, appId] = process.argv.slice(2);
if (!project || !projectNumber || !appId)
  throw new Error(
    "Usage: node scripts/provision.cjs AI_PROJECT PROJECT_NUMBER HAKIKI_WEB_APP_ID",
  );
const hostingProject = "hakiki-hybrid-2026";
(async () => {
  const { configstore } = load("configstore");
  await load("requireAuth").requireAuth({
    project,
    nonInteractive: true,
    user: configstore.get("user"),
    tokens: configstore.get("tokens"),
  });
  const { Client } = load("apiv2");
  await load("ensureApiEnabled").ensure(
    project,
    "recaptchaenterprise.googleapis.com",
    "Hakiki",
  );
  await load("ensureApiEnabled").ensure(
    project,
    "firebaseappcheck.googleapis.com",
    "Hakiki",
  );
  const client = new Client({
    urlPrefix: "https://recaptchaenterprise.googleapis.com",
    apiVersion: "v1",
    auth: true,
  });
  const existing = await client.get(`projects/${project}/keys`);
  let key = existing.body.keys?.find(
    (k) => k.displayName === "Hakiki web attestation",
  );
  if (!key) {
    const created = await client.post(`projects/${project}/keys`, {
      displayName: "Hakiki web attestation",
      webSettings: {
        allowedDomains: [
          `${hostingProject}.web.app`,
          `${hostingProject}.firebaseapp.com`,
        ],
        allowAllDomains: false,
        integrationType: "SCORE",
      },
    });
    key = created.body;
  }
  const siteKey = key.name.split("/").pop();
  const check = load("appcheck/api");
  await check.updateProviderConfig(
    projectNumber,
    appId,
    "recaptcha-enterprise",
    { siteKey, tokenTtl: "3600s", riskAnalysis: { minValidScore: 0.5 } },
    ["siteKey", "tokenTtl", "riskAnalysis.minValidScore"],
  );
  const service = await check.getService(
    projectNumber,
    "firebaseml.googleapis.com",
  );
  console.log(
    "Existing AI Logic App Check enforcement:",
    service.enforcementMode,
  );
  const sdk = await new Client({
    urlPrefix: "https://firebase.googleapis.com",
    apiVersion: "v1beta1",
    auth: true,
  }).get(`projects/${project}/webApps/${appId}/config`);
  const c = sdk.body;
  fs.writeFileSync(
    ".env.local",
    `VITE_FIREBASE_API_KEY=${c.apiKey}\nVITE_FIREBASE_AUTH_DOMAIN=${c.authDomain}\nVITE_FIREBASE_PROJECT_ID=${project}\nVITE_FIREBASE_APP_ID=${appId}\nVITE_FIREBASE_MESSAGING_SENDER_ID=${projectNumber}\nVITE_RECAPTCHA_SITE_KEY=${siteKey}\nVITE_CLOUD_MODEL=gemini-3.8-flash\n`,
  );
  const debugFile = `.local/appcheck-${project}.env`;
  fs.mkdirSync(".local", { recursive: true });
  if (!fs.existsSync(debugFile)) {
    const token = crypto.randomUUID();
    await check.createDebugToken(
      projectNumber,
      appId,
      "Hakiki local implementation",
      token,
    );
    fs.writeFileSync(debugFile, `VITE_APPCHECK_DEBUG_TOKEN=${token}\n`);
  }
  fs.copyFileSync(debugFile, ".env.development.local");
  console.log(
    "Web configuration saved to ignored environment files. Hakiki attestation registered. Existing service enforcement preserved.",
  );
})().catch((e) => {
  console.error("Setup failed:", e.message);
  process.exitCode = 1;
});
