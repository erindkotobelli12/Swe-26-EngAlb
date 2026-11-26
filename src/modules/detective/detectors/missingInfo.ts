import { READINESS_LABEL } from "@/domain/types";
import { LEVEL_RANK, reportedLevel } from "@/modules/readiness/evaluate";
import { candidate, claimFacts, compact, nonTrackerEvidence, personLabel, trackerFact } from "../helpers";
import type { Detector } from "../types";

const KT_IN_PROGRESS = /kt started|shadowing|supported execution/i;

export const missingProject: Detector = ({ state }) => {
  if (state.employee.projectId) return [];
  return [candidate("MISSING_PROJECT", {
    fingerprint: "MISSING_PROJECT",
    title: "No project recorded",
    description: `${state.employee.name}'s tracker entry has no project, so scope, required applications and KT cannot be confirmed.`,
    facts: compact([trackerFact(state, "Project", "The tracker records no project.")]),
    assumptions: [],
    affectedEntities: [{ type: "gate", id: "SCOPE_CONFIRMED" }, { type: "case", id: state.caseId }],
    ownerRole: "PMO",
    recommendedActions: [{ action: "Confirm the project and exact role with the responsible manager and update the tracker.", ownerRole: "PMO", rationale: "Scope must be confirmed before access and KT can be planned." }],
  })];
};

export const missingLineManager: Detector = ({ state }) => {
  if (state.people.lineManager || state.people.lineManagerText) return [];
  return [candidate("MISSING_LINE_MANAGER", {
    fingerprint: "MISSING_LINE_MANAGER",
    title: "No manager recorded",
    description: "The tracker has no manager for this case, so local logistics and escalation have no owner.",
    facts: compact([trackerFact(state, "Manager", "The tracker records no manager.")]),
    assumptions: [],
    affectedEntities: [{ type: "gate", id: "OWNERS_ASSIGNED" }, { type: "case", id: state.caseId }],
    ownerRole: "PMO",
    recommendedActions: [{ action: "Identify and record the Line Manager for this case.", ownerRole: "PMO", rationale: "Every case needs an accountable Line Manager (checklist §6)." }],
  })];
};

export const ktWithoutOwner: Detector = ({ state }) => {
  const ktOwnerKnown = Boolean(state.people.ktOwner) || state.kt.some((k) => k.status === "CONFIRMED" && k.owner);
  if (ktOwnerKnown) return [];
  const progressedKt = state.kt.filter((k) => k.status === "CONFIRMED" && k.stage !== "NOT_STARTED");
  const trackerSaysKt = KT_IN_PROGRESS.test(state.employee.trackerStatus);
  if (!trackerSaysKt && !progressedKt.length) return [];
  const ktIds = new Set(progressedKt.map((k) => k.title.toLowerCase()));
  return [candidate("KT_WITHOUT_OWNER", {
    fingerprint: "KT_WITHOUT_OWNER",
    title: `"${trackerSaysKt ? state.employee.trackerStatus : "KT in progress"}" with no KT owner recorded`,
    description: "Knowledge transfer is reported as in progress, but nobody is recorded as KT owner, so execution cannot be observed or validated.",
    facts: compact([
      trackerSaysKt ? trackerFact(state, "Status", `The tracker reports "${state.employee.trackerStatus}".`) : null,
      ...claimFacts(state, (c) => c.field.startsWith("kt.") && ktIds.has(c.field.slice(3, c.field.lastIndexOf(".")).toLowerCase()), (c) => `Evidence reports KT activity progress (${c.value.toLowerCase().replaceAll("_", " ")}).`),
    ]),
    assumptions: [],
    affectedEntities: [{ type: "gate", id: "OWNERS_ASSIGNED" }, { type: "gate", id: "EXECUTION_OBSERVED" }],
    ownerRole: "PMO",
    recommendedActions: [{ action: "Identify the KT owner who will observe shadowing, supported and independent execution.", ownerRole: state.people.techLead ? "TECH_LEAD" : "PMO", rationale: "Readiness is based on observed execution; an observer must be named." }],
  })];
};

export const missingReadinessDate: Detector = ({ state, readiness }) => {
  if (state.caseInfo.expectedReadyAt || state.caseInfo.readinessReviewAt) return [];
  const noDateClaims = claimFacts(state, (c) => c.field === "case.readinessReviewAt" && c.value === "NOT_SET", () => "The source states that no readiness review date has been given.");
  const reported = reportedLevel(state.employee.trackerStatus);
  const nearReadiness = LEVEL_RANK[readiness.assessed] >= LEVEL_RANK.PARTIALLY_READY || (reported !== null && LEVEL_RANK[reported] >= LEVEL_RANK.PARTIALLY_READY);
  if (!nearReadiness && !noDateClaims.length) return [];
  return [candidate("MISSING_READINESS_DATE", {
    fingerprint: "MISSING_READINESS_DATE",
    title: "No readiness review date recorded",
    description: `The case is at or near readiness (assessed ${READINESS_LABEL[readiness.assessed]}), but no expected readiness or readiness review date is recorded.`,
    facts: compact([...noDateClaims, trackerFact(state, "Status", `The tracker reports "${state.employee.trackerStatus}".`)]),
    assumptions: [],
    affectedEntities: [{ type: "gate", id: "READINESS_DATE_RECORDED" }],
    ownerRole: "TECH_LEAD",
    recommendedActions: [{ action: "Schedule the final readiness review and record its date.", ownerRole: "TECH_LEAD", rationale: "Final readiness requires a technical-owner validation on a recorded date." }],
  })];
};

export const insufficientEvidence: Detector = ({ state }) => {
  if (nonTrackerEvidence(state).length) return [];
  return [candidate("INSUFFICIENT_EVIDENCE", {
    fingerprint: "INSUFFICIENT_EVIDENCE",
    title: "Reported status has no supporting evidence",
    description: `Only the tracker entry exists for this case. The reported status "${state.employee.trackerStatus}" cannot be verified and is shown as reported, not assessed.`,
    facts: compact([trackerFact(state, "Status", `The tracker reports "${state.employee.trackerStatus}".`)]),
    assumptions: [],
    affectedEntities: [{ type: "case", id: state.caseId }],
    ownerRole: "PMO",
    recommendedActions: [{
      action: `Request a short progress update from ${personLabel(state.people.lineManager?.name ?? state.people.lineManagerText, "Line Manager")} or the KT owner.`,
      ownerRole: "PMO",
      rationale: "Evidence is needed before any readiness assessment can be made.",
    }],
  })];
};
