/**
 * Source authority: which role is authoritative for which kind of statement.
 * Used by the conflict viewer, the reliability classifier and claim review. Deterministic and documented
 * in docs/ASSUMPTIONS.md ("Source authority").
 */
export type AuthorityDomain = "TECHNICAL_READINESS" | "ACCESS_PROVISIONING" | "ACCESS_USE" | "LOCAL_LOGISTICS" | "OWNERSHIP" | "DOCUMENTATION" | "GENERAL";
export type AuthorityLevel = "AUTHORITATIVE" | "SECONDARY" | "SELF_REPORT" | "TRACKER" | "UNKNOWN";

const MATRIX: Record<AuthorityDomain, Partial<Record<string, AuthorityLevel>>> = {
  TECHNICAL_READINESS: { TECH_LEAD: "AUTHORITATIVE", KT_OWNER: "AUTHORITATIVE", TECH_MANAGER: "AUTHORITATIVE", LINE_MANAGER: "SECONDARY", PMO: "SECONDARY", PROJECT_MANAGER: "SECONDARY", EMPLOYEE: "SELF_REPORT" },
  ACCESS_PROVISIONING: { ACCESS_SUPPORT: "AUTHORITATIVE", APP_OWNER: "AUTHORITATIVE", PROJECT_MANAGER: "SECONDARY", PMO: "SECONDARY", LINE_MANAGER: "SECONDARY", EMPLOYEE: "SELF_REPORT" },
  ACCESS_USE: { EMPLOYEE: "AUTHORITATIVE", ACCESS_SUPPORT: "SECONDARY", TECH_LEAD: "SECONDARY" },
  LOCAL_LOGISTICS: { LINE_MANAGER: "AUTHORITATIVE", PMO: "AUTHORITATIVE", HR: "AUTHORITATIVE", EMPLOYEE: "SELF_REPORT" },
  OWNERSHIP: { TECH_MANAGER: "AUTHORITATIVE", PMO: "AUTHORITATIVE", LINE_MANAGER: "AUTHORITATIVE", PROJECT_MANAGER: "AUTHORITATIVE", TECH_LEAD: "SECONDARY" },
  DOCUMENTATION: { KT_OWNER: "AUTHORITATIVE", TECH_LEAD: "AUTHORITATIVE" },
  GENERAL: {},
};

export function authorityFor(role: string | null | undefined, domain: AuthorityDomain): AuthorityLevel {
  if (!role) return "UNKNOWN";
  if (role === "TRACKER") return "TRACKER";
  if (role === "EMPLOYEE" && domain !== "ACCESS_USE") return "SELF_REPORT";
  return MATRIX[domain][role] ?? "SECONDARY";
}

/** Coarse authority stored on Evidence.authorityLevel, derived from the sender role only. */
export function evidenceAuthority(role: string | null | undefined): AuthorityLevel {
  if (!role) return "UNKNOWN";
  if (role === "TRACKER") return "TRACKER";
  if (role === "EMPLOYEE") return "SELF_REPORT";
  if (["TECH_LEAD", "KT_OWNER", "ACCESS_SUPPORT", "APP_OWNER", "TECH_MANAGER"].includes(role)) return "AUTHORITATIVE";
  return "SECONDARY";
}

/** Which authority domain a claim field belongs to. */
export function domainForField(field: string): AuthorityDomain {
  if (field.startsWith("access.") && field.endsWith(".usable")) return "ACCESS_USE";
  if (field.startsWith("access.")) return "ACCESS_PROVISIONING";
  if (field.startsWith("kt.") || field.startsWith("readiness.") || field === "onboarding.closed") return "TECHNICAL_READINESS";
  if (field.startsWith("case.") && /owner|lead|manager|role/i.test(field)) return "OWNERSHIP";
  if (field.startsWith("docs.")) return "DOCUMENTATION";
  if (field.startsWith("case.")) return "LOCAL_LOGISTICS";
  return "GENERAL";
}

export const AUTHORITY_LABEL: Record<AuthorityLevel, string> = {
  AUTHORITATIVE: "Authoritative source",
  SECONDARY: "Secondary source",
  SELF_REPORT: "Self-report",
  TRACKER: "Tracker entry",
  UNKNOWN: "Unknown authority",
};
