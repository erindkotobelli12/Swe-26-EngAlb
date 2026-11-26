import { z } from "zod";
import { ACCESS_STATUSES, KT_STAGES, type CaseState } from "@/domain/types";

/**
 * What-if overrides. Applied to a deep clone of CaseState only — never to the database.
 * Every toggle the UI offers is generated from the case's actual unsatisfied items (see simulator/toggles.ts).
 */
export const OverrideSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ACCESS_STATUS"), accessId: z.string().min(1), status: z.enum(ACCESS_STATUSES) }),
  z.object({ kind: z.literal("KT_STAGE"), ktId: z.string().min(1), stage: z.enum(KT_STAGES) }),
  z.object({ kind: z.literal("CONFIRM_KT"), ktId: z.string().min(1) }),
  z.object({ kind: z.literal("ASSIGN_OWNER"), role: z.enum(["LINE_MANAGER", "TECH_LEAD", "KT_OWNER"]) }),
  z.object({ kind: z.literal("CONFIRM_SCOPE") }),
  z.object({ kind: z.literal("RESOLVE_FINDING"), findingId: z.string().min(1), winnerEvidenceId: z.string().optional() }),
  z.object({ kind: z.literal("RECORD_VALIDATION") }),
  z.object({ kind: z.literal("SET_READINESS_DATE"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
]);
export type Override = z.infer<typeof OverrideSchema>;

export const SimulationOverridesSchema = z.object({
  items: z.array(OverrideSchema).max(50),
  includeProposed: z.boolean().default(false),
});
export type SimulationOverrides = z.infer<typeof SimulationOverridesSchema>;

const SIMULATED = "(simulated)";

export function applyOverrides(state: CaseState, overrides?: SimulationOverrides): CaseState {
  if (!overrides || (!overrides.items.length && !overrides.includeProposed)) return state;
  const next: CaseState = structuredClone(state);
  if (overrides.includeProposed) {
    next.kt = next.kt.map((k) => (k.status === "PROPOSED" ? { ...k, status: "CONFIRMED" } : k));
  }
  for (const o of overrides.items) {
    switch (o.kind) {
      case "ACCESS_STATUS":
        next.access = next.access.map((a) => (a.id === o.accessId ? { ...a, status: o.status, usableConfirmedAt: o.status === "USABLE" ? next.evaluationDate : a.usableConfirmedAt } : a));
        break;
      case "KT_STAGE":
        next.kt = next.kt.map((k) => (k.id === o.ktId ? { ...k, stage: o.stage, stageBasis: "OBSERVED" } : k));
        break;
      case "CONFIRM_KT":
        next.kt = next.kt.map((k) => (k.id === o.ktId ? { ...k, status: "CONFIRMED" } : k));
        break;
      case "ASSIGN_OWNER": {
        const person = { id: `SIM-${o.role}`, name: `${SIMULATED} owner`, role: o.role, projectId: next.employee.projectId, isSimulated: true };
        if (o.role === "LINE_MANAGER") next.people.lineManager = person;
        if (o.role === "TECH_LEAD") next.people.techLead = person;
        if (o.role === "KT_OWNER") next.people.ktOwner = person;
        break;
      }
      case "CONFIRM_SCOPE":
        next.employee.projectId = next.employee.projectId ?? "SIMULATED";
        next.employee.projectName = next.employee.projectName ?? SIMULATED;
        next.employee.role = next.employee.role ?? SIMULATED;
        break;
      case "RESOLVE_FINDING":
        next.findings = next.findings.map((f) => (f.id === o.findingId ? { ...f, status: "RESOLVED", resolutionType: o.winnerEvidenceId ? "CONFIRMED_SOURCE" : "SIMULATED", resolution: o.winnerEvidenceId ? `Source ${o.winnerEvidenceId} confirmed ${SIMULATED}` : SIMULATED } : f));
        break;
      case "RECORD_VALIDATION":
        next.validations = [...next.validations, {
          id: "SIM-VALIDATION", state: "APPROVED", validatedLevel: "INDEPENDENTLY_READY", reviewerRole: "TECH_LEAD",
          reviewerName: `${SIMULATED} Technical Lead`, evidenceIds: ["SIMULATED"], comment: SIMULATED, timestamp: `${next.evaluationDate}T23:59:59.999Z`,
        }];
        break;
      case "SET_READINESS_DATE":
        next.caseInfo.expectedReadyAt = o.date;
        break;
    }
  }
  // An owner assigned in simulation also owns otherwise unowned access steps and blockers for this case.
  if (overrides.items.some((o) => o.kind === "ASSIGN_OWNER")) {
    next.access = next.access.map((a) => (a.owner ? a : { ...a, owner: `${SIMULATED} owner` }));
    next.findings = next.findings.map((f) => (f.ownerRole ? f : { ...f, ownerRole: "SIMULATED" }));
  }
  return next;
}
