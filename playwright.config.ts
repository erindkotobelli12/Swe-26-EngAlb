import { defineConfig } from "@playwright/test";

/**
 * E2E runs against a running app (default the dev server on port 3000; override with E2E_BASE_URL, e.g. a
 * production build started with `npx next start -p 3100`). The global setup re-seeds the demo database first
 * (set E2E_RESEED=false to skip) because the journeys mutate data like real users. Files run in order:
 * demo (smoke) → roles-journey (the role/project demo, on seeded data) → stories-evidence (Leo and Eva).
 * Tests tagged @llm need a running local Ollama model; skip them with `npm run test:e2e -- --grep-invert @llm`.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: { baseURL, trace: "retain-on-failure" },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
