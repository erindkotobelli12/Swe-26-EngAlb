import { thresholds } from "@/config/thresholds";
import { daysBetween, formatDate } from "@/lib/clock";
import { roleLabel, type AccessItem, type CaseState, type RecommendedAction, type Severity } from "@/domain/types";
import { candidate, claimFacts } from "../helpers";
import type { CandidateFinding, Detector } from "../types";

const fieldApp = (field: string) => field.slice("access.".length, field.lastIndexOf(".")).toLowerCase();

export function accessFacts(state: CaseState, a: AccessItem) {
  return claimFacts(
    state,
    (c) => c.field.startsWith("access.") && fieldApp(c.field) === a.application.toLowerCase(),
    (c) => `${a.application}: ${c.value.toLowerCase().replaceAll("_", " ")} (${c.effectiveDate ?? "date unknown"}).`,
  );
}

function sinceDate(state: CaseState, a: AccessItem): string | null {
  return a.requestDate ?? state.evidence.find((e) => e.id === (a.requestEvidenceId ?? a.evidenceId))?.timestamp.slice(0, 10) ?? a.lastUpdate;
}

function titleFor(a: AccessItem): string {
  switch (a.status) {
    case "NOT_REQUESTED": return `${a.application} not requested`;
    case "REQUESTED": return `${a.application} requested${a.requestDate ? ` ${formatDate(a.requestDate)}` : ""} but not provisioned`;
    case "APPROVAL_PENDING": return `${a.application} awaiting ${a.approverRole ? roleLabel(a.approverRole).toLowerCase() : "owner"} approval`;
    case "APPROVED": return `${a.application} approved but not provisioned`;
    case "PROVISIONED": return `${a.application} active — successful use unconfirmed`;
    case "REJECTED": return `${a.application} request rejected`;
    default: return `${a.application} not usable`;
  }
}

function nextStep(a: AccessItem): RecommendedAction {
  switch (a.status) {
    case "APPROVAL_PENDING": return { action: `Obtain the approval decision for ${a.application}.`, ownerRole: a.approverRole ?? a.handlerRole ?? "PMO", rationale: "Approval is pending; provisioning cannot start." };
    case "PROVISIONED": return { action: `Ask the employee to confirm a successful login to ${a.application}.`, ownerRole: "EMPLOYEE", rationale: "Provisioned is not usable until successful use is confirmed." };
    case "NOT_REQUESTED": return { action: `Submit the access request for ${a.application}.`, ownerRole: "PMO", rationale: "Access has not been requested." };
    case "REJECTED": return { action: `Clarify why ${a.application} was rejected and whether it is still required.`, ownerRole: a.handlerRole ?? "PMO", rationale: "A rejected required access blocks readiness." };
    default: return { action: `Confirm the provisioning status, owner and expected date for ${a.application}.`, ownerRole: a.handlerRole ?? "PMO", rationale: "Requested but not provisioned." };
  }
}

export const accessNotUsable: Detector = ({ state }) => {
  const out: CandidateFinding[] = [];
  for (const a of state.access.filter((x) => x.required && x.status !== "USABLE")) {
    const since = sinceDate(state, a);
    const age = since ? daysBetween(since, state.evaluationDate) : null;
    let severity: Severity = "HIGH";
    if (a.status === "PROVISIONED") severity = "MEDIUM";
    else if (["REQUESTED", "APPROVAL_PENDING", "APPROVED"].includes(a.status) && age !== null && age <= thresholds.FOLLOW_UP_AFTER_DAYS) severity = "MEDIUM";
    out.push(candidate("ACCESS_NOT_USABLE", {
      fingerprint: `ACCESS_NOT_USABLE:${a.id}:${a.status}`,
      severity,
      title: titleFor(a),
      description: `${a.application} is ${a.status.replaceAll("_", " ").toLowerCase()}${age !== null ? `, ${age} days since ${a.requestDate ? "the request" : "the last source"}` : ""}. Only confirmed successful use satisfies the access gate.${a.blockerReason ? ` Recorded reason: ${a.blockerReason}.` : ""}`,
      facts: accessFacts(state, a),
      assumptions: [],
      affectedEntities: [{ type: "access", id: a.id, label: a.application }, { type: "gate", id: "ACCESS_USABLE" }],
      ownerRole: a.handlerRole ?? (a.owner ? "PMO" : null),
      recommendedActions: [nextStep(a)],
    }));
  }
  return out;
};

export const accessOwnerUnknown: Detector = ({ state }) => {
  const out: CandidateFinding[] = [];
  for (const a of state.access.filter((x) => x.required && !x.owner && ["NOT_REQUESTED", "REQUESTED", "APPROVED", "REJECTED"].includes(x.status))) {
    out.push(candidate("ACCESS_OWNER_UNKNOWN", {
      fingerprint: `ACCESS_OWNER_UNKNOWN:${a.id}`,
      title: `Owner of ${a.application} provisioning not recorded`,
      description: `Nobody is recorded as responsible for the next step on ${a.application}${a.handlerRole ? `; the request was handled by ${roleLabel(a.handlerRole)}` : ""}.`,
      facts: accessFacts(state, a),
      assumptions: a.handlerRole ? [{ statement: `${roleLabel(a.handlerRole)} may own provisioning because it handled the request.`, basis: "The request was sent to that role; ownership is not stated in any source." }] : [],
      affectedEntities: [{ type: "access", id: a.id, label: a.application }, { type: "gate", id: "BLOCKERS_OWNED" }],
      ownerRole: a.handlerRole,
      recommendedActions: [{ action: `Confirm who owns provisioning of ${a.application} and record the owner and next follow-up date.`, ownerRole: a.handlerRole ?? "PMO", rationale: "A delayed account must record its owner and next follow-up (starter pack)." }],
    }));
  }
  return out;
};
