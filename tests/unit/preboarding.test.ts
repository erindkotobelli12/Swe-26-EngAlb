import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PermissionError, type Principal } from "../../src/modules/permissions";
import { confirmHandover, updatePreboardingItem } from "../../src/modules/preboarding/service";

const db = new PrismaClient();
const NOAH = "ONB-006"; // official case in pre-boarding; Line Manager (tracker) Maya Ford
const hr: Principal = { userId: "demo-hr", role: "HR", employeeId: null, name: "Hana Ilic" };
const sara: Principal = { userId: "demo-lm-sara", role: "LINE_MANAGER", employeeId: null, name: "Sara Neri" };
const maya: Principal = { userId: "test-maya", role: "LINE_MANAGER", employeeId: null, name: "Maya Ford", personId: "P-LM-MAYA-FORD" };
let original: { id: string; status: string; blockerReason: string | null }[] = [];

beforeAll(async () => {
  await db.user.upsert({ where: { id: maya.userId }, update: {}, create: { id: maya.userId, name: maya.name, email: "maya.test@onboardiq.demo", role: "LINE_MANAGER", personId: "P-LM-MAYA-FORD" } });
  original = await db.preboardingItem.findMany({ where: { employeeId: NOAH }, select: { id: true, status: true, blockerReason: true } });
});
// Restore the seeded state so other test files see Noah in pre-boarding.
afterAll(async () => {
  for (const o of original) await db.preboardingItem.update({ where: { id: o.id }, data: { status: o.status, blockerReason: o.blockerReason } });
  await db.onboardingCase.update({ where: { employeeId: NOAH }, data: { phase: "PRE_BOARDING" } });
  await db.$disconnect();
});

describe("pre-boarding and the hand-over to onboarding", () => {
  it("HR and the employee's Line Manager update items; another Line Manager cannot", async () => {
    const item = await db.preboardingItem.findFirstOrThrow({ where: { employeeId: NOAH, templateKey: "equipment" } });
    await expect(updatePreboardingItem({ itemId: item.id, status: "DONE" }, sara, db)).rejects.toBeInstanceOf(PermissionError);
    await updatePreboardingItem({ itemId: item.id, status: "IN_PROGRESS" }, hr, db);
    await updatePreboardingItem({ itemId: item.id, status: "DONE" }, maya, db);
    expect((await db.preboardingItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("DONE");
    await expect(updatePreboardingItem({ itemId: item.id, status: "BLOCKED" }, hr, db)).rejects.toThrow(/blocking/);
    expect(await db.auditLog.count({ where: { action: "PREBOARDING_ITEM_UPDATED", employeeId: NOAH } })).toBeGreaterThanOrEqual(2);
  });

  it("the hand-over requires HR's items to be complete and the Line Manager's confirmation", async () => {
    await expect(confirmHandover({ employeeId: NOAH }, maya, db)).rejects.toThrow(/HR still has open items/);
    for (const i of await db.preboardingItem.findMany({ where: { employeeId: NOAH, ownerRole: "HR" } })) {
      if (i.status !== "DONE") await updatePreboardingItem({ itemId: i.id, status: "DONE" }, hr, db);
    }
    await expect(confirmHandover({ employeeId: NOAH }, hr, db)).rejects.toBeInstanceOf(PermissionError);
    await expect(confirmHandover({ employeeId: NOAH }, sara, db)).rejects.toBeInstanceOf(PermissionError);
    await confirmHandover({ employeeId: NOAH, note: "Laptop delivered, HR paperwork signed" }, maya, db);
    expect((await db.onboardingCase.findUniqueOrThrow({ where: { employeeId: NOAH } })).phase).toBe("ONBOARDING");
    const change = await db.auditLog.findFirstOrThrow({ where: { action: "PHASE_CHANGED", employeeId: NOAH }, orderBy: { timestamp: "desc" } });
    expect(change.actorLabel).toContain("Maya Ford");
    expect(JSON.parse(change.after!)).toEqual({ phase: "ONBOARDING" });
    // HR's scope ends at the hand-over.
    const item = await db.preboardingItem.findFirstOrThrow({ where: { employeeId: NOAH, templateKey: "welcome" } });
    await expect(updatePreboardingItem({ itemId: item.id, status: "TODO" }, hr, db)).rejects.toBeInstanceOf(PermissionError);
  });
});
