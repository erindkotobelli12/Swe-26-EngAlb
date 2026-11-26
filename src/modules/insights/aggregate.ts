import { thresholds } from "@/config/thresholds";
import { daysBetween } from "@/lib/clock";
import { ACCESS_STATUS_LABEL, roleLabel } from "@/domain/types";
import type { PortfolioCase } from "@/modules/case/portfolio";
import { isFinalValidation, latestValidation } from "@/modules/readiness/gates";
import { SIMULATED_HISTORY } from "./simulatedHistory";

/**
 * Deterministic organisational aggregations over all official cases. Pure. Every figure keeps the case IDs it
 * counts, so charts link to cases and AI hypotheses can only cite real figures.
 */
export type Bar = { key: string; label: string; value: number; caseIds: string[]; detail?: string };
export type Metric = { key: string; label: string; n: number; value: number | null; unit: string; sufficient: boolean };
export type Insights = {
  appsNotUsable: Bar[];
  handlingBottlenecks: Bar[];
  findingsByProject: Bar[];
  findingsByCategory: Bar[];
  missingResponsibilities: Bar[];
  unansweredByRecipient: Bar[];
  delayedKT: { caseId: string; employee: string; activity: string; stage: string; basis: string; days: number }[];
  sharedDependencies: Bar[];
  reusableMaterials: { id: string; title: string; project: string | null; location: string; copyAllowed: boolean; projectsWithoutMaterial: string[] }[];
  metrics: Metric[];
  employees: Record<string, string>;
};

const group = (rows: { key: string; label: string; caseId: string; detail?: string }[]): Bar[] => {
  const m = new Map<string, Bar>();
  for (const r of rows) {
    const b = m.get(r.key) ?? { key: r.key, label: r.label, value: 0, caseIds: [] as string[], detail: r.detail };
    if (!b.caseIds.includes(r.caseId)) b.caseIds.push(r.caseId);
    b.value = b.caseIds.length;
    m.set(r.key, b);
  }
  return [...m.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
};

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const metric = (key: string, label: string, xs: number[], unit = "days"): Metric => ({ key, label, n: xs.length, value: xs.length >= thresholds.MIN_SAMPLE_SIZE ? avg(xs) : null, unit, sufficient: xs.length >= thresholds.MIN_SAMPLE_SIZE });

export function aggregate(portfolio: PortfolioCase[], knowledge: { id: string; title: string; projectId: string | null; projectName: string | null; location: string; copyAllowed: boolean }[], allProjects: string[]): Insights {
  const employees = Object.fromEntries(portfolio.map((c) => [c.state.employee.id, c.state.employee.name]));
  const unusable = portfolio.flatMap((c) => c.state.access.filter((a) => a.required && a.status !== "USABLE").map((a) => ({ c, a })));

  const appsNotUsable = group(unusable.map(({ c, a }) => ({ key: a.application, label: a.application, caseId: c.state.employee.id, detail: ACCESS_STATUS_LABEL[a.status] })));
  const handlingBottlenecks = group(unusable.map(({ c, a }) => {
    const role = a.status === "APPROVAL_PENDING" ? a.approverRole : a.status === "PROVISIONED" ? "EMPLOYEE" : a.handlerRole;
    return { key: role ?? "UNOWNED", label: role ? `${roleLabel(role)} (${a.status === "APPROVAL_PENDING" ? "approval" : a.status === "PROVISIONED" ? "use confirmation" : "provisioning"})` : "No owner recorded", caseId: c.state.employee.id };
  }));
  const open = portfolio.flatMap((c) => c.open.map((f) => ({ c, f })));
  const findingsByProject = group(open.map(({ c }) => ({ key: c.state.employee.projectName ?? "No project", label: c.state.employee.projectName ?? "No project recorded", caseId: c.state.employee.id })))
    .map((b) => ({ ...b, value: open.filter(({ c }) => (c.state.employee.projectName ?? "No project") === b.key).length, detail: "open findings" }));
  const findingsByCategory = group(open.map(({ c, f }) => ({ key: f.category, label: f.category.toLowerCase().replaceAll("_", " "), caseId: c.state.employee.id })))
    .map((b) => ({ ...b, value: open.filter(({ f }) => f.category === b.key).length, detail: "open findings" }));

  const missing: { key: string; label: string; caseId: string }[] = [];
  for (const c of portfolio) {
    const id = c.state.employee.id;
    if (!c.state.employee.projectId) missing.push({ key: "project", label: "Project", caseId: id });
    if (!c.state.employee.role) missing.push({ key: "role", label: "Exact role", caseId: id });
    if (!c.state.people.lineManager && !c.state.people.lineManagerText) missing.push({ key: "lm", label: "Line Manager", caseId: id });
    if (!c.state.people.techLead?.name) missing.push({ key: "tl", label: "Technical Lead (named)", caseId: id });
    if (!c.state.people.ktOwner?.name && !c.state.kt.some((k) => k.owner && k.status === "CONFIRMED")) missing.push({ key: "kt", label: "KT owner", caseId: id });
    if (!c.state.caseInfo.expectedReadyAt && !c.state.caseInfo.readinessReviewAt) missing.push({ key: "date", label: "Readiness date", caseId: id });
    if (!c.state.access.length) missing.push({ key: "apps", label: "Required applications", caseId: id });
  }

  const unansweredByRecipient = group(open.filter(({ f }) => f.type === "UNANSWERED_REQUEST").map(({ c, f }) => ({ key: f.ownerRole ?? "UNKNOWN", label: roleLabel(f.ownerRole), caseId: c.state.employee.id })));

  const delayedKT = portfolio.flatMap((c) => c.state.kt.filter((k) => k.status === "CONFIRMED" && k.stage !== "INDEPENDENT_EXECUTION").map((k) => {
    const ev = c.state.evidence.find((e) => e.id === k.evidenceId);
    return { caseId: c.state.employee.id, employee: c.state.employee.name, activity: k.title, stage: k.stage.replaceAll("_", " ").toLowerCase(), basis: k.stageBasis.toLowerCase().replaceAll("_", " "), days: ev ? daysBetween(ev.timestamp, c.state.evaluationDate) : 0 };
  })).sort((a, b) => b.days - a.days);

  const sharedDependencies = group(portfolio.flatMap((c) => c.state.dependencies.filter((d) => d.status !== "REJECTED" && d.fromType === "access").map((d) => {
    const app = c.state.access.find((a) => a.id === d.fromId)?.application ?? d.fromId;
    return { key: app, label: `${app} → KT (${d.status.toLowerCase()})`, caseId: c.state.employee.id };
  })));

  const projectsWithMaterial = new Set(knowledge.map((k) => k.projectId).filter(Boolean));
  const reusableMaterials = knowledge.map((k) => ({ id: k.id, title: k.title, project: k.projectName, location: k.location, copyAllowed: k.copyAllowed, projectsWithoutMaterial: allProjects.filter((p) => !projectsWithMaterial.has(p.toUpperCase())) }));

  const accessDays = portfolio.flatMap((c) => c.state.access.filter((a) => a.requestDate && a.usableConfirmedAt).map((a) => daysBetween(a.requestDate!, a.usableConfirmedAt!)));
  const readinessDays = portfolio.flatMap((c) => { const v = latestValidation(c.state.validations); return isFinalValidation(v) ? [daysBetween(c.state.employee.startDate, v!.timestamp!)] : []; });
  const resolutionDays = portfolio.flatMap((c) => c.state.findings.filter((f) => f.status === "RESOLVED" && f.resolutionType !== "CONDITION_CLEARED" && f.firstDetectedAt && f.resolvedAt).map((f) => daysBetween(f.firstDetectedAt!, f.resolvedAt!)));

  return {
    appsNotUsable, handlingBottlenecks, findingsByProject, findingsByCategory, missingResponsibilities: group(missing), unansweredByRecipient, delayedKT, sharedDependencies, reusableMaterials,
    metrics: [
      metric("timeToAccess", "Time from access request to confirmed use", accessDays),
      metric("timeToReadiness", "Time from start to validated independent readiness", readinessDays),
      metric("blockerResolution", "Blocker resolution time (human-resolved findings)", resolutionDays),
    ],
    employees,
  };
}

export function simulatedMetrics() {
  const access = SIMULATED_HISTORY.flatMap((c) => (c.daysToUsableAccess !== null ? [c.daysToUsableAccess] : []));
  const ready = SIMULATED_HISTORY.flatMap((c) => (c.daysToReadiness !== null ? [c.daysToReadiness] : []));
  const byProject: Bar[] = SIMULATED_HISTORY.filter((c) => c.daysToReadiness !== null).map((c) => ({ key: c.id, label: `${c.project ?? "No project"} (${c.id})`, value: c.daysToReadiness!, caseIds: [c.id] }));
  const causes = group(SIMULATED_HISTORY.map((c) => ({ key: c.delayCause, label: c.delayCause, caseId: c.id })));
  return { metrics: [metric("simTimeToAccess", "Time to usable access (simulated)", access), metric("simTimeToReadiness", "Time to readiness (simulated)", ready)], byProject, causes };
}
