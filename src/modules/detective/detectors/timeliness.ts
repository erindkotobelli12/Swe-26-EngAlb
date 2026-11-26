import { thresholds } from "@/config/thresholds";
import { daysBetween } from "@/lib/clock";
import { roleLabel, type GateId } from "@/domain/types";
import { candidate, compact, nonTrackerEvidence, trackerFact } from "../helpers";
import { staleSeverity, type Detector } from "../types";

/** Stale when the newest source (tracker update or evidence) is older than STALE_AFTER_DAYS. */
export const staleStatus: Detector = ({ state }) => {
  const dates = [state.employee.lastUpdate, ...nonTrackerEvidence(state).map((e) => e.timestamp.slice(0, 10))];
  const newest = dates.sort().at(-1)!;
  const age = daysBetween(newest, state.evaluationDate);
  if (age <= thresholds.STALE_AFTER_DAYS) return [];
  return [candidate("STALE_STATUS", {
    fingerprint: "STALE_STATUS",
    severity: staleSeverity(age),
    title: `Stale for ${age} days`,
    description: `The newest source for this case is dated ${newest}, ${age} days before the evaluation date (threshold ${thresholds.STALE_AFTER_DAYS} days). The reported status "${state.employee.trackerStatus}" may no longer be true.`,
    facts: compact([trackerFact(state, "Last update", `The tracker was last updated ${state.employee.lastUpdate}.`)]),
    assumptions: [],
    affectedEntities: [{ type: "case", id: state.caseId }],
    ownerRole: "PMO",
    recommendedActions: [{ action: "Request a current status update and the date of any outstanding step.", ownerRole: "PMO", rationale: `No update for ${age} days.` }],
  })];
};

/** A verbatim first sentence of a source, used as the excerpt of a request. */
export function firstSentence(content: string): string {
  const match = content.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (match ? match[0] : content).trim();
}

function gatesMentioned(text: string): GateId[] {
  const gates: GateId[] = [];
  if (/\brole\b|\bproject\b/i.test(text)) gates.push("SCOPE_CONFIRMED");
  if (/owner|lead|manager/i.test(text)) gates.push("OWNERS_ASSIGNED");
  if (/readiness date|readiness review|ready date/i.test(text)) gates.push("READINESS_DATE_RECORDED");
  if (/access|account/i.test(text)) gates.push("ACCESS_USABLE");
  return gates;
}

export const unansweredRequest: Detector = ({ state }) => {
  const out = [];
  for (const req of state.evidence.filter((e) => e.isRequest && e.reviewStatus !== "REJECTED")) {
    const replied = state.evidence.some((e) => e.inReplyToId === req.id && e.reviewStatus === "APPROVED")
      || state.communications.some((c) => (c.requestEvidenceIds.includes(req.id) || c.outboxEvidenceIds.includes(req.id)) && (c.status === "RESPONDED" || c.status === "CLOSED"));
    const age = daysBetween(req.timestamp, state.evaluationDate);
    if (replied || age <= thresholds.FOLLOW_UP_AFTER_DAYS) continue;
    const recipient = req.recipients[0] ?? null;
    const excerpt = firstSentence(req.content);
    out.push(candidate("UNANSWERED_REQUEST", {
      fingerprint: `UNANSWERED_REQUEST:${req.id}`,
      title: `Request unanswered for ${age} days${recipient ? ` (${roleLabel(recipient.role)})` : ""}`,
      description: `${req.id} from ${roleLabel(req.senderRole)} on ${req.timestamp.slice(0, 10)} has no recorded reply after ${age} days (follow-up threshold ${thresholds.FOLLOW_UP_AFTER_DAYS} days).`,
      facts: [{ statement: `${roleLabel(req.senderRole)} asked ${recipient ? roleLabel(recipient.role) : "an unrecorded recipient"} on ${req.timestamp.slice(0, 10)}.`, evidenceId: req.id, excerpt }],
      assumptions: [],
      affectedEntities: [{ type: "evidence", id: req.id }, ...gatesMentioned(req.content).map((g) => ({ type: "gate" as const, id: g }))],
      ownerRole: recipient?.role ?? null,
      recommendedActions: [{ action: `Follow up with ${recipient ? roleLabel(recipient.role) : "the request recipient"} and record the answer as evidence.`, ownerRole: recipient?.role ?? "PMO", rationale: `Unanswered for ${age} days.` }],
    }));
  }
  return out;
};
