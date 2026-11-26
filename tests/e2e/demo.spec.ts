import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test("Eva conflict workflow is visible", async ({page})=>{
  await page.goto("/employees/ONB-005");
  await expect(page.getByText("Eva readiness reports")).toBeVisible();
  await expect(page.getByText("Ready with Support",{exact:true}).last()).toBeVisible();
});

test("Leo access workflow is visible", async ({page})=>{
  await page.goto("/employees/ONB-002");
  await expect(page.getByText("Nova VPN")).toBeVisible();
  await expect(page.getByText("PROVISIONED",{exact:true}).first()).toBeVisible();
});

test("employees directory searches and opens cases", async ({page})=>{
  await page.goto("/employees");
  await expect(page.getByRole("heading",{name:"Employees"})).toBeVisible();
  await page.getByRole("textbox",{name:"Search employees"}).fill("Eva Stone");
  await expect(page.getByRole("link",{name:/Eva Stone/})).toBeVisible();
  await expect(page.getByRole("link",{name:/Leo Marin/})).toHaveCount(0);
  await page.getByRole("link",{name:"Open case →"}).click();
  await expect(page.getByRole("heading",{name:"Eva Stone"})).toBeVisible();
});

test("dashboard employee search filters the table", async ({page})=>{
  await page.goto("/dashboard");
  await page.getByRole("textbox",{name:"Search dashboard employees"}).fill("Eva Stone");
  await expect(page.getByRole("link",{name:"Eva Stone"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Leo Marin"})).toHaveCount(0);
});

test("primary navigation pages render", async ({page})=>{
  const pages=[
    ["/dashboard","Onboarding command center"],
    ["/employees","Employees"],
    ["/evidence","Evidence"],
    ["/actions","Action center"],
    ["/knowledge","Knowledge repository"],
    ["/workspace","My workspace"],
    ["/assistant","AI assistant"],
  ] as const;
  for(const [path,heading] of pages){
    await page.goto(path);
    await expect(page.getByRole("heading",{name:heading})).toBeVisible();
  }
});

test("assistant answers from the real local LLM and cites database evidence", async ({page})=>{
  test.setTimeout(120_000);
  await page.goto("/assistant");
  await expect(page.getByText("Live local LLM · llama3.2:latest")).toBeVisible();
  const response = await page.request.post("/api/assistant", {data:{question:"What is blocking Leo's access?"},timeout:90_000});
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.answer).toEqual(expect.any(String));
  expect(result.answer.length).toBeGreaterThan(20);
  expect(result.evidenceIds).toContain("EMAIL-002");
});

test("evidence can be added and remains after reload", async ({page})=>{
  const evidenceId=`E2E-${Date.now()}`;
  const prisma=new PrismaClient();
  try{
    await page.goto("/evidence");
    await page.getByText("Add evidence",{exact:true}).click();
    await page.getByPlaceholder("Evidence ID").fill(evidenceId);
    await page.getByPlaceholder("Source title").fill("E2E evidence submission");
    await page.locator("textarea[name=content]").fill("A test source statement for persistence verification.");
    await page.getByRole("button",{name:"Save evidence"}).click();
    await expect(page.getByText(evidenceId,{exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByText(evidenceId,{exact:true})).toBeVisible();
  } finally {
    await prisma.auditLog.deleteMany({where:{entityId:evidenceId}});
    await prisma.evidence.deleteMany({where:{id:evidenceId}});
    await prisma.$disconnect();
  }
});

test("demo role switch persists after navigation", async ({page})=>{
  await page.goto("/dashboard");
  await page.getByLabel("Demo role").selectOption("TECH_LEAD");
  await expect(page.getByLabel("Demo role")).toHaveValue("TECH_LEAD");
  await page.goto("/employees");
  await expect(page.getByLabel("Demo role")).toHaveValue("TECH_LEAD");
});
