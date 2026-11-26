import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadFollowUpQueue, createDrafts, approve, sendSimulated, recordResponse } from "../../src/modules/followups/service";
import { PermissionError, type Principal } from "../../src/modules/permissions";
import { recomputeCase } from "../../src/modules/case/recompute";
import { SYSTEM_ACTOR } from "../../src/modules/audit";

const db = new PrismaClient();
// Undo this file's writes (draft, simulated outbox and response) so other test files see the seeded state.
afterAll(async () => {
  const comms = await db.communication.findMany({ where: { createdBy: "Nina Cross" } });
  const evidenceIds = comms.flatMap((c) => [...JSON.parse(c.outboxEvidenceIds) as string[], ...(c.responseEvidenceId ? [c.responseEvidenceId] : [])]);
  await db.evidenceClaim.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
  await db.evidence.deleteMany({ where: { id: { in: evidenceIds } } });
  await db.communication.deleteMany({ where: { id: { in: comms.map((c) => c.id) } } });
  await recomputeCase("ONB-009", "test cleanup", SYSTEM_ACTOR, db);
  await db.$disconnect();
});
const pmo: Principal = { userId: "demo-pmo", role: "PMO", employeeId: null, name: "Petra Lind" };
const tl: Principal = { userId: "demo-tl", role: "TECH_LEAD", employeeId: null, name: "Ben Okafor" };
// Lina West has no project (so no Technical Lead); her Line Manager from the tracker is Nina Cross.
const nina: Principal = { userId: "test-nina", role: "LINE_MANAGER", employeeId: null, name: "Nina Cross", personId: "P-LM-NINA-CROSS" };
beforeAll(async () => {
  await db.user.upsert({ where: { id: nina.userId }, update: {}, create: { id: nina.userId, name: nina.name, email: "nina.test@onboardiq.demo", role: "LINE_MANAGER", personId: "P-LM-NINA-CROSS" } });
});

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

  it("escalation goes up the hierarchy: Line Manager → Additional Manager → PMO", async () => {
    const { groups } = await loadFollowUpQueue(db);
    const toLm = groups.find((g) => g.stakeholder.role === "LINE_MANAGER" && g.escalationLevel === 2);
    if (toLm) expect(toLm.escalationRecommendation).toContain("the Additional Manager");
    const access = groups.find((g) => g.stakeholder.role === "ACCESS_SUPPORT")!;
    expect(access.escalationRecommendation).toContain("the employee's Line Manager");
  });

  it("the PMO and unrelated Technical Leads cannot approve; the employee's Line Manager does; send is simulated; a response is recorded as pending evidence", async () => {
    const { groups } = await loadFollowUpQueue(db);
    const key = groups.find((g) => g.stakeholder.role === "TECH_MANAGER")!.stakeholder.key;
    await expect(createDrafts([key], pmo, db)).rejects.toBeInstanceOf(PermissionError);
    await expect(createDrafts([key], tl, db)).rejects.toBeInstanceOf(PermissionError);
    await createDrafts([key], nina, db);
    const draft = await db.communication.findFirstOrThrow({ where: { stakeholderKey: key, status: "DRAFT" } });
    await expect(approve(draft.id, tl, db)).rejects.toBeInstanceOf(PermissionError);
    await expect(approve(draft.id, pmo, db)).rejects.toBeInstanceOf(PermissionError);
    await expect(sendSimulated(draft.id, nina, db)).rejects.toThrow(/approved/);
    await approve(draft.id, nina, db);
    await sendSimulated(draft.id, nina, db);
    const sent = await db.communication.findUniqueOrThrow({ where: { id: draft.id } });
    expect(sent.status).toBe("SENT_SIMULATED");
    const outbox = await db.evidence.findFirstOrThrow({ where: { id: { startsWith: "OUT-" }, employeeId: "ONB-009" } });
    expect(outbox.isSimulated).toBe(true);
    const ev = await recordResponse({ id: draft.id, employeeId: "ONB-009", content: "Lina's KT owner will be confirmed by the Technical Lead this week." }, nina, db);
    expect((await db.evidence.findUniqueOrThrow({ where: { id: ev } })).reviewStatus).toBe("PENDING_REVIEW");
    const lina = await db.finding.findFirst({ where: { caseId: "CASE-ONB-009", type: "UNANSWERED_REQUEST" } });
    expect(lina?.status).toBe("RESOLVED");
  });
});
