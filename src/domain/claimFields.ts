import { ACCESS_STATUSES, KT_STAGES, READINESS_LEVELS } from "./types";

/**
 * Whitelisted claim fields (pure). Approving a claim may only change the state these map to — see
 * src/modules/evidence/fieldMapper.ts. Readiness validation and validated status are deliberately absent:
 * no claim — human-reviewed or not — can set them. `readiness.*`, `onboarding.*`, `docs.*` and `info.*` are
 * informational: stored and used for conflict detection, never written into case state.
 */
export type ParsedField =
  | { kind: "ACCESS_STATUS"; application: string }
  | { kind: "KT_STAGE"; activity: string }
  | { kind: "CASE_OWNER"; role: "KT_OWNER" | "TECH_LEAD" | "LINE_MANAGER" }
  | { kind: "CASE_ROLE" }
  | { kind: "CASE_PROJECT" }
  | { kind: "CASE_DATE"; which: "expectedReadyAt" | "readinessReviewAt" }
  | { kind: "INFO"; reason: string };

export const FIELD_VOCABULARY = [
  "access.<Application name>.status  (REQUESTED | APPROVAL_PENDING | APPROVED | PROVISIONED | USABLE | REJECTED)",
  "kt.<Activity title>.stage  (NOT_STARTED | SHADOWING | SUPPORTED_EXECUTION | INDEPENDENT_EXECUTION)",
  "case.ktOwner | case.techLead | case.lineManager  (the person's name exactly as written)",
  "case.projectRole  (exact role text)",
  "case.project  (project name)",
  "case.expectedReadyAt | case.readinessReviewAt  (YYYY-MM-DD, only if a full date is written)",
  "readiness.reported  (" + READINESS_LEVELS.join(" | ") + ")",
  "onboarding.closed | onboarding.complete  (true)",
  "info.<topic>  (any other factual statement; informational only)",
];

/**
 * Deterministic aliases for common model variations, e.g. `access.X.usable = true` → `access.X.status = USABLE`.
 * Applied before validation; anything still unrecognised stays informational.
 */
export function canonicalClaim(field: string, value: string): { field: string; value: string } {
  const f = field.trim();
  const v = value.trim();
  const usable = f.match(/^access\.(.+)\.(usable|usability|use|login|available)$/i);
  if (usable && /^(true|yes|usable|confirmed)$/i.test(v)) return { field: `access.${usable[1].trim()}.status`, value: "USABLE" };
  const access = f.match(/^access\.(.+)\.(state|provisioning)$/i);
  if (access) return { field: `access.${access[1].trim()}.status`, value: v };
  const kt = f.match(/^kt\.(.+)\.(status|level)$/i);
  if (kt) return { field: `kt.${kt[1].trim()}.stage`, value: v };
  return { field: f, value: v };
}

export function parseField(field: string): ParsedField {
  const f = field.trim();
  let m = f.match(/^access\.(.+)\.status$/i);
  if (m) return { kind: "ACCESS_STATUS", application: m[1].trim() };
  m = f.match(/^kt\.(.+)\.stage$/i);
  if (m) return { kind: "KT_STAGE", activity: m[1].trim() };
  const lower = f.toLowerCase();
  if (lower === "case.ktowner") return { kind: "CASE_OWNER", role: "KT_OWNER" };
  if (lower === "case.techlead") return { kind: "CASE_OWNER", role: "TECH_LEAD" };
  if (lower === "case.linemanager") return { kind: "CASE_OWNER", role: "LINE_MANAGER" };
  if (lower === "case.projectrole") return { kind: "CASE_ROLE" };
  if (lower === "case.project") return { kind: "CASE_PROJECT" };
  if (lower === "case.expectedreadyat") return { kind: "CASE_DATE", which: "expectedReadyAt" };
  if (lower === "case.readinessreviewat") return { kind: "CASE_DATE", which: "readinessReviewAt" };
  if (/validat/i.test(f)) return { kind: "INFO", reason: "Readiness validation can only be recorded by a Technical Lead through the validation form." };
  if (/^(readiness|onboarding|docs|info|request|project)\./i.test(f)) return { kind: "INFO", reason: "Informational: recorded as a claim and used for conflict detection; never written to case state." };
  return { kind: "INFO", reason: "Not a whitelisted field; stored as information only." };
}

/** Normalise and validate a claim value for its field. Returns null when the value is not acceptable. */
export function normalizeValue(parsed: ParsedField, value: string): string | null {
  const v = value.trim();
  switch (parsed.kind) {
    case "ACCESS_STATUS": {
      const up = v.toUpperCase().replace(/[\s-]+/g, "_");
      return (ACCESS_STATUSES as readonly string[]).includes(up) ? up : null;
    }
    case "KT_STAGE": {
      const up = v.toUpperCase().replace(/[\s-]+/g, "_");
      return (KT_STAGES as readonly string[]).includes(up) ? up : null;
    }
    case "CASE_DATE":
      return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
    default:
      return v.length ? v.slice(0, 200) : null;
  }
}

/** Fields whose approval needs the Technical Lead (technical authority). */
export function requiresTechnicalReviewer(parsed: ParsedField): boolean {
  return parsed.kind === "KT_STAGE" || (parsed.kind === "CASE_DATE" && parsed.which === "readinessReviewAt") || (parsed.kind === "CASE_OWNER" && parsed.role !== "LINE_MANAGER");
}
