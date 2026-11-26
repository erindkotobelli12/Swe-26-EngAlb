import { thresholds } from "@/config/thresholds";
import { plural } from "@/lib/labels";

/**
 * Project health: a deterministic, explainable function. No percentages and no AI: the status comes from counts,
 * compared with the thresholds in src/config/thresholds.ts, and every contributing factor is returned as a reason.
 *
 *   NOT_STARTED  no active employees on the project
 *   CRITICAL     open critical findings ≥ HEALTH_CRITICAL_FINDINGS
 *   AT_RISK      any At-risk factor reaches its threshold, or a required role is not assigned
 *   ON_TRACK     otherwise
 */
export type Health = "ON_TRACK" | "AT_RISK" | "CRITICAL" | "NOT_STARTED";
export type HealthInput = {
  employeesByPhase: { PRE_BOARDING: number; ONBOARDING: number; READY: number; CLOSED: number };
  criticalFindings: number;
  highFindings: number;
  accessNotUsable: number;
  overdueFollowUps: number;
  staleCases: number;
  pendingValidations: number;
  missingRoles: ("ADDITIONAL_MANAGER" | "LINE_MANAGER" | "TECH_LEAD")[];
};
export type HealthReason = { level: "CRITICAL" | "AT_RISK" | "INFO"; text: string };
export type HealthResult = { status: Health; reasons: HealthReason[]; headline: string };

const ROLE_TEXT = { ADDITIONAL_MANAGER: "Additional Manager", LINE_MANAGER: "Line Manager", TECH_LEAD: "Technical Lead" } as const;

export function projectHealth(i: HealthInput): HealthResult {
  const active = i.employeesByPhase.PRE_BOARDING + i.employeesByPhase.ONBOARDING + i.employeesByPhase.READY;
  const reasons: HealthReason[] = [];
  if (i.criticalFindings >= thresholds.HEALTH_CRITICAL_FINDINGS) reasons.push({ level: "CRITICAL", text: `${plural(i.criticalFindings, "critical finding")} open` });
  if (i.highFindings >= thresholds.HEALTH_AT_RISK_HIGH_FINDINGS) reasons.push({ level: "AT_RISK", text: `${plural(i.highFindings, "high-severity finding")} open` });
  if (i.accessNotUsable >= thresholds.HEALTH_AT_RISK_ACCESS_NOT_USABLE) reasons.push({ level: "AT_RISK", text: `${plural(i.accessNotUsable, "access item")} not working yet` });
  if (i.overdueFollowUps >= thresholds.HEALTH_AT_RISK_OVERDUE) reasons.push({ level: "AT_RISK", text: `${plural(i.overdueFollowUps, "follow-up")} overdue` });
  if (i.staleCases >= thresholds.HEALTH_AT_RISK_STALE) reasons.push({ level: "AT_RISK", text: `${plural(i.staleCases, "case")} with an out-of-date status` });
  if (i.pendingValidations >= thresholds.HEALTH_AT_RISK_PENDING_VALIDATIONS) reasons.push({ level: "AT_RISK", text: `${plural(i.pendingValidations, "person", "people")} waiting for technical sign-off` });
  else if (i.pendingValidations > 0) reasons.push({ level: "INFO", text: `${plural(i.pendingValidations, "person", "people")} waiting for technical sign-off` });
  for (const r of i.missingRoles) reasons.push({ level: "AT_RISK", text: `No ${ROLE_TEXT[r]} assigned` });

  if (!active) {
    const gaps = reasons.filter((r) => r.text.startsWith("No "));
    return { status: "NOT_STARTED", reasons: [{ level: "INFO", text: "No employees assigned yet" }, ...gaps], headline: "No employees assigned yet" };
  }
  const status: Health = reasons.some((r) => r.level === "CRITICAL") ? "CRITICAL" : reasons.some((r) => r.level === "AT_RISK") ? "AT_RISK" : "ON_TRACK";
  if (status === "ON_TRACK") reasons.unshift({ level: "INFO", text: "No blockers, overdue follow-ups or role gaps" });
  const top = reasons.find((r) => r.level === "CRITICAL") ?? reasons.find((r) => r.level === "AT_RISK") ?? reasons[0];
  return { status, reasons, headline: top.text };
}
