import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can, type Scope } from "@/modules/permissions";
import { evaluateCheckoff } from "./checkoff";

/** Read-only requirement views: the project matrix (requirements × employees) and one employee's column. */
export type CellStatus = "TODO" | "IN_PROGRESS" | "DONE" | "SATISFIED_BY_EXISTING_SKILL" | "POSSIBLY_COVERED" | "WAIVED";
export type MatrixCell = {
  statusId: string | null;
  status: CellStatus;
  stored: string | null;
  skill: { recordId: string; personId: string; name: string; level: string; status: string; source: string; projectName: string | null } | null;
  derived: "KT" | "ACCESS" | null;
  note: string | null;
};
export type MatrixRequirement = { id: string; title: string; description: string; type: string; skillId: string | null; skillName: string | null; requiredLevel: string | null; completionCriteria: string; mandatory: boolean; status: string };
export type MatrixEmployee = { employeeId: string; personId: string; name: string; isSample: boolean; phase: string; movement: string | null };

export async function loadRequirementMatrix(projectId: string, scope: Scope, db: PrismaClient = prisma) {
  if (!can(scope, "project.view", { projectId }) && !Object.values(scope.cases).some((c) => c.projectId === projectId)) return null;
  const [project, reqs, assignments, skills] = await Promise.all([
    db.project.findUnique({ where: { id: projectId } }),
    db.onboardingRequirement.findMany({ where: { projectId }, include: { skill: true, statuses: true }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
    db.projectAssignment.findMany({ where: { projectId, role: "EMPLOYEE", status: "ACTIVE" }, include: { person: { include: { employee: { include: { case: { select: { phase: true } }, activities: true, access: true } } } } }, orderBy: { startDate: "asc" } }),
    db.skill.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);
  if (!project) return null;
  const personIds = assignments.map((a) => a.personId);
  const records = await db.employeeSkill.findMany({ where: { personId: { in: personIds } }, include: { skill: true } });
  const projectNames = new Map((await db.project.findMany({ select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const employees: MatrixEmployee[] = assignments.filter((a) => a.person.employee).map((a) => ({ employeeId: a.person.employee!.id, personId: a.personId, name: a.person.name ?? a.person.employee!.name, isSample: a.person.isSimulated, phase: a.person.employee!.case?.phase ?? "PRE_BOARDING", movement: a.movement }));

  const cells: Record<string, Record<string, MatrixCell>> = {};
  for (const r of reqs.filter((x) => x.status === "ACTIVE")) {
    cells[r.id] = {};
    for (const a of assignments) {
      const e = a.person.employee;
      if (!e) continue;
      const row = r.statuses.find((s) => s.employeeId === e.id) ?? null;
      const mine = records.filter((s) => s.personId === a.personId);
      const rule = evaluateCheckoff(r, mine);
      const rec = (id: string | null | undefined) => {
        const s = id ? mine.find((x) => x.id === id) : undefined;
        return s ? { recordId: s.id, personId: s.personId, name: s.skill.name, level: s.level, status: s.status, source: s.source, projectName: s.projectId ? projectNames.get(s.projectId) ?? null : null } : null;
      };
      let status: CellStatus = (row?.status as CellStatus) ?? "TODO";
      let derived: MatrixCell["derived"] = null;
      if (status === "TODO" || status === "IN_PROGRESS") {
        if (r.type === "KT_ACTIVITY") {
          const kt = e.activities.find((k) => k.requirementId === r.id);
          if (kt) { derived = "KT"; status = kt.stage === "INDEPENDENT_EXECUTION" && kt.stageBasis === "OBSERVED" ? "DONE" : kt.stage !== "NOT_STARTED" ? "IN_PROGRESS" : status; }
        }
        if (r.type === "ACCESS") {
          const acc = e.access.find((x) => x.requirementId === r.id);
          if (acc) { derived = "ACCESS"; status = acc.status === "USABLE" ? "DONE" : acc.status !== "NOT_REQUESTED" ? "IN_PROGRESS" : status; }
        }
        if (rule.kind === "POSSIBLY" && status !== "DONE") status = "POSSIBLY_COVERED";
      }
      cells[r.id][e.id] = {
        statusId: row?.id ?? null, status, stored: row?.status ?? null, derived, note: row?.note ?? null,
        skill: status === "SATISFIED_BY_EXISTING_SKILL" ? rec(row?.satisfiedBySkillId) : status === "POSSIBLY_COVERED" && rule.kind === "POSSIBLY" ? rec(rule.recordId) : null,
      };
    }
  }
  const requirements: MatrixRequirement[] = reqs.map((r) => ({ id: r.id, title: r.title, description: r.description, type: r.type, skillId: r.skillId, skillName: r.skill?.name ?? null, requiredLevel: r.requiredLevel, completionCriteria: r.completionCriteria, mandatory: r.mandatory, status: r.status }));
  const active = requirements.filter((r) => r.status === "ACTIVE");
  const progress = Object.fromEntries(employees.map((e) => {
    const cs = active.map((r) => cells[r.id][e.employeeId]).filter(Boolean);
    return [e.employeeId, { done: cs.filter((c) => c.status === "DONE" || c.status === "SATISFIED_BY_EXISTING_SKILL").length, total: cs.filter((c) => c.status !== "WAIVED").length }];
  }));
  return { project: { id: project.id, name: project.name }, requirements, employees, cells, progress, skills: skills.map((s) => ({ id: s.id, name: s.name, category: s.category })), canManage: can(scope, "requirement.manage", { projectId }) };
}

/** Projects where the user is Technical Lead, with requirement counts. */
export async function loadTechLeadProjects(scope: Scope, db: PrismaClient = prisma) {
  const ids = Object.entries(scope.projectRoles).filter(([, rs]) => rs.includes("TECH_LEAD")).map(([id]) => id);
  if (!ids.length) return [];
  const projects = await db.project.findMany({ where: { id: { in: ids } }, include: { requirements: { where: { status: "ACTIVE" } }, assignments: { where: { role: "EMPLOYEE", status: "ACTIVE" } } }, orderBy: { name: "asc" } });
  return projects.map((p) => ({ id: p.id, name: p.name, isSample: p.isSimulated, requirements: p.requirements.length, employees: p.assignments.length }));
}
