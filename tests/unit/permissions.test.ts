import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { can, PermissionError, type Principal } from "../../src/modules/permissions";
import { confirmOwnAccessUsable } from "../../src/modules/access/confirmUsable";
import { reviewClaim } from "../../src/modules/evidence/pipeline";

const db = new PrismaClient();
afterAll(() => db.$disconnect());

const pmo: Principal = { userId: "demo-pmo", role: "PMO", employeeId: null, name: "PMO" };
const tl: Principal = { userId: "demo-tl", role: "TECH_LEAD", employeeId: null, name: "TL" };
const mila: Principal = { userId: "employee-mila", role: "EMPLOYEE", employeeId: "ONB-001", name: "Mila Rowan" };

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

describe("permissions", () => {
  it("only a Technical Lead can record readiness validation", () => {
    expect(can(tl, "validation.record")).toBe(true);
    for (const p of [pmo, mila, { ...pmo, role: "LINE_MANAGER" as const }, { ...pmo, role: "MANAGEMENT" as const }]) expect(can(p, "validation.record")).toBe(false);
  });

  it("only PMO can approve communications", () => {
    expect(can(pmo, "communication.approve")).toBe(true);
    expect(can(tl, "communication.approve")).toBe(false);
    expect(can(mila, "communication.approve")).toBe(false);
  });

  it("an employee can confirm only their own access usability", async () => {
    expect(can(mila, "access.confirmUsable", { employeeId: "ONB-001" })).toBe(true);
    expect(can(mila, "access.confirmUsable", { employeeId: "ONB-002" })).toBe(false);
    expect(can(pmo, "access.confirmUsable", { employeeId: "ONB-002" })).toBe(false);
    await expect(confirmOwnAccessUsable("ACC-LEO-NOVA", mila, db)).rejects.toBeInstanceOf(PermissionError);
    expect((await db.accessRequest.findUniqueOrThrow({ where: { id: "ACC-LEO-NOVA" } })).status).toBe("PROVISIONED");
  });

  it("KT-stage claims need the Technical Lead", async () => {
    const ev = await db.evidence.create({ data: { id: `PERM-${Date.now()}`, title: "t", sourceType: "EMAIL", senderRole: "TECH_LEAD", timestamp: "2026-10-14", content: "Eva handled the complex scenarios independently.", employeeId: "ONB-005", caseId: "CASE-ONB-005" } });
    const claim = await db.evidenceClaim.create({ data: { evidenceId: ev.id, entity: "ONB-005", field: "kt.Complex scenarios.stage", extractedValue: "INDEPENDENT_EXECUTION", excerpt: "handled the complex scenarios independently", excerptVerified: true, origin: "HUMAN" } });
    await expect(reviewClaim({ claimId: claim.id, decision: "APPROVE" }, pmo, db)).rejects.toBeInstanceOf(PermissionError);
    await db.evidenceClaim.delete({ where: { id: claim.id } });
    await db.evidence.delete({ where: { id: ev.id } });
  });

  it("AI modules have no import path to validation or communication-sending code", () => {
    const aiFiles = filesUnder(path.resolve(__dirname, "../../src/ai"));
    const forbidden = /from\s+["'](@\/server\/actions|@\/modules\/validation|@\/modules\/followups\/send|@\/modules\/evidence\/fieldMapper["']|@\/modules\/case\/recompute)/;
    const offenders = aiFiles.filter((f) => forbidden.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("no claim field can set readiness validation", async () => {
    const { parseField } = await import("../../src/modules/evidence/fieldMapper");
    for (const f of ["case.validatedStatus", "readiness.validated", "validation.state", "readinessValidation.APPROVED"]) expect(parseField(f).kind).toBe("INFO");
  });
});
