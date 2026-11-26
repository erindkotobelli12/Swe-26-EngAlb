import { expect, test, type Page } from "@playwright/test";

/**
 * The evidence examples: Leo Marin (access blocker) and Eva Stone (conflicting readiness reports).
 * Decisions are made by the case's phase owner — Leo's is Ben Okafor, the Nimbus Technical Lead (sample person).
 * Runs serially on a freshly seeded database. LLM-dependent steps are in separate @llm tests.
 */
test.describe.configure({ mode: "serial" });

async function as(page: Page, userId: string) {
  await page.context().addCookies([{ name: "demo_user", value: userId, url: test.info().project.use.baseURL! }]);
}

test("1. Leo's overview shows three access items not working and a blocked assessment", async ({ page }) => {
  await as(page, "demo-tl");
  await page.goto("/employees/ONB-002");
  await expect(page.getByTestId("assessed-level")).toHaveText("Blocked");
  await expect(page.locator('[data-access="Nova VPN"]')).toContainText("Set up, not yet confirmed");
  await expect(page.locator('[data-access="Helix Service Desk"]')).toHaveAttribute("data-status", "REQUESTED");
});

test("2. Leo's findings keep verbatim facts and assumptions in the details drawer", async ({ page }) => {
  await as(page, "demo-tl");
  await page.goto("/employees/ONB-002?tab=investigation");
  const helix = page.locator('[data-finding-type="ACCESS_NOT_USABLE"]', { hasText: "Helix Service Desk requested" });
  await expect(helix).toBeVisible();
  await helix.getByTestId("finding-details").click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Helix Service Desk has not yet been provisioned.").first()).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Facts" })).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Assumptions" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-finding-type="ACCESS_OWNER_UNKNOWN"]')).toContainText("Owner of Helix Service Desk provisioning not recorded");
});

test("3. Confirming the proposed Helix path turns downstream nodes blocked; the plan is baselined", async ({ page }) => {
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
  await expect(page.locator('[data-node-key="gate:TECH_VALIDATION_APPROVED"]')).toHaveAttribute("data-display", "BLOCKED");

  await page.goto("/employees/ONB-002?tab=roadmap");
  await expect(page.locator('[data-plan="kt:KT-ONB-002-TPL-SERVICE-DESK"]')).toHaveAttribute("data-status", "BLOCKED");
  await page.getByRole("button", { name: "Approve current plan as baseline" }).click();
  await expect(page.getByText(/No changes since the baseline approved by/)).toBeVisible();
});

test("4. Simulator changes only the simulated level; the actual record is unchanged", async ({ page }) => {
  await as(page, "demo-pmo");
  await page.goto("/employees/ONB-002?tab=simulator&preset=access%3AACC-LEO-HELIX");
  await expect(page.getByTestId("simulation-banner")).toContainText("Simulation — not actual employee readiness");
  await expect(page.locator('select[data-toggle="access:ACC-LEO-HELIX"]')).toHaveValue("USABLE");
  await page.locator('select[data-toggle="access:ACC-LEO-ORION"]').selectOption("APPROVED");
  await expect(page.getByTestId("sim-current")).toHaveText("Blocked");
  await expect(page.getByTestId("sim-result")).toContainText("Pre-onboarding");
  await page.goto("/employees/ONB-002");
  await expect(page.getByTestId("assessed-level")).toHaveText("Blocked");
});

test("5. Follow-ups: the phase owner drafts, edits, approves and sends (simulated); the PMO cannot", async ({ page }) => {
  await as(page, "demo-pmo");
  await page.goto("/follow-ups");
  await expect(page.getByRole("button", { name: "Create draft" })).toHaveCount(0);

  await as(page, "demo-tl");
  await page.goto("/follow-ups");
  const accessGroup = page.locator("[data-group]", { hasText: "Access support (name not recorded)" });
  await expect(accessGroup.locator('[data-item^="access:ACC-LEO-"]')).toHaveCount(3);
  await accessGroup.getByRole("button", { name: "Create draft" }).click();
  const card = page.locator('[data-communication="Access support (name not recorded)"]');
  await expect(card).toHaveAttribute("data-status", "DRAFT");
  await card.getByLabel("Message body").fill((await card.getByLabel("Message body").inputValue()).replace("Thank you,", "Many thanks for your help,\nThank you,"));
  await card.getByRole("button", { name: "Save edit" }).click();
  await expect(card.getByText("draft: edited by a human")).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card).toHaveAttribute("data-status", "APPROVED");
  await card.getByRole("button", { name: "Send (simulated)" }).click();
  await expect(card).toHaveAttribute("data-status", "SENT_SIMULATED");
});

test("6. The response is recorded; approving its claim makes Helix usable and the case updates", async ({ page }) => {
  await as(page, "demo-tl");
  await page.goto("/follow-ups");
  const card = page.locator('[data-communication="Access support (name not recorded)"]');
  const about = card.getByLabel("Response is about");
  if (await about.count()) await about.selectOption("ONB-002");
  await card.getByLabel("Response text").fill("Helix Service Desk has now been provisioned. Leo logged in successfully this morning.");
  await card.getByRole("button", { name: "Record response" }).click();
  await expect(card).toHaveAttribute("data-status", "RESPONDED");

  await page.goto("/employees/ONB-002?tab=evidence");
  const response = page.locator("article", { hasText: "Response from Access support" }).first();
  await response.getByRole("button", { name: "Add claim manually" }).click();
  await response.getByLabel("Field").fill("access.Helix Service Desk.status");
  await response.getByLabel("Value").fill("USABLE");
  await response.getByLabel("Verbatim excerpt").fill("Leo logged in successfully");
  await response.getByRole("button", { name: "Save as pending claim" }).click();
  const claim = page.locator('[data-claim-field="access.Helix Service Desk.status"]', { hasText: "USABLE" }).last();
  await claim.getByRole("button", { name: "Approve claim" }).click();
  const steps = page.getByTestId("pipeline-steps");
  await expect(steps).toContainText("4. State update");
  await expect(steps).toContainText("Unblocked: Practical ticket-handling KT");

  await page.goto("/employees/ONB-002");
  await expect(page.locator('[data-access="Helix Service Desk"]')).toHaveAttribute("data-status", "USABLE");
  await expect(page.getByTestId("assessed-level")).toHaveText("Pre-onboarding");
  await page.goto("/employees/ONB-002?tab=roadmap");
  await expect(page.getByTestId("roadmap-diff")).toContainText(/Practical ticket-handling KT: Blocked → To do/i);
  await page.goto("/employees/ONB-002?tab=history");
  await expect(page.getByText(/claim approved/i).first()).toBeVisible();
});

test("7. Eva: the conflict is shown side by side; only the project's Technical Lead may validate", async ({ page }) => {
  await as(page, "demo-pmo");
  await page.goto("/employees/ONB-005?tab=investigation");
  await expect(page.getByTestId("conflict-viewer")).toContainText("Eva is working independently");
  await expect(page.getByTestId("conflict-viewer")).toContainText("The Technical Lead classifies her as Ready with Support.");
  await page.goto("/employees/ONB-005");
  await expect(page.locator('[data-reliability="CONFLICTING"]').first()).toBeVisible();
  await expect(page.getByText("Only a Technical Lead can record a validation decision.")).toBeVisible();

  // Ben is the Technical Lead of Nimbus, not Orion: he cannot even open Eva's case; he validates Leo instead.
  await as(page, "demo-tl");
  await page.goto("/employees/ONB-005");
  await expect(page.getByText("This case isn't available.")).toBeVisible();
  await page.goto("/employees/ONB-002#validation");
  const form = page.getByTestId("validation-form");
  await form.getByLabel("Validation decision").selectOption("NEEDS_MORE_EVIDENCE");
  await form.getByLabel(/Delayed account: Leo Marin/).check();
  await form.getByLabel("Validation comment").fill("Access works now, but no knowledge transfer has been observed yet.");
  await form.getByRole("button", { name: "Record validation decision" }).click();
  await expect(page.getByTestId("validation-history")).toContainText("Needs more evidence");
  await expect(page.getByTestId("validated-level")).toHaveText("Not validated");
});

test("AI Detective adds root-cause hypotheses to Leo's findings @llm", async ({ page }) => {
  test.setTimeout(600_000);
  await as(page, "demo-tl");
  await page.goto("/employees/ONB-002?tab=investigation");
  await page.getByRole("button", { name: "Investigate with AI" }).click();
  await expect(page.getByText(/Reviewed \d+ rule finding/)).toBeVisible({ timeout: 540_000 });
  await expect(page.getByTestId("ai-review").first()).toBeAttached();
});
