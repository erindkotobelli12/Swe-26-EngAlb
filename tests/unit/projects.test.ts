import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { PermissionError, resolveScope, type Principal } from "../../src/modules/permissions";
import { projectHealth } from "../../src/modules/projects/health";
import { loadProjectSummaries } from "../../src/modules/projects/queries";
import { chooseTechLead, createProject, endAssignment } from "../../src/modules/projects/service";

const db = new PrismaClient();
afterAll(() => db.$disconnect());

const pmo: Principal = { userId: "demo-pmo", role: "PMO", employeeId: null, name: "Petra Lind" };
const marco: Principal = { userId: "demo-am", role: "ADDITIONAL_MANAGER", employeeId: null, name: "Marco Ruiz" };
const iva: Principal = { userId: "demo-lm-tl", role: "LINE_MANAGER", employeeId: null, name: "Iva Duka" };
const base = { employeesByPhase: { PRE_BOARDING: 0, ONBOARDING: 2, READY: 0, CLOSED: 0 }, criticalFindings: 0, highFindings: 0, accessNotUsable: 0, overdueFollowUps: 0, staleCases: 0, pendingValidations: 0, missingRoles: [] as ("TECH_LEAD" | "LINE_MANAGER" | "ADDITIONAL_MANAGER")[] };

describe("project health (deterministic, with reasons, no percentages)", () => {
  it("classifies from counts and explains itself", () => {
    expect(projectHealth({ ...base, employeesByPhase: { PRE_BOARDING: 0, ONBOARDING: 0, READY: 0, CLOSED: 1 } }).status).toBe("NOT_STARTED");
    expect(projectHealth(base).status).toBe("ON_TRACK");
    const critical = projectHealth({ ...base, criticalFindings: 1, highFindings: 2 });
    expect(critical.status).toBe("CRITICAL");
    expect(critical.headline).toBe("1 critical finding open");
    const gap = projectHealth({ ...base, missingRoles: ["TECH_LEAD"] });
    expect(gap.status).toBe("AT_RISK");
    expect(gap.reasons.map((r) => r.text)).toContain("No Technical Lead assigned");
    for (const r of critical.reasons) expect(r.text).not.toMatch(/%/);
  });

  it("Nimbus is At risk and Orion is Critical, with visible reasons", async () => {
    const all = await loadProjectSummaries(await resolveScope(pmo, db), db);
    const nimbus = all.find((p) => p.name === "Nimbus")!;
    expect(nimbus.health.status).toBe("AT_RISK");
    expect(nimbus.health.reasons.map((r) => r.text).join(" ")).toMatch(/access items? not working/);
    expect(all.find((p) => p.name === "Orion")!.health.status).toBe("CRITICAL");
    expect(all.find((p) => p.name === "Helios")!.health.reasons.map((r) => r.text)).toEqual(expect.arrayContaining(["No Line Manager assigned", "No Technical Lead assigned"]));
  });
});

describe("projects: creation, Technical Lead, assignments", () => {
  it("only the PMO creates projects; employees start in pre-boarding with the default checklist", async () => {
    const input = {
      details: { name: "Test Borealis", code: "BOR-1", description: "", startDate: "2026-11-02" },
      additionalManagerId: "P-S-AM-MARCO", lineManagerIds: ["P-S-IVA"],
      employees: [{ personId: "P-S-RINA", lineManagerId: "P-S-IVA" }, { newName: "Test New Person", lineManagerId: "P-S-IVA" }],
    };
    await expect(createProject(input, marco, db)).rejects.toBeInstanceOf(PermissionError);
    const id = await createProject(input, pmo, db);
    const assignments = await db.projectAssignment.findMany({ where: { projectId: id }, include: { person: true } });
    expect(assignments.map((a) => a.role).sort()).toEqual(["ADDITIONAL_MANAGER", "EMPLOYEE", "EMPLOYEE", "LINE_MANAGER"]);
    const rina = assignments.find((a) => a.personId === "P-S-RINA")!;
    expect(rina.movement).toBe("Reallocation"); // derived from her completed Cirrus assignment
    expect(assignments.find((a) => a.person.name === "Test New Person")!.movement).toBe("New Hire");
    const cases = await db.employee.findMany({ where: { projectId: id }, include: { case: true, preboarding: true } });
    expect(cases).toHaveLength(2);
    for (const c of cases) {
      expect(c.case!.phase).toBe("PRE_BOARDING");
      expect(c.preboarding).toHaveLength(7);
      expect(c.lineManagerId).toBe("P-S-IVA");
    }
    expect(await db.auditLog.count({ where: { action: "ASSIGNMENT_CREATED", details: { contains: "Test Borealis" } } })).toBe(4);

    // The Additional Manager chooses the Line Manager as Technical Lead; another person cannot.
    await expect(chooseTechLead({ projectId: id, personId: "P-S-IVA" }, pmo, db)).rejects.toBeInstanceOf(PermissionError);
    await chooseTechLead({ projectId: id, personId: "P-S-IVA" }, marco, db);
    const ivaScope = await resolveScope(iva, db);
    expect(ivaScope.projectRoles[id]?.sort()).toEqual(["LINE_MANAGER", "TECH_LEAD"]);
    expect((await db.employee.findFirstOrThrow({ where: { projectId: id, personId: "P-S-RINA" } })).technicalLeadId).toBe("P-S-IVA");

    // Ending an assignment keeps it (with an end date and reason) and closes the case.
    await expect(endAssignment({ assignmentId: rina.id, outcome: "REMOVED", reason: "x" }, pmo, db)).rejects.toThrow();
    await endAssignment({ assignmentId: rina.id, outcome: "REMOVED", reason: "Assigned by mistake" }, pmo, db);
    const ended = await db.projectAssignment.findUniqueOrThrow({ where: { id: rina.id } });
    expect(ended.status).toBe("REMOVED");
    expect(ended.endReason).toBe("Assigned by mistake");
    expect((await db.onboardingCase.findFirstOrThrow({ where: { employee: { personId: "P-S-RINA" } } })).phase).toBe("CLOSED");
    expect(await db.auditLog.count({ where: { action: "PHASE_CHANGED", details: { contains: "Rina Kola" } } })).toBeGreaterThan(0);
  });
});
