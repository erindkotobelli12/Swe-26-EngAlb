import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Creates a fresh scratch database for unit tests: prisma/test.db (git-ignored). Only that hard-coded file is
 * removed — never the dev database — and migrations are applied with the non-destructive `migrate deploy`.
 */
export default function setup() {
  const prismaDir = path.resolve(__dirname, "../../prisma");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = path.join(prismaDir, `test.db${suffix}`);
    if (existsSync(file)) rmSync(file);
  }
  const env = { ...process.env, DATABASE_URL: "file:./test.db", DEMO_EVALUATION_DATE: "2026-10-14" };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });
}
