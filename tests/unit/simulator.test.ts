import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { loadCaseState } from "../../src/modules/case/loadCaseState";
import { availableToggles, simulate } from "../../src/modules/simulator/simulate";
import { evaluateReadiness } from "../../src/modules/readiness/evaluate";
import type { Override } from "../../src/modules/simulator/overrides";

const db = new PrismaClient();
afterAll(() => db.$disconnect());

async function snapshot() {
  const [employees, cases, access, kt, findings, deps, evidence, claims, validations, audit] = await Promise.all([
    db.employee.findMany({ orderBy: { id: "asc" } }), db.onboardingCase.findMany({ orderBy: { id: "asc" } }), db.accessRequest.findMany({ orderBy: { id: "asc" } }),
    db.kTActivity.findMany({ orderBy: { id: "asc" } }), db.finding.findMany({ orderBy: { id: "asc" } }), db.dependency.findMany({ orderBy: { id: "asc" } }),
    db.evidence.count(), db.evidenceClaim.count(), db.readinessValidation.count(), db.auditLog.count(),
  ]);
  return JSON.stringify({ employees, cases, access, kt, findings, deps, evidence, claims, validations, audit });
}

describe("what-if simulator", () => {
  it("never writes to the database (row counts and updatedAt unchanged)", async () => {
    const before = await snapshot();
    const state = (await loadCaseState("ONB-002", db, "2026-10-14"))!;
    const toggles = availableToggles(state, evaluateReadiness(state));
    const items: Override[] = toggles.flatMap((t) => (t.kind === "check" ? [t.override] : [t.options.at(-1)!.override]));
    const result = simulate(state, { items, includeProposed: true });
    expect(result.simulated.level).toBe("Independently ready");
    expect(await snapshot()).toBe(before);
    expect((await loadCaseState("ONB-002", db, "2026-10-14"))!.access.find((a) => a.application === "Helix Service Desk")!.status).toBe("REQUESTED");
  });

  it("generates toggles only from the case's unsatisfied items", async () => {
    const leo = (await loadCaseState("ONB-002", db, "2026-10-14"))!;
    const keys = availableToggles(leo, evaluateReadiness(leo)).map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(["access:ACC-LEO-HELIX", "access:ACC-LEO-ORION", "access:ACC-LEO-NOVA", "validation"]));
    expect(keys.some((k) => k.startsWith("conflict:"))).toBe(false);
    const eva = (await loadCaseState("ONB-005", db, "2026-10-14"))!;
    expect(availableToggles(eva, evaluateReadiness(eva)).some((t) => t.key.startsWith("conflict:"))).toBe(true);
  });

  it("Leo: with confirmed dependencies, Helix usable unblocks KT; Orion approved stays not usable", async () => {
    const leo = (await loadCaseState("ONB-002", db, "2026-10-14"))!;
    leo.dependencies = leo.dependencies.map((d) => ({ ...d, status: "CONFIRMED" }));
    leo.kt = leo.kt.map((k) => ({ ...k, status: "CONFIRMED" }));
    const r = simulate(leo, { includeProposed: false, items: [
      { kind: "ACCESS_STATUS", accessId: "ACC-LEO-HELIX", status: "USABLE" },
      { kind: "ACCESS_STATUS", accessId: "ACC-LEO-ORION", status: "APPROVED" },
    ] });
    expect(r.current.level).toBe("Blocked");
    expect(r.simulated.level).toBe("Pre-onboarding");
    expect(r.unblockedActivities).toEqual(["Practical ticket-handling KT"]);
    expect(r.blockersRemoved.join(" ")).toMatch(/Helix Service Desk \(root blocker\)/);
    expect(r.remainingPrerequisites).toEqual(expect.arrayContaining(["Orion Portal", "Nova VPN", "Practical ticket-handling KT"]));
    expect(r.remainingPrerequisites).not.toContain("Helix Service Desk");
  });
});
