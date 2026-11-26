import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SEVERITY_RANK, type FindingItem } from "@/domain/types";
import { loadPortfolio, type PortfolioCase } from "@/modules/case/portfolio";
import { loadFollowUpQueue } from "@/modules/followups/service";
import { can, type Phase, type Scope } from "@/modules/permissions";
import { projectHealth, type HealthResult } from "./health";

/** Read-only project views. Nothing here writes. */

export type PersonLite = { id: string; name: string | null; isSample: boolean; assignmentId?: string };
export type ProjectEmployee = {
  personId: string;
  employeeId: string | null;
  name: string;
  isSample: boolean;
  phase: Phase;
  movement: string | null;
  startDate: string | null;
  lineManagerId: string | null;
  assignmentId: string;
  assessed: string | null;
  topFinding: FindingItem | null;
  blocked: boolean;
  overdue: number;
};
export type ProjectSummary = {
  id: string; name: string; code: string | null; description: string | null; startDate: string | null; status: string; isSimulated: boolean;
  additionalManager: PersonLite | null;
  lineManagers: (PersonLite & { reportsToId: string | null })[];
  techLeads: PersonLite[];
  employees: ProjectEmployee[];
  byPhase: Record<Phase, number>;
  openBlockers: number;
  overdue: number;
  health: HealthResult;
};

const lite = (p: { id: string; name: string | null; isSimulated: boolean }, assignmentId?: string): PersonLite => ({ id: p.id, name: p.name, isSample: p.isSimulated, assignmentId });
const isHighOrCritical = (f: FindingItem) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK.HIGH;

export async function loadProjectSummaries(scope: Scope, db: PrismaClient = prisma, opts: { projectIds?: string[]; includeClosed?: boolean } = {}): Promise<ProjectSummary[]> {
  const projects = await db.project.findMany({
    where: { ...(opts.projectIds ? { id: { in: opts.projectIds } } : {}), ...(opts.includeClosed ? {} : { status: "ACTIVE" }) },
    include: { assignments: { where: { status: "ACTIVE" }, include: { person: { include: { employee: { include: { case: { select: { phase: true } } } } } } } } },
    orderBy: { name: "asc" },
  });
  const visible = projects.filter((p) => can(scope, "project.view", { projectId: p.id }));
  const employeeIds = visible.flatMap((p) => p.assignments.filter((a) => a.role === "EMPLOYEE").map((a) => a.person.employee?.id)).filter((x): x is string => Boolean(x));
  const [portfolio, queue] = await Promise.all([loadPortfolio(db, employeeIds), loadFollowUpQueue(db)]);
  const byEmployee = new Map<string, PortfolioCase>(portfolio.map((c) => [c.state.employee.id, c]));
  const overdueByEmployee = new Map<string, number>();
  for (const i of queue.groups.flatMap((g) => g.items)) if (i.escalationLevel === 2) overdueByEmployee.set(i.employeeId, (overdueByEmployee.get(i.employeeId) ?? 0) + 1);

  return visible.map((p) => {
    const am = p.assignments.find((a) => a.role === "ADDITIONAL_MANAGER");
    const lms = p.assignments.filter((a) => a.role === "LINE_MANAGER");
    const tls = p.assignments.filter((a) => a.role === "TECH_LEAD");
    const employees: ProjectEmployee[] = p.assignments.filter((a) => a.role === "EMPLOYEE").map((a) => {
      const e = a.person.employee;
      const c = e ? byEmployee.get(e.id) : undefined;
      const phase = (e?.case?.phase ?? "PRE_BOARDING") as Phase;
      return {
        personId: a.personId, employeeId: e?.id ?? null, name: a.person.name ?? e?.name ?? "Name not recorded", isSample: a.person.isSimulated, phase,
        movement: a.movement ?? e?.movement ?? null, startDate: a.startDate ?? e?.startDate ?? null, lineManagerId: a.reportsToPersonId, assignmentId: a.id,
        assessed: c?.readiness.assessed ?? null, topFinding: c?.open[0] ?? null, overdue: e ? overdueByEmployee.get(e.id) ?? 0 : 0, blocked: Boolean(c && (c.readiness.assessed === "BLOCKED" || c.open.some((f) => f.severity === "CRITICAL"))),
      };
    });
    const cases = employees.map((e) => (e.employeeId ? byEmployee.get(e.employeeId) : undefined)).filter((c): c is PortfolioCase => Boolean(c));
    const byPhase: Record<Phase, number> = { PRE_BOARDING: 0, ONBOARDING: 0, READY: 0, CLOSED: 0 };
    for (const e of employees) byPhase[e.phase]++;
    const open = cases.flatMap((c) => c.open);
    const overdue = employees.reduce((n, e) => n + (e.employeeId ? overdueByEmployee.get(e.employeeId) ?? 0 : 0), 0);
    const pendingValidations = cases.filter((c) => ["READY_WITH_SUPPORT", "PARTIALLY_READY", "INDEPENDENTLY_READY"].includes(c.readiness.assessed) && c.readiness.gates.find((g) => g.id === "TECH_VALIDATION_APPROVED")?.status !== "SATISFIED").length;
    const health = projectHealth({
      employeesByPhase: byPhase,
      criticalFindings: open.filter((f) => f.severity === "CRITICAL").length,
      highFindings: open.filter((f) => f.severity === "HIGH").length,
      accessNotUsable: cases.reduce((n, c) => n + c.state.access.filter((a) => a.required && a.status !== "USABLE").length, 0),
      overdueFollowUps: overdue,
      staleCases: cases.filter((c) => c.open.some((f) => f.type === "STALE_STATUS")).length,
      pendingValidations,
      missingRoles: [...(am ? [] : ["ADDITIONAL_MANAGER" as const]), ...(lms.length ? [] : ["LINE_MANAGER" as const]), ...(tls.length ? [] : ["TECH_LEAD" as const])],
    });
    return {
      id: p.id, name: p.name, code: p.code, description: p.description, startDate: p.startDate, status: p.status, isSimulated: p.isSimulated,
      additionalManager: am ? lite(am.person, am.id) : null,
      lineManagers: lms.map((a) => ({ ...lite(a.person, a.id), reportsToId: a.reportsToPersonId })),
      techLeads: tls.map((a) => lite(a.person, a.id)),
      employees, byPhase, openBlockers: open.filter(isHighOrCritical).length, overdue, health,
    };
  });
}

/** Project detail: summary plus key risks, past members and recent changes. */
export async function loadProjectDetail(projectId: string, scope: Scope, db: PrismaClient = prisma) {
  if (!can(scope, "project.view", { projectId })) return null;
  const [summary] = await loadProjectSummaries(scope, db, { projectIds: [projectId], includeClosed: true });
  if (!summary) return null;
  const employeeIds = summary.employees.map((e) => e.employeeId).filter((x): x is string => Boolean(x));
  const [portfolio, past, audit] = await Promise.all([
    loadPortfolio(db, employeeIds),
    db.projectAssignment.findMany({ where: { projectId, status: { not: "ACTIVE" } }, include: { person: true }, orderBy: { endDate: "desc" } }),
    db.auditLog.findMany({
      where: { OR: [{ entityType: "Project", entityId: projectId }, { entityType: "ProjectAssignment", details: { contains: summary.name } }, ...(employeeIds.length ? [{ employeeId: { in: employeeIds }, action: { notIn: ["STATE_RECOMPUTED"] } }] : [])] },
      orderBy: { timestamp: "desc" }, take: 12,
    }),
  ]);
  const risks = portfolio.flatMap((c) => c.open.filter(isHighOrCritical).map((f) => ({ finding: f, employeeId: c.state.employee.id, employeeName: c.state.employee.name })))
    .sort((a, b) => SEVERITY_RANK[b.finding.severity] - SEVERITY_RANK[a.finding.severity]).slice(0, 6);
  return {
    summary, risks,
    pastMembers: past.map((a) => ({ id: a.id, role: a.role, status: a.status, endDate: a.endDate, endReason: a.endReason, person: lite(a.person) })),
    recent: audit.map((a) => ({ id: a.id, action: a.action, details: a.details, timestamp: a.timestamp, actor: a.actorLabel ?? "Unknown" })),
  };
}

/** People who can be chosen in the project wizard. Sample people are marked. */
export async function loadAssignablePeople(db: PrismaClient = prisma) {
  const people = await db.person.findMany({ where: { name: { not: null } }, include: { assignments: { select: { status: true, role: true, project: { select: { name: true } } } } }, orderBy: { name: "asc" } });
  const toOption = (p: (typeof people)[number]) => ({ id: p.id, name: p.name!, isSample: p.isSimulated, projects: [...new Set(p.assignments.filter((a) => a.status === "ACTIVE").map((a) => a.project.name))] });
  return {
    additionalManagers: people.filter((p) => p.role === "ADDITIONAL_MANAGER").map(toOption),
    lineManagers: people.filter((p) => p.role === "LINE_MANAGER" || p.assignments.some((a) => a.role === "LINE_MANAGER")).map(toOption),
    // Employees: people without an active employee assignment. Earlier (completed) assignments make them a reallocation.
    employees: people.filter((p) => p.role === "EMPLOYEE" && !p.assignments.some((a) => a.role === "EMPLOYEE" && a.status === "ACTIVE"))
      .map((p) => ({ ...toOption(p), hasHistory: p.assignments.some((a) => a.role === "EMPLOYEE" && a.status === "COMPLETED") })),
  };
}
