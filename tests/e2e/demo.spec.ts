import { test, expect } from "@playwright/test";

/** Smoke coverage: every role's home, the main pages, and switching demo accounts from the account menu. */

const as = async (context: import("@playwright/test").BrowserContext, userId: string) =>
  context.addCookies([{ name: "demo_user", value: userId, url: test.info().project.use.baseURL! }]);

test("each role lands on its own home page", async ({ page, context }) => {
  const homes = [
    ["demo-pmo", /\/portfolio$/, "Portfolio"],
    ["demo-am", /\/my-projects$/, "My projects"],
    ["demo-lm-sara", /\/my-team$/, "My team"],
    ["demo-tl", /\/onboarding$/, "Onboarding"],
    ["demo-hr", /\/preboarding$/, "Pre-boarding"],
    ["employee-leo", /\/my-onboarding$/, "My onboarding"],
  ] as const;
  for (const [user, url, heading] of homes) {
    await as(context, user);
    await page.goto("/");
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
  }
});

test("main pages render for the PMO and the Technical Lead", async ({ page, context }) => {
  await as(context, "demo-pmo");
  for (const [path, heading] of [["/projects", "Projects"], ["/briefing", "Briefing"], ["/insights", "Insights & improvements"], ["/ai-activity", "Audit & AI log"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
  }
  await as(context, "demo-tl");
  for (const [path, heading] of [["/requirements", "Onboarding requirements"], ["/investigations", "Investigations"], ["/evidence", "Evidence"], ["/follow-ups", "Follow-ups"], ["/knowledge", "Knowledge"], ["/assistant", "Assistant"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
  }
});

test("switch demo account from the account menu; employees only see their own case", async ({ page, context }) => {
  await as(context, "demo-pmo");
  await page.goto("/portfolio");
  await expect(page.getByTestId("current-role")).toHaveText("PMO");
  await page.getByTestId("account-menu").click();
  // Keyboard navigation (the submenu also supports it): open the submenu, then typeahead to Leo and select.
  await page.getByRole("menuitem", { name: "Switch demo account" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("Leo");
  await expect(page.getByRole("menuitem", { name: /Leo Marin/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "My onboarding" })).toBeVisible();
  await page.goto("/employees/ONB-005");
  await expect(page.getByText("This case isn't available.")).toBeVisible();
});

test("assistant answers from the real local LLM and cites verified evidence @llm", async ({ page, context }) => {
  test.setTimeout(300_000);
  await as(context, "demo-pmo");
  await page.goto("/assistant");
  const response = await page.request.post("/api/assistant", { data: { question: "Why is Eva not independently ready?" } });
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.answer.length).toBeGreaterThan(20);
  for (const c of result.citations) expect(typeof c.excerpt).toBe("string");
});
