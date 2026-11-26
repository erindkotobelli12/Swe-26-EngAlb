import { describe, expect, it } from "vitest";
import { runDetectors } from "../../src/modules/detective/detectors";
import { daysBetween, getEvaluationDate } from "../../src/lib/clock";
import { access, kt, readyState } from "./fixtures";

const typesOf = (s: ReturnType<typeof readyState>) => runDetectors(s).map((f) => f.type);

describe("deterministic detectors", () => {
  it("use the single evaluation clock", () => {
    expect(getEvaluationDate()).toBe("2026-10-14");
    expect(daysBetween("2026-10-08", getEvaluationDate())).toBe(6);
  });

  it("flag a stale status only beyond the threshold, HIGH beyond three times it", () => {
    const s = readyState();
    s.employee.lastUpdate = "2026-10-07";
    s.evidence[0].timestamp = "2026-10-07";
    expect(typesOf(s)).not.toContain("STALE_STATUS");
    s.employee.lastUpdate = "2026-10-06";
    s.evidence[0].timestamp = "2026-10-06";
    expect(runDetectors(s).find((f) => f.type === "STALE_STATUS")?.severity).toBe("MEDIUM");
    s.employee.lastUpdate = "2026-09-20";
    s.evidence[0].timestamp = "2026-09-20";
    expect(runDetectors(s).find((f) => f.type === "STALE_STATUS")?.severity).toBe("HIGH");
  });

  it("flag an unanswered request after the follow-up threshold, cleared by an approved reply", () => {
    const s = readyState();
    s.evidence.push({ ...s.evidence[0], id: "REQ", sourceType: "EMAIL", senderRole: "PMO", recipients: [{ name: null, role: "TECH_MANAGER" }], timestamp: "2026-10-08", content: "Please confirm the KT owner. Thanks.", isRequest: true });
    const f = runDetectors(s).find((x) => x.type === "UNANSWERED_REQUEST")!;
    expect(f.title).toContain("6 days");
    expect(f.ownerRole).toBe("TECH_MANAGER");
    expect(f.facts[0].excerpt).toBe("Please confirm the KT owner.");
    s.evidence.push({ ...s.evidence[0], id: "REPLY", sourceType: "EMAIL", timestamp: "2026-10-14", content: "The KT owner is confirmed.", isRequest: false, inReplyToId: "REQ", reviewStatus: "PENDING_REVIEW" });
    expect(typesOf(s)).toContain("UNANSWERED_REQUEST");
    s.evidence[s.evidence.length - 1].reviewStatus = "APPROVED";
    expect(typesOf(s)).not.toContain("UNANSWERED_REQUEST");
  });

  it("flag missing owners", () => {
    const s = readyState();
    s.people.lineManager = null;
    s.people.lineManagerText = null;
    s.people.ktOwner = null;
    s.kt = [kt({ id: "K", title: "Shadow", stage: "SHADOWING", owner: null })];
    expect(typesOf(s)).toEqual(expect.arrayContaining(["MISSING_LINE_MANAGER", "KT_WITHOUT_OWNER"]));
    s.access = [access({ id: "A", application: "Helix", status: "REQUESTED", owner: null })];
    expect(typesOf(s)).toContain("ACCESS_OWNER_UNKNOWN");
  });

  it("flag closure language without observed execution or validation", () => {
    const s = readyState();
    s.validations = [];
    s.evidence.push({ ...s.evidence[0], id: "LM", sourceType: "EMAIL", senderRole: "LINE_MANAGER", content: "Onboarding is closed." });
    s.claims = [{ id: "C1", evidenceId: "LM", entity: "TEST-1", field: "onboarding.closed", value: "true", excerpt: "Onboarding is closed.", excerptVerified: true, reviewStatus: "APPROVED", origin: "HUMAN", effectiveDate: "2026-10-13" }];
    expect(typesOf(s)).toContain("CLOSURE_WITHOUT_EVIDENCE");
  });

  it("treat a later access status as an update, not a conflict", () => {
    const s = readyState();
    s.evidence.push({ ...s.evidence[0], id: "E1", sourceType: "EMAIL", content: "requested" }, { ...s.evidence[0], id: "E2", sourceType: "EMAIL", content: "active" });
    s.claims = [
      { id: "C1", evidenceId: "E1", entity: "TEST-1", field: "access.Tool.status", value: "REQUESTED", excerpt: "requested", excerptVerified: true, reviewStatus: "APPROVED", origin: "SEED", effectiveDate: "2026-10-07" },
      { id: "C2", evidenceId: "E2", entity: "TEST-1", field: "access.Tool.status", value: "PROVISIONED", excerpt: "active", excerptVerified: true, reviewStatus: "APPROVED", origin: "SEED", effectiveDate: "2026-10-14" },
    ];
    expect(typesOf(s)).not.toContain("CONFLICTING_EVIDENCE");
  });
});
