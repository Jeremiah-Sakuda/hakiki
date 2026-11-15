import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { provenance } from "./scripts/provenance.ts";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [
      react(),
      {
        name: "release-provenance",
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "build-info.json",
            source: JSON.stringify(
              {
                ...provenance("npm run build"),
                provider: env.VITE_AI_PROVIDER || "google-ai",
                model: env.VITE_CLOUD_MODEL || "gemini-3.8-flash",
              },
              null,
              2,
            ),
          });
        },
      },
    ],
    build: { chunkSizeWarningLimit: 650 },
    server: { port: 5173, strictPort: true },
  };
});
