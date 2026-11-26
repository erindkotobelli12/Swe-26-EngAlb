import { expect, test, type Page } from "@playwright/test";

/**
 * Section 7 demo journey. Primary: Leo Marin (access blocker). Secondary: Eva Stone (conflict).
 * Runs serially on a freshly seeded database. LLM-dependent steps are in separate @llm tests.
 */
test.describe.configure({ mode: "serial" });

async function as(page: Page, userId: string) {
  await page.context().addCookies([{ name: "demo_user", value: userId, domain: "localhost", path: "/" }]);
}

test("1. Dashboard shows data-driven KPIs and Leo's access blocker", async ({ page }) => {
  await as(page, "demo-pmo");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Onboarding command center" })).toBeVisible();
  await expect(page.getByText("3 access items not usable")).toBeVisible();
  await expect(page.getByText("All figures are computed from stored records")).toBeVisible();
});

test("2. Leo's investigation shows verbatim excerpts, facts vs assumptions and owners", async ({ page }) => {
  await as(page, "demo-pmo");
  await page.goto("/employees/ONB-002?tab=investigation");
  const helix = page.locator('[data-finding-type="ACCESS_NOT_USABLE"]', { hasText: "Helix Service Desk requested" });
  await expect(helix).toBeVisible();
  await expect(helix.getByText("Helix Service Desk has not yet been provisioned.")).toBeVisible();
  await expect(helix.getByText("Confirmed facts")).toBeVisible();
  await expect(helix.getByText("Assumptions and hypotheses")).toBeVisible();
  await expect(helix.getByText("Access Support").first()).toBeVisible();
  await expect(page.locator('[data-finding-type="ACCESS_NOT_USABLE"]', { hasText: "Orion Portal awaiting" })).toBeVisible();
  await expect(page.locator('[data-finding-type="ACCESS_OWNER_UNKNOWN"]')).toContainText("Owner of Helix Service Desk provisioning not recorded");
});

test("3. Confirming the proposed Helix path turns downstream nodes blocked", async ({ page }) => {
  await as(page, "demo-tl");
  await page.goto("/employees/ONB-002?tab=map");
  const ktNode = page.locator('[data-node-key="kt:KT-ONB-002-TPL-SERVICE-DESK"]');
  await expect(ktNode).toBeVisible();
  await expect(ktNode).not.toHaveAttribute("data-display", "BLOCKED");
  const suggestions = page.getByTestId("suggested-dependencies");
  await expect(suggestions.locator("li")).toHaveCount(2);
  await suggestions.locator("li").first().getByRole("button", { name: "Confirm" }).click();
  await expect(suggestions.locator("li")).toHaveCount(1);
  await suggestions.locator("li").first().getByRole("button", { name: "Confirm" }).click();
  await expect(suggestions.getByText("No proposals waiting.")).toBeVisible();
  await expect(ktNode).toHaveAttribute("data-display", "BLOCKED");
  await expect(page.locator('[data-node-key="gate:EXECUTION_OBSERVED"]')).toHaveAttribute("data-display", "BLOCKED");
  await expect(page.locator('[data-node-key="gate:TECH_VALIDATION_APPROVED"]')).toHaveAttribute("data-display", "BLOCKED");
  await page.locator('[data-node-key="access:ACC-LEO-HELIX"]').click();
  await expect(page.getByTestId("node-panel")).toContainText("Root blocker");

  await page.goto("/employees/ONB-002?tab=roadmap");
  await expect(page.locator('[data-plan="kt:KT-ONB-002-TPL-SERVICE-DESK"]')).toHaveAttribute("data-status", "BLOCKED");
  await page.getByRole("button", { name: "Approve current plan as baseline" }).click();
  await expect(page.getByText(/No changes since the baseline approved by/)).toBeVisible();
});

test("4. Simulator: Helix usable + Orion approved changes the simulated level; actual record unchanged", async ({ page }) => {
  await as(page, "demo-pmo");
  await page.goto("/employees/ONB-002?tab=simulator&preset=access%3AACC-LEO-HELIX");
  await expect(page.getByTestId("simulation-banner")).toContainText("Simulation — not actual employee readiness");
  await expect(page.locator('select[data-toggle="access:ACC-LEO-HELIX"]')).toHaveValue("USABLE");
  await page.locator('select[data-toggle="access:ACC-LEO-ORION"]').selectOption("APPROVED");
  await expect(page.getByTestId("sim-current")).toHaveText("Blocked");
  await expect(page.getByTestId("sim-result")).toContainText("Pre-onboarding");
  await expect(page.getByTestId("sim-blockers")).toContainText("Helix Service Desk (root blocker)");
  await expect(page.getByTestId("sim-order")).toContainText("Orion Portal");
  await page.goto("/employees/ONB-002");
  await expect(page.getByTestId("assessed-level")).toHaveText("Blocked");
  await expect(page.locator('[data-access="Helix Service Desk"]')).toHaveAttribute("data-status", "REQUESTED");
});

test("5. Follow-Up Center: one Access Support draft and a separate app-owner request; edit, approve, send (simulated)", async ({ page }) => {
  await as(page, "demo-pmo");
  await page.goto("/follow-ups");
  const accessGroup = page.locator("[data-group]", { hasText: "Access Support (name not recorded)" });
  await expect(accessGroup.locator('[data-item^="access:ACC-LEO-"]')).toHaveCount(3);
  await expect(page.locator("[data-group]", { hasText: "Application Owner — Orion Portal" }).locator('[data-item="approval:ACC-LEO-ORION"]')).toBeVisible();
  await accessGroup.getByRole("button", { name: "Create draft" }).click();
  const card = page.locator('[data-communication="Access Support (name not recorded)"]');
  await expect(card).toHaveAttribute("data-status", "DRAFT");
  await card.getByLabel("Message body").fill((await card.getByLabel("Message body").inputValue()).replace("Thank you,", "Many thanks for your help,\nThank you,"));
  await card.getByRole("button", { name: "Save edit" }).click();
  await expect(card.getByText("draft: edited by a human")).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card).toHaveAttribute("data-status", "APPROVED");
  await card.getByRole("button", { name: "Send (simulated)" }).click();
  await expect(card).toHaveAttribute("data-status", "SENT_SIMULATED");
  await expect(card.getByText("SIMULATED OUTBOX — nothing was sent outside this machine.")).toBeVisible();
});

test("6. Record the response; approving its claim makes Helix usable and the pipeline updates the case", async ({ page }) => {
  await as(page, "demo-pmo");
  await page.goto("/follow-ups");
  const card = page.locator('[data-communication="Access Support (name not recorded)"]');
  const about = card.getByLabel("Response is about");
  if (await about.count()) await about.selectOption("ONB-002");
  await card.getByLabel("Response text").fill("Helix Service Desk has now been provisioned. Leo logged in successfully this morning.");
  await card.getByRole("button", { name: "Record response" }).click();
  await expect(card).toHaveAttribute("data-status", "RESPONDED");

  await page.goto("/employees/ONB-002?tab=evidence");
  const response = page.locator("article", { hasText: "Response from Access Support" }).first();
  await response.getByRole("button", { name: "Add claim manually" }).click();
  await response.getByLabel("Field").fill("access.Helix Service Desk.status");
  await response.getByLabel("Value").fill("USABLE");
  await response.getByLabel("Verbatim excerpt").fill("Leo logged in successfully");
  await response.getByRole("button", { name: "Save as pending claim" }).click();
  const claim = page.locator('[data-claim-field="access.Helix Service Desk.status"]', { hasText: "USABLE" }).last();
  await claim.getByRole("button", { name: "Approve claim" }).click();
  const steps = page.getByTestId("pipeline-steps");
  await expect(steps).toContainText("4. State update");
  await expect(steps).toContainText("USABLE");
  await expect(steps).toContainText("Unblocked: Practical ticket-handling KT");
  await expect(steps).toContainText("Plan adapted: Usable access: Helix Service Desk in progress → done");

  await page.goto("/employees/ONB-002");
  await expect(page.locator('[data-access="Helix Service Desk"]')).toHaveAttribute("data-status", "USABLE");
  await expect(page.getByTestId("assessed-level")).toHaveText("Pre-onboarding");
  await page.goto("/employees/ONB-002?tab=map");
  await expect(page.locator('[data-node-key="access:ACC-LEO-HELIX"]')).toHaveAttribute("data-display", "SATISFIED");
  await page.goto("/employees/ONB-002?tab=roadmap");
  await expect(page.getByTestId("roadmap-diff")).toContainText("Usable access: Helix Service Desk: in progress → done");
  await expect(page.getByTestId("roadmap-diff")).toContainText("Practical ticket-handling KT: blocked → todo");
  await page.goto("/employees/ONB-002?tab=history");
  await expect(page.getByText("pipeline run").first()).toBeVisible();
  await expect(page.getByText("claim approved").first()).toBeVisible();
});

test("7. Eva: side-by-side conflict; the Technical Lead records NEEDS_MORE_EVIDENCE", async ({ page }) => {
  await as(page, "demo-tl");
  await page.goto("/employees/ONB-005?tab=investigation");
  await expect(page.getByTestId("conflict-viewer")).toContainText("Eva is working independently");
  await page.goto("/employees/ONB-005");
  await expect(page.locator('[data-reliability="CONFLICTING"]').first()).toBeVisible();
  await page.goto("/employees/ONB-005#validation");
  const form = page.getByTestId("validation-form");
  await form.getByLabel("Validation decision").selectOption("NEEDS_MORE_EVIDENCE");
  await form.getByLabel(/EMAIL-003/).check();
  await form.getByLabel("Validation comment").fill("The two complex scenarios have not been observed yet; independent readiness cannot be validated.");
  await form.getByRole("button", { name: "Record validation decision" }).click();
  await expect(page.getByTestId("validation-history")).toContainText("needs more evidence");
  await expect(page.getByTestId("validated-level")).toHaveText("Not validated");
  await as(page, "demo-pmo");
  await page.goto("/employees/ONB-005");
  await expect(page.getByText("Only a Technical Lead can record a validation decision.")).toBeVisible();
});

test("8. Briefing: TL and PMO get different, fully referenced content; Markdown export", async ({ page }) => {
  test.setTimeout(400_000);
  for (const [user, role, section] of [["demo-tl", "TECH_LEAD", "Outstanding technical validations"], ["demo-pmo", "PMO", "Most urgent problems"]] as const) {
    await as(page, user);
    await page.goto(`/briefing?role=${role}`);
    await page.getByRole("button", { name: "Generate briefing" }).click();
    const briefing = page.getByTestId("briefing");
    await expect(briefing.getByRole("heading", { name: section })).toBeVisible({ timeout: 300_000 });
    const statements = briefing.locator("[data-statement]");
    expect(await statements.count()).toBeGreaterThan(0);
    for (const s of await statements.all()) expect(await s.locator("a").count()).toBeGreaterThan(0);
  }
  const href = await page.getByRole("link", { name: "Markdown" }).getAttribute("href");
  const md = await page.request.get(href!);
  expect(md.headers()["content-type"]).toContain("text/markdown");
  expect(await md.text()).toContain("## Most urgent problems");
});

test("AI Detective adds root-cause hypotheses to Leo's findings @llm", async ({ page }) => {
  test.setTimeout(600_000);
  await as(page, "demo-pmo");
  await page.goto("/employees/ONB-002?tab=investigation");
  await page.getByRole("button", { name: "Investigate with AI" }).click();
  await expect(page.getByText(/Reviewed \d+ rule finding/)).toBeVisible({ timeout: 540_000 });
  await expect(page.getByTestId("ai-review").first()).toBeVisible();
});
