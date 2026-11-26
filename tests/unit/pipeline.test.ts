import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addManualClaim, ingestEvidence, PipelineError, reviewClaim } from "../../src/modules/evidence/pipeline";
import { recomputeCase } from "../../src/modules/case/recompute";
import { SYSTEM_ACTOR } from "../../src/modules/audit";
import type { Principal } from "../../src/modules/permissions";

const db = new PrismaClient();
// The case's phase owner (its project's Technical Lead) reviews evidence; the PMO no longer does.
const tl: Principal = { userId: "demo-tl", role: "TECH_LEAD", employeeId: null, name: "Ben Okafor" };
const pmo: Principal = { userId: "demo-pmo", role: "PMO", employeeId: null, name: "Petra Lind" };
const EMP = "SIM-PIPE-1";

beforeAll(async () => {
  await db.employee.create({ data: { id: EMP, name: "Pipeline Test (simulated)", projectId: "NIMBUS", startDate: "2026-10-01", movement: "New Hire", trackerStatus: "Access Pending", lastUpdate: "2026-10-14", isSimulated: true } });
  await db.onboardingCase.create({ data: { id: `CASE-${EMP}`, employeeId: EMP } });
  await db.accessRequest.create({ data: { id: "ACC-SIM-PIPE", employeeId: EMP, application: "Helix Service Desk", requiredScope: "x", status: "REQUESTED", requestDate: "2026-10-07", handlerRole: "ACCESS_SUPPORT" } });
  await recomputeCase(EMP, "test setup", SYSTEM_ACTOR, db);
});
afterAll(() => db.$disconnect());

describe("evidence pipeline", () => {
  it("stores evidence verbatim, applies an approved claim, recomputes and reports every step", async () => {
    const before = await db.finding.findMany({ where: { caseId: `CASE-${EMP}`, status: "OPEN", type: "ACCESS_NOT_USABLE" } });
    expect(before).toHaveLength(1);
    const content = "Helix has been provisioned and Leo logged in successfully this morning.";
    const id = await ingestEvidence({ title: "Helix confirmed", sourceType: "EMAIL", senderRole: "ACCESS_SUPPORT", content, employeeId: EMP, isRequest: false, isSimulated: true }, tl, db);
    const stored = await db.evidence.findUniqueOrThrow({ where: { id } });
    expect(stored.content).toBe(content);
    expect(stored.reviewStatus).toBe("PENDING_REVIEW");

    await expect(addManualClaim({ evidenceId: id, field: "access.Helix Service Desk.status", value: "USABLE", excerpt: "Leo can now use Helix" }, tl, db)).rejects.toBeInstanceOf(PipelineError);
    await addManualClaim({ evidenceId: id, field: "access.Helix Service Desk.status", value: "USABLE", excerpt: "logged in successfully" }, tl, db);
    const claim = await db.evidenceClaim.findFirstOrThrow({ where: { evidenceId: id } });
    await expect(reviewClaim({ claimId: claim.id, decision: "APPROVE" }, pmo, db)).rejects.toThrow(/permission/);
    const result = await reviewClaim({ claimId: claim.id, decision: "APPROVE" }, tl, db);

    expect(result.steps).toHaveLength(9);
    expect((await db.accessRequest.findUniqueOrThrow({ where: { id: "ACC-SIM-PIPE" } })).status).toBe("USABLE");
    const cleared = await db.finding.findMany({ where: { caseId: `CASE-${EMP}`, type: "ACCESS_NOT_USABLE", status: "RESOLVED" } });
    expect(cleared.every((f) => f.resolutionType === "CONDITION_CLEARED")).toBe(true);
    expect((await db.evidence.findUniqueOrThrow({ where: { id } })).content).toBe(content);
    const audit = await db.auditLog.findMany({ where: { employeeId: EMP } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["EVIDENCE_INGESTED", "CLAIM_APPROVED", "STATE_RECOMPUTED", "PIPELINE_RUN"]));
  });

  it("an approved claim can never write readiness validation", async () => {
    const id = await ingestEvidence({ title: "LM says validated", sourceType: "EMAIL", senderRole: "LINE_MANAGER", content: "I hereby validate the employee as independently ready.", employeeId: EMP, isRequest: false, isSimulated: true }, tl, db);
    await addManualClaim({ evidenceId: id, field: "case.validatedStatus", value: "INDEPENDENTLY_READY", excerpt: "validate the employee as independently ready" }, tl, db);
    const claim = await db.evidenceClaim.findFirstOrThrow({ where: { evidenceId: id } });
    await reviewClaim({ claimId: claim.id, decision: "APPROVE" }, tl, db);
    expect(await db.readinessValidation.count({ where: { caseId: `CASE-${EMP}` } })).toBe(0);
    expect((await db.onboardingCase.findUniqueOrThrow({ where: { id: `CASE-${EMP}` } })).validatedStatus).not.toBe("INDEPENDENTLY_READY");
  });
});
