import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { AIResponseError, setAIProviderForTests, type AIProvider } from "../../src/ai/providers";
import { generateBriefing, validateStatements } from "../../src/modules/briefing/service";
import type { Section } from "../../src/modules/briefing/select";
import type { Principal } from "../../src/modules/permissions";

const db = new PrismaClient();
afterEach(() => setAIProviderForTests(null));
afterAll(() => db.$disconnect());
const pmo: Principal = { userId: "demo-pmo", role: "PMO", employeeId: null, name: "PMO" };
const tl: Principal = { userId: "demo-tl", role: "TECH_LEAD", employeeId: null, name: "TL" };
const double = (impl: AIProvider["complete"]): AIProvider => ({ model: () => "test-double", complete: impl });

describe("management briefing", () => {
  it("rejects statements without valid refs", () => {
    const allowed = new Set(["finding:F1", "evidence:EMAIL-003"]);
    const r = validateStatements([
      { text: "ok", refs: ["finding:F1"] },
      { text: "no refs", refs: [] },
      { text: "invented ref", refs: ["finding:F1", "finding:NOPE"] },
    ], allowed);
    expect(r.valid).toHaveLength(1);
    expect(r.rejected).toBe(2);
  });

  it("keeps deterministic statements when the model is unavailable, and only referenced AI statements otherwise", async () => {
    setAIProviderForTests(double(async () => { throw new AIResponseError("down", 503, "UNAVAILABLE"); }));
    const id1 = await generateBriefing("PMO", pmo, db);
    const b1 = await db.briefing.findUniqueOrThrow({ where: { id: id1 } });
    expect(b1.narrativeSource).toBe("DETERMINISTIC");
    expect(b1.aiError).toBe("down");
    const sections = JSON.parse(b1.sectionsJson) as Section[];
    expect(sections.flatMap((s) => s.statements).every((s) => s.refs.length > 0)).toBe(true);
    expect(sections.find((s) => s.key === "urgent")!.statements.some((s) => s.text.includes("Eva Stone"))).toBe(true);

    const urgentRef = sections.find((s) => s.key === "urgent")!.statements[0].refs[0];
    setAIProviderForTests(double(async <T,>() => ({ sections: [{ key: "urgent", statements: [{ text: "Top risk first.", refs: [urgentRef] }, { text: "Made-up risk.", refs: ["finding:FAKE"] }] }] }) as T));
    const id2 = await generateBriefing("PMO", pmo, db);
    const b2 = await db.briefing.findUniqueOrThrow({ where: { id: id2 } });
    expect(b2.narrativeSource).toBe("AI");
    expect(b2.rejectedCount).toBe(1);
    const urgent = (JSON.parse(b2.sectionsJson) as Section[]).find((s) => s.key === "urgent")!;
    expect(urgent.statements.map((s) => s.text)).toEqual(["Top risk first."]);
  });

  it("selects different content per role", async () => {
    setAIProviderForTests(double(async () => { throw new AIResponseError("down", 503, "UNAVAILABLE"); }));
    const tlBrief = await db.briefing.findUniqueOrThrow({ where: { id: await generateBriefing("TECH_LEAD", tl, db) } });
    const keys = (JSON.parse(tlBrief.sectionsJson) as Section[]).map((s) => s.key);
    expect(keys).toContain("validations");
    expect(keys).not.toContain("urgent");
    const validations = (JSON.parse(tlBrief.sectionsJson) as Section[]).find((s) => s.key === "validations")!;
    expect(validations.statements.some((s) => s.text.includes("Eva Stone"))).toBe(true);
  });
});
