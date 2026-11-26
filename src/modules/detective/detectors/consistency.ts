import { thresholds } from "@/config/thresholds";
import { daysBetween } from "@/lib/clock";
import { authorityFor, domainForField } from "@/domain/authority";
import { READINESS_LABEL, roleLabel, type ClaimItem, type Fact, type ReadinessLevel } from "@/domain/types";
import { LEVEL_RANK, reportedLevel } from "@/modules/readiness/evaluate";
import { approvedClaims, candidate, claimFacts, compact, trackerFact } from "../helpers";
import type { CandidateFinding, Detector } from "../types";

const PROGRESSION_FIELD = /^(access\..+\.status|kt\..+\.stage)$/i;
const POSITIVE_STATUS = /on track/i;

function valueLabel(field: string, value: string): string {
  if (field.startsWith("readiness.") && value === "INDEPENDENTLY_READY") return "independent";
  if (field.startsWith("readiness.") && value in READINESS_LABEL) return READINESS_LABEL[value as ReadinessLevel];
  return value.replaceAll("_", " ").toLowerCase();
}

/**
 * Multiple sources making different claims about the same field. Progression fields (access status, KT stage)
 * only conflict on the same date; a later value is an update, not a contradiction.
 */
export const conflictingClaims: Detector = ({ state }) => {
  const senderRole = (c: ClaimItem) => state.evidence.find((e) => e.id === c.evidenceId)?.senderRole ?? null;
  const dateOf = (c: ClaimItem) => c.effectiveDate ?? state.evidence.find((e) => e.id === c.evidenceId)?.timestamp.slice(0, 10) ?? state.evaluationDate;
  const byField = new Map<string, ClaimItem[]>();
  for (const c of approvedClaims(state)) byField.set(c.field.toLowerCase(), [...(byField.get(c.field.toLowerCase()) ?? []), c]);

  const out: CandidateFinding[] = [];
  for (const [field, claims] of byField) {
    const progression = PROGRESSION_FIELD.test(field);
    const pairs: [ClaimItem, ClaimItem][] = [];
    for (let i = 0; i < claims.length; i++) for (let j = i + 1; j < claims.length; j++) {
      const [a, b] = [claims[i], claims[j]];
      if (a.evidenceId === b.evidenceId || a.value.toLowerCase() === b.value.toLowerCase()) continue;
      const gap = Math.abs(daysBetween(dateOf(a), dateOf(b)));
      if (progression ? gap === 0 : gap <= thresholds.STALE_AFTER_DAYS) pairs.push([a, b]);
    }
    if (!pairs.length) continue;
    const involved = [...new Map(pairs.flat().map((c) => [c.id, c])).values()];
    const domain = domainForField(field);
    const authoritative = involved.filter((c) => authorityFor(senderRole(c), domain) === "AUTHORITATIVE").map((c) => senderRole(c)!);
    const ownerRole = authoritative[0] ?? (domain === "TECHNICAL_READINESS" ? "TECH_LEAD" : "PMO");
    const describe = (c: ClaimItem) => `${roleLabel(senderRole(c))}: ${valueLabel(field, c.value)}`;
    const readiness = field.startsWith("readiness.") || field.startsWith("onboarding.");
    out.push(candidate("CONFLICTING_EVIDENCE", {
      fingerprint: `CONFLICT:${field}:${involved.map((c) => c.evidenceId).sort().join("+")}`,
      title: `Conflicting ${readiness ? "readiness" : field} reports: ${involved.map(describe).join(" vs ")}`,
      description: `${involved.length} sources make different statements about ${field} within ${thresholds.STALE_AFTER_DAYS} days. The conflict stays open until a human records which source is correct or attaches new evidence.`,
      facts: involved.map((c) => ({ statement: `${describe(c)} (${dateOf(c)}).`, evidenceId: c.evidenceId, excerpt: c.excerpt })),
      assumptions: [],
      affectedEntities: [{ type: "gate", id: "NO_MATERIAL_CONFLICT" }, { type: "case", id: state.caseId }],
      ownerRole,
      recommendedActions: [{ action: readiness ? "Technical Lead confirms observed execution for the disputed scope and records a validation decision." : "Confirm the correct value with the authoritative source.", ownerRole, rationale: `${roleLabel(ownerRole)} is the authoritative source for ${domain.toLowerCase().replaceAll("_", " ")}.` }],
    }));
  }
  return out;
};

/** "Complete"/"closed"/"independent" language without observed execution or technical validation. */
export const closureWithoutEvidence: Detector = ({ state, readiness }) => {
  const executionOk = readiness.gates.find((g) => g.id === "EXECUTION_OBSERVED")?.status === "SATISFIED";
  const validationOk = readiness.gates.find((g) => g.id === "TECH_VALIDATION_APPROVED")?.status === "SATISFIED";
  if (executionOk && validationOk) return [];
  const closureFacts = claimFacts(
    state,
    (c) => ((c.field === "onboarding.closed" || c.field === "onboarding.complete") && c.value.toLowerCase() === "true") || (c.field === "readiness.reported" && c.value === "INDEPENDENTLY_READY"),
    (c) => (c.field === "readiness.reported" ? "A source reports the employee as working independently." : `A source declares onboarding ${c.field.endsWith("closed") ? "closed" : "complete"}.`),
  );
  const trackerClosed = reportedLevel(state.employee.trackerStatus) === "INDEPENDENTLY_READY";
  if (!closureFacts.length && !trackerClosed) return [];
  const gaps: Fact[] = claimFacts(state, (c) => c.field.startsWith("kt.") && c.value !== "INDEPENDENT_EXECUTION", (c) => `Outstanding KT: ${c.field.slice(3, c.field.lastIndexOf("."))} is ${c.value.toLowerCase().replaceAll("_", " ")}.`);
  return [candidate("CLOSURE_WITHOUT_EVIDENCE", {
    fingerprint: `CLOSURE_WITHOUT_EVIDENCE:${[...new Set(closureFacts.map((f) => f.evidenceId))].sort().join("+") || "TRACKER"}`,
    title: "Appears complete, but readiness is not demonstrated",
    description: `Closure or independence is declared, but ${[!executionOk && "independent execution has not been observed for every agreed KT activity", !validationOk && "no technical-owner validation is recorded"].filter(Boolean).join(" and ")}. Final readiness is based on observed execution plus technical validation, not on declarations.`,
    facts: compact([...closureFacts, ...gaps, trackerClosed ? trackerFact(state, "Status", `The tracker reports "${state.employee.trackerStatus}".`) : null]),
    assumptions: [],
    affectedEntities: [{ type: "gate", id: "EXECUTION_OBSERVED" }, { type: "gate", id: "TECH_VALIDATION_APPROVED" }],
    ownerRole: "TECH_LEAD",
    recommendedActions: [{ action: "Do not close onboarding. Technical Lead observes the outstanding scope and records a validation decision.", ownerRole: "TECH_LEAD", rationale: "Only the technical owner can validate final readiness." }],
  })];
};

/** Tracker status inconsistent with the evidence-derived state. */
export const statusEvidenceMismatch: Detector = ({ state, readiness }) => {
  const reported = reportedLevel(state.employee.trackerStatus);
  const positive = POSITIVE_STATUS.test(state.employee.trackerStatus) || (reported !== null && LEVEL_RANK[reported] >= LEVEL_RANK.PARTIALLY_READY);
  const reasons: string[] = [];
  const facts: (Fact | null)[] = [trackerFact(state, "Status", `The tracker reports "${state.employee.trackerStatus}".`)];
  if (positive && !state.employee.projectId) {
    reasons.push("no project is recorded");
    facts.push(trackerFact(state, "Project", "No project is recorded."));
  }
  if (positive) {
    for (const a of state.access.filter((x) => x.required && x.status !== "USABLE")) {
      const ev = state.evidence.find((e) => e.id === (a.evidenceId ?? a.requestEvidenceId));
      const age = ev ? daysBetween(ev.timestamp, state.evaluationDate) : 0;
      if (age > thresholds.FOLLOW_UP_AFTER_DAYS) {
        reasons.push(`${a.application} has not been confirmed usable in ${age} days`);
        const claim = approvedClaims(state).find((c) => c.field.toLowerCase() === `access.${a.application.toLowerCase()}.status`);
        if (claim) facts.push({ statement: `${a.application} was reported as ${claim.value.toLowerCase().replaceAll("_", " ")} and never confirmed.`, evidenceId: claim.evidenceId, excerpt: claim.excerpt });
      }
    }
  }
  if (reported && readiness.assessed !== "UNKNOWN" && LEVEL_RANK[reported] > LEVEL_RANK[readiness.assessed]) {
    reasons.push(`the evidence supports ${READINESS_LABEL[readiness.assessed]}, lower than reported`);
  }
  if (!reasons.length) return [];
  return [candidate("STATUS_EVIDENCE_MISMATCH", {
    fingerprint: `STATUS_EVIDENCE_MISMATCH:${state.employee.trackerStatus}`,
    title: `"${state.employee.trackerStatus}" while ${reasons[0]}`,
    description: `The tracker reports "${state.employee.trackerStatus}", but ${reasons.join("; ")}.`,
    facts: compact(facts),
    assumptions: [],
    affectedEntities: [{ type: "case", id: state.caseId }, ...(!state.employee.projectId ? [{ type: "gate" as const, id: "SCOPE_CONFIRMED" }] : [])],
    ownerRole: "PMO",
    recommendedActions: [{ action: "Correct the tracker status or record the evidence that supports it.", ownerRole: state.people.lineManager || state.people.lineManagerText ? "LINE_MANAGER" : "PMO", rationale: "Tracker status must reflect evidence." }],
  })];
};

export const blockedWithoutCause: Detector = ({ state }) => {
  if (!/blocked/i.test(state.employee.trackerStatus)) return [];
  const explained = state.access.some((a) => a.required && a.status !== "USABLE") || state.access.some((a) => a.blockerReason);
  if (explained) return [];
  const lm = state.people.lineManager?.name ?? state.people.lineManagerText;
  return [candidate("BLOCKED_WITHOUT_CAUSE", {
    fingerprint: "BLOCKED_WITHOUT_CAUSE",
    title: "Blocked with no recorded cause or owner",
    description: "The tracker reports Blocked, but no source records what blocks the employee or who owns resolving it.",
    facts: compact([trackerFact(state, "Status", "The tracker reports Blocked.")]),
    assumptions: [],
    affectedEntities: [{ type: "gate", id: "BLOCKERS_OWNED" }, { type: "case", id: state.caseId }],
    ownerRole: null,
    recommendedActions: [{
      action: `Ask ${lm ? `the Line Manager (${lm})` : "the responsible manager"} for the blocker cause, its owner and the next follow-up date.`,
      ownerRole: lm ? "LINE_MANAGER" : "PMO",
      rationale: "A blocker must be owned and followed to closure (checklist §6).",
    }],
  })];
};

export const unverifiedSelfReport: Detector = ({ state }) => {
  const selfEvidence = new Set(state.evidence.filter((e) => e.senderRole === "EMPLOYEE").map((e) => e.id));
  const facts = claimFacts(state, (c) => selfEvidence.has(c.evidenceId) && (c.field.startsWith("kt.") || c.field.startsWith("access.")), (c) => `Self-reported: ${c.field.replace(/^(kt|access)\./, "").replace(/\.(stage|status|available)$/, "")} — ${c.value.toLowerCase().replaceAll("_", " ")}.`);
  const selfStages = state.kt.filter((k) => k.status === "CONFIRMED" && k.stage !== "NOT_STARTED" && k.stageBasis === "SELF_REPORTED");
  if (!facts.length && !selfStages.length) return [];
  return [candidate("UNVERIFIED_SELF_REPORT", {
    fingerprint: `UNVERIFIED_SELF_REPORT:${[...selfEvidence].sort().join("+")}`,
    title: "Progress and tool availability are self-reported only",
    description: "Independence and tool availability come only from the employee's own check-in. They have not been observed by a technical owner or confirmed by Access Support.",
    facts,
    assumptions: [],
    affectedEntities: [{ type: "gate", id: "EXECUTION_OBSERVED" }, ...selfStages.map((k) => ({ type: "kt" as const, id: k.id, label: k.title }))],
    ownerRole: "TECH_LEAD",
    recommendedActions: [{ action: "Observe the reported independent activities and record the observation as evidence.", ownerRole: "TECH_LEAD", rationale: "Self-reports support, but cannot establish, readiness." }],
  })];
};
