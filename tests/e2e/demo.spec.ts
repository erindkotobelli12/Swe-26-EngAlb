import { test, expect } from "@playwright/test";

/** Smoke coverage of every page and the core read paths. The full demo journey lives in journey.spec.ts. */

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "demo_user", value: "demo-pmo", domain: "localhost", path: "/" }]);
});

test("Eva conflict is shown side by side with verbatim excerpts", async ({ page }) => {
  await page.goto("/employees/ONB-005?tab=investigation");
  const viewer = page.getByTestId("conflict-viewer");
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText("Eva is working independently")).toBeVisible();
  await expect(viewer.getByText("The Technical Lead classifies her as Ready with Support.")).toBeVisible();
});

test("Leo access shows provisioned is not usable", async ({ page }) => {
  await page.goto("/employees/ONB-002");
  await expect(page.locator('[data-access="Nova VPN"]')).toContainText("Provisioned (use unconfirmed)");
  await expect(page.locator('[data-access="Helix Service Desk"]')).toContainText("Requested");
  await expect(page.getByTestId("assessed-level")).toHaveText("Blocked");
});

test("employees directory searches and opens cases", async ({ page }) => {
  await page.goto("/employees");
  await page.getByRole("textbox", { name: "Search employees" }).fill("Eva Stone");
  await expect(page.getByRole("link", { name: /Eva Stone/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Leo Marin/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Open case →" }).click();
  await expect(page.getByRole("heading", { name: "Eva Stone" })).toBeVisible();
});

test("dashboard is data-driven", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("3 access items not usable")).toBeVisible();
  await page.getByRole("textbox", { name: "Search dashboard employees" }).fill("Eva Stone");
  const table = page.getByRole("table");
  await expect(table.getByRole("link", { name: "Eva Stone", exact: true })).toBeVisible();
  await expect(table.getByRole("link", { name: "Leo Marin", exact: true })).toHaveCount(0);
});

test("primary navigation pages render", async ({ page }) => {
  const pages = [
    ["/dashboard", "Onboarding command center"],
    ["/employees", "Employees"],
    ["/investigations", "Investigations"],
    ["/follow-ups", "Follow-Up Center"],
    ["/briefing", "Briefing — PMO"],
    ["/insights", "Insights"],
    ["/evidence", "Evidence"],
    ["/knowledge", "Knowledge repository"],
    ["/assistant", "AI assistant"],
    ["/ai-activity", "AI activity"],
  ] as const;
  for (const [path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("demo user switch persists and employees only see their own case", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByLabel("Demo user").selectOption("employee-leo");
  await expect(page.getByRole("heading", { name: "My workspace" })).toBeVisible();
  await expect(page.getByText("Hello Leo Marin")).toBeVisible();
  await page.goto("/employees/ONB-005");
  await expect(page.getByText("You can only view your own onboarding case.")).toBeVisible();
  await page.getByLabel("Demo user").selectOption("demo-pmo");
  await expect(page.getByTestId("current-role")).toHaveText("Role: PMO");
});

test("assistant answers from the real local LLM and cites verified evidence @llm", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/assistant");
  await expect(page.getByText(/Live local LLM/)).toBeVisible();
  const response = await page.request.post("/api/assistant", { data: { question: "What is blocking Leo's access?" }, timeout: 280_000 });
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.answer.length).toBeGreaterThan(20);
  for (const c of result.citations) expect(typeof c.excerpt).toBe("string");
});
