import { describe, expect, it } from "vitest";
import { verifyExcerpt, verifyFacts } from "../../src/ai/verify";

const EMAIL_004 = "From the local side everything looks complete and Eva is working independently. The Line Manager considers onboarding closed.";

describe("excerpt verifier", () => {
  it("accepts verbatim excerpts, tolerating whitespace, quote style and a trailing period", () => {
    expect(verifyExcerpt("Eva is working independently", EMAIL_004)).toBe(true);
    expect(verifyExcerpt("The Line Manager  considers onboarding closed", EMAIL_004)).toBe(true);
    expect(verifyExcerpt("Leo’s Nova VPN", "Please create Leo's Nova VPN accounts.")).toBe(true);
  });

  it("rejects paraphrases and trivial fragments", () => {
    expect(verifyExcerpt("Eva appears independent", EMAIL_004)).toBe(false);
    expect(verifyExcerpt("the manager considers onboarding closed", EMAIL_004)).toBe(false);
    expect(verifyExcerpt("Eva", EMAIL_004)).toBe(false);
  });

  it("rejects unknown evidence IDs and downgrades unverifiable facts to assumptions", () => {
    const report = verifyFacts(
      [
        { statement: "LM says independent", evidenceId: "EMAIL-004", excerpt: "Eva is working independently" },
        { statement: "made up", evidenceId: "EMAIL-999", excerpt: "anything at all" },
        { statement: "paraphrase", evidenceId: "EMAIL-004", excerpt: "Eva appears independent" },
      ],
      new Map([["EMAIL-004", EMAIL_004]]),
    );
    expect(report.verified).toHaveLength(1);
    expect(report.unknownEvidenceIds).toEqual(["EMAIL-999"]);
    expect(report.downgraded).toHaveLength(2);
    expect(report.downgraded.every((a) => a.basis.startsWith("Unverifiable"))).toBe(true);
  });
});
