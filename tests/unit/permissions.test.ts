import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { can, PermissionError, resolveScope, type Principal, type Scope } from "../../src/modules/permissions";
import { confirmOwnAccessUsable } from "../../src/modules/access/confirmUsable";
import { reviewClaim } from "../../src/modules/evidence/pipeline";
import { recordValidation } from "../../src/modules/validation/recordValidation";

const db = new PrismaClient();
afterAll(() => db.$disconnect());

// Seeded demo accounts (see prisma/seed-data/sample.ts).
const pmo: Principal = { userId: "demo-pmo", role: "PMO", employeeId: null, name: "Petra Lind" };
const am: Principal = { userId: "demo-am", role: "ADDITIONAL_MANAGER", employeeId: null, name: "Marco Ruiz" };
const sara: Principal = { userId: "demo-lm-sara", role: "LINE_MANAGER", employeeId: null, name: "Sara Neri" };
const tl: Principal = { userId: "demo-tl", role: "TECH_LEAD", employeeId: null, name: "Ben Okafor" };
const hr: Principal = { userId: "demo-hr", role: "HR", employeeId: null, name: "Hana Ilic" };
const iva: Principal = { userId: "demo-lm-tl", role: "LINE_MANAGER", employeeId: null, name: "Iva Duka" };
const leo: Principal = { userId: "employee-leo", role: "EMPLOYEE", employeeId: "ONB-002", name: "Leo Marin" };
const mila: Principal = { userId: "employee-mila", role: "EMPLOYEE", employeeId: "ONB-001", name: "Mila Rowan" };

/** Hand-built scope for pure rule tests (no database). */
function scopeOf(partial: Partial<Scope> & { role?: Principal["role"] }): Scope {
  const { role = "LINE_MANAGER", ...rest } = partial;
  return { principal: { userId: "u", role, employeeId: null, name: "Test", personId: "P-X" }, personId: "P-X", isPMO: role === "PMO", isHR: role === "HR", projectRoles: {}, cases: {}, people: {}, ...rest };
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

describe("scoped permissions: role + relationship + phase", () => {
  it("one person can be both Line Manager and Technical Lead on the same project", async () => {
    const both = scopeOf({
      projectRoles: { P1: ["LINE_MANAGER", "TECH_LEAD"] },
      cases: {
        E1: { employeeId: "E1", personId: "PE1", projectId: "P1", phase: "ONBOARDING", relations: ["LM", "TL"] },
        E2: { employeeId: "E2", personId: "PE2", projectId: "P1", phase: "PRE_BOARDING", relations: ["LM"] },
      },
      people: { PE1: ["LM", "TL"], PE2: ["LM", "TL"] },
    });
    // As Technical Lead (onboarding phase): validation, technical findings, requirements, skills.
    expect(can(both, "validation.record", { employeeId: "E1" })).toBe(true);
    expect(can(both, "finding.decide", { employeeId: "E1", findingCategory: "CONFLICT" })).toBe(true);
    expect(can(both, "requirement.manage", { projectId: "P1" })).toBe(true);
    expect(can(both, "skill.confirm", { personId: "PE2" })).toBe(true);
    // As Line Manager (pre-boarding phase): pre-boarding items and the hand-over, but no validation.
    expect(can(both, "preboarding.update", { employeeId: "E2" })).toBe(true);
    expect(can(both, "handover.confirm", { employeeId: "E2" })).toBe(true);
    expect(can(both, "validation.record", { employeeId: "E2" })).toBe(false);
    // Seeded: Iva Duka holds both roles on Lumen.
    const s = await resolveScope(iva, db);
    expect(s.projectRoles.LUMEN?.sort()).toEqual(["LINE_MANAGER", "TECH_LEAD"]);
  });

  it("a Line Manager cannot see another manager's employee", async () => {
    const s = await resolveScope(sara, db);
    expect(Object.keys(s.cases)).toEqual(["ONB-002"]);
    expect(s.cases["ONB-002"].relations).toContain("LM");
    expect(can(s, "case.view", { employeeId: "ONB-001" })).toBe(false);
    expect(can(s, "finding.decide", { employeeId: "ONB-001", findingCategory: "ACCESS" })).toBe(false);
    // Non-technical findings about her own employee: yes. Technical ones belong to the Technical Lead.
    expect(can(s, "finding.decide", { employeeId: "ONB-002", findingCategory: "ACCESS" })).toBe(true);
    expect(can(s, "finding.decide", { employeeId: "ONB-002", findingCategory: "CONFLICT" })).toBe(false);
  });

  it("HR sees everyone in pre-boarding but cannot edit an onboarding-phase case", async () => {
    const s = await resolveScope(hr, db);
    expect(Object.keys(s.cases)).toEqual(["ONB-006"]);
    expect(s.cases["ONB-006"].phase).toBe("PRE_BOARDING");
    expect(can(s, "preboarding.update", { employeeId: "ONB-006" })).toBe(true);
    expect(can(s, "evidence.review", { employeeId: "ONB-006" })).toBe(true);
    for (const p of ["preboarding.update", "evidence.review", "dependency.decide", "case.view"] as const) expect(can(s, p, { employeeId: "ONB-002" })).toBe(false);
    expect(can(s, "finding.decide", { employeeId: "ONB-002", findingCategory: "ACCESS" })).toBe(false);
  });

  it("an Additional Manager sees only their own projects' managers and teams", async () => {
    const s = await resolveScope(am, db);
    expect(Object.keys(s.cases).sort()).toEqual(["ONB-001", "ONB-002", "ONB-005", "ONB-010"]);
    expect(s.people["P-LM-SARA-NERI"]).toContain("AM");
    expect(s.people["P-LM-MAYA-FORD"]).toBeUndefined();
    expect(can(s, "project.chooseTechLead", { projectId: "NIMBUS" })).toBe(true);
    expect(can(s, "project.chooseTechLead", { projectId: "ATLAS" })).toBe(false);
    expect(can(s, "validation.record", { employeeId: "ONB-002" })).toBe(false);
  });

  it("an employee sees only themselves", async () => {
    const s = await resolveScope(leo, db);
    expect(Object.keys(s.cases)).toEqual(["ONB-002"]);
    expect(can(s, "case.view", { employeeId: "ONB-001" })).toBe(false);
    expect(can(s, "profile.view", { personId: "P-EMP-ONB-001" })).toBe(false);
    expect(can(s, "profile.view", { personId: "P-EMP-ONB-002" })).toBe(true);
    expect(can(s, "skill.claim", { personId: "P-EMP-ONB-002" })).toBe(true);
    expect(can(s, "skill.claim", { personId: "P-EMP-ONB-001" })).toBe(false);
  });

  it("the PMO sees every case but cannot approve a follow-up or record a validation", async () => {
    const s = await resolveScope(pmo, db);
    expect(Object.keys(s.cases)).toHaveLength(10);
    expect(can(s, "communication.approve", { employeeIds: ["ONB-002"] })).toBe(false);
    expect(can(s, "validation.record", { employeeId: "ONB-005" })).toBe(false);
    expect(can(s, "finding.decide", { employeeId: "ONB-005", findingCategory: "CONFLICT" })).toBe(false);
    expect(can(s, "evidence.review", { employeeId: "ONB-002" })).toBe(false);
    expect(can(s, "project.manage")).toBe(true);
    expect(can(s, "improvement.create")).toBe(true);
    await expect(recordValidation({ employeeId: "ONB-005", state: "NEEDS_MORE_EVIDENCE", evidenceIds: ["EMAIL-003"], comment: "Not enough observed execution yet." }, pmo, db)).rejects.toBeInstanceOf(PermissionError);
  });

  it("only the project's Technical Lead records validation", async () => {
    const s = await resolveScope(tl, db);
    expect(can(s, "validation.record", { employeeId: "ONB-002" })).toBe(true); // Nimbus
    expect(can(s, "validation.record", { employeeId: "ONB-005" })).toBe(false); // Orion has its own Technical Lead
    for (const p of [pmo, am, sara, hr, mila]) expect(can(await resolveScope(p, db), "validation.record", { employeeId: "ONB-002" })).toBe(false);
  });

  it("follow-ups are approved by the phase owner or the employee's Line Manager, never the PMO", async () => {
    expect(can(await resolveScope(tl, db), "communication.approve", { employeeIds: ["ONB-002"] })).toBe(true);
    expect(can(await resolveScope(sara, db), "communication.approve", { employeeIds: ["ONB-002"] })).toBe(true);
    expect(can(await resolveScope(sara, db), "communication.approve", { employeeIds: ["ONB-002", "ONB-001"] })).toBe(false);
    expect(can(await resolveScope(pmo, db), "communication.approve", { employeeIds: ["ONB-002"] })).toBe(false);
  });

  it("an employee can confirm only their own access usability", async () => {
    expect(can(await resolveScope(mila, db), "access.confirmUsable", { employeeId: "ONB-001" })).toBe(true);
    expect(can(await resolveScope(mila, db), "access.confirmUsable", { employeeId: "ONB-002" })).toBe(false);
    expect(can(await resolveScope(pmo, db), "access.confirmUsable", { employeeId: "ONB-002" })).toBe(false);
    await expect(confirmOwnAccessUsable("ACC-LEO-NOVA", mila, db)).rejects.toBeInstanceOf(PermissionError);
    expect((await db.accessRequest.findUniqueOrThrow({ where: { id: "ACC-LEO-NOVA" } })).status).toBe("PROVISIONED");
  });

  it("KT-stage claims need the case's Technical Lead", async () => {
    const ev = await db.evidence.create({ data: { id: `PERM-${Date.now()}`, title: "t", sourceType: "EMAIL", senderRole: "TECH_LEAD", timestamp: "2026-10-14", content: "Eva handled the complex scenarios independently.", employeeId: "ONB-005", caseId: "CASE-ONB-005" } });
    const claim = await db.evidenceClaim.create({ data: { evidenceId: ev.id, entity: "ONB-005", field: "kt.Complex scenarios.stage", extractedValue: "INDEPENDENT_EXECUTION", excerpt: "handled the complex scenarios independently", excerptVerified: true, origin: "HUMAN" } });
    await expect(reviewClaim({ claimId: claim.id, decision: "APPROVE" }, pmo, db)).rejects.toBeInstanceOf(PermissionError);
    await expect(reviewClaim({ claimId: claim.id, decision: "APPROVE" }, tl, db)).rejects.toBeInstanceOf(PermissionError);
    await db.evidenceClaim.delete({ where: { id: claim.id } });
    await db.evidence.delete({ where: { id: ev.id } });
  });

  it("AI modules have no import path to decision, phase, skill, requirement, assignment or improvement code", () => {
    const aiFiles = filesUnder(path.resolve(__dirname, "../../src/ai"));
    const forbidden = /from\s+["'](@\/server\/actions|@\/modules\/validation|@\/modules\/phase|@\/modules\/projects|@\/modules\/preboarding|@\/modules\/skills|@\/modules\/requirements|@\/modules\/improvements|@\/modules\/followups\/send|@\/modules\/evidence\/fieldMapper["']|@\/modules\/case\/recompute)/;
    const offenders = aiFiles.filter((f) => forbidden.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("no claim field can set readiness validation or phase", async () => {
    const { parseField } = await import("../../src/modules/evidence/fieldMapper");
    for (const f of ["case.validatedStatus", "readiness.validated", "validation.state", "readinessValidation.APPROVED", "case.phase", "onboarding.phase"]) expect(parseField(f).kind).toBe("INFO");
  });
});
