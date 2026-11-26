import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // A separate SQLite file (prisma/test.db) is migrated and seeded once; the dev database is never touched.
    env: { DATABASE_URL: "file:./test.db", DEMO_EVALUATION_DATE: "2026-10-14", OLLAMA_BASE_URL: "http://127.0.0.1:11434" },
    globalSetup: ["tests/setup/global.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
