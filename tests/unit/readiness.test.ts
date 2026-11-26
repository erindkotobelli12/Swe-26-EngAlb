import { describe, expect, it } from "vitest";
import { evaluateReadiness } from "../../src/modules/readiness/evaluate";
import { access, finding, kt, readyState, validation } from "./fixtures";

const gate = (r: ReturnType<typeof evaluateReadiness>, id: string) => r.gates.find((g) => g.id === id)!;

describe("readiness gates", () => {
  it("a fully evidenced and validated case is independently ready", () => {
    const r = evaluateReadiness(readyState());
    expect(r.gates.every((g) => g.status === "SATISFIED")).toBe(true);
    expect(r.assessed).toBe("INDEPENDENTLY_READY");
  });

  it("provisioned or approved access is not usable", () => {
    for (const status of ["PROVISIONED", "APPROVED", "REQUESTED", "APPROVAL_PENDING"] as const) {
      const s = readyState();
      s.access = [access({ id: "A1", application: "Tool", status })];
      const r = evaluateReadiness(s);
      expect(gate(r, "ACCESS_USABLE").status).toBe("UNSATISFIED");
      expect(r.assessed).not.toBe("INDEPENDENTLY_READY");
    }
  });

  it("never reaches INDEPENDENTLY_READY without a human Technical Lead validation", () => {
    const s = readyState();
    s.validations = [];
    expect(evaluateReadiness(s).assessed).not.toBe("INDEPENDENTLY_READY");
    s.validations = [validation({ reviewerRole: "LINE_MANAGER" })];
    expect(gate(evaluateReadiness(s), "TECH_VALIDATION_APPROVED").status).toBe("UNSATISFIED");
    s.validations = [validation({ evidenceIds: [] })];
    expect(gate(evaluateReadiness(s), "TECH_VALIDATION_APPROVED").status).toBe("UNSATISFIED");
    s.validations = [validation({ validatedLevel: "READY_WITH_SUPPORT" })];
    const r = evaluateReadiness(s);
    expect(gate(r, "TECH_VALIDATION_APPROVED").status).toBe("UNSATISFIED");
    expect(r.validated).toBe("READY_WITH_SUPPORT");
  });

  it("an unresolved material conflict blocks independent readiness; an AI-proposed conflict does not count until accepted", () => {
    const s = readyState();
    s.findings = [finding({ id: "F1", category: "CONFLICT", status: "PROPOSED" })];
    expect(evaluateReadiness(s).assessed).toBe("INDEPENDENTLY_READY");
    s.findings = [finding({ id: "F1", category: "CONFLICT", status: "OPEN" })];
    const r = evaluateReadiness(s);
    expect(gate(r, "NO_MATERIAL_CONFLICT").status).toBe("UNSATISFIED");
    expect(r.assessed).not.toBe("INDEPENDENTLY_READY");
  });

  it("assessment results cannot satisfy observed execution or technical validation", () => {
    const s = readyState();
    s.kt = [kt({ id: "K1", title: "Core work", stage: "INDEPENDENT_EXECUTION", stageBasis: "ASSESSMENT" })];
    const r = evaluateReadiness(s);
    expect(gate(r, "EXECUTION_OBSERVED").status).toBe("UNSATISFIED");
    expect(r.assessed).not.toBe("INDEPENDENTLY_READY");
  });

  it("self-reported independence is not observed execution", () => {
    const s = readyState();
    s.kt = [kt({ id: "K1", title: "Core work", stage: "INDEPENDENT_EXECUTION", stageBasis: "SELF_REPORTED" })];
    expect(gate(evaluateReadiness(s), "EXECUTION_OBSERVED").status).toBe("UNSATISFIED");
  });

  it("unknown is never treated as satisfied", () => {
    const s = readyState();
    s.access = [];
    s.kt = [];
    s.employee.role = null;
    const r = evaluateReadiness(s);
    expect(gate(r, "ACCESS_USABLE").status).toBe("UNKNOWN");
    expect(gate(r, "KT_AGREED").status).toBe("UNKNOWN");
    expect(gate(r, "SCOPE_CONFIRMED").status).toBe("UNKNOWN");
    expect(r.assessed).not.toBe("INDEPENDENTLY_READY");
  });

  it("core independent with complex scope outstanding is Ready with Support; part of core is Partially Ready", () => {
    const s = readyState();
    s.validations = [];
    s.kt = [kt({ id: "K1", title: "Core", stage: "INDEPENDENT_EXECUTION", stageBasis: "OBSERVED" }), kt({ id: "K2", title: "Complex", scopeType: "COMPLEX", stage: "NOT_STARTED", stageBasis: "OBSERVED" })];
    expect(evaluateReadiness(s).assessed).toBe("READY_WITH_SUPPORT");
    s.kt = [kt({ id: "K1", title: "Core A", stage: "INDEPENDENT_EXECUTION", stageBasis: "OBSERVED" }), kt({ id: "K2", title: "Core B", stage: "SUPPORTED_EXECUTION", stageBasis: "OBSERVED" })];
    expect(evaluateReadiness(s).assessed).toBe("PARTIALLY_READY");
  });

  it("keeps reported, assessed and validated separate", () => {
    const s = readyState();
    s.employee.trackerStatus = "Closed";
    s.validations = [];
    const r = evaluateReadiness(s);
    expect(r.reported).toBe("Closed");
    expect(r.assessed).toBe("READY_WITH_SUPPORT");
    expect(r.validated).toBeNull();
  });
});
