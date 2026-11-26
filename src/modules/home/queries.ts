import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { roleLabel } from "@/lib/labels";
import { loadPortfolio, type PortfolioCase } from "@/modules/case/portfolio";
import { loadFollowUpQueue } from "@/modules/followups/service";
import { figuresOf, loadInsights } from "@/modules/insights/service";
import { can, type Relation, type Scope } from "@/modules/permissions";
import { buildBackbone, type PlanItem } from "@/modules/roadmap/backbone";
import { classifyCaseStatus } from "@/modules/reliability/classify";

/** Read-only data for the role home pages. Every figure is deterministic and traceable to records. */

export const casesWith = (scope: Scope, r: Relation) => Object.values(scope.cases).filter((c) => c.relations.includes(r));

/** First open item of the deterministic roadmap: what has to happen next. */
export function nextStep(c: PortfolioCase): PlanItem | null {
  const plan = buildBackbone(c.state, c.readiness);
  return plan.find((i) => i.status === "BLOCKED") ?? plan.find((i) => i.status !== "DONE") ?? null;
}

/** What the person is waiting on, and from whom (access not working, blocked plan items). */
export function waitingOn(c: PortfolioCase): { what: string; who: string }[] {
  const access = c.state.access.filter((a) => a.required && a.status !== "USABLE" && a.status !== "PROVISIONED")
    .map((a) => ({ what: `${a.application}: ${a.blockerReason ?? "waiting"}`, who: a.owner ?? (a.handlerRole ? roleLabel(a.handlerRole) : "Owner not recorded") }));
  const plan = buildBackbone(c.state, c.readiness).filter((i) => i.status === "BLOCKED" && !i.key.startsWith("access:"))
    .map((i) => ({ what: `${i.title}${i.waitsFor.length ? ` (waits for ${i.waitsFor.join(", ")})` : ""}`, who: i.owner }));
  return [...access, ...plan];
}

export type CaseRow = {
  employeeId: string; personId: string | null; name: string; projectName: string | null; phase: string; assessed: string; reliability: string;
  blocker: string | null; next: string | null; requirements: { done: number; total: number }; isSample: boolean;
};

export async function loadCaseRows(scope: Scope, ids: string[], db: PrismaClient = prisma): Promise<CaseRow[]> {
  if (!ids.length) return [];
  const [portfolio, people] = await Promise.all([loadPortfolio(db, ids), db.employee.findMany({ where: { id: { in: ids } }, select: { id: true, person: { select: { isSimulated: true } } } })]);
  return portfolio.map((c) => {
    const reqs = c.state.requirements ?? [];
    return {
      employeeId: c.state.employee.id, personId: scope.cases[c.state.employee.id]?.personId ?? null, name: c.state.employee.name, projectName: c.state.employee.projectName,
      phase: scope.cases[c.state.employee.id]?.phase ?? "ONBOARDING", assessed: c.readiness.assessed, reliability: classifyCaseStatus(c.state).category,
      blocker: c.open[0]?.title ?? null, next: nextStep(c)?.title ?? null,
      requirements: { done: reqs.filter((r) => r.status === "DONE" || r.status === "SATISFIED_BY_EXISTING_SKILL").length, total: reqs.filter((r) => r.status !== "WAIVED").length },
      isSample: people.find((p) => p.id === c.state.employee.id)?.person?.isSimulated ?? false,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** Escalations waiting for an Additional Manager: Line Manager follow-ups past the escalation threshold, on their projects. */
export async function escalationsFor(scope: Scope, db: PrismaClient = prisma) {
  const amCases = new Set(casesWith(scope, "AM").map((c) => c.employeeId));
  const { groups, employees } = await loadFollowUpQueue(db, scope);
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => amCases.has(i.employeeId) && i.escalationLevel === 2) }))
    .filter((g) => g.items.length && g.stakeholder.role === "LINE_MANAGER")
    .map((g) => ({ key: g.stakeholder.key, stakeholder: g.stakeholder.label, recommendation: g.escalationRecommendation, items: g.items.map((i) => ({ key: i.key, employeeId: i.employeeId, employee: employees.get(i.employeeId) ?? i.employeeName, title: i.title, ask: i.ask, daysOpen: i.daysOpen })) }));
}

/** Top cross-project bottlenecks from the insights figures (largest first). */
export async function topBottlenecks(scope: Scope, limit = 5, db: PrismaClient = prisma) {
  const ids = scope.isPMO ? undefined : Object.keys(scope.cases);
  const insights = await loadInsights(db, ids);
  const TITLE: Record<string, string> = {
    "apps-not-usable": "Application not usable", handling: "Access waiting at", "findings-by-project": "Open findings on", "findings-by-category": "Findings about",
    missing: "Often not recorded", unanswered: "Unanswered requests to",
  };
  return figuresOf(insights).filter((f) => f.value > 1 || f.key.startsWith("missing:")).sort((a, b) => b.value - a.value).slice(0, limit)
    .map((f) => ({ key: f.key, title: `${TITLE[f.key.split(":")[0]] ?? "Pattern"}: ${f.label}`, value: f.value, caseIds: f.caseIds, cases: f.caseIds.map((id) => insights.employees[id] ?? id) }));
}

/** Claimed skills waiting for a Technical Lead in scope. */
export async function skillsToConfirm(scope: Scope, db: PrismaClient = prisma) {
  const personIds = Object.entries(scope.people).filter(([, r]) => r.includes("TL")).map(([id]) => id);
  if (!personIds.length) return [];
  const rows = await db.employeeSkill.findMany({ where: { personId: { in: personIds }, status: "CLAIMED" }, include: { skill: true, person: true }, orderBy: { createdAt: "asc" } });
  return rows.filter((r) => can(scope, "skill.confirm", { personId: r.personId })).map((r) => ({ id: r.id, personId: r.personId, person: r.person.name ?? "Unknown", skill: r.skill.name, level: r.level }));
}
