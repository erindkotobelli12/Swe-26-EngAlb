import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { loadCaseState } from "../../src/modules/case/loadCaseState";
import { buildGraph } from "../../src/modules/dependencies/graph";
import { evaluateReadiness } from "../../src/modules/readiness/evaluate";
import { computeGates } from "../../src/modules/readiness/gates";
import type { DependencyItem } from "../../src/domain/types";
import { access, kt, readyState } from "./fixtures";

const db = new PrismaClient();
afterAll(() => db.$disconnect());

const dep = (id: string, from: string, to: string, status: DependencyItem["status"] = "CONFIRMED"): DependencyItem => {
  const [fromType, fromId] = from.split(":") as [DependencyItem["fromType"], string];
  const [toType, toId] = to.split(":") as [DependencyItem["toType"], string];
  return { id, fromType, fromId, toType, toId, kind: "REQUIRES", status, origin: "HUMAN", rationale: "test", evidenceIds: [], excerpts: [], confirmedBy: null, confirmedAt: null };
};

function chainState(status: DependencyItem["status"]) {
  const s = readyState();
  s.validations = [];
  s.access = [access({ id: "A1", application: "Desk", status: "REQUESTED" }), access({ id: "A2", application: "VPN", status: "USABLE" })];
  s.kt = [kt({ id: "K1", title: "Tickets", stage: "NOT_STARTED" }), kt({ id: "K2", title: "Escalations", stage: "NOT_STARTED" })];
  s.dependencies = [dep("D1", "access:A1", "kt:K1", status), dep("D2", "kt:K1", "kt:K2", status)];
  return s;
}

describe("dependency engine", () => {
  it("propagates blocking only through confirmed edges", () => {
    const confirmed = buildGraph(chainState("CONFIRMED"), computeGates(chainState("CONFIRMED")));
    const node = (k: string) => confirmed.nodes.find((n) => n.key === k)!;
    expect(node("access:A1").isRootBlocker).toBe(true);
    expect(node("kt:K1").display).toBe("BLOCKED");
    expect(node("kt:K2").display).toBe("BLOCKED");
    expect(node("access:A1").downstreamImpact).toEqual(expect.arrayContaining(["kt:K1", "kt:K2", "gate:EXECUTION_OBSERVED", "gate:TECH_VALIDATION_APPROVED", "readiness"]));

    const proposed = chainState("PROPOSED");
    const ignored = buildGraph(proposed, computeGates(proposed));
    expect(ignored.nodes.find((n) => n.key === "kt:K1")!.display).not.toBe("BLOCKED");
    const optedIn = buildGraph(proposed, computeGates(proposed), true);
    expect(optedIn.usedProposed).toBe(true);
    expect(optedIn.nodes.find((n) => n.key === "kt:K1")!.display).toBe("BLOCKED");
  });

  it("returns the minimal prerequisite set in topological order", () => {
    const s = chainState("CONFIRMED");
    const g = buildGraph(s, computeGates(s));
    expect(g.minimalPrerequisites).toEqual(expect.arrayContaining(["access:A1", "kt:K1", "kt:K2", "gate:TECH_VALIDATION_APPROVED"]));
    expect(g.minimalPrerequisites).not.toContain("access:A2");
    const pos = (k: string) => g.recommendedOrder.indexOf(k);
    expect(pos("access:A1")).toBeLessThan(pos("kt:K1"));
    expect(pos("kt:K1")).toBeLessThan(pos("kt:K2"));
    expect(pos("gate:EXECUTION_OBSERVED")).toBeLessThan(pos("gate:TECH_VALIDATION_APPROVED"));
  });

  it("Leo: confirming the template edges makes Helix the root blocker of KT, execution and validation", async () => {
    const leo = (await loadCaseState("ONB-002", db, "2026-10-14"))!;
    const before = evaluateReadiness(leo).graph;
    const ktKey = before.nodes.find((n) => n.type === "kt")!.key;
    expect(before.nodes.find((n) => n.key === ktKey)!.proposed).toBe(true);
    expect(before.nodes.find((n) => n.key === ktKey)!.display).not.toBe("BLOCKED");
    expect(before.edges.filter((e) => e.status === "PROPOSED")).toHaveLength(2);

    const confirmed = structuredClone(leo);
    confirmed.dependencies = confirmed.dependencies.map((d) => ({ ...d, status: "CONFIRMED" }));
    confirmed.kt = confirmed.kt.map((k) => ({ ...k, status: "CONFIRMED" }));
    const r = evaluateReadiness(confirmed);
    const helix = r.graph.nodes.find((n) => n.label === "Helix Service Desk")!;
    expect(helix.isRootBlocker).toBe(true);
    const newlyBlocked = [ktKey, "gate:EXECUTION_OBSERVED", "gate:TECH_VALIDATION_APPROVED"];
    for (const k of newlyBlocked) {
      expect(helix.downstreamImpact).toContain(k);
      expect(r.graph.nodes.find((n) => n.key === k)!.display).toBe("BLOCKED");
    }
    expect(r.assessed).toBe("BLOCKED");
    expect(r.assessedReasons[0]).toMatch(/Helix Service Desk/);
  });
});
