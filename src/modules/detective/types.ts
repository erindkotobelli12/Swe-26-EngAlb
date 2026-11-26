import { thresholds } from "@/config/thresholds";
import type { Assumption, CaseState, EntityRef, Fact, RecommendedAction, Severity } from "@/domain/types";
import type { ReadinessResult } from "@/modules/readiness/evaluate";

export type CandidateFinding = {
  /** Stable key within a case; used for idempotent upserts across recomputes. */
  fingerprint: string;
  type: FindingType;
  category: FindingCategory;
  severity: Severity;
  title: string;
  description: string;
  evidenceIds: string[];
  facts: Fact[];
  assumptions: Assumption[];
  affectedEntities: EntityRef[];
  ownerRole: string | null;
  recommendedActions: RecommendedAction[];
};

export type DetectorContext = { state: CaseState; readiness: ReadinessResult };
export type Detector = (ctx: DetectorContext) => CandidateFinding[];

export const FINDING_TYPES = [
  "CONFLICTING_EVIDENCE", "SEMANTIC_CONTRADICTION", "BLOCKED_WITHOUT_CAUSE", "CLOSURE_WITHOUT_EVIDENCE",
  "STATUS_EVIDENCE_MISMATCH", "UNANSWERED_REQUEST", "ACCESS_NOT_USABLE", "ACCESS_OWNER_UNKNOWN", "MISSING_PROJECT",
  "MISSING_LINE_MANAGER", "KT_WITHOUT_OWNER", "MISSING_READINESS_DATE", "STALE_STATUS", "UNVERIFIED_SELF_REPORT",
  "INSUFFICIENT_EVIDENCE", "AI_OBSERVATION", "OTHER",
] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const FINDING_CATEGORIES = ["CONFLICT", "READINESS_CLAIM", "ACCESS", "OWNERSHIP", "MISSING_INFO", "STALE", "FOLLOW_UP", "EVIDENCE_GAP", "OTHER"] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

/** Category and base severity per type. Severity is always computed here, never by the LLM. */
export const TYPE_META: Record<FindingType, { category: FindingCategory; severity: Severity; label: string }> = {
  CONFLICTING_EVIDENCE: { category: "CONFLICT", severity: "CRITICAL", label: "Conflicting sources" },
  SEMANTIC_CONTRADICTION: { category: "CONFLICT", severity: "HIGH", label: "Semantic contradiction" },
  BLOCKED_WITHOUT_CAUSE: { category: "OWNERSHIP", severity: "CRITICAL", label: "Blocked without cause or owner" },
  CLOSURE_WITHOUT_EVIDENCE: { category: "READINESS_CLAIM", severity: "HIGH", label: "Complete/closed without readiness evidence" },
  STATUS_EVIDENCE_MISMATCH: { category: "READINESS_CLAIM", severity: "HIGH", label: "Tracker status inconsistent with evidence" },
  UNANSWERED_REQUEST: { category: "FOLLOW_UP", severity: "HIGH", label: "Unanswered request" },
  ACCESS_NOT_USABLE: { category: "ACCESS", severity: "HIGH", label: "Access not usable" },
  ACCESS_OWNER_UNKNOWN: { category: "OWNERSHIP", severity: "MEDIUM", label: "Access step without owner" },
  MISSING_PROJECT: { category: "MISSING_INFO", severity: "HIGH", label: "Missing project" },
  MISSING_LINE_MANAGER: { category: "OWNERSHIP", severity: "HIGH", label: "Missing manager" },
  KT_WITHOUT_OWNER: { category: "OWNERSHIP", severity: "MEDIUM", label: "KT in progress without KT owner" },
  MISSING_READINESS_DATE: { category: "MISSING_INFO", severity: "MEDIUM", label: "No readiness date" },
  STALE_STATUS: { category: "STALE", severity: "MEDIUM", label: "Stale status" },
  UNVERIFIED_SELF_REPORT: { category: "EVIDENCE_GAP", severity: "MEDIUM", label: "Unverified self-report" },
  INSUFFICIENT_EVIDENCE: { category: "EVIDENCE_GAP", severity: "LOW", label: "Insufficient evidence" },
  AI_OBSERVATION: { category: "OTHER", severity: "MEDIUM", label: "AI-proposed finding (category set per finding)" },
  OTHER: { category: "OTHER", severity: "MEDIUM", label: "Other" },
};

export function staleSeverity(days: number): Severity {
  return days > thresholds.STALE_AFTER_DAYS * thresholds.STALE_HIGH_MULTIPLIER ? "HIGH" : "MEDIUM";
}

/** Base severity for AI-proposed findings, by category. Never taken from the LLM. */
export const AI_CATEGORY_SEVERITY: Record<FindingCategory, Severity> = {
  CONFLICT: "HIGH", READINESS_CLAIM: "HIGH", ACCESS: "HIGH", OWNERSHIP: "MEDIUM", MISSING_INFO: "MEDIUM",
  STALE: "MEDIUM", FOLLOW_UP: "MEDIUM", EVIDENCE_GAP: "LOW", OTHER: "MEDIUM",
};

/** AI findings: severity from category, raised to CRITICAL when a contradiction touches readiness. */
export function severityForAIFinding(category: FindingCategory, touchesReadiness: boolean): Severity {
  if (category === "CONFLICT" && touchesReadiness) return "CRITICAL";
  return AI_CATEGORY_SEVERITY[category];
}
