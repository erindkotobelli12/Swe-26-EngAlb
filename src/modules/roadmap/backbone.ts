import { ACCESS_STATUS_LABEL, KT_STAGE_LABEL, roleLabel, type CaseState, type GateId } from "@/domain/types";
import type { ReadinessResult } from "@/modules/readiness/evaluate";

/**
 * Deterministic roadmap backbone, derived on read from the case state (so it is always "Actual").
 * Phases: 1 prerequisites → 2 knowledge transfer → 3 readiness. Status and "waits for" come from the gates and
 * the dependency graph, so the roadmap adapts automatically when an approved change updates the state.
 */
export type PlanStatus = "DONE" | "IN_PROGRESS" | "BLOCKED" | "TODO" | "UNKNOWN";
export type PlanItem = {
  key: string;
  phase: 1 | 2 | 3;
  title: string;
  owner: string;
  completion: string;
  status: PlanStatus;
  waitsFor: string[];
  evidenceIds: string[];
  proposed: boolean;
};

export const PHASES: Record<1 | 2 | 3, string> = { 1: "Week 1 · Prerequisites", 2: "Weeks 2–3 · Knowledge transfer", 3: "Week 4 · Readiness" };

export function buildBackbone(state: CaseState, readiness: ReadinessResult): PlanItem[] {
  const gate = (id: GateId) => readiness.gates.find((g) => g.id === id)!;
  const node = (key: string) => readiness.graph.nodes.find((n) => n.key === key);
  const fromGate = (id: GateId): PlanStatus => (gate(id).status === "SATISFIED" ? "DONE" : gate(id).status === "UNKNOWN" ? "UNKNOWN" : "TODO");
  const lm = state.people.lineManager?.name ?? state.people.lineManagerText;
  const tl = state.people.techLead ? state.people.techLead.name ?? "Technical Lead (name not recorded)" : "Technical Lead (not recorded)";
  const items: PlanItem[] = [];

  items.push({ key: "scope", phase: 1, title: "Confirm project and exact role", owner: lm ? `${lm} (Line Manager)` : "PMO Coordinator", completion: "Project and exact role recorded", status: fromGate("SCOPE_CONFIRMED"), waitsFor: [], evidenceIds: gate("SCOPE_CONFIRMED").evidenceIds, proposed: false });
  items.push({ key: "owners", phase: 1, title: "Name Line Manager, Technical Lead and KT owner", owner: "PMO Coordinator", completion: "All three recorded by name", status: fromGate("OWNERS_ASSIGNED"), waitsFor: [], evidenceIds: gate("OWNERS_ASSIGNED").evidenceIds, proposed: false });
  if (!state.access.length) items.push({ key: "apps", phase: 1, title: "Identify required applications", owner: lm ? `${lm} (Line Manager)` : "PMO Coordinator", completion: "Required applications recorded", status: "UNKNOWN", waitsFor: [], evidenceIds: [], proposed: false });
  for (const a of state.access.filter((x) => x.required)) {
    const n = node(`access:${a.id}`);
    const status: PlanStatus = a.status === "USABLE" ? "DONE" : n?.display === "BLOCKED" ? "BLOCKED" : a.status === "NOT_REQUESTED" || a.status === "REJECTED" ? "TODO" : "IN_PROGRESS";
    items.push({
      key: `access:${a.id}`, phase: 1, title: `Usable access: ${a.application}`, owner: a.owner ?? (a.handlerRole ? `${roleLabel(a.handlerRole)} (owner not recorded)` : "Owner not recorded"),
      completion: `Employee confirms a successful login (now: ${ACCESS_STATUS_LABEL[a.status]})`, status, waitsFor: (n?.blockedBy ?? []).map((k) => node(k)?.label ?? k),
      evidenceIds: [a.requestEvidenceId, a.evidenceId, a.usableEvidenceId].filter((x): x is string => Boolean(x)), proposed: false,
    });
  }

  const kts = state.kt.filter((k) => k.status !== "REJECTED");
  if (!kts.length) items.push({ key: "kt-topics", phase: 2, title: "Agree KT topics with the Technical Lead", owner: tl, completion: "KT activities agreed", status: "UNKNOWN", waitsFor: ["Confirm project and exact role"], evidenceIds: [], proposed: false });
  for (const k of kts) {
    const n = node(`kt:${k.id}`);
    if (k.coveredBySkill) {
      // Redundant training is skipped only through a requirement check-off by a CONFIRMED skill — never guessed.
      items.push({ key: `kt:${k.id}`, phase: 2, title: k.title, owner: tl, completion: `Skipped: already has the confirmed skill ${k.coveredBySkill.skillName} (${k.coveredBySkill.level.toLowerCase()})`, status: "DONE", waitsFor: [], evidenceIds: k.coveredBySkill.evidenceId ? [k.coveredBySkill.evidenceId] : [], proposed: false });
      continue;
    }
    const done = k.stage === "INDEPENDENT_EXECUTION" && k.stageBasis === "OBSERVED";
    const status: PlanStatus = done ? "DONE" : n?.display === "BLOCKED" ? "BLOCKED" : k.stage !== "NOT_STARTED" ? "IN_PROGRESS" : "TODO";
    items.push({
      key: `kt:${k.id}`, phase: 2, title: k.title, owner: k.owner ?? (state.people.ktOwner ? state.people.ktOwner.name ?? "KT owner (name not recorded)" : "KT owner not recorded"),
      completion: `${k.scopeType === "COMPLEX" ? "Complex/exception cases" : "Core scope"}: shadowing → supported → independent execution observed (now: ${KT_STAGE_LABEL[k.stage]})`,
      status, waitsFor: (n?.blockedBy ?? []).map((b) => node(b)?.label ?? b), evidenceIds: k.evidenceId ? [k.evidenceId] : [], proposed: k.status === "PROPOSED",
    });
  }

  for (const r of (state.requirements ?? []).filter((x) => (x.type === "SKILL" || x.type === "DOCUMENT") && x.status !== "WAIVED")) {
    const covered = r.status === "SATISFIED_BY_EXISTING_SKILL" && r.satisfiedBySkill;
    items.push({
      key: `req:${r.id}`, phase: 2, title: r.type === "SKILL" ? `Skill: ${r.title}` : r.title, owner: tl,
      completion: covered ? `Skipped: already has the confirmed skill ${r.satisfiedBySkill!.skillName} (${r.satisfiedBySkill!.level.toLowerCase()})` : r.completionCriteria,
      status: covered || r.status === "DONE" ? "DONE" : r.status === "IN_PROGRESS" ? "IN_PROGRESS" : "TODO", waitsFor: [],
      evidenceIds: covered && r.satisfiedBySkill!.evidenceId ? [r.satisfiedBySkill!.evidenceId] : [], proposed: false,
    });
  }

  items.push({ key: "date", phase: 3, title: "Record expected readiness date", owner: tl, completion: "Date recorded on the case", status: fromGate("READINESS_DATE_RECORDED"), waitsFor: [], evidenceIds: [], proposed: false });
  items.push({ key: "execution", phase: 3, title: "Observe independent execution", owner: tl, completion: "Every agreed KT activity observed at independent execution", status: fromGate("EXECUTION_OBSERVED") === "DONE" ? "DONE" : node("gate:EXECUTION_OBSERVED")?.display === "BLOCKED" ? "BLOCKED" : fromGate("EXECUTION_OBSERVED"), waitsFor: kts.filter((k) => k.status === "CONFIRMED" && !(k.stage === "INDEPENDENT_EXECUTION" && k.stageBasis === "OBSERVED")).map((k) => k.title), evidenceIds: gate("EXECUTION_OBSERVED").evidenceIds, proposed: false });
  items.push({ key: "validation", phase: 3, title: "Technical-owner validation", owner: tl, completion: "Technical Lead approves independent readiness with linked evidence", status: fromGate("TECH_VALIDATION_APPROVED") === "DONE" ? "DONE" : node("gate:TECH_VALIDATION_APPROVED")?.display === "BLOCKED" ? "BLOCKED" : "TODO", waitsFor: gate("EXECUTION_OBSERVED").status === "SATISFIED" ? [] : ["Observe independent execution"], evidenceIds: gate("TECH_VALIDATION_APPROVED").evidenceIds, proposed: false });
  return items;
}

export type BaselineEntry = { key: string; title: string; status: PlanStatus };
export function diffBackbone(baseline: BaselineEntry[], current: PlanItem[]): { key: string; title: string; before: PlanStatus | "NEW"; after: PlanStatus | "REMOVED" }[] {
  const out: { key: string; title: string; before: PlanStatus | "NEW"; after: PlanStatus | "REMOVED" }[] = [];
  for (const c of current) {
    const b = baseline.find((x) => x.key === c.key);
    if (!b) out.push({ key: c.key, title: c.title, before: "NEW", after: c.status });
    else if (b.status !== c.status) out.push({ key: c.key, title: c.title, before: b.status, after: c.status });
  }
  for (const b of baseline) if (!current.some((c) => c.key === b.key)) out.push({ key: b.key, title: b.title, before: b.status, after: "REMOVED" });
  return out;
}
