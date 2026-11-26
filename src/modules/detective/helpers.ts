import type { CaseState, ClaimItem, EvidenceItem, Fact } from "@/domain/types";
import { TYPE_META, type CandidateFinding, type FindingType } from "./types";

export function trackerEvidence(state: CaseState): EvidenceItem | null {
  return state.evidence.find((e) => e.sourceType === "TRACKER") ?? null;
}

/** A verbatim line of the tracker row, e.g. "Project: —". Returns a fact only when the line exists verbatim. */
export function trackerFact(state: CaseState, label: string, statement: string): Fact | null {
  const tracker = trackerEvidence(state);
  if (!tracker) return null;
  const line = tracker.content.split(/\r?\n/).find((l) => l.startsWith(`${label}:`));
  return line ? { statement, evidenceId: tracker.id, excerpt: line.trim() } : null;
}

export function approvedClaims(state: CaseState): ClaimItem[] {
  return state.claims.filter((c) => c.reviewStatus === "APPROVED");
}

export function claimFacts(state: CaseState, predicate: (c: ClaimItem) => boolean, statement: (c: ClaimItem) => string): Fact[] {
  return approvedClaims(state).filter(predicate).map((c) => ({ statement: statement(c), evidenceId: c.evidenceId, excerpt: c.excerpt }));
}

export function nonTrackerEvidence(state: CaseState): EvidenceItem[] {
  return state.evidence.filter((e) => e.sourceType !== "TRACKER" && e.reviewStatus !== "REJECTED");
}

export function candidate(type: FindingType, input: Omit<CandidateFinding, "type" | "category" | "severity" | "evidenceIds"> & { severity?: CandidateFinding["severity"] }): CandidateFinding {
  const facts = input.facts.filter(Boolean);
  return {
    ...input,
    type,
    category: TYPE_META[type].category,
    severity: input.severity ?? TYPE_META[type].severity,
    facts,
    evidenceIds: [...new Set(facts.map((f) => f.evidenceId))],
  };
}

export const compact = <T,>(items: (T | null | undefined | false)[]): T[] => items.filter((x): x is T => Boolean(x));

export function personLabel(name: string | null | undefined, role: string): string {
  return name ? `${name} (${role})` : `${role} — name not recorded`;
}
