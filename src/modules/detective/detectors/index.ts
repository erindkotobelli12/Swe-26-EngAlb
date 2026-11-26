import type { CaseState } from "@/domain/types";
import { evaluateReadiness } from "@/modules/readiness/evaluate";
import type { CandidateFinding, Detector } from "../types";
import { accessNotUsable, accessOwnerUnknown } from "./access";
import { blockedWithoutCause, closureWithoutEvidence, conflictingClaims, statusEvidenceMismatch, unverifiedSelfReport } from "./consistency";
import { insufficientEvidence, ktWithoutOwner, missingLineManager, missingProject, missingReadinessDate } from "./missingInfo";
import { staleStatus, unansweredRequest } from "./timeliness";

/** Registry of deterministic detectors. Generic rules only — no employee-specific branches. */
export const DETECTORS: Record<string, Detector> = {
  missingProject, missingLineManager, ktWithoutOwner, missingReadinessDate, insufficientEvidence,
  staleStatus, unansweredRequest, accessNotUsable, accessOwnerUnknown,
  conflictingClaims, closureWithoutEvidence, statusEvidenceMismatch, blockedWithoutCause, unverifiedSelfReport,
};

export function runDetectors(state: CaseState): CandidateFinding[] {
  const readiness = evaluateReadiness(state);
  const all = Object.values(DETECTORS).flatMap((detect) => detect({ state, readiness }));
  const seen = new Set<string>();
  return all.filter((f) => (seen.has(f.fingerprint) ? false : (seen.add(f.fingerprint), true)));
}
