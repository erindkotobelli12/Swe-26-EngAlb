import { READINESS_LABEL, type CaseState, type Gate, type ReadinessLevel } from "@/domain/types";
import { buildGraph, nodeKey, type GraphResult } from "@/modules/dependencies/graph";
import { applyOverrides, type SimulationOverrides } from "@/modules/simulator/overrides";
import { computeGates, latestValidation } from "./gates";

export type ReadinessResult = {
  /** Reported: the tracker status, verbatim. */
  reported: string;
  /** Assessed: computed deterministically by the system. */
  assessed: ReadinessLevel;
  assessedReasons: string[];
  /** Validated: set only by a human technical owner's decision. */
  validated: ReadinessLevel | null;
  validatedBy: string | null;
  gates: Gate[];
  graph: GraphResult;
  effectiveState: CaseState;
};

/** Maps a free-text tracker status to the closest readiness level (used to compare reported vs assessed). */
export function reportedLevel(trackerStatus: string): ReadinessLevel | null {
  const s = trackerStatus.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, ReadinessLevel> = {
    preonboarding: "PRE_ONBOARDING", blocked: "BLOCKED", accesspending: "BLOCKED", shadowing: "SHADOWING", ktstarted: "SHADOWING",
    supportedexecution: "SUPPORTED_EXECUTION", partiallyready: "PARTIALLY_READY", readywithsupport: "READY_WITH_SUPPORT",
    independentlyready: "INDEPENDENTLY_READY", independent: "INDEPENDENTLY_READY", completed: "INDEPENDENTLY_READY", closed: "INDEPENDENTLY_READY",
  };
  return map[s] ?? null;
}

export const LEVEL_RANK: Record<ReadinessLevel, number> = {
  UNKNOWN: 0, PRE_ONBOARDING: 1, BLOCKED: 1, SHADOWING: 2, SUPPORTED_EXECUTION: 3, PARTIALLY_READY: 4, READY_WITH_SUPPORT: 5, INDEPENDENTLY_READY: 6,
};

function assessLevel(state: CaseState, gates: Gate[], graph: GraphResult): { level: ReadinessLevel; reasons: string[] } {
  if (gates.every((g) => g.status === "SATISFIED")) return { level: "INDEPENDENTLY_READY", reasons: ["Every readiness gate is satisfied, including technical-owner validation."] };

  // KT already covered by a confirmed skill is not part of the learning path, so it does not drive the level.
  const agreed = state.kt.filter((k) => k.status === "CONFIRMED" && k.required && !k.coveredBySkill);
  // Assessment results never move a KT stage; stages backed only by an assessment are ignored here.
  const staged = agreed.filter((k) => k.stageBasis !== "ASSESSMENT");
  const progressed = staged.filter((k) => k.stage !== "NOT_STARTED");
  const display = new Map(graph.nodes.map((n) => [n.key, n]));

  if (!progressed.length) {
    if (state.employee.startDate > state.evaluationDate) return { level: "PRE_ONBOARDING", reasons: [`Start date ${state.employee.startDate} is after the evaluation date.`] };
    const blockedKt = agreed.filter((k) => display.get(nodeKey("kt", k.id))?.display === "BLOCKED");
    if (blockedKt.length) {
      const blockers = blockedKt.flatMap((k) => display.get(nodeKey("kt", k.id))!.blockedBy.map((b) => display.get(b)?.label ?? b));
      return { level: "BLOCKED", reasons: [`KT cannot start: ${blockedKt.map((k) => k.title).join(", ")} blocked by ${[...new Set(blockers)].join(", ")} (confirmed dependency).`] };
    }
    const unusable = state.access.filter((a) => a.required && a.status !== "USABLE");
    if (!agreed.length && unusable.length) {
      return { level: "BLOCKED", reasons: [`Required access not usable (${unusable.map((a) => a.application).join(", ")}) and no KT activity has started; no confirmed dependency shows what could proceed meanwhile.`] };
    }
    if (/blocked/i.test(state.employee.trackerStatus)) return { level: "BLOCKED", reasons: ["Tracker reports Blocked; accepted conservatively although the cause is not recorded."] };
    if (agreed.length || state.access.length) return { level: "PRE_ONBOARDING", reasons: ["Prerequisites are recorded but no KT activity has started."] };
    return { level: "UNKNOWN", reasons: ["Insufficient evidence: no access, KT or execution records. Unknown is not treated as progress."] };
  }

  const basisNote = progressed.some((k) => k.stageBasis === "SELF_REPORTED") ? " Some stages are self-reported and not yet observed." : "";
  const core = staged.filter((k) => k.scopeType === "CORE");
  const complex = staged.filter((k) => k.scopeType === "COMPLEX");
  const coreIndependent = core.filter((k) => k.stage === "INDEPENDENT_EXECUTION");
  if (core.length && coreIndependent.length === core.length) {
    const open = [...complex.filter((k) => k.stage !== "INDEPENDENT_EXECUTION").map((k) => k.title)];
    const unmet = gates.filter((g) => g.status !== "SATISFIED").map((g) => g.label.toLowerCase());
    return {
      level: "READY_WITH_SUPPORT",
      reasons: [
        open.length ? `Core scope executed independently; still needs support for: ${open.join(", ")}.` : "All agreed KT executed independently, but independent readiness is not validated.",
        `Outstanding gates: ${unmet.join("; ")}.${basisNote}`,
      ],
    };
  }
  if (coreIndependent.length) {
    return { level: "PARTIALLY_READY", reasons: [`Independent for part of the core scope (${coreIndependent.map((k) => k.title).join(", ")}); not for ${core.filter((k) => k.stage !== "INDEPENDENT_EXECUTION").map((k) => k.title).join(", ")}.${basisNote}`] };
  }
  if (progressed.some((k) => k.stage === "SUPPORTED_EXECUTION" || k.stage === "INDEPENDENT_EXECUTION")) {
    return { level: "SUPPORTED_EXECUTION", reasons: [`Working with guidance on: ${progressed.map((k) => k.title).join(", ")}.${basisNote}`] };
  }
  return { level: "SHADOWING", reasons: [`Shadowing: ${progressed.map((k) => k.title).join(", ")}.${basisNote}`] };
}

/**
 * The single readiness function. The simulator calls exactly this with overrides applied to a cloned state.
 */
export function evaluateReadiness(state: CaseState, overrides?: SimulationOverrides): ReadinessResult {
  const effective = applyOverrides(state, overrides);
  const gates = computeGates(effective);
  const graph = buildGraph(effective, gates, overrides?.includeProposed ?? false);
  const { level, reasons } = assessLevel(effective, gates, graph);
  const v = latestValidation(effective.validations);
  return {
    reported: effective.employee.trackerStatus,
    assessed: level,
    assessedReasons: reasons,
    validated: v?.state === "APPROVED" ? v.validatedLevel : null,
    validatedBy: v?.state === "APPROVED" ? v.reviewerName ?? v.reviewerRole : null,
    gates,
    graph,
    effectiveState: effective,
  };
}

export const levelLabel = (l: ReadinessLevel | null | undefined) => (l ? READINESS_LABEL[l] : "Not validated");
