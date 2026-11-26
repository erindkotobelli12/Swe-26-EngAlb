import { thresholds } from "@/config/thresholds";
import { daysBetween } from "@/lib/clock";
import { ACCESS_STATUS_LABEL, roleLabel, type CaseState, type FindingItem, type Severity } from "@/domain/types";
import { accessFacts } from "@/modules/detective/detectors/access";
import type { ReadinessResult } from "@/modules/readiness/evaluate";

/**
 * Deterministic follow-up detection, stakeholder resolution, consolidation, escalation and prioritisation.
 * Pure: the Follow-Up Center computes this on read; drafts are persisted only when a user creates them.
 */
export type DirectoryPerson = { id: string; name: string | null; role: string; projectId: string | null; note: string | null };
export type Stakeholder = { key: string; role: string; personId: string | null; label: string; greeting: string; channel: "EMAIL" | "TEAMS" };
export type FollowUpItem = {
  key: string;
  employeeId: string;
  employeeName: string;
  kind: "ACCESS_STATUS" | "APPROVAL" | "UNANSWERED_REQUEST" | "FINDING" | "ACTION" | "IDENTIFY_OWNER";
  title: string;
  ask: string;
  facts: { evidenceId: string; excerpt: string }[];
  refs: { findingId?: string; accessId?: string; actionId?: string; evidenceId?: string };
  requestEvidenceId: string | null;
  sinceDate: string | null;
  daysOpen: number;
  severity: Severity;
  impact: number;
  escalationLevel: 0 | 1 | 2;
  score: number;
  breakdown: { impact: number; severity: number; overdue: number; escalation: number };
};
export type FollowUpGroup = { stakeholder: Stakeholder; items: FollowUpItem[]; score: number; escalationLevel: 0 | 1 | 2; escalationRecommendation: string | null };
export type OpenAction = { id: string; employeeId: string; findingId: string | null; title: string; description: string; ownerRole: string | null; dueDate: string | null; priority: string; evidenceIds: string[] };

const SEVERITY_POINTS: Record<Severity, number> = { CRITICAL: 40, HIGH: 25, MEDIUM: 10, LOW: 5 };

/** Who follows up on what, by finding type. Unresolvable owners go to the PMO as "identify owner". */
const ROUTE: Partial<Record<string, string>> = {
  CONFLICTING_EVIDENCE: "TECH_LEAD", CLOSURE_WITHOUT_EVIDENCE: "TECH_LEAD", UNVERIFIED_SELF_REPORT: "TECH_LEAD", MISSING_READINESS_DATE: "TECH_LEAD",
  BLOCKED_WITHOUT_CAUSE: "LINE_MANAGER", STALE_STATUS: "LINE_MANAGER", INSUFFICIENT_EVIDENCE: "LINE_MANAGER", STATUS_EVIDENCE_MISMATCH: "LINE_MANAGER",
  MISSING_PROJECT: "LINE_MANAGER", KT_WITHOUT_OWNER: "LINE_MANAGER", MISSING_LINE_MANAGER: "PMO",
};

export function resolveStakeholder(role: string, state: CaseState, directory: DirectoryPerson[], personId?: string | null, context?: string): Stakeholder | null {
  const make = (p: { id: string | null; name: string | null }, context?: string): Stakeholder => ({
    key: p.id ? `PERSON:${p.id}` : `ROLE:${role}`, role, personId: p.id,
    label: p.name ? `${p.name} (${roleLabel(role)})` : `${roleLabel(role)}${context ? ` — ${context}` : ""} (name not recorded)`,
    greeting: p.name ? p.name.split(" ")[0] : `${roleLabel(role)} team`, channel: p.name ? "TEAMS" : "EMAIL",
  });
  if (personId) {
    const p = directory.find((x) => x.id === personId);
    if (p) return make(p, context);
  }
  switch (role) {
    case "EMPLOYEE": return { key: `EMPLOYEE:${state.employee.id}`, role, personId: null, label: `${state.employee.name} (Employee)`, greeting: state.employee.name.split(" ")[0], channel: "TEAMS" };
    case "LINE_MANAGER": {
      const p = state.people.lineManager;
      if (p) return make(p);
      if (state.people.lineManagerText) return make({ id: null, name: state.people.lineManagerText });
      return null;
    }
    case "TECH_LEAD": return state.people.techLead ? make(state.people.techLead, state.employee.projectName ?? undefined) : null;
    case "KT_OWNER": return state.people.ktOwner ? make(state.people.ktOwner, state.employee.projectName ?? undefined) : null;
    default: {
      const p = directory.find((x) => x.role === role && x.projectId === state.employee.projectId) ?? directory.find((x) => x.role === role && x.projectId === null);
      return p ? make(p) : role === "PMO" ? make({ id: null, name: null }) : null;
    }
  }
}

function escalation(daysOpen: number): 0 | 1 | 2 {
  if (daysOpen >= thresholds.ESCALATE_AFTER_DAYS) return 2;
  if (daysOpen >= thresholds.REMINDER_AFTER_DAYS) return 1;
  return 0;
}

function scored(base: Omit<FollowUpItem, "score" | "breakdown" | "escalationLevel" | "daysOpen">, evaluationDate: string): FollowUpItem {
  const daysOpen = base.sinceDate ? Math.max(0, daysBetween(base.sinceDate, evaluationDate)) : 0;
  const level = escalation(daysOpen);
  const breakdown = {
    impact: base.impact * 5,
    severity: SEVERITY_POINTS[base.severity],
    overdue: Math.max(0, daysOpen - thresholds.FOLLOW_UP_AFTER_DAYS) * 2,
    escalation: level * 10,
  };
  return { ...base, daysOpen, escalationLevel: level, score: breakdown.impact + breakdown.severity + breakdown.overdue + breakdown.escalation, breakdown };
}

const factDate = (state: CaseState, f: FindingItem) =>
  f.facts.map((x) => state.evidence.find((e) => e.id === x.evidenceId)?.timestamp.slice(0, 10)).filter((d): d is string => Boolean(d)).sort()[0] ?? state.employee.lastUpdate;

/** Builds the per-stakeholder queue across cases. Items already covered by an active communication are excluded. */
export function buildFollowUps(
  cases: { state: CaseState; readiness: ReadinessResult }[],
  directory: DirectoryPerson[],
  actions: OpenAction[],
  coveredItemKeys: Set<string>,
): FollowUpGroup[] {
  const groups = new Map<string, FollowUpGroup>();
  const add = (s: Stakeholder, item: FollowUpItem) => {
    if (coveredItemKeys.has(item.key)) return;
    const g = groups.get(s.key) ?? { stakeholder: s, items: [], score: 0, escalationLevel: 0 as const, escalationRecommendation: null };
    g.items.push(item);
    groups.set(s.key, g);
  };

  for (const { state, readiness } of cases) {
    const ev = state.evaluationDate;
    const impactOf = (nodeKey: string) => readiness.graph.nodes.find((n) => n.key === nodeKey)?.downstreamImpact.length ?? 0;
    const pmo = resolveStakeholder("PMO", state, directory)!;
    const open = state.findings.filter((f) => f.status === "OPEN");
    const accessFinding = (accessId: string, type: string) => open.find((f) => f.type === type && f.affectedEntities.some((e) => e.id === accessId));

    // 1. Access: consolidated to the team handling the request; approvals also to the approver.
    for (const a of state.access.filter((x) => x.required && x.status !== "USABLE")) {
      const f = accessFinding(a.id, "ACCESS_NOT_USABLE");
      const ownerUnknown = accessFinding(a.id, "ACCESS_OWNER_UNKNOWN");
      const since = a.requestDate ?? state.evidence.find((e) => e.id === a.evidenceId)?.timestamp.slice(0, 10) ?? null;
      const common = { employeeId: state.employee.id, employeeName: state.employee.name, facts: accessFacts(state, a).map(({ evidenceId, excerpt }) => ({ evidenceId, excerpt })), requestEvidenceId: a.requestEvidenceId, sinceDate: since, severity: (f?.severity ?? "HIGH") as Severity, impact: impactOf(`access:${a.id}`) };
      const asks: Record<string, string> = {
        REQUESTED: "please confirm the provisioning status and an expected date",
        APPROVAL_PENDING: "please confirm the approval request is with the application owner and share any expected date",
        APPROVED: "please confirm when provisioning will happen",
        PROVISIONED: "active according to your update — please confirm nothing further is needed; we will confirm successful use with the employee",
        NOT_REQUESTED: "please raise the access request",
        REJECTED: "please share why the request was rejected",
      };
      const handler = a.handlerRole ? resolveStakeholder(a.handlerRole, state, directory) : null;
      if (handler) {
        add(handler, scored({ ...common, key: `access:${a.id}:${a.status}`, kind: "ACCESS_STATUS", title: `${a.application} — ${ACCESS_STATUS_LABEL[a.status]}`, ask: `${asks[a.status] ?? "please confirm the status"}${ownerUnknown ? ", and who owns provisioning" : ""}`, refs: { accessId: a.id, findingId: f?.id } }, ev));
      } else {
        add(pmo, scored({ ...common, key: `access:${a.id}:identify`, kind: "IDENTIFY_OWNER", title: `${a.application} — no owner or handler recorded`, ask: "identify who handles this access request and record the owner and next follow-up date", refs: { accessId: a.id, findingId: f?.id } }, ev));
      }
      if (a.status === "APPROVAL_PENDING" && a.approverRole) {
        const approverId = a.approverRole === "APP_OWNER" ? directory.find((p) => p.role === "APP_OWNER" && p.note?.includes(a.application))?.id : null;
        const approver = resolveStakeholder(a.approverRole, state, directory, approverId, a.application);
        if (approver) add(approver, scored({ ...common, key: `approval:${a.id}`, kind: "APPROVAL", title: `${a.application} — approval decision needed`, ask: `please approve or decline ${state.employee.name}'s ${a.application} access request`, refs: { accessId: a.id, findingId: f?.id } }, ev));
      }
    }

    // 2. Findings routed by type (access findings are covered above).
    for (const f of open.filter((x) => x.category !== "ACCESS" && x.type !== "ACCESS_OWNER_UNKNOWN")) {
      const facts = f.facts.map(({ evidenceId, excerpt }) => ({ evidenceId, excerpt }));
      const base = { employeeId: state.employee.id, employeeName: state.employee.name, facts, severity: f.severity, impact: impactOf(`finding:${f.id}`) || 1, sinceDate: factDate(state, f), refs: { findingId: f.id } };
      if (f.type === "UNANSWERED_REQUEST") {
        const requestId = f.affectedEntities.find((e) => e.type === "evidence")?.id ?? null;
        const to = f.ownerRole ? resolveStakeholder(f.ownerRole, state, directory) : null;
        const item = { ...base, key: `finding:${f.id}`, kind: "UNANSWERED_REQUEST" as const, title: f.title, ask: "your answer to the request below is still outstanding", requestEvidenceId: requestId, refs: { findingId: f.id, evidenceId: requestId ?? undefined } };
        if (to) add(to, scored(item, ev));
        else add(pmo, scored({ ...item, kind: "IDENTIFY_OWNER", ask: "identify who must answer this request" }, ev));
        continue;
      }
      const role = ROUTE[f.type] ?? f.recommendedActions[0]?.ownerRole ?? f.ownerRole ?? "PMO";
      const to = role === "PMO" ? null : resolveStakeholder(role, state, directory);
      const ask = f.recommendedActions.find((a) => a.ownerRole === role)?.action ?? f.recommendedActions[0]?.action ?? "please advise";
      if (to) add(to, scored({ ...base, key: `finding:${f.id}`, kind: "FINDING", title: f.title, ask, requestEvidenceId: null }, ev));
      else add(pmo, scored({ ...base, key: `finding:${f.id}`, kind: "IDENTIFY_OWNER", title: f.title, ask: role === "PMO" ? ask : `identify the ${roleLabel(role)} for ${state.employee.name} — ${ask.charAt(0).toLowerCase()}${ask.slice(1)}`, requestEvidenceId: null }, ev));
    }

    // 3. Open action items created by people.
    for (const a of actions.filter((x) => x.employeeId === state.employee.id)) {
      const role = a.ownerRole ?? "PMO";
      const to = resolveStakeholder(role, state, directory) ?? pmo;
      const overdue = a.dueDate && a.dueDate < ev;
      const sev: Severity = (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(a.priority) ? a.priority : "MEDIUM") as Severity;
      add(to, scored({ key: `action:${a.id}`, employeeId: state.employee.id, employeeName: state.employee.name, kind: "ACTION", title: a.title, ask: overdue ? `overdue since ${a.dueDate} — please confirm the status` : "please confirm the status", facts: [], refs: { actionId: a.id, findingId: a.findingId ?? undefined }, requestEvidenceId: null, sinceDate: a.dueDate ?? null, severity: sev, impact: 0 }, ev));
    }
  }

  const out = [...groups.values()].map((g) => {
    g.items = mergeDuplicates(g.items).sort((a, b) => b.score - a.score);
    g.score = Math.max(...g.items.map((i) => i.score));
    const top = g.items.reduce((m, i) => (i.escalationLevel > m ? i.escalationLevel : m), 0 as 0 | 1 | 2);
    g.escalationLevel = top;
    const target = g.stakeholder.role === "LINE_MANAGER" || g.stakeholder.role === "TECH_LEAD" || g.stakeholder.role === "KT_OWNER" ? "the Technical Manager" : "the employee's Line Manager or the Technical Manager";
    g.escalationRecommendation = top === 2
      ? `Escalation recommended to ${target}: ${g.items.filter((i) => i.escalationLevel === 2).length} item(s) open ≥ ${thresholds.ESCALATE_AFTER_DAYS} days (ESCALATE_AFTER_DAYS). Not sent automatically.`
      : top === 1 ? `Reminder due: item(s) open ≥ ${thresholds.REMINDER_AFTER_DAYS} days (REMINDER_AFTER_DAYS).` : null;
    return g;
  });
  return out.sort((a, b) => b.score - a.score || a.stakeholder.label.localeCompare(b.stakeholder.label));
}

function mergeDuplicates(items: FollowUpItem[]): FollowUpItem[] {
  const byFinding = new Set(items.filter((i) => i.kind === "ACTION" && i.refs.findingId).map((i) => i.refs.findingId));
  return items.filter((i) => !(i.kind !== "ACTION" && i.refs.findingId && byFinding.has(i.refs.findingId)));
}

/** Deterministic template draft (clearly labelled; the AI can personalise it on request). */
export function templateDraft(group: FollowUpGroup, sender = "PMO Coordinator"): { subject: string; body: string } {
  const employees = [...new Set(group.items.map((i) => i.employeeName))];
  const subject = `Follow-up: ${group.items.length} open onboarding item${group.items.length > 1 ? "s" : ""}${employees.length === 1 ? ` for ${employees[0]}` : ""}`;
  const lines = employees.flatMap((name) => [
    `${name}:`,
    ...group.items.filter((i) => i.employeeName === name).map((i) => `- ${i.title}: ${i.ask} (open ${i.daysOpen} day${i.daysOpen === 1 ? "" : "s"}${i.facts.length ? `; source ${[...new Set(i.facts.map((f) => f.evidenceId))].join(", ")}` : ""}).`),
    "",
  ]);
  const body = [`Hello ${group.stakeholder.greeting},`, "", "We are following up on the onboarding items below. Could you please reply with the current status?", "", ...lines, "Thank you,", sender].join("\n");
  return { subject, body };
}
