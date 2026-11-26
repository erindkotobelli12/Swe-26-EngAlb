import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { loadCaseState } from "../../src/modules/case/loadCaseState";
import { evaluateReadiness } from "../../src/modules/readiness/evaluate";

const db = new PrismaClient();
afterAll(() => db.$disconnect());

async function caseOf(id: string) {
  const state = await loadCaseState(id, db, "2026-10-14");
  if (!state) throw new Error(`missing ${id}`);
  return { state, readiness: evaluateReadiness(state), open: state.findings.filter((f) => f.status === "OPEN") };
}
const types = (c: Awaited<ReturnType<typeof caseOf>>) => c.open.map((f) => f.type);

describe("official starter-pack cases (generic rules, no ID branches)", () => {
  it("produces sensible assessed levels for all ten cases", async () => {
    const expected: Record<string, string> = {
      "ONB-001": "UNKNOWN", "ONB-002": "BLOCKED", "ONB-003": "UNKNOWN", "ONB-004": "UNKNOWN", "ONB-005": "READY_WITH_SUPPORT",
      "ONB-006": "UNKNOWN", "ONB-007": "SHADOWING", "ONB-008": "BLOCKED", "ONB-009": "UNKNOWN", "ONB-010": "PARTIALLY_READY",
    };
    for (const [id, level] of Object.entries(expected)) expect((await caseOf(id)).readiness.assessed, id).toBe(level);
  });

  it("Eva: TL vs LM conflict and 'complete' without demonstrated readiness", async () => {
    const eva = await caseOf("ONB-005");
    const conflict = eva.open.find((f) => f.type === "CONFLICTING_EVIDENCE")!;
    expect(conflict.severity).toBe("CRITICAL");
    expect(conflict.facts.map((f) => f.evidenceId).sort()).toEqual(["EMAIL-003", "EMAIL-004"]);
    expect(types(eva)).toContain("CLOSURE_WITHOUT_EVIDENCE");
    expect(eva.readiness.validated).toBeNull();
  });

  it("Leo: three access items not usable plus unclear Helix ownership", async () => {
    const leo = await caseOf("ONB-002");
    const access = leo.open.filter((f) => f.type === "ACCESS_NOT_USABLE").map((f) => f.title);
    expect(access).toHaveLength(3);
    expect(access.join(" ")).toMatch(/Orion Portal awaiting/);
    expect(access.join(" ")).toMatch(/Helix Service Desk requested 07 Oct 2026/);
    expect(access.join(" ")).toMatch(/Nova VPN active — successful use unconfirmed/);
    expect(leo.open.some((f) => f.type === "ACCESS_OWNER_UNKNOWN" && f.title.includes("Helix"))).toBe(true);
    expect(leo.state.access.find((a) => a.application === "Helix Service Desk")!.status).toBe("REQUESTED");
  });

  it("Lina: request unanswered for 6 days to the Technical Manager, no project, KT Started without owner", async () => {
    const lina = await caseOf("ONB-009");
    const unanswered = lina.open.find((f) => f.type === "UNANSWERED_REQUEST")!;
    expect(unanswered.title).toContain("6 days");
    expect(unanswered.ownerRole).toBe("TECH_MANAGER");
    expect(types(lina)).toEqual(expect.arrayContaining(["MISSING_PROJECT", "KT_WITHOUT_OWNER"]));
  });

  it("Owen, Iris, Nora, Aron, Theo, Mila, Noah", async () => {
    expect(types(await caseOf("ONB-010"))).toEqual(expect.arrayContaining(["UNVERIFIED_SELF_REPORT", "MISSING_READINESS_DATE"]));
    const iris = await caseOf("ONB-007");
    expect(iris.open.find((f) => f.type === "STALE_STATUS")!.title).toContain("24 days");
    expect(types(iris)).toContain("STATUS_EVIDENCE_MISMATCH");
    expect(types(await caseOf("ONB-003"))).toEqual(expect.arrayContaining(["MISSING_PROJECT", "STALE_STATUS", "STATUS_EVIDENCE_MISMATCH"]));
    expect(types(await caseOf("ONB-004"))).toContain("MISSING_LINE_MANAGER");
    expect(types(await caseOf("ONB-008"))).toContain("BLOCKED_WITHOUT_CAUSE");
    for (const id of ["ONB-001", "ONB-006"]) {
      const c = await caseOf(id);
      expect(types(c)).toContain("INSUFFICIENT_EVIDENCE");
      expect(c.readiness.assessed).toBe("UNKNOWN");
    }
  });

  it("no source file under src/ contains a hard-coded official employee ID", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && /ONB-0\d\d/.test(readFileSync(p, "utf8"))) offenders.push(p);
      }
    };
    walk(path.resolve(__dirname, "../../src"));
    expect(offenders).toEqual([]);
  });

  it("seeded evidence is verbatim and keeps the Atlas no-copy constraint", async () => {
    const e4 = await db.evidence.findUniqueOrThrow({ where: { id: "EMAIL-004" } });
    expect(e4.content).toBe("From the local side everything looks complete and Eva is working independently. The Line Manager considers onboarding closed.");
    const e1 = await db.evidence.findUniqueOrThrow({ where: { id: "EMAIL-001" } });
    expect([e1.senderRole, JSON.parse(e1.recipients)[0].role]).toEqual(["PROJECT_MANAGER", "ACCESS_SUPPORT"]);
    const atlas = await db.knowledgeResource.findUniqueOrThrow({ where: { id: "RES-ATLAS" } });
    expect(atlas.copyAllowed).toBe(false);
    const eva = await db.kTActivity.findMany({ where: { employeeId: "ONB-005" } });
    expect(eva.every((k) => k.validation !== "APPROVED")).toBe(true);
  });
});
