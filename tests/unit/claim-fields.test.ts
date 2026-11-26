import { describe, expect, it } from "vitest";
import { canonicalClaim, normalizeValue, parseField } from "../../src/domain/claimFields";

describe("claim field whitelist", () => {
  it("canonicalises common model variations deterministically", () => {
    expect(canonicalClaim("access.Helix Service Desk.usable", "USABLE")).toEqual({ field: "access.Helix Service Desk.status", value: "USABLE" });
    expect(canonicalClaim("access.Helix.usable", "true")).toEqual({ field: "access.Helix.status", value: "USABLE" });
    expect(canonicalClaim("access.Helix.usable", "false").field).toBe("access.Helix.usable");
    expect(canonicalClaim("kt.Ticket handling.status", "SHADOWING")).toEqual({ field: "kt.Ticket handling.stage", value: "SHADOWING" });
  });

  it("validates values per field and keeps readiness informational", () => {
    expect(normalizeValue(parseField("access.X.status"), "provisioned")).toBe("PROVISIONED");
    expect(normalizeValue(parseField("access.X.status"), "logged in")).toBeNull();
    expect(normalizeValue(parseField("case.expectedReadyAt"), "next week")).toBeNull();
    expect(parseField("readiness.reported").kind).toBe("INFO");
  });
});
