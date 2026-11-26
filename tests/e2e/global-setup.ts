import { execSync } from "node:child_process";

/** The journey mutates data like a real user. Re-seed the demo database first (set E2E_RESEED=false to skip). */
export default function globalSetup() {
  if (process.env.E2E_RESEED === "false") return;
  execSync("npm run db:seed", { stdio: "inherit" });
}
