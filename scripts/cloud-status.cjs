// Read-only owner diagnostic; never outputs credentials or API keys.
const path = require("node:path");
const root = path.join(
  process.env.APPDATA,
  "npm/node_modules/firebase-tools/lib",
);
const load = (p) => require(path.join(root, p));
const project = process.argv[2] || "soma-meta-jerem-2026";
(async () => {
  const { configstore } = load("configstore");
  await load("requireAuth").requireAuth({
    project,
    nonInteractive: true,
    user: configstore.get("user"),
    tokens: configstore.get("tokens"),
  });
  const { Client } = load("apiv2");
  const client = new Client({
    urlPrefix: "https://serviceusage.googleapis.com",
    apiVersion: "v1",
    auth: true,
  });
  for (const service of [
    "firebasevertexai.googleapis.com",
    "generativelanguage.googleapis.com",
  ]) {
    const response = await client.get(
      `projects/${project}/services/${service}`,
    );
    console.log(service, JSON.stringify({ state: response.body.state }));
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
