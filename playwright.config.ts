import { defineConfig } from "@playwright/test";

/**
 * E2E runs against the dev server on port 3000 with the seeded dev database.
 * The global setup re-seeds the demo database first (set E2E_RESEED=false to skip) because the journey
 * mutates data like a real user. Tests tagged @llm need a running local Ollama model; skip them with
 * `npm run test:e2e -- --grep-invert @llm`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 180_000 },
});
