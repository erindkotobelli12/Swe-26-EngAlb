import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { PermissionError, resolveScope, type Principal } from "../../src/modules/permissions";
import { evaluateCheckoff } from "../../src/modules/requirements/checkoff";
import { createRequirement, setRequirementStatus } from "../../src/modules/requirements/service";
import { loadRequirementMatrix } from "../../src/modules/requirements/queries";
import { claimSkill, decideSkill } from "../../src/modules/skills/service";
import { loadCaseState } from "../../src/modules/case/loadCaseState";
import { evaluateReadiness } from "../../src/modules/readiness/evaluate";
import { buildBackbone } from "../../src/modules/roadmap/backbone";
import { recomputeCase } from "../../src/modules/case/recompute";
import { SYSTEM_ACTOR } from "../../src/modules/audit";

const db = new PrismaClient();
const ben: Principal = { userId: "demo-tl", role: "TECH_LEAD", employeeId: null, name: "Ben Okafor" };
const sara: Principal = { userId: "demo-lm-sara", role: "LINE_MANAGER", employeeId: null, name: "Sara Neri" };
const leo: Principal = { userId: "employee-leo", role: "EMPLOYEE", employeeId: "ONB-002", name: "Leo Marin" };
const LEO_PERSON = "P-EMP-ONB-002";

// Restore Leo's seeded state for other test files.
afterAll(async () => {
  const reqs = await db.onboardingRequirement.findMany({ where: { projectId: "NIMBUS" } });
  const ids = reqs.map((r) => r.id);
  await db.employeeRequirementStatus.deleteMany({ where: { requirementId: { in: ids } } });
  await db.dependency.deleteMany({ where: { employeeId: "ONB-002", OR: [{ fromId: { in: (await db.kTActivity.findMany({ where: { requirementId: { in: ids } } })).map((k) => k.id) } }] } });
  await db.kTActivity.deleteMany({ where: { requirementId: { in: ids } } });
  await db.onboardingRequirement.deleteMany({ where: { id: { in: ids } } });
  await db.employeeSkill.updateMany({ where: { personId: LEO_PERSON, skillId: "SK-SQL" }, data: { status: "CLAIMED", source: "SELF_DECLARED", level: "INTERMEDIATE", confirmedById: null, confirmedAt: null } });
  await db.employeeSkill.deleteMany({ where: { personId: LEO_PERSON, skillId: "SK-PYTHON" } });
  await recomputeCase("ONB-002", "test cleanup", SYSTEM_ACTOR, db);
  await db.$disconnect();
});

describe("automatic skill check-off rule", () => {
  const skills = [
    { id: "a", skillId: "S1", level: "INTERMEDIATE", status: "CONFIRMED" },
    { id: "b", skillId: "S2", level: "ADVANCED", status: "CLAIMED" },
    { id: "c", skillId: "S3", level: "ADVANCED", status: "REJECTED" },
  ];
  it("needs a CONFIRMED skill at the required level or higher", () => {
    expect(evaluateCheckoff({ type: "SKILL", skillId: "S1", requiredLevel: "BASIC" }, skills)).toEqual({ kind: "SATISFIED", recordId: "a" });
    expect(evaluateCheckoff({ type: "SKILL", skillId: "S1", requiredLevel: "INTERMEDIATE" }, skills).kind).toBe("SATISFIED");
    expect(evaluateCheckoff({ type: "SKILL", skillId: "S1", requiredLevel: "ADVANCED" }, skills).kind).toBe("NONE");
    expect(evaluateCheckoff({ type: "KT_ACTIVITY", skillId: "S1", requiredLevel: null }, skills).kind).toBe("SATISFIED");
  });
  it("a claimed skill is only 'possibly covered'; rejected skills and other types never count", () => {
    expect(evaluateCheckoff({ type: "SKILL", skillId: "S2", requiredLevel: "BASIC" }, skills)).toEqual({ kind: "POSSIBLY", recordId: "b" });
    expect(evaluateCheckoff({ type: "SKILL", skillId: "S3", requiredLevel: "BASIC" }, skills).kind).toBe("NONE");
    expect(evaluateCheckoff({ type: "DOCUMENT", skillId: "S1", requiredLevel: null }, skills).kind).toBe("NONE");
  });
});

describe("requirements on a project (Leo on Nimbus)", () => {
  it("only the project's Technical Lead defines requirements; a matching confirmed skill ticks one off", async () => {
    const triage = { projectId: "NIMBUS", title: "Incident triage", type: "SKILL", skillId: "SK-INCIDENT", requiredLevel: "INTERMEDIATE", completionCriteria: "Triages a P2 incident end to end", mandatory: true };
    await expect(createRequirement(triage, sara, db)).rejects.toBeInstanceOf(PermissionError);
    await createRequirement(triage, ben, db);
    const row = await db.employeeRequirementStatus.findFirstOrThrow({ where: { employeeId: "ONB-002", requirement: { title: "Incident triage" } } });
    expect(row.status).toBe("SATISFIED_BY_EXISTING_SKILL");
    const rec = await db.employeeSkill.findUniqueOrThrow({ where: { id: row.satisfiedBySkillId! } });
    expect(rec.skillId).toBe("SK-INCIDENT");
    expect(await db.auditLog.count({ where: { action: "REQUIREMENT_CHECKED_OFF", employeeId: "ONB-002" } })).toBe(1);

    // Counts toward the KT gates, never toward technical validation; Leo's Helix access story is unchanged.
    const state = (await loadCaseState("ONB-002", db, "2026-10-14"))!;
    const r = evaluateReadiness(state);
    expect(r.gates.find((g) => g.id === "KT_AGREED")!.status).toBe("SATISFIED");
    expect(r.gates.find((g) => g.id === "EXECUTION_OBSERVED")!.reasons.join(" ")).toMatch(/already has the confirmed skill Incident triage/);
    expect(r.gates.find((g) => g.id === "TECH_VALIDATION_APPROVED")!.status).toBe("UNSATISFIED");
    expect(r.assessed).toBe("BLOCKED");
    expect(state.access.find((a) => a.application === "Helix Service Desk")!.status).toBe("REQUESTED");
  });

  it("a claimed skill is 'possibly covered' until the Technical Lead confirms it; then the matrix updates", async () => {
    await createRequirement({ projectId: "NIMBUS", title: "SQL reporting", type: "SKILL", skillId: "SK-SQL", requiredLevel: "BASIC", completionCriteria: "Builds the weekly SLA report", mandatory: true }, ben, db);
    const scope = await resolveScope(ben, db);
    let m = (await loadRequirementMatrix("NIMBUS", scope, db))!;
    const sqlReq = m.requirements.find((x) => x.title === "SQL reporting")!;
    expect(m.cells[sqlReq.id]["ONB-002"].status).toBe("POSSIBLY_COVERED");
    const claimed = await db.employeeSkill.findUniqueOrThrow({ where: { personId_skillId: { personId: LEO_PERSON, skillId: "SK-SQL" } } });
    await expect(decideSkill({ skillRecordId: claimed.id, decision: "CONFIRM" }, leo, db)).rejects.toBeInstanceOf(PermissionError);
    await decideSkill({ skillRecordId: claimed.id, decision: "CONFIRM" }, ben, db);
    m = (await loadRequirementMatrix("NIMBUS", scope, db))!;
    expect(m.cells[sqlReq.id]["ONB-002"].status).toBe("SATISFIED_BY_EXISTING_SKILL");
    expect((await db.employeeSkill.findUniqueOrThrow({ where: { id: claimed.id } })).source).toBe("TL_CONFIRMED");
  });

  it("an employee can claim a skill on their own profile only; it stays claimed", async () => {
    await claimSkill({ personId: LEO_PERSON, skillId: "SK-PYTHON", level: "BASIC" }, leo, db);
    expect((await db.employeeSkill.findUniqueOrThrow({ where: { personId_skillId: { personId: LEO_PERSON, skillId: "SK-PYTHON" } } })).status).toBe("CLAIMED");
    await expect(claimSkill({ personId: "P-EMP-ONB-001", skillId: "SK-PYTHON", level: "BASIC" }, leo, db)).rejects.toBeInstanceOf(PermissionError);
  });

  it("the Technical Lead can undo a check-off with a reason; it is audited and not re-applied", async () => {
    const row = await db.employeeRequirementStatus.findFirstOrThrow({ where: { employeeId: "ONB-002", requirement: { title: "Incident triage" } } });
    await expect(setRequirementStatus({ statusId: row.id, status: "TODO" }, ben, db)).rejects.toThrow(/reason/);
    await setRequirementStatus({ statusId: row.id, status: "TODO", reason: "Incident process differs on Nimbus" }, ben, db);
    // Another requirement change re-runs the rule; the undone check-off stays undone.
    await createRequirement({ projectId: "NIMBUS", title: "Read the Nimbus runbook", type: "DOCUMENT", completionCriteria: "Runbook read and discussed", mandatory: false }, ben, db);
    expect((await db.employeeRequirementStatus.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("TODO");
    expect(await db.auditLog.count({ where: { action: "REQUIREMENT_CHECKOFF_UNDONE", employeeId: "ONB-002" } })).toBe(1);
  });

  it("KT requirements create KT activities; a skill-covered one is skipped on the roadmap", async () => {
    await createRequirement({ projectId: "NIMBUS", title: "Change process walkthrough", type: "KT_ACTIVITY", skillId: "SK-ITIL-CHANGE", requiredLevel: "BASIC", completionCriteria: "Raises a standard change", mandatory: true }, ben, db);
    const kt = await db.kTActivity.findFirstOrThrow({ where: { employeeId: "ONB-002", title: "Change process walkthrough" } });
    expect(kt.requirementId).not.toBeNull();
    const state = (await loadCaseState("ONB-002", db, "2026-10-14"))!;
    expect(state.kt.find((k) => k.id === kt.id)!.coveredBySkill?.skillName).toBe("ITIL change management");
    const item = buildBackbone(state, evaluateReadiness(state)).find((i) => i.key === `kt:${kt.id}`)!;
    expect(item.status).toBe("DONE");
    expect(item.completion).toMatch(/Skipped: already has the confirmed skill/);
    expect(evaluateReadiness(state).assessed).toBe("BLOCKED");
  });
});
