import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { loadCaseState } from "../../src/modules/case/loadCaseState";
import { classifyAccess, classifyCaseStatus } from "../../src/modules/reliability/classify";
import { readyState } from "./fixtures";

const db = new PrismaClient();
afterAll(() => db.$disconnect());
const state = async (id: string) => (await loadCaseState(id, db, "2026-10-14"))!;

describe("reliability classifier", () => {
  it("matches the expected categories on the official data", async () => {
    expect(classifyCaseStatus(await state("ONB-005")).category).toBe("CONFLICTING");
    expect(classifyCaseStatus(await state("ONB-007")).category).toBe("OUTDATED");
    expect(classifyCaseStatus(await state("ONB-010")).category).toBe("UNVERIFIED");
    expect(classifyCaseStatus(await state("ONB-003")).category).toBe("INSUFFICIENT_EVIDENCE");
    const leo = await state("ONB-002");
    for (const a of leo.access) expect(classifyAccess(leo, a).category, a.application).toBe("WELL_SUPPORTED");
  });

  it("always returns reasons and source IDs", async () => {
    for (const id of ["ONB-005", "ONB-007", "ONB-010", "ONB-003"]) {
      const r = classifyCaseStatus(await state(id));
      expect(r.reasons.length).toBeGreaterThan(0);
      expect(r.sourceIds.length).toBeGreaterThan(0);
    }
  });

  it("is Verified only with a human technical validation; the employee verifies successful use", () => {
    const s = readyState();
    s.evidence.push({ ...s.evidence[0], id: "TL-1", sourceType: "EMAIL", senderRole: "TECH_LEAD", timestamp: "2026-10-13", content: "Observed." });
    s.kt[0].evidenceId = "TL-1";
    expect(classifyCaseStatus(s).category).toBe("VERIFIED");
    s.validations = [];
    expect(classifyCaseStatus(s).category).toBe("WELL_SUPPORTED");
    s.evidence.push({ ...s.evidence[0], id: "EMP-1", sourceType: "EMPLOYEE_UPDATE", senderRole: "EMPLOYEE", timestamp: "2026-10-14", content: "I logged in." });
    s.access[0].usableEvidenceId = "EMP-1";
    expect(classifyAccess(s, s.access[0]).category).toBe("VERIFIED");
  });
});
