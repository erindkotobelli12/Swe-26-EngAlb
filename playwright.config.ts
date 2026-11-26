import { defineConfig } from "@playwright/test";

/**
 * E2E runs against the dev server on port 3000 with the seeded dev database.
 * Re-seed before a run (`npm run db:seed`): the journey test mutates data like a real user would.
 * Tests tagged @llm need a running local Ollama model; skip them with `npm run test:e2e -- --grep-invert @llm`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 120_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 180_000 },
});
