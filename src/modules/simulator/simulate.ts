import { addDays } from "@/lib/clock";
import { ACCESS_STATUSES, ACCESS_STATUS_LABEL, GATE_LABEL, KT_STAGES, KT_STAGE_LABEL, READINESS_LABEL, roleLabel, type CaseState, type GateStatus } from "@/domain/types";
import { evaluateReadiness, type ReadinessResult } from "@/modules/readiness/evaluate";
import type { Override, SimulationOverrides } from "./overrides";

/** A toggle the UI can offer. Generated only from the case's actual unsatisfied items — never a fixed list. */
export type Toggle =
  | { key: string; kind: "select"; group: string; label: string; options: { value: string; label: string; override: Override }[] }
  | { key: string; kind: "check"; group: string; label: string; override: Override };

export function availableToggles(state: CaseState, readiness: ReadinessResult): Toggle[] {
  const toggles: Toggle[] = [];
  const gate = (id: string) => readiness.gates.find((g) => g.id === id)?.status;

  for (const a of state.access.filter((x) => x.required && x.status !== "USABLE")) {
    const later = ACCESS_STATUSES.slice(ACCESS_STATUSES.indexOf(a.status) + 1).filter((s) => s !== "REJECTED");
    toggles.push({ key: `access:${a.id}`, kind: "select", group: "Access", label: `${a.application} (now: ${ACCESS_STATUS_LABEL[a.status]})`, options: later.map((s) => ({ value: s, label: ACCESS_STATUS_LABEL[s], override: { kind: "ACCESS_STATUS", accessId: a.id, status: s } })) });
  }
  for (const k of state.kt.filter((x) => x.status !== "REJECTED")) {
    if (k.status === "PROPOSED") toggles.push({ key: `confirm-kt:${k.id}`, kind: "check", group: "Knowledge transfer", label: `Agree proposed KT requirement "${k.title}"`, override: { kind: "CONFIRM_KT", ktId: k.id } });
    if (k.stage === "INDEPENDENT_EXECUTION" && k.stageBasis === "OBSERVED") continue;
    const stages = KT_STAGES.slice(Math.max(1, KT_STAGES.indexOf(k.stage) + (k.stageBasis === "OBSERVED" ? 1 : 0)));
    toggles.push({ key: `kt:${k.id}`, kind: "select", group: "Knowledge transfer", label: `${k.title} (now: ${KT_STAGE_LABEL[k.stage]}${k.stage !== "NOT_STARTED" ? `, ${k.stageBasis.toLowerCase().replaceAll("_", " ")}` : ""})`, options: stages.map((s) => ({ value: s, label: `${KT_STAGE_LABEL[s]} — observed`, override: { kind: "KT_STAGE", ktId: k.id, stage: s } })) });
  }
  if (gate("SCOPE_CONFIRMED") !== "SATISFIED") toggles.push({ key: "scope", kind: "check", group: "Scope and owners", label: `Confirm ${state.employee.projectId ? "exact role" : "project and exact role"}`, override: { kind: "CONFIRM_SCOPE" } });
  const owners: ["LINE_MANAGER" | "TECH_LEAD" | "KT_OWNER", boolean][] = [
    ["LINE_MANAGER", !state.people.lineManager?.name && !state.people.lineManagerText],
    ["TECH_LEAD", !state.people.techLead?.name],
    ["KT_OWNER", !state.people.ktOwner?.name],
  ];
  for (const [role, missing] of owners) if (missing) toggles.push({ key: `owner:${role}`, kind: "check", group: "Scope and owners", label: `Assign a named ${roleLabel(role)}`, override: { kind: "ASSIGN_OWNER", role } });
  for (const f of state.findings.filter((x) => x.status === "OPEN" && x.category === "CONFLICT")) {
    toggles.push({ key: `conflict:${f.id}`, kind: "select", group: "Conflicts and blockers", label: `Resolve: ${f.title}`, options: [...new Set(f.evidenceIds)].map((id) => ({ value: id, label: `${id} is correct`, override: { kind: "RESOLVE_FINDING", findingId: f.id, winnerEvidenceId: id } })) });
  }
  for (const f of state.findings.filter((x) => x.status === "OPEN" && x.category !== "CONFLICT" && ["HIGH", "CRITICAL"].includes(x.severity) && !x.ownerRole)) {
    toggles.push({ key: `finding:${f.id}`, kind: "check", group: "Conflicts and blockers", label: `Resolve: ${f.title}`, override: { kind: "RESOLVE_FINDING", findingId: f.id } });
  }
  if (gate("READINESS_DATE_RECORDED") !== "SATISFIED") toggles.push({ key: "date", kind: "check", group: "Validation", label: `Set a readiness date (${addDays(state.evaluationDate, 14)})`, override: { kind: "SET_READINESS_DATE", date: addDays(state.evaluationDate, 14) } });
  if (gate("TECH_VALIDATION_APPROVED") !== "SATISFIED") toggles.push({ key: "validation", kind: "check", group: "Validation", label: "Record technical-owner validation (independent readiness)", override: { kind: "RECORD_VALIDATION" } });
  return toggles;
}

export type SimulationResult = {
  current: { level: string; reasons: string[] };
  simulated: { level: string; reasons: string[] };
  gatesFlipped: { id: string; label: string; before: GateStatus; after: GateStatus }[];
  blockersRemoved: string[];
  unblockedActivities: string[];
  remainingPrerequisites: string[];
  recommendedOrder: string[];
  rootBlockersAfter: string[];
  usedProposed: boolean;
  changes: string[];
};

export function describeOverride(state: CaseState, o: Override): string {
  switch (o.kind) {
    case "ACCESS_STATUS": return `${state.access.find((a) => a.id === o.accessId)?.application ?? o.accessId} → ${ACCESS_STATUS_LABEL[o.status]}`;
    case "KT_STAGE": return `${state.kt.find((k) => k.id === o.ktId)?.title ?? o.ktId} → ${KT_STAGE_LABEL[o.stage]} (observed)`;
    case "CONFIRM_KT": return `KT requirement agreed: ${state.kt.find((k) => k.id === o.ktId)?.title ?? o.ktId}`;
    case "ASSIGN_OWNER": return `Named ${roleLabel(o.role)} assigned`;
    case "CONFIRM_SCOPE": return "Project and exact role confirmed";
    case "RESOLVE_FINDING": return `Resolved: ${state.findings.find((f) => f.id === o.findingId)?.title ?? o.findingId}${o.winnerEvidenceId ? ` (${o.winnerEvidenceId} correct)` : ""}`;
    case "RECORD_VALIDATION": return "Technical-owner validation recorded";
    case "SET_READINESS_DATE": return `Readiness date set to ${o.date}`;
  }
}

/**
 * Pure what-if: the actual state versus the same state with overrides applied to a clone.
 * Uses exactly evaluateReadiness and the dependency propagation. Never writes anything.
 */
export function simulate(state: CaseState, overrides: SimulationOverrides): SimulationResult {
  const before = evaluateReadiness(state);
  const after = evaluateReadiness(state, overrides);
  const label = (r: ReadinessResult, key: string) => r.graph.nodes.find((n) => n.key === key)?.label ?? key;
  const blockedBefore = before.graph.nodes.filter((n) => n.display === "BLOCKED");
  const stillBlocked = new Set(after.graph.nodes.filter((n) => n.display === "BLOCKED").map((n) => n.key));
  const rootBefore = new Set(before.graph.rootBlockers);
  const rootAfter = new Set(after.graph.rootBlockers);
  return {
    current: { level: READINESS_LABEL[before.assessed], reasons: before.assessedReasons },
    simulated: { level: READINESS_LABEL[after.assessed], reasons: after.assessedReasons },
    gatesFlipped: after.gates.map((g) => ({ id: g.id, label: GATE_LABEL[g.id], before: before.gates.find((b) => b.id === g.id)!.status, after: g.status })).filter((g) => g.before !== g.after),
    blockersRemoved: [...new Set([...[...rootBefore].filter((k) => !rootAfter.has(k)).map((k) => `${label(before, k)} (root blocker)`), ...blockedBefore.filter((n) => !stillBlocked.has(n.key)).map((n) => n.label)])],
    unblockedActivities: blockedBefore.filter((n) => n.type === "kt" && !stillBlocked.has(n.key)).map((n) => n.label),
    remainingPrerequisites: after.graph.minimalPrerequisites.map((k) => label(after, k)),
    recommendedOrder: after.graph.recommendedOrder.map((k) => label(after, k)),
    rootBlockersAfter: after.graph.rootBlockers.map((k) => label(after, k)),
    usedProposed: overrides.includeProposed,
    changes: overrides.items.map((o) => describeOverride(state, o)),
  };
}
