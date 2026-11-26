// Visual QA helper (not part of the test suite): node tests/visual/shoot.mjs <outDir> <user> <route> [<user> <route> ...]
// Saves a full-page screenshot per (user, route) at 1280px wide against the running dev server.
import { chromium } from "@playwright/test";
import path from "node:path";

const [outDir, ...pairs] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3000";
const width = Number(process.env.WIDTH ?? 1280);
const browser = await chromium.launch();
try {
  for (let i = 0; i < pairs.length; i += 2) {
    const [user, route] = [pairs[i], pairs[i + 1]];
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addCookies([{ name: "demo_user", value: user, url: base }]);
    const page = await ctx.newPage();
    await page.goto(base + route, { waitUntil: "networkidle" });
    const file = path.join(outDir, `${user}${route.replace(/[^a-z0-9]+/gi, "_")}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
    await ctx.close();
  }
} finally {
  await browser.close();
}
