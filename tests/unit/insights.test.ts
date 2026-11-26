import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { setAIProviderForTests, type AIProvider } from "../../src/ai/providers";
import { simulatedMetrics } from "../../src/modules/insights/aggregate";
import { generateHypotheses, loadInsights } from "../../src/modules/insights/service";
import type { Principal } from "../../src/modules/permissions";

const db = new PrismaClient();
afterEach(() => setAIProviderForTests(null));
afterAll(() => db.$disconnect());
const pmo: Principal = { userId: "demo-pmo", role: "PMO", employeeId: null, name: "PMO" };

describe("bottleneck insights", () => {
  it("aggregates actual cases only and withholds historical metrics below the minimum sample", async () => {
    const i = await loadInsights(db);
    expect(Object.keys(i.employees).every((id) => !id.startsWith("SIM-"))).toBe(true);
    expect(i.appsNotUsable.find((b) => b.label === "Helix Service Desk")?.caseIds).toEqual(["ONB-002"]);
    expect(i.missingResponsibilities.find((b) => b.key === "project")?.value).toBe(2);
    for (const m of i.metrics) {
      expect(m.n).toBeLessThan(5);
      expect(m.sufficient).toBe(false);
      expect(m.value).toBeNull();
    }
  });

  it("keeps simulated history separate and labelled", () => {
    const s = simulatedMetrics();
    expect(s.metrics.every((m) => m.label.includes("simulated"))).toBe(true);
    expect(s.byProject.every((b) => b.caseIds.every((id) => id.startsWith("SIM-")))).toBe(true);
  });

  it("rejects AI hypotheses that cite unknown figures or cases outside the cited figures", async () => {
    const helixKey = "apps-not-usable:Helix Service Desk";
    setAIProviderForTests({ model: () => "double", complete: async <T,>() => ({ hypotheses: [
      { hypothesis: "Approval queues delay service-desk access.", recommendation: "Track approvals with an owner and date.", figureKeys: [helixKey], caseIds: ["ONB-002"] },
      { hypothesis: "Invented figure.", recommendation: "Something unsupported.", figureKeys: ["nope:x"], caseIds: [] },
      { hypothesis: "Cites a case the figure does not count.", recommendation: "Something unsupported.", figureKeys: [helixKey], caseIds: ["ONB-005"] },
    ] }) as T } satisfies AIProvider);
    const r = await generateHypotheses(pmo, db);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hypotheses).toHaveLength(1);
      expect(r.rejected).toBe(2);
    }
  });
});
