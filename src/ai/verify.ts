import type { Assumption, Fact } from "@/domain/types";

/**
 * Traceability guard. Every AI factual statement must carry a known evidence ID and an excerpt that is a
 * verbatim substring of that evidence (after whitespace, quote and dash normalisation). Anything else is
 * dropped or downgraded to an explicitly labelled assumption.
 */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const MIN_EXCERPT_LENGTH = 6;

export function verifyExcerpt(excerpt: string, sourceContent: string): boolean {
  const needle = normalizeForMatch(excerpt).replace(/^["']|["']$/g, "").replace(/[.;,]+$/, "").trim();
  if (needle.length < MIN_EXCERPT_LENGTH) return false;
  return normalizeForMatch(sourceContent).includes(needle);
}

export type VerificationReport = {
  verified: Fact[];
  downgraded: Assumption[];
  unknownEvidenceIds: string[];
};

export function verifyFacts(facts: Fact[], evidence: Map<string, string>): VerificationReport {
  const report: VerificationReport = { verified: [], downgraded: [], unknownEvidenceIds: [] };
  for (const f of facts) {
    const content = evidence.get(f.evidenceId);
    if (content === undefined) {
      report.unknownEvidenceIds.push(f.evidenceId);
      report.downgraded.push({ statement: f.statement, basis: `Unverifiable: cited source ${f.evidenceId} is not in this case.` });
      continue;
    }
    if (verifyExcerpt(f.excerpt, content)) report.verified.push(f);
    else report.downgraded.push({ statement: f.statement, basis: `Unverifiable: the quoted excerpt was not found verbatim in ${f.evidenceId}.` });
  }
  return report;
}
