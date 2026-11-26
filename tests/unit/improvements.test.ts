import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { AIResponseError, setAIProviderForTests } from "../../src/ai/providers";
import { PermissionError, type Principal } from "../../src/modules/permissions";
import { createImprovement, updateImprovement } from "../../src/modules/improvements/service";
import { generateBriefing } from "../../src/modules/briefing/service";
import type { Section } from "../../src/modules/briefing/select";

const db = new PrismaClient();
afterEach(() => setAIProviderForTests(null));
afterAll(() => db.$disconnect());
const pmo: Principal = { userId: "demo-pmo", role: "PMO", employeeId: null, name: "Petra Lind" };
const marco: Principal = { userId: "demo-am", role: "ADDITIONAL_MANAGER", employeeId: null, name: "Marco Ruiz" };
const sara: Principal = { userId: "demo-lm-sara", role: "LINE_MANAGER", employeeId: null, name: "Sara Neri" };
const hr: Principal = { userId: "demo-hr", role: "HR", employeeId: null, name: "Hana Ilic" };

describe("improvements", () => {
  it("only the PMO creates and approves; the owning Additional Manager moves it forward with an outcome", async () => {
    const input = { title: "Name an owner for Helix provisioning", description: "Access requests for Helix have no provisioning owner; agree one with Access Support.", source: "INSIGHT", refs: ["figure:handling:ACCESS_SUPPORT", "case:ONB-002"], ownerPersonId: "P-S-AM-MARCO" };
    await expect(createImprovement(input, marco, db)).rejects.toBeInstanceOf(PermissionError);
    const id = await createImprovement(input, pmo, db);
    expect((await db.improvement.findUniqueOrThrow({ where: { id } })).status).toBe("PROPOSED");
    await expect(updateImprovement({ id, status: "APPROVED" }, marco, db)).rejects.toThrow(/Only the PMO approves/);
    await expect(updateImprovement({ id, status: "IN_PROGRESS" }, marco, db)).rejects.toThrow(/approved before work starts/);
    await updateImprovement({ id, status: "APPROVED" }, pmo, db);
    await expect(updateImprovement({ id, status: "IN_PROGRESS" }, sara, db)).rejects.toBeInstanceOf(PermissionError);
    await updateImprovement({ id, status: "IN_PROGRESS" }, marco, db);
    await expect(updateImprovement({ id, status: "DONE" }, marco, db)).rejects.toThrow(/outcome/);
    await updateImprovement({ id, status: "DONE", outcomeNote: "Access Support now owns Helix provisioning." }, marco, db);
    const row = await db.improvement.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("DONE");
    expect(JSON.parse(row.refs)).toContain("case:ONB-002");
    expect(await db.auditLog.count({ where: { entityType: "Improvement", entityId: id } })).toBe(4);
  });
});

describe("HR briefing", () => {
  it("covers the pre-boarding pipeline and start dates at risk", async () => {
    setAIProviderForTests({ model: () => "test", complete: async () => { throw new AIResponseError("down", 503, "UNAVAILABLE"); } });
    const b = await db.briefing.findUniqueOrThrow({ where: { id: await generateBriefing("HR", hr, db) } });
    const sections = JSON.parse(b.sectionsJson) as Section[];
    expect(sections.map((s) => s.key).slice(0, 2)).toEqual(["pipeline", "startDates"]);
    expect(sections.find((s) => s.key === "pipeline")!.statements.some((s) => s.text.includes("Noah Lane"))).toBe(true);
    expect(b.sectionsJson).not.toContain("Leo Marin");
  });
});
