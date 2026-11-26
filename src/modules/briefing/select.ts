import { READINESS_LABEL, SEVERITY_RANK, type ReadinessLevel } from "@/domain/types";
import type { PortfolioCase } from "@/modules/case/portfolio";
import type { FollowUpGroup } from "@/modules/followups/candidates";
import { classifyCaseStatus, RELIABILITY_LABEL } from "@/modules/reliability/classify";

/**
 * Deterministic data selection for the briefing. Every statement carries typed refs
 * ("finding:<id>", "evidence:<id>", "action:<id>"); the AI may only rephrase/prioritise these statements.
 */
export type BriefingRole = "PMO" | "ADDITIONAL_MANAGER" | "LINE_MANAGER" | "TECH_LEAD" | "HR";
export type Statement = { text: string; refs: string[] };
export type Section = { key: string; title: string; statements: Statement[]; note?: string; source?: "AI" | "DETERMINISTIC" };
export type Snapshot = { levels: Record<string, string>; openFindings: Record<string, string>; resolved: string[] };
export type OpenActionLite = { id: string; employeeName: string; title: string; dueDate: string | null; ownerRole: string | null };

export const SECTION_TITLES: Record<string, string> = {
  urgent: "Most urgent problems",
  intervention: "Employees needing intervention",
  contradictions: "New contradictions",
  resolved: "Newly resolved blockers",
  approaching: "Employees approaching readiness",
  overdue: "Overdue actions and escalations",
  validations: "Outstanding technical validations",
  ktGaps: "KT gaps",
  risk: "Risk overview",
  distribution: "Readiness distribution",
  local: "Local practical blockers",
  priorities: "Recommended priorities",
  changes: "Changes since the previous briefing",
};

const ROLE_SECTIONS: Record<BriefingRole, string[]> = {
  // Portfolio level: risk and readiness distribution (formerly the Management view), the most urgent problems and escalations.
  PMO: ["risk", "distribution", "urgent", "contradictions", "overdue", "resolved", "changes"],
  ADDITIONAL_MANAGER: ["risk", "distribution", "urgent", "intervention", "overdue", "approaching", "resolved", "changes"],
  TECH_LEAD: ["validations", "ktGaps", "contradictions", "approaching", "resolved", "priorities", "changes"],
  LINE_MANAGER: ["local", "intervention", "overdue", "resolved", "changes"],
  HR: ["local", "overdue", "changes"],
};

const tracker = (c: PortfolioCase) => c.state.evidence.find((e) => e.sourceType === "TRACKER")?.id;

export function snapshotOf(portfolio: PortfolioCase[]): Snapshot {
  return {
    levels: Object.fromEntries(portfolio.map((c) => [c.state.employee.id, c.readiness.assessed])),
    openFindings: Object.fromEntries(portfolio.flatMap((c) => c.open.map((f) => [f.id, `${c.state.employee.name}: ${f.title}`]))),
    resolved: portfolio.flatMap((c) => c.state.findings.filter((f) => f.status === "RESOLVED").map((f) => f.id)),
  };
}

export function selectBriefing(role: BriefingRole, portfolio: PortfolioCase[], groups: FollowUpGroup[], actions: OpenActionLite[], previous: { snapshot: Snapshot; generatedAt: string } | null, evaluationDate: string): Section[] {
  const all = portfolio.flatMap((c) => c.open.map((f) => ({ c, f })));
  const name = (c: PortfolioCase) => c.state.employee.name;
  const sections: Record<string, Statement[]> = {};

  sections.urgent = all.filter(({ f }) => f.severity === "CRITICAL" || f.severity === "HIGH")
    .sort((a, b) => SEVERITY_RANK[b.f.severity] - SEVERITY_RANK[a.f.severity])
    .slice(0, 6).map(({ c, f }) => ({ text: `${name(c)}: ${f.title} (${f.severity.toLowerCase()}).`, refs: [`finding:${f.id}`] }));

  sections.intervention = portfolio.filter((c) => c.open.some((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK.HIGH))
    .map((c) => ({ text: `${name(c)} — ${c.open.filter((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK.HIGH).length} high/critical finding(s); assessed ${READINESS_LABEL[c.readiness.assessed]}.`, refs: c.open.filter((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK.HIGH).map((f) => `finding:${f.id}`) }));

  const prevOpen = new Set(Object.keys(previous?.snapshot.openFindings ?? {}));
  sections.contradictions = portfolio.flatMap((c) => c.state.findings.filter((f) => f.category === "CONFLICT" && (f.status === "OPEN" || f.status === "PROPOSED") && !prevOpen.has(f.id))
    .map((f) => ({ text: `${name(c)}: ${f.title}${f.status === "PROPOSED" ? " (AI-proposed, awaiting review)" : ""}.`, refs: [`finding:${f.id}`, ...f.evidenceIds.map((e) => `evidence:${e}`)] })));

  const prevResolved = new Set(previous?.snapshot.resolved ?? []);
  sections.resolved = portfolio.flatMap((c) => c.state.findings.filter((f) => f.status === "RESOLVED" && !prevResolved.has(f.id) && (!previous || (f.resolvedAt ?? "") > previous.generatedAt))
    .map((f) => ({ text: `${name(c)}: resolved — ${f.title} (${(f.resolutionType ?? "").toLowerCase().replaceAll("_", " ")}).`, refs: [`finding:${f.id}`] })));

  sections.approaching = portfolio.map((c) => ({ c, left: c.readiness.gates.filter((g) => g.status !== "SATISFIED") }))
    .filter(({ c, left }) => left.length <= 2 || ["READY_WITH_SUPPORT", "PARTIALLY_READY"].includes(c.readiness.assessed))
    .map(({ c, left }) => ({ text: `${name(c)} (assessed ${READINESS_LABEL[c.readiness.assessed]}): ${left.length} gate(s) left — ${left.slice(0, 4).map((g) => g.label.toLowerCase()).join("; ")}${left.length > 4 ? "; …" : ""}.`, refs: [...left.flatMap((g) => g.evidenceIds).slice(0, 4).map((e) => `evidence:${e}`), ...(tracker(c) ? [`evidence:${tracker(c)}`] : [])] }));

  sections.overdue = [
    ...actions.filter((a) => a.dueDate && a.dueDate < evaluationDate).map((a) => ({ text: `${a.employeeName}: action "${a.title}" overdue since ${a.dueDate}.`, refs: [`action:${a.id}`] })),
    ...groups.filter((g) => g.escalationLevel === 2).map((g) => ({ text: `${g.stakeholder.label}: ${g.items.filter((i) => i.escalationLevel === 2).length} item(s) open ≥ escalation threshold — escalation recommended (not sent).`, refs: g.items.filter((i) => i.escalationLevel === 2).flatMap((i) => (i.refs.findingId ? [`finding:${i.refs.findingId}`] : i.refs.actionId ? [`action:${i.refs.actionId}`] : i.facts.map((f) => `evidence:${f.evidenceId}`))) })),
  ];

  sections.validations = portfolio.filter((c) => ["READY_WITH_SUPPORT", "PARTIALLY_READY", "INDEPENDENTLY_READY"].includes(c.readiness.assessed) && c.readiness.gates.find((g) => g.id === "TECH_VALIDATION_APPROVED")?.status !== "SATISFIED")
    .map((c) => ({ text: `${name(c)}: assessed ${READINESS_LABEL[c.readiness.assessed]} but no final technical validation recorded.`, refs: [...(tracker(c) ? [`evidence:${tracker(c)}`] : []), ...c.open.filter((f) => f.category === "CONFLICT" || f.category === "READINESS_CLAIM").map((f) => `finding:${f.id}`)] }));

  sections.ktGaps = portfolio.flatMap((c) => c.state.kt.filter((k) => k.status === "CONFIRMED" && !(k.stage === "INDEPENDENT_EXECUTION" && k.stageBasis === "OBSERVED"))
    .map((k) => ({ text: `${name(c)}: ${k.title} — ${k.stage.replaceAll("_", " ").toLowerCase()}${k.stageBasis === "SELF_REPORTED" ? " (self-reported)" : ""}.`, refs: k.evidenceId ? [`evidence:${k.evidenceId}`] : (tracker(c) ? [`evidence:${tracker(c)}`] : []) })));
  if (!sections.ktGaps.length) sections.ktGaps = [];

  const bySeverity = (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) => ({ s, items: all.filter(({ f }) => f.severity === s) })).filter((x) => x.items.length);
  sections.risk = [
    ...bySeverity.map(({ s, items }) => ({ text: `${items.length} open ${s.toLowerCase()} finding(s) across ${new Set(items.map(({ c }) => c.state.employee.id)).size} case(s).`, refs: items.slice(0, 6).map(({ f }) => `finding:${f.id}`) })),
    ...Object.entries(portfolio.reduce<Record<string, PortfolioCase[]>>((m, c) => { const k = classifyCaseStatus(c.state).category; (m[k] ??= []).push(c); return m; }, {}))
      .map(([k, cs]) => ({ text: `Status reliability ${RELIABILITY_LABEL[k as keyof typeof RELIABILITY_LABEL].toLowerCase()}: ${cs.map(name).join(", ")}.`, refs: cs.map((c) => tracker(c)).filter((x): x is string => Boolean(x)).map((e) => `evidence:${e}`) })),
  ];

  sections.distribution = Object.entries(portfolio.reduce<Record<string, PortfolioCase[]>>((m, c) => { (m[c.readiness.assessed] ??= []).push(c); return m; }, {}))
    .map(([level, cs]) => ({ text: `${READINESS_LABEL[level as ReadinessLevel]}: ${cs.length} (${cs.map(name).join(", ")}). Validated: ${cs.filter((c) => c.readiness.validated).length}.`, refs: cs.map((c) => tracker(c)).filter((x): x is string => Boolean(x)).map((e) => `evidence:${e}`) }));

  sections.local = all.filter(({ f }) => ["ACCESS", "MISSING_INFO", "OWNERSHIP"].includes(f.category))
    .map(({ c, f }) => ({ text: `${name(c)}: ${f.title}.`, refs: [`finding:${f.id}`] }));

  sections.priorities = groups.slice(0, 5).map((g, i) => ({ text: `${i + 1}. Follow up with ${g.stakeholder.label} on ${g.items.length} item(s) (priority ${g.score}).`, refs: g.items.slice(0, 4).flatMap((it) => (it.refs.findingId ? [`finding:${it.refs.findingId}`] : it.refs.actionId ? [`action:${it.refs.actionId}`] : it.facts.slice(0, 1).map((f) => `evidence:${f.evidenceId}`))) }));

  sections.changes = previous ? [
    ...portfolio.filter((c) => previous.snapshot.levels[c.state.employee.id] && previous.snapshot.levels[c.state.employee.id] !== c.readiness.assessed)
      .map((c) => ({ text: `${name(c)}: assessed ${READINESS_LABEL[previous.snapshot.levels[c.state.employee.id] as ReadinessLevel] ?? previous.snapshot.levels[c.state.employee.id]} → ${READINESS_LABEL[c.readiness.assessed]}.`, refs: [...(tracker(c) ? [`evidence:${tracker(c)}`] : [])] })),
    ...all.filter(({ f }) => !prevOpen.has(f.id)).map(({ c, f }) => ({ text: `New: ${name(c)} — ${f.title}.`, refs: [`finding:${f.id}`] })),
    ...Object.keys(previous.snapshot.openFindings).filter((id) => !all.some(({ f }) => f.id === id)).map((id) => ({ text: `No longer open: ${previous.snapshot.openFindings[id]}.`, refs: [`finding:${id}`] })),
  ] : [];

  return ROLE_SECTIONS[role].map((key) => ({
    key, title: SECTION_TITLES[key], statements: (sections[key] ?? []).filter((s) => s.refs.length > 0),
    ...(key === "changes" && !previous ? { note: "First briefing for this role — no previous briefing to compare with." } : {}),
  }));
}
