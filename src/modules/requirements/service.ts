import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditTimestamp, getEvaluationDate } from "@/lib/clock";
import { audit, type Actor } from "@/modules/audit";
import { recomputeCase } from "@/modules/case/recompute";
import { DecisionError } from "@/modules/detective/decisions";
import { assertAllowed, type Principal } from "@/modules/permissions";
import { evaluateCheckoff, SKILL_LEVELS } from "./checkoff";

/**
 * Onboarding requirements are defined per project by its Technical Lead. Syncing a project's requirements:
 *  - creates a status row per employee and requirement,
 *  - links KT_ACTIVITY requirements to KTActivity rows and ACCESS requirements to AccessRequest rows (no second tracking system),
 *  - applies the deterministic skill check-off rule (src/modules/requirements/checkoff.ts),
 * then recomputes the affected cases so gates and the roadmap update. Every check-off and undo is audited.
 */

const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });
const AUTO = "automatic skill check-off";

export async function syncRequirements(db: PrismaClient, input: { projectId: string; actor: Actor; trigger: string; personIds?: string[] }): Promise<string[]> {
  const [reqs, assignments] = await Promise.all([
    db.onboardingRequirement.findMany({ where: { projectId: input.projectId }, include: { skill: true } }),
    db.projectAssignment.findMany({ where: { projectId: input.projectId, role: "EMPLOYEE", status: "ACTIVE", ...(input.personIds ? { personId: { in: input.personIds } } : {}) }, include: { person: { include: { employee: true, skills: true } } } }),
  ]);
  const changed = new Set<string>();
  const at = auditTimestamp();
  for (const a of assignments) {
    const employee = a.person.employee;
    if (!employee) continue;
    for (const r of reqs) {
      if (r.status === "RETIRED") {
        const kt = await db.kTActivity.updateMany({ where: { employeeId: employee.id, requirementId: r.id, status: "CONFIRMED" }, data: { status: "REJECTED", originNote: "Requirement retired by the Technical Lead" } });
        const acc = await db.accessRequest.updateMany({ where: { employeeId: employee.id, requirementId: r.id, required: true }, data: { required: false } });
        if (kt.count || acc.count) changed.add(employee.id);
        continue;
      }
      let row = await db.employeeRequirementStatus.findUnique({ where: { employeeId_requirementId: { employeeId: employee.id, requirementId: r.id } } });
      if (!row) { row = await db.employeeRequirementStatus.create({ data: { employeeId: employee.id, requirementId: r.id, status: "TODO" } }); changed.add(employee.id); }

      if (r.type === "KT_ACTIVITY") {
        const kt = await db.kTActivity.findFirst({ where: { employeeId: employee.id, requirementId: r.id } });
        if (!kt) {
          await db.kTActivity.create({ data: { employeeId: employee.id, requirementId: r.id, title: r.title, description: r.description || r.title, scope: r.completionCriteria, scopeType: "CORE", stage: "NOT_STARTED", stageBasis: "UNKNOWN", status: "CONFIRMED", origin: "REQUIREMENT", originNote: "Onboarding requirement defined by the project's Technical Lead", requiredForReady: r.mandatory } });
          changed.add(employee.id);
        } else if (kt.title !== r.title || kt.requiredForReady !== r.mandatory || kt.status !== "CONFIRMED") {
          await db.kTActivity.update({ where: { id: kt.id }, data: { title: r.title, requiredForReady: r.mandatory, status: "CONFIRMED" } });
          changed.add(employee.id);
        }
      }
      if (r.type === "ACCESS") {
        const acc = await db.accessRequest.findFirst({ where: { employeeId: employee.id, requirementId: r.id } });
        if (!acc) {
          await db.accessRequest.create({ data: { employeeId: employee.id, requirementId: r.id, application: r.title, requiredScope: r.description || r.completionCriteria, status: "NOT_REQUESTED", required: r.mandatory, lastUpdate: getEvaluationDate() } });
          changed.add(employee.id);
        } else if (acc.required !== r.mandatory) {
          await db.accessRequest.update({ where: { id: acc.id }, data: { required: r.mandatory } });
          changed.add(employee.id);
        }
      }

      const result = evaluateCheckoff({ type: r.type, skillId: r.skillId, requiredLevel: r.requiredLevel }, a.person.skills);
      const undone = row.checkoffUndone && result.kind === "SATISFIED" && row.satisfiedBySkillId === result.recordId;
      if ((row.status === "TODO" || row.status === "IN_PROGRESS") && result.kind === "SATISFIED" && !undone) {
        const skill = a.person.skills.find((s) => s.id === result.recordId)!;
        await db.employeeRequirementStatus.update({ where: { id: row.id }, data: { status: "SATISFIED_BY_EXISTING_SKILL", satisfiedBySkillId: result.recordId, checkoffUndone: false, decidedById: "system", decidedAt: at, note: null } });
        await audit({
          actor: input.actor, action: "REQUIREMENT_CHECKED_OFF", entityType: "EmployeeRequirementStatus", entityId: row.id, employeeId: employee.id,
          before: { status: row.status }, after: { status: "SATISFIED_BY_EXISTING_SKILL", skillRecord: result.recordId },
          details: `${employee.name}: "${r.title}" ticked off — already has the confirmed skill ${r.skill?.name ?? ""} (${skill.level.toLowerCase()}). Rule: ${AUTO}, after ${input.trigger}.`,
        }, db);
        changed.add(employee.id);
      } else if (row.status === "SATISFIED_BY_EXISTING_SKILL" && result.kind !== "SATISFIED") {
        await db.employeeRequirementStatus.update({ where: { id: row.id }, data: { status: "TODO", satisfiedBySkillId: null, decidedById: "system", decidedAt: at, note: "The skill that covered this is no longer confirmed at the required level." } });
        await audit({
          actor: input.actor, action: "REQUIREMENT_STATUS_SET", entityType: "EmployeeRequirementStatus", entityId: row.id, employeeId: employee.id,
          before: { status: "SATISFIED_BY_EXISTING_SKILL" }, after: { status: "TODO" },
          details: `${employee.name}: "${r.title}" is no longer covered by a confirmed skill (${input.trigger}).`,
        }, db);
        changed.add(employee.id);
      }
    }
  }
  for (const id of changed) await recomputeCase(id, input.trigger, input.actor, db);
  return [...changed];
}

/** After a skill changes, re-check the person's active project. */
export async function syncForPerson(db: PrismaClient, personId: string, actor: Actor, trigger: string): Promise<void> {
  const active = await db.projectAssignment.findMany({ where: { personId, role: "EMPLOYEE", status: "ACTIVE" }, select: { projectId: true } });
  for (const a of active) await syncRequirements(db, { projectId: a.projectId, actor, trigger, personIds: [personId] });
}

export const RequirementSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(3, "Give the requirement a title").max(120),
  description: z.string().trim().max(500).optional().default(""),
  type: z.enum(["SKILL", "KT_ACTIVITY", "ACCESS", "DOCUMENT"]),
  skillId: z.string().min(1).nullish(),
  requiredLevel: z.enum(SKILL_LEVELS).nullish(),
  completionCriteria: z.string().trim().min(3, "Say how completion is judged").max(300),
  mandatory: z.boolean().default(true),
}).refine((r) => r.type !== "SKILL" || Boolean(r.skillId), "A skill requirement needs a linked skill");

export async function createRequirement(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<string> {
  const input = RequirementSchema.parse(raw);
  await assertAllowed(principal, "requirement.manage", { projectId: input.projectId }, db);
  if (input.skillId && !(await db.skill.findUnique({ where: { id: input.skillId } }))) throw new DecisionError("Unknown skill.");
  const at = auditTimestamp();
  const r = await db.onboardingRequirement.create({ data: { ...input, skillId: input.skillId ?? null, requiredLevel: input.skillId ? input.requiredLevel ?? "BASIC" : null, createdById: principal.userId, createdAt: at, status: "ACTIVE" } });
  await audit({ actor: actorOf(principal), action: "REQUIREMENT_CREATED", entityType: "OnboardingRequirement", entityId: r.id, after: { ...input }, details: `Requirement "${r.title}" (${r.type.toLowerCase().replace("_", " ")}) added to project ${input.projectId}.` }, db);
  await syncRequirements(db, { projectId: input.projectId, actor: actorOf(principal), trigger: `requirement "${r.title}" added` });
  return r.id;
}

export async function updateRequirement(id: string, raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const input = RequirementSchema.parse(raw);
  const r = await db.onboardingRequirement.findUnique({ where: { id } });
  if (!r || r.projectId !== input.projectId) throw new DecisionError("Unknown requirement.");
  await assertAllowed(principal, "requirement.manage", { projectId: r.projectId }, db);
  if (r.type !== input.type) throw new DecisionError("The type of a requirement can't change. Retire it and add a new one.");
  const before = { title: r.title, description: r.description, skillId: r.skillId, requiredLevel: r.requiredLevel, completionCriteria: r.completionCriteria, mandatory: r.mandatory };
  const after = { title: input.title, description: input.description, skillId: input.skillId ?? null, requiredLevel: input.skillId ? input.requiredLevel ?? "BASIC" : null, completionCriteria: input.completionCriteria, mandatory: input.mandatory };
  await db.onboardingRequirement.update({ where: { id }, data: { ...after, updatedAt: auditTimestamp() } });
  await audit({ actor: actorOf(principal), action: "REQUIREMENT_UPDATED", entityType: "OnboardingRequirement", entityId: id, before, after, details: `Requirement "${input.title}" edited.` }, db);
  await syncRequirements(db, { projectId: r.projectId, actor: actorOf(principal), trigger: `requirement "${input.title}" edited` });
}

export async function retireRequirement(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const input = z.object({ requirementId: z.string().min(1), reason: z.string().trim().min(3).max(500) }).parse(raw);
  const r = await db.onboardingRequirement.findUnique({ where: { id: input.requirementId } });
  if (!r || r.status === "RETIRED") throw new DecisionError("Unknown or already retired requirement.");
  await assertAllowed(principal, "requirement.manage", { projectId: r.projectId }, db);
  await db.onboardingRequirement.update({ where: { id: r.id }, data: { status: "RETIRED", updatedAt: auditTimestamp() } });
  await audit({ actor: actorOf(principal), action: "REQUIREMENT_RETIRED", entityType: "OnboardingRequirement", entityId: r.id, before: { status: "ACTIVE" }, after: { status: "RETIRED" }, details: `Requirement "${r.title}" retired: ${input.reason}` }, db);
  await syncRequirements(db, { projectId: r.projectId, actor: actorOf(principal), trigger: `requirement "${r.title}" retired` });
}

/** The Technical Lead records progress, waives a requirement, or undoes an automatic check-off (with a reason). */
export const StatusChangeSchema = z.object({ statusId: z.string().min(1), status: z.enum(["TODO", "IN_PROGRESS", "DONE", "WAIVED"]), reason: z.string().trim().max(500).optional() });

export async function setRequirementStatus(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const input = StatusChangeSchema.parse(raw);
  const row = await db.employeeRequirementStatus.findUnique({ where: { id: input.statusId }, include: { requirement: true, employee: { select: { name: true } } } });
  if (!row) throw new DecisionError("Unknown requirement status.");
  await assertAllowed(principal, "requirement.decide", { projectId: row.requirement.projectId }, db);
  const undo = row.status === "SATISFIED_BY_EXISTING_SKILL";
  if ((undo || input.status === "WAIVED") && (input.reason ?? "").length < 3) throw new DecisionError(undo ? "Give a reason for undoing the check-off." : "Give a reason for waiving the requirement.");
  await db.employeeRequirementStatus.update({ where: { id: row.id }, data: { status: input.status, checkoffUndone: undo ? true : row.checkoffUndone, decidedById: principal.userId, decidedAt: auditTimestamp(), note: input.reason || row.note } });
  await audit({
    actor: actorOf(principal), action: undo ? "REQUIREMENT_CHECKOFF_UNDONE" : "REQUIREMENT_STATUS_SET", entityType: "EmployeeRequirementStatus", entityId: row.id, employeeId: row.employeeId,
    before: { status: row.status, satisfiedBySkillId: row.satisfiedBySkillId }, after: { status: input.status },
    details: `${row.employee.name}: "${row.requirement.title}" ${row.status} → ${input.status}${input.reason ? ` — ${input.reason}` : ""}.`,
  }, db);
  await recomputeCase(row.employeeId, undo ? "skill check-off undone" : "requirement status changed", actorOf(principal), db);
}

/**
 * After a Technical Lead validates someone as ready, the project's SKILL requirements are proposed for the person's
 * profile. The Technical Lead confirms in one click; skills are added as CONFIRMED with source PREVIOUS_PROJECT.
 */
export async function proposedProfileSkills(employeeId: string, db: PrismaClient = prisma) {
  const e = await db.employee.findUnique({ where: { id: employeeId }, include: { case: true, person: { include: { skills: true } } } });
  if (!e?.projectId || !e.person || e.case?.phase !== "READY") return [];
  const reqs = await db.onboardingRequirement.findMany({ where: { projectId: e.projectId, type: "SKILL", status: "ACTIVE", skillId: { not: null } }, include: { skill: true } });
  return reqs.filter((r) => !e.person!.skills.some((s) => s.skillId === r.skillId && s.status === "CONFIRMED" && evaluateCheckoff(r, [s]).kind === "SATISFIED"))
    .map((r) => ({ requirementId: r.id, skillId: r.skillId!, skillName: r.skill!.name, level: r.requiredLevel ?? "BASIC" }));
}

export async function addProjectSkillsToProfile(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<number> {
  const { employeeId } = z.object({ employeeId: z.string().min(1) }).parse(raw);
  const e = await db.employee.findUnique({ where: { id: employeeId } });
  if (!e?.projectId || !e.personId) throw new DecisionError("Unknown case.");
  await assertAllowed(principal, "requirement.decide", { projectId: e.projectId }, db);
  await assertAllowed(principal, "validation.record", { employeeId }, db);
  const proposals = await proposedProfileSkills(employeeId, db);
  const at = auditTimestamp();
  for (const p of proposals) {
    const before = await db.employeeSkill.findUnique({ where: { personId_skillId: { personId: e.personId, skillId: p.skillId } } });
    const rec = await db.employeeSkill.upsert({
      where: { personId_skillId: { personId: e.personId, skillId: p.skillId } },
      update: { level: p.level, status: "CONFIRMED", source: "PREVIOUS_PROJECT", projectId: e.projectId, confirmedById: principal.userId, confirmedAt: at, updatedAt: at },
      create: { personId: e.personId, skillId: p.skillId, level: p.level, status: "CONFIRMED", source: "PREVIOUS_PROJECT", projectId: e.projectId, confirmedById: principal.userId, confirmedAt: at, createdAt: at },
    });
    await audit({ actor: actorOf(principal), action: "SKILL_CONFIRMED", entityType: "EmployeeSkill", entityId: rec.id, employeeId, before: before ? { status: before.status, level: before.level } : null, after: { status: "CONFIRMED", level: p.level, source: "PREVIOUS_PROJECT" }, details: `${e.name}: ${p.skillName} added to the profile after validated readiness on the project.` }, db);
  }
  return proposals.length;
}
