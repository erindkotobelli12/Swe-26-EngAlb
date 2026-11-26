import { thresholds } from "@/config/thresholds";
import { daysBetween } from "@/lib/clock";
import { authorityFor, type AuthorityDomain } from "@/domain/authority";
import { roleLabel, type AccessItem, type CaseState, type EvidenceItem, type KTItem } from "@/domain/types";
import { isFinalValidation, latestValidation } from "@/modules/readiness/gates";

/**
 * Deterministic reliability classifier — how trustworthy a status is, kept separate from readiness.
 *
 * Precedence (the first rule that fires wins):
 *   1. CONFLICTING            an unresolved material contradiction affects it
 *   2. INSUFFICIENT_EVIDENCE  no source supports it, or required fields are missing
 *   3. OUTDATED               the newest supporting source is older than STALE_AFTER_DAYS
 *   4. UNVERIFIED             supported only by self-report, a secondary source or unreviewed AI claims
 *   5. VERIFIED               human-verified by the authoritative role, plus practical execution evidence where implied
 *   6. WELL_SUPPORTED         authoritative, recent and consistent, but not (yet) human-verified
 * Insufficient precedes Outdated because when nothing supports a status its age is moot.
 */
export const RELIABILITY = ["CONFLICTING", "INSUFFICIENT_EVIDENCE", "OUTDATED", "UNVERIFIED", "VERIFIED", "WELL_SUPPORTED"] as const;
export type ReliabilityCategory = (typeof RELIABILITY)[number];
export type Reliability = { category: ReliabilityCategory; reasons: string[]; sourceIds: string[] };

export const RELIABILITY_LABEL: Record<ReliabilityCategory, string> = {
  CONFLICTING: "Conflicting", INSUFFICIENT_EVIDENCE: "Insufficient evidence", OUTDATED: "Outdated",
  UNVERIFIED: "Unverified", VERIFIED: "Verified", WELL_SUPPORTED: "Well-supported",
};

/** Requests (including simulated follow-ups) ask for information; they never support a status. */
const supporting = (state: CaseState): EvidenceItem[] =>
  state.evidence.filter((e) => e.sourceType !== "TRACKER" && e.reviewStatus === "APPROVED" && !e.isRequest);

const newest = (sources: EvidenceItem[]) => sources.map((s) => s.timestamp.slice(0, 10)).sort().at(-1) ?? null;

/** Reliability of the employee's reported tracker status. */
export function classifyCaseStatus(state: CaseState): Reliability {
  const tracker = state.evidence.find((e) => e.sourceType === "TRACKER");
  const sources = supporting(state);
  const ids = sources.map((s) => s.id);
  const conflicts = state.findings.filter((f) => f.category === "CONFLICT" && f.status === "OPEN");
  if (conflicts.length) {
    return { category: "CONFLICTING", reasons: conflicts.map((f) => `Unresolved contradiction: ${f.title}.`), sourceIds: [...new Set(conflicts.flatMap((f) => f.evidenceIds))] };
  }
  const missing = [!state.employee.projectId && "project", !(state.people.lineManager || state.people.lineManagerText) && "manager"].filter(Boolean) as string[];
  if (!sources.length || missing.length) {
    return {
      category: "INSUFFICIENT_EVIDENCE",
      reasons: [
        ...(!sources.length ? [`Only the tracker entry exists; no source supports "${state.employee.trackerStatus}".`] : []),
        ...(missing.length ? [`Required field(s) missing: ${missing.join(", ")}.`] : []),
      ],
      sourceIds: [...ids, ...(tracker ? [tracker.id] : [])],
    };
  }
  const latest = newest(sources)!;
  const age = daysBetween(latest, state.evaluationDate);
  if (age > thresholds.STALE_AFTER_DAYS) {
    return { category: "OUTDATED", reasons: [`Newest supporting source is ${age} days old (${latest}); threshold ${thresholds.STALE_AFTER_DAYS} days.`], sourceIds: ids };
  }
  const authority = (e: EvidenceItem) => authorityFor(e.senderRole, "TECHNICAL_READINESS") === "AUTHORITATIVE" || authorityFor(e.senderRole, "ACCESS_PROVISIONING") === "AUTHORITATIVE";
  const authoritative = sources.filter(authority);
  const pendingAiOnly = state.claims.length > 0 && state.claims.every((c) => c.origin === "AI" && c.reviewStatus === "PENDING");
  if (!authoritative.length || pendingAiOnly) {
    const selfOnly = sources.every((s) => s.senderRole === "EMPLOYEE");
    return {
      category: "UNVERIFIED",
      reasons: [selfOnly ? "Supported only by the employee's self-report." : pendingAiOnly ? "Supported only by unreviewed AI-extracted claims." : `Supported only by secondary sources (${[...new Set(sources.map((s) => roleLabel(s.senderRole)))].join(", ")}).`],
      sourceIds: ids,
    };
  }
  const validation = latestValidation(state.validations);
  const observed = state.kt.some((k) => k.status === "CONFIRMED" && k.stage !== "NOT_STARTED" && k.stageBasis === "OBSERVED");
  if (validation?.state === "APPROVED" && validation.reviewerRole === "TECH_LEAD" && (observed || !state.kt.length)) {
    return { category: "VERIFIED", reasons: [`Human-verified by ${validation.reviewerName ?? "the Technical Lead"}${isFinalValidation(validation) ? " (final validation)" : ""}, with observed execution evidence.`], sourceIds: [...ids, ...validation.evidenceIds] };
  }
  return {
    category: "WELL_SUPPORTED",
    reasons: [`Recent authoritative source(s): ${authoritative.map((s) => `${s.id} (${roleLabel(s.senderRole)}, ${s.timestamp.slice(0, 10)})`).join(", ")}.`, "Not yet verified by a technical-owner validation."],
    sourceIds: authoritative.map((s) => s.id),
  };
}

function classifyItem(state: CaseState, sourceIds: (string | null)[], domain: AuthorityDomain, entityId: string, executionImplied: boolean, observedExecution: boolean): Reliability {
  const conflicts = state.findings.filter((f) => f.category === "CONFLICT" && f.status === "OPEN" && f.affectedEntities.some((e) => e.id === entityId));
  if (conflicts.length) return { category: "CONFLICTING", reasons: conflicts.map((f) => `Unresolved contradiction: ${f.title}.`), sourceIds: conflicts.flatMap((f) => f.evidenceIds) };
  const sources = sourceIds.filter((x): x is string => Boolean(x)).map((id) => state.evidence.find((e) => e.id === id)).filter((e): e is EvidenceItem => Boolean(e) && e!.reviewStatus !== "REJECTED");
  if (!sources.length) return { category: "INSUFFICIENT_EVIDENCE", reasons: ["No source is linked to this item."], sourceIds: [] };
  const latest = sources.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const age = daysBetween(latest.timestamp, state.evaluationDate);
  if (age > thresholds.STALE_AFTER_DAYS) return { category: "OUTDATED", reasons: [`Latest source ${latest.id} is ${age} days old (threshold ${thresholds.STALE_AFTER_DAYS}).`], sourceIds: [latest.id] };
  const authority = authorityFor(latest.senderRole, domain);
  if (authority !== "AUTHORITATIVE") return { category: "UNVERIFIED", reasons: [`Latest source is ${authority === "SELF_REPORT" ? "a self-report" : authority === "TRACKER" ? "a tracker note" : `a secondary source (${roleLabel(latest.senderRole)})`}, not the authoritative role for this kind of statement.`], sourceIds: [latest.id] };
  if (!executionImplied || observedExecution) {
    if (domain === "ACCESS_USE") return { category: "VERIFIED", reasons: [`Successful use confirmed by the employee (${latest.id}).`], sourceIds: [latest.id] };
    const v = latestValidation(state.validations);
    if (v?.state === "APPROVED" && v.reviewerRole === "TECH_LEAD" && domain === "TECHNICAL_READINESS") return { category: "VERIFIED", reasons: ["Observed by the technical owner and covered by a recorded validation."], sourceIds: [latest.id, ...v.evidenceIds] };
  }
  return { category: "WELL_SUPPORTED", reasons: [`Authoritative source ${latest.id} (${roleLabel(latest.senderRole)}), ${age} day(s) old.`], sourceIds: [latest.id] };
}

export function classifyAccess(state: CaseState, a: AccessItem): Reliability {
  const usable = a.status === "USABLE";
  return classifyItem(state, [usable ? a.usableEvidenceId : a.evidenceId, a.evidenceId], usable ? "ACCESS_USE" : "ACCESS_PROVISIONING", a.id, false, false);
}

export function classifyKT(state: CaseState, k: KTItem): Reliability {
  return classifyItem(state, [k.evidenceId], "TECHNICAL_READINESS", k.id, k.stage !== "NOT_STARTED", k.stageBasis === "OBSERVED");
}
