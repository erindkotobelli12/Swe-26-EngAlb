import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditTimestamp, getEvaluationDate } from "@/lib/clock";
import { audit, type Actor } from "@/modules/audit";
import { recomputeCase } from "@/modules/case/recompute";
import { DecisionError } from "@/modules/detective/decisions";
import { assertAllowed, type Principal } from "@/modules/permissions";
import { changePhase } from "@/modules/phase/transition";
import { createDefaultChecklist } from "@/modules/preboarding/service";
import { syncRequirements } from "@/modules/requirements/service";

/**
 * Project and assignment management. Only humans call this (PMO for projects and people, the project's Additional
 * Manager for the Technical Lead). Assignments are never hard-deleted: ending one sets its status, end date and
 * reason, and every change is audited with before/after values.
 */

const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format");

export const ProjectDetailsSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
  code: z.string().trim().max(20).optional().transform((v) => v || null),
  description: z.string().trim().max(500).optional().transform((v) => v || null),
  startDate: isoDate.optional().or(z.literal("")).transform((v) => v || null),
});

const EmployeePick = z.object({
  personId: z.string().min(1).optional(),
  newName: z.string().trim().min(2).max(80).optional(),
  lineManagerId: z.string().min(1, "Choose a Line Manager for every employee"),
  movement: z.enum(["New Hire", "Reallocation"]).optional(),
}).refine((e) => Boolean(e.personId) !== Boolean(e.newName), "Pick an existing person or type a new name");

export const ProjectInputSchema = z.object({
  details: ProjectDetailsSchema,
  additionalManagerId: z.string().min(1, "Choose an Additional Manager"),
  lineManagerIds: z.array(z.string().min(1)).min(1, "Choose at least one Line Manager"),
  employees: z.array(EmployeePick).max(40),
}).refine((p) => p.employees.every((e) => p.lineManagerIds.includes(e.lineManagerId)), "Each employee must report to one of the project's Line Managers");
export type ProjectInput = z.infer<typeof ProjectInputSchema>;

function slugId(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "PROJECT";
}

async function uniqueProjectId(db: PrismaClient, name: string): Promise<string> {
  const base = slugId(name);
  for (let i = 1; i < 100; i++) {
    const id = i === 1 ? base : `${base}-${i}`;
    if (!(await db.project.findUnique({ where: { id } }))) return id;
  }
  throw new DecisionError("Could not create a unique project id.");
}

async function requirePerson(db: PrismaClient, id: string, what: string) {
  const p = await db.person.findUnique({ where: { id } });
  if (!p?.name) throw new DecisionError(`Unknown ${what}.`);
  return p;
}

/** Validates every referenced person before anything is written, so a failed save writes nothing. */
async function validatePeople(db: PrismaClient, input: ProjectInput) {
  await requirePerson(db, input.additionalManagerId, "Additional Manager");
  for (const id of input.lineManagerIds) await requirePerson(db, id, "Line Manager");
  const seen = new Set<string>();
  for (const e of input.employees) {
    if (!e.personId) continue;
    if (seen.has(e.personId)) throw new DecisionError("The same person was added twice.");
    seen.add(e.personId);
    const p = await requirePerson(db, e.personId, "employee");
    const active = await db.projectAssignment.findFirst({ where: { personId: p.id, role: "EMPLOYEE", status: "ACTIVE" }, include: { project: true } });
    if (active) throw new DecisionError(`${p.name} is already assigned to ${active.project.name}. End that assignment first.`);
    const existing = await db.employee.findUnique({ where: { personId: p.id }, include: { case: true } });
    if (existing?.case && existing.case.phase !== "CLOSED") throw new DecisionError(`${p.name} already has an open onboarding case.`);
  }
}

async function assignEmployee(db: PrismaClient, project: { id: string; name: string; startDate: string | null }, pick: ProjectInput["employees"][number], actor: Actor, at: string): Promise<string> {
  const lm = await requirePerson(db, pick.lineManagerId, "Line Manager");
  const person = pick.personId
    ? await requirePerson(db, pick.personId, "employee")
    : await db.person.create({ data: { id: `P-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`, name: pick.newName!, role: "EMPLOYEE", note: `Added by ${actor.label} when assigning to ${project.name}` } });
  const history = await db.projectAssignment.count({ where: { personId: person.id, role: "EMPLOYEE", status: "COMPLETED" } });
  const movement = pick.movement ?? (history ? "Reallocation" : "New Hire");
  const startDate = project.startDate ?? getEvaluationDate();
  const tl = await db.projectAssignment.findFirst({ where: { projectId: project.id, role: "TECH_LEAD", status: "ACTIVE", isSimulated: false } });

  const assignment = await db.projectAssignment.create({ data: { projectId: project.id, personId: person.id, role: "EMPLOYEE", reportsToPersonId: lm.id, assignedById: actor.userId ?? "system", assignedAt: at, startDate, movement, status: "ACTIVE" } });
  const existing = await db.employee.findUnique({ where: { personId: person.id }, include: { case: true } });
  let employeeId: string;
  if (existing?.case) {
    // A person whose earlier case is closed: the same case anchor is reopened for the new project.
    employeeId = existing.id;
    await db.employee.update({ where: { id: existing.id }, data: { projectId: project.id, startDate, movement, manager: lm.name, lineManagerId: lm.id, technicalLeadId: tl?.personId ?? null, trackerStatus: "Pre-Onboarding", lastUpdate: getEvaluationDate() } });
    await changePhase(db, { employeeId, to: "PRE_BOARDING", reason: `Assigned to ${project.name}`, actor, allowedFrom: ["CLOSED"] });
  } else {
    employeeId = `EMP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    await db.employee.create({
      data: {
        id: employeeId, name: person.name!, personId: person.id, startDate, movement, projectId: project.id, manager: lm.name, lineManagerId: lm.id,
        technicalLeadId: tl?.personId ?? null, trackerStatus: "Pre-Onboarding", lastUpdate: getEvaluationDate(),
      },
    });
    await db.onboardingCase.create({ data: { id: `CASE-${employeeId}`, employeeId, phase: "PRE_BOARDING", phaseChangedAt: at, phaseChangedBy: actor.label } });
  }
  await createDefaultChecklist(db, employeeId, actor);
  await audit({
    actor, action: "ASSIGNMENT_CREATED", entityType: "ProjectAssignment", entityId: assignment.id, employeeId,
    after: { project: project.name, person: person.name, role: "EMPLOYEE", reportsTo: lm.name, movement, phase: "PRE_BOARDING" },
    details: `${person.name} assigned to ${project.name} as an employee (${movement.toLowerCase()}), reporting to ${lm.name}. Onboarding case opened in pre-boarding.`,
  }, db);
  await recomputeCase(employeeId, `assigned to ${project.name}`, actor, db);
  // The project's onboarding requirements apply at once, including automatic check-off by confirmed skills.
  await syncRequirements(db, { projectId: project.id, actor, trigger: `${person.name} assigned to ${project.name}`, personIds: [person.id] });
  return employeeId;
}

async function addRoleAssignment(db: PrismaClient, projectId: string, projectName: string, personId: string, role: "ADDITIONAL_MANAGER" | "LINE_MANAGER" | "TECH_LEAD", reportsTo: string | null, actor: Actor, at: string) {
  const person = await requirePerson(db, personId, "person");
  const a = await db.projectAssignment.create({ data: { projectId, personId, role, reportsToPersonId: reportsTo, assignedById: actor.userId ?? "system", assignedAt: at, startDate: getEvaluationDate(), status: "ACTIVE" } });
  await audit({ actor, action: "ASSIGNMENT_CREATED", entityType: "ProjectAssignment", entityId: a.id, after: { project: projectName, person: person.name, role }, details: `${person.name} assigned to ${projectName} as ${role.replaceAll("_", " ").toLowerCase()}.` }, db);
  return a;
}

async function endRole(db: PrismaClient, assignmentId: string, status: "COMPLETED" | "REMOVED", reason: string, actor: Actor, projectName: string) {
  const a = await db.projectAssignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { person: true } });
  if (a.status !== "ACTIVE") return;
  await db.projectAssignment.update({ where: { id: a.id }, data: { status, endDate: getEvaluationDate(), endReason: reason } });
  await audit({ actor, action: "ASSIGNMENT_ENDED", entityType: "ProjectAssignment", entityId: a.id, before: { status: "ACTIVE" }, after: { status, endDate: getEvaluationDate(), reason }, details: `${a.person.name ?? "Role-only person"} — ${a.role.replaceAll("_", " ").toLowerCase()} on ${projectName} ${status.toLowerCase()}: ${reason}` }, db);
}

export async function createProject(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<string> {
  await assertAllowed(principal, "project.manage", {}, db);
  const input = ProjectInputSchema.parse(raw);
  await validatePeople(db, input);
  const actor = actorOf(principal);
  const at = auditTimestamp();
  const id = await uniqueProjectId(db, input.details.name);
  const project = await db.project.create({ data: { id, ...input.details, status: "ACTIVE", createdById: principal.userId, createdAt: at } });
  await audit({ actor, action: "PROJECT_CREATED", entityType: "Project", entityId: id, after: input.details, details: `Project ${project.name} created.` }, db);
  await addRoleAssignment(db, id, project.name, input.additionalManagerId, "ADDITIONAL_MANAGER", null, actor, at);
  for (const lm of input.lineManagerIds) await addRoleAssignment(db, id, project.name, lm, "LINE_MANAGER", input.additionalManagerId, actor, at);
  for (const e of input.employees) await assignEmployee(db, project, e, actor, at);
  return id;
}

export async function updateProject(projectId: string, raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  await assertAllowed(principal, "project.manage", {}, db);
  const input = ProjectInputSchema.parse(raw);
  const project = await db.project.findUnique({ where: { id: projectId }, include: { assignments: { where: { status: "ACTIVE" } } } });
  if (!project) throw new DecisionError("Unknown project.");
  await validatePeople(db, input);
  const actor = actorOf(principal);
  const at = auditTimestamp();

  const before = { name: project.name, code: project.code, description: project.description, startDate: project.startDate };
  if (JSON.stringify(before) !== JSON.stringify(input.details)) {
    await db.project.update({ where: { id: projectId }, data: input.details });
    await audit({ actor, action: "PROJECT_UPDATED", entityType: "Project", entityId: projectId, before, after: input.details, details: `Project ${input.details.name} details updated.` }, db);
  }
  const name = input.details.name;
  const am = project.assignments.find((a) => a.role === "ADDITIONAL_MANAGER");
  if (am?.personId !== input.additionalManagerId) {
    if (am) await endRole(db, am.id, "REMOVED", "Replaced as Additional Manager", actor, name);
    await addRoleAssignment(db, projectId, name, input.additionalManagerId, "ADDITIONAL_MANAGER", null, actor, at);
    for (const lm of project.assignments.filter((a) => a.role === "LINE_MANAGER")) await db.projectAssignment.update({ where: { id: lm.id }, data: { reportsToPersonId: input.additionalManagerId } });
  }
  const currentLms = project.assignments.filter((a) => a.role === "LINE_MANAGER");
  for (const lm of currentLms.filter((a) => !input.lineManagerIds.includes(a.personId))) {
    const reports = project.assignments.filter((a) => a.role === "EMPLOYEE" && a.reportsToPersonId === lm.personId).length;
    if (reports) throw new DecisionError("A Line Manager with employees on the project can't be removed. Move their employees first.");
    await endRole(db, lm.id, "REMOVED", "Removed from the project by the PMO", actor, name);
  }
  for (const lm of input.lineManagerIds.filter((id) => !currentLms.some((a) => a.personId === id))) await addRoleAssignment(db, projectId, name, lm, "LINE_MANAGER", input.additionalManagerId, actor, at);
  for (const e of input.employees) await assignEmployee(db, { id: projectId, name, startDate: input.details.startDate }, e, actor, at);
}

export const ChooseTechLeadSchema = z.object({ projectId: z.string().min(1), personId: z.string().min(1), reason: z.string().trim().max(500).optional() });

/** The project's Additional Manager chooses the Technical Lead; the Line Manager may be chosen. */
export async function chooseTechLead(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const input = ChooseTechLeadSchema.parse(raw);
  await assertAllowed(principal, "project.chooseTechLead", { projectId: input.projectId }, db);
  const project = await db.project.findUnique({ where: { id: input.projectId }, include: { assignments: { where: { status: "ACTIVE" } } } });
  if (!project) throw new DecisionError("Unknown project.");
  const candidates = await techLeadCandidates(input.projectId, db);
  if (!candidates.some((c) => c.id === input.personId)) throw new DecisionError("Choose one of the listed people.");
  const actor = actorOf(principal);
  const current = project.assignments.filter((a) => a.role === "TECH_LEAD");
  if (current.some((a) => a.personId === input.personId)) throw new DecisionError("That person is already the Technical Lead.");
  for (const a of current) await endRole(db, a.id, "REMOVED", input.reason || "Replaced as Technical Lead", actor, project.name);
  const person = await requirePerson(db, input.personId, "person");
  const a = await db.projectAssignment.create({ data: { projectId: project.id, personId: person.id, role: "TECH_LEAD", assignedById: principal.userId, assignedAt: auditTimestamp(), startDate: getEvaluationDate(), status: "ACTIVE" } });
  const alsoLm = project.assignments.some((x) => x.role === "LINE_MANAGER" && x.personId === person.id);
  await audit({
    actor, action: "TECH_LEAD_CHOSEN", entityType: "ProjectAssignment", entityId: a.id,
    before: { techLeads: current.map((c) => c.personId) }, after: { techLead: person.name, alsoLineManager: alsoLm },
    details: `${person.name} chosen as Technical Lead of ${project.name}${alsoLm ? " (also a Line Manager on the project)" : ""}.${input.reason ? ` Reason: ${input.reason}` : ""}`,
  }, db);
  // Cases on the project now have a named Technical Lead (owners gate, contacts, roadmap owner).
  const employees = await db.employee.findMany({ where: { projectId: project.id }, select: { id: true } });
  for (const e of employees) {
    await db.employee.update({ where: { id: e.id }, data: { technicalLeadId: person.id } });
    await recomputeCase(e.id, "Technical Lead chosen", actor, db);
  }
}

/** Candidates: the project's Line Managers (a Line Manager can also be the Technical Lead) and people whose role is Technical Lead. */
export async function techLeadCandidates(projectId: string, db: PrismaClient = prisma) {
  const [lms, tls] = await Promise.all([
    db.projectAssignment.findMany({ where: { projectId, role: "LINE_MANAGER", status: "ACTIVE" }, include: { person: true } }),
    db.person.findMany({ where: { role: "TECH_LEAD", name: { not: null } } }),
  ]);
  const out = new Map<string, { id: string; name: string; isSample: boolean; isLineManager: boolean }>();
  for (const a of lms) if (a.person.name) out.set(a.personId, { id: a.personId, name: a.person.name, isSample: a.person.isSimulated, isLineManager: true });
  for (const p of tls) if (!out.has(p.id)) out.set(p.id, { id: p.id, name: p.name!, isSample: p.isSimulated, isLineManager: false });
  return [...out.values()];
}

export const EndAssignmentSchema = z.object({ assignmentId: z.string().min(1), outcome: z.enum(["COMPLETED", "REMOVED"]), reason: z.string().trim().min(3, "A reason is required").max(500) });

/** PMO ends an assignment. Ending an employee's assignment closes their onboarding case (audited phase change). */
export async function endAssignment(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  await assertAllowed(principal, "project.manage", {}, db);
  const input = EndAssignmentSchema.parse(raw);
  const a = await db.projectAssignment.findUnique({ where: { id: input.assignmentId }, include: { project: true, person: { include: { employee: true } } } });
  if (!a || a.status !== "ACTIVE") throw new DecisionError("This assignment is not active.");
  if (a.role === "LINE_MANAGER" && (await db.projectAssignment.count({ where: { projectId: a.projectId, role: "EMPLOYEE", status: "ACTIVE", reportsToPersonId: a.personId } }))) {
    throw new DecisionError("Move this Line Manager's employees to another Line Manager first.");
  }
  const actor = actorOf(principal);
  await endRole(db, a.id, input.outcome, input.reason, actor, a.project.name);
  if (a.role === "EMPLOYEE" && a.person.employee) {
    await changePhase(db, { employeeId: a.person.employee.id, to: "CLOSED", reason: `${input.outcome === "COMPLETED" ? "Left" : "Removed from"} ${a.project.name}: ${input.reason}`, actor, allowedFrom: ["PRE_BOARDING", "ONBOARDING", "READY"] });
  }
}
