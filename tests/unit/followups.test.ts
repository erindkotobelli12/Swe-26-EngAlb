import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { loadFollowUpQueue, createDrafts, approve, sendSimulated, recordResponse } from "../../src/modules/followups/service";
import { PermissionError, type Principal } from "../../src/modules/permissions";

const db = new PrismaClient();
afterAll(() => db.$disconnect());
const pmo: Principal = { userId: "demo-pmo", role: "PMO", employeeId: null, name: "PMO" };
const tl: Principal = { userId: "demo-tl", role: "TECH_LEAD", employeeId: null, name: "TL" };

describe("follow-up and escalation", () => {
  it("consolidates Leo's three access items into one Access Support message and a separate app-owner approval", async () => {
    const { groups } = await loadFollowUpQueue(db);
    const access = groups.find((g) => g.stakeholder.role === "ACCESS_SUPPORT")!;
    const leoItems = access.items.filter((i) => i.employeeName === "Leo Marin");
    expect(leoItems.map((i) => i.title.split(" — ")[0]).sort()).toEqual(["Helix Service Desk", "Nova VPN", "Orion Portal"]);
    expect(leoItems.find((i) => i.title.startsWith("Helix"))!.ask).toMatch(/who owns provisioning/);
    const approver = groups.find((g) => g.stakeholder.role === "APP_OWNER")!;
    expect(approver.items.map((i) => i.title)).toEqual(["Orion Portal — approval decision needed"]);
    expect(approver.stakeholder.label).toContain("Orion Portal");
  });

  it("routes Lina's unanswered EMAIL-005 to the Technical Manager, 6 days open", async () => {
    const { groups } = await loadFollowUpQueue(db);
    const tm = groups.find((g) => g.stakeholder.role === "TECH_MANAGER")!;
    const item = tm.items.find((i) => i.kind === "UNANSWERED_REQUEST")!;
    expect(item.employeeName).toBe("Lina West");
    expect(item.daysOpen).toBe(6);
    expect(item.requestEvidenceId).toBe("EMAIL-005");
    expect(item.escalationLevel).toBe(1);
  });

  it("applies escalation thresholds and orders groups by a transparent priority score", async () => {
    const { groups } = await loadFollowUpQueue(db);
    const helix = groups.flatMap((g) => g.items).find((i) => i.key.startsWith("access:ACC-LEO-HELIX"))!;
    expect(helix.daysOpen).toBe(7);
    expect(helix.escalationLevel).toBe(2);
    expect(helix.score).toBe(helix.breakdown.impact + helix.breakdown.severity + helix.breakdown.overdue + helix.breakdown.escalation);
    for (let i = 1; i < groups.length; i++) expect(groups[i - 1].score).toBeGreaterThanOrEqual(groups[i].score);
    const unowned = groups.find((g) => g.stakeholder.role === "PMO");
    expect(unowned?.items.some((i) => i.kind === "IDENTIFY_OWNER")).toBe(true);
  });

  it("only PMO approves; send is simulated; a response is recorded as pending evidence", async () => {
    await expect(createDrafts("ALL", tl, db)).rejects.toBeInstanceOf(PermissionError);
    const { groups } = await loadFollowUpQueue(db);
    const key = groups.find((g) => g.stakeholder.role === "TECH_MANAGER")!.stakeholder.key;
    await createDrafts([key], pmo, db);
    const draft = await db.communication.findFirstOrThrow({ where: { stakeholderKey: key, status: "DRAFT" } });
    await expect(approve(draft.id, tl, db)).rejects.toBeInstanceOf(PermissionError);
    await expect(sendSimulated(draft.id, pmo, db)).rejects.toThrow(/approved/);
    await approve(draft.id, pmo, db);
    await sendSimulated(draft.id, pmo, db);
    const sent = await db.communication.findUniqueOrThrow({ where: { id: draft.id } });
    expect(sent.status).toBe("SENT_SIMULATED");
    const outbox = await db.evidence.findFirstOrThrow({ where: { id: { startsWith: "OUT-" }, employeeId: "ONB-009" } });
    expect(outbox.isSimulated).toBe(true);
    const ev = await recordResponse({ id: draft.id, employeeId: "ONB-009", content: "Lina's KT owner will be confirmed by the Technical Lead this week." }, pmo, db);
    expect((await db.evidence.findUniqueOrThrow({ where: { id: ev } })).reviewStatus).toBe("PENDING_REVIEW");
    const lina = await db.finding.findFirst({ where: { caseId: "CASE-ONB-009", type: "UNANSWERED_REQUEST" } });
    expect(lina?.status).toBe("RESOLVED");
  });
});
