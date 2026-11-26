import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { setAIProviderForTests } from "../../src/ai/providers";
import { loadCaseState } from "../../src/modules/case/loadCaseState";
import { PermissionError, type Principal } from "../../src/modules/permissions";
import { evaluateReadiness } from "../../src/modules/readiness/evaluate";
import { buildBackbone, diffBackbone } from "../../src/modules/roadmap/backbone";
import { decideRoadmapItem, suggestRoadmap } from "../../src/modules/roadmap/service";

const db = new PrismaClient();
afterEach(() => setAIProviderForTests(null));
afterAll(() => db.$disconnect());
const pmo: Principal = { userId: "demo-pmo", role: "PMO", employeeId: null, name: "PMO" };
const tl: Principal = { userId: "demo-tl", role: "TECH_LEAD", employeeId: null, name: "TL" };

describe("adaptive roadmap", () => {
  it("derives a deterministic backbone that adapts to state changes", async () => {
    const leo = (await loadCaseState("ONB-002", db, "2026-10-14"))!;
    leo.dependencies = leo.dependencies.map((d) => ({ ...d, status: "CONFIRMED" }));
    leo.kt = leo.kt.map((k) => ({ ...k, status: "CONFIRMED" }));
    const before = buildBackbone(leo, evaluateReadiness(leo));
    const kt = before.find((b) => b.key === "kt:KT-ONB-002-TPL-SERVICE-DESK")!;
    expect(kt.status).toBe("BLOCKED");
    expect(kt.waitsFor).toEqual(["Helix Service Desk"]);
    const after = structuredClone(leo);
    after.access = after.access.map((a) => (a.application === "Helix Service Desk" ? { ...a, status: "USABLE" } : a));
    const diff = diffBackbone(before.map(({ key, title, status }) => ({ key, title, status })), buildBackbone(after, evaluateReadiness(after)));
    expect(diff).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "access:ACC-LEO-HELIX", after: "DONE" }),
      expect.objectContaining({ key: "kt:KT-ONB-002-TPL-SERVICE-DESK", before: "BLOCKED", after: "TODO" }),
    ]));
  });

  it("keeps only valid AI proposals and requires the right approver", async () => {
    setAIProviderForTests({ model: () => "double", complete: async <T,>() => ({ proposals: [
      { type: "ALTERNATIVE", kind: "ALTERNATIVE", phase: 1, title: "Read the service-desk runbook", description: "Documentation reading while Helix is pending.", ownerRole: "TECH_LEAD", completionCriteria: "Runbook read", relatesToKey: "access:ACC-LEO-HELIX", rationale: "Helix is not yet provisioned.", evidenceIds: ["EMAIL-002"] },
      { type: "ADD", kind: "KT", phase: 2, title: "Invented activity", description: "Cites a source that does not exist.", ownerRole: "TECH_LEAD", completionCriteria: "n/a", relatesToKey: null, rationale: "No basis at all here.", evidenceIds: ["EMAIL-999"] },
      { type: "SKIP", kind: "KT", phase: 2, title: "Skip ticket handling", description: "No evidence of a validated competency.", ownerRole: "TECH_LEAD", completionCriteria: "n/a", relatesToKey: "kt:KT-ONB-002-TPL-SERVICE-DESK", rationale: "Assumed experience.", evidenceIds: [] },
    ] }) as T });
    const r = await suggestRoadmap("ONB-002", pmo, db);
    expect(r.ok && r.created).toBe(1);
    expect(r.ok && r.rejected.length).toBe(2);
    const item = await db.roadmapItem.findFirstOrThrow({ where: { employeeId: "ONB-002", title: "Read the service-desk runbook" } });
    await expect(decideRoadmapItem({ id: item.id, decision: "APPROVE" }, pmo, db)).rejects.toBeInstanceOf(PermissionError);
    await decideRoadmapItem({ id: item.id, decision: "APPROVE" }, tl, db);
    expect((await db.roadmapItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("APPROVED");
  });
});
