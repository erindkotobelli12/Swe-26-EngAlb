import { expect, test, type Page } from "@playwright/test";

/**
 * The demo journey from the Business Owner's organisation model (docs/DEMO.md):
 * PMO creates a project → Additional Manager chooses the Line Manager as Technical Lead → HR and the Line Manager
 * finish pre-boarding and hand over → the Technical Lead defines requirements (one ticked off by a confirmed skill)
 * and confirms a claimed skill → Leo checks his onboarding and profile → PMO briefing and an improvement.
 * Runs serially, before the evidence stories, on the freshly seeded database.
 */
test.describe.configure({ mode: "serial" });

async function as(page: Page, userId: string) {
  await page.context().addCookies([{ name: "demo_user", value: userId, url: test.info().project.use.baseURL! }]);
}
const toast = (page: Page, text: string | RegExp) => expect(page.getByTestId("toast").filter({ hasText: text }).last()).toBeVisible();

test("1. PMO: Nimbus is at risk with reasons; create a project with two employees in pre-boarding", async ({ page }) => {
  await as(page, "demo-pmo");
  await page.goto("/");
  await expect(page).toHaveURL(/\/portfolio$/);
  const nimbus = page.locator("tr", { has: page.locator('[data-project-row="Nimbus"]') });
  await expect(nimbus).toContainText("At risk");
  await expect(nimbus).toContainText(/high-severity finding|access item|follow-up/);

  await page.goto("/projects/new");
  await page.locator("#p-name").fill("Borealis");
  await page.locator("#p-code").fill("BOR-101");
  await page.getByTestId("wizard-next").click();
  await page.locator("label", { hasText: "Marco Ruiz" }).click();
  await page.getByTestId("wizard-next").click();
  await page.locator("label", { hasText: "Jon Vale" }).click();
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("add-person-P-S-RINA").click();
  await page.getByTestId("add-person-P-S-DREN").click();
  await expect(page.getByTestId("picked-employees")).toContainText("Rina Kola");
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("wizard-save").click();
  await expect(page).toHaveURL(/\/projects\/BOREALIS\?tab=team/);
  const tree = page.getByTestId("team-tree");
  await expect(tree).toContainText("Rina Kola");
  await expect(tree).toContainText("Dren Leka");
  await expect(tree.getByText("Pre-boarding").first()).toBeVisible();
});

test("2. Additional Manager: choose the Line Manager as Technical Lead; see Line Managers and teams", async ({ page }) => {
  await as(page, "demo-am");
  await page.goto("/my-projects");
  await expect(page.locator('[data-needs-tl="Borealis"]')).toBeVisible();
  await page.goto("/projects/BOREALIS");
  await page.getByTestId("choose-tech-lead").click();
  await page.getByRole("dialog").locator("label", { hasText: "Jon Vale" }).click();
  await page.getByTestId("save-tech-lead").click();
  await toast(page, "Technical Lead saved.");
  await page.goto("/projects/BOREALIS?tab=team");
  await expect(page.getByTestId("team-tree")).toContainText("Line Manager and Technical Lead");
  await page.goto("/team");
  await expect(page.getByText("Sara Neri").first()).toBeVisible();
  await expect(page.getByText("Jon Vale").first()).toBeVisible();
});

test("3. HR: update the pre-boarding checklist for the new employees", async ({ page }) => {
  await as(page, "demo-hr");
  await page.goto("/");
  await expect(page).toHaveURL(/\/preboarding$/);
  const row = page.locator('[data-testid="preboarding-row"][data-employee="Rina Kola"]');
  await row.locator("summary").click();
  for (const item of ["Start date and movement type confirmed", "Contract and HR paperwork complete", "Welcome message and first-day agenda sent"]) {
    const select = row.getByLabel(`Status of ${item}`);
    await select.selectOption("DONE");
    await expect(select).toHaveValue("DONE");
  }
});

test("4. Line Manager: update an item, confirm the hand-over; the team is grouped by phase", async ({ page }) => {
  await as(page, "demo-lm-jon");
  await page.goto("/");
  await expect(page).toHaveURL(/\/my-team$/);
  await expect(page.getByTestId("phase-group-PRE_BOARDING")).toContainText("Rina Kola");
  const row = page.locator('[data-testid="preboarding-row"][data-employee="Rina Kola"]');
  await row.locator("summary").click();
  const laptop = row.getByLabel("Status of Laptop and equipment ready");
  await laptop.selectOption("DONE");
  await expect(laptop).toHaveValue("DONE");
  await row.locator('[data-testid^="handover-"]:not([data-testid$="-confirm"])').click();
  await page.locator("#confirm-reason").fill("Laptop delivered; HR items complete.");
  await page.locator('[data-testid^="handover-"][data-testid$="-confirm"]').click();
  await toast(page, "Rina Kola is now in onboarding.");
  await expect(page.getByTestId("phase-group-ONBOARDING")).toContainText("Rina Kola");
  await expect(page.getByTestId("phase-group-PRE_BOARDING")).toContainText("Dren Leka");
});

test("5. Technical Lead: three requirements, an automatic check-off, a confirmed skill; Leo's case still works", async ({ page }) => {
  await as(page, "demo-tl");
  await page.goto("/requirements?project=NIMBUS");
  const add = async (title: string, type: string, criteria: string, skill?: string, level?: string) => {
    await page.getByTestId("add-requirement").first().click();
    const d = page.getByRole("dialog");
    await d.locator("#rq-title").fill(title);
    await d.locator("#rq-type").selectOption(type);
    if (skill) await d.locator("#rq-skill").selectOption({ label: skill });
    if (level) await d.locator("#rq-level").selectOption(level);
    await d.locator("#rq-criteria").fill(criteria);
    await d.getByTestId("save-requirement").click();
    await expect(page.getByTestId("requirements-list")).toContainText(title);
  };
  await add("Incident triage", "SKILL", "Triages a P2 incident end to end", "Incident triage", "INTERMEDIATE");
  await add("SQL reporting", "SKILL", "Builds the weekly SLA report", "SQL reporting", "BASIC");
  await add("Read the Nimbus service runbook", "DOCUMENT", "Runbook read and discussed with the Technical Lead");

  const cell = (req: string) => page.locator(`[data-testid="matrix-cell"][data-requirement="${req}"][data-employee="Leo Marin"]`);
  await expect(cell("Incident triage")).toHaveAttribute("data-status", "SATISFIED_BY_EXISTING_SKILL");
  await expect(cell("SQL reporting")).toHaveAttribute("data-status", "POSSIBLY_COVERED");
  await expect(cell("Read the Nimbus service runbook")).toHaveAttribute("data-status", "TODO");

  await page.goto("/onboarding");
  const claim = page.getByTestId("skills-to-confirm").locator("li", { hasText: "Leo Marin" });
  await claim.getByTestId("confirm-skill-SQL reporting").click();
  await page.getByTestId("confirm-skill-save").click();
  await toast(page, /Skill decision saved/);
  await page.goto("/requirements?project=NIMBUS");
  await expect(cell("SQL reporting")).toHaveAttribute("data-status", "SATISFIED_BY_EXISTING_SKILL");

  await page.goto("/employees/ONB-002?tab=investigation");
  await expect(page.locator("[data-finding-type]").first()).toBeVisible();
  await page.goto("/employees/ONB-002?tab=map");
  await expect(page.getByTestId("dependency-map")).toBeVisible();
  await page.goto("/employees/ONB-002?tab=simulator");
  await expect(page.getByTestId("simulation-banner")).toBeVisible();
  await expect(page.getByTestId("sim-current")).toBeVisible();
});

test("6. Leo: phase, next steps, contacts and requirements; skills and earlier projects on his profile", async ({ page }) => {
  await as(page, "employee-leo");
  await page.goto("/");
  await expect(page).toHaveURL(/\/my-onboarding$/);
  await expect(page.getByRole("heading", { name: "My onboarding" })).toBeVisible();
  await expect(page.getByLabel(/Phase: Onboarding/)).toBeVisible();
  await expect(page.getByTestId("next-steps")).toBeVisible();
  await expect(page.getByTestId("contacts")).toContainText("Sara Neri");
  await expect(page.getByTestId("contacts")).toContainText("Ben Okafor");
  await expect(page.getByTestId("employee-requirements")).toContainText("Already has this skill");
  await page.goto("/profile");
  await expect(page.locator('[data-skill="Incident triage"]')).toHaveAttribute("data-status", "CONFIRMED");
  await expect(page.locator('[data-skill="SQL reporting"]')).toHaveAttribute("data-status", "CONFIRMED");
  await expect(page.getByText("Lumen").first()).toBeVisible();
  await page.goto("/employees/ONB-001");
  await expect(page.getByText("This case isn't available.")).toBeVisible();
});

test("7. PMO: generate the portfolio briefing and turn an insight into an improvement", async ({ page }) => {
  test.setTimeout(400_000);
  await as(page, "demo-pmo");
  await page.goto("/portfolio");
  await page.getByTestId("generate-briefing").first().click();
  await expect(page.getByText("Most urgent")).toBeVisible({ timeout: 300_000 });
  await page.goto("/briefing");
  const statements = page.getByTestId("briefing").locator("[data-statement]");
  expect(await statements.count()).toBeGreaterThan(0);
  const href = await page.getByRole("link", { name: "Markdown" }).getAttribute("href");
  const md = await page.request.get(href!);
  expect(md.headers()["content-type"]).toContain("text/markdown");

  await page.goto("/portfolio");
  await page.getByTestId("bottlenecks").getByTestId("create-improvement").first().click();
  const d = page.getByRole("dialog");
  await d.locator("#im-owner").selectOption("P-S-AM-MARCO");
  await d.getByTestId("save-improvement").click();
  await toast(page, "Improvement created.");
  await expect(page.getByTestId("improvements")).toContainText("Reduce:");
  await expect(page.getByTestId("improvements")).toContainText("Marco Ruiz");
});
