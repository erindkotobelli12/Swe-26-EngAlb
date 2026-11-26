/**
 * Role × action permission matrix. Enforced server-side in every server action and route handler.
 * AI agents are not actors: no AI module imports the actions that change readiness, validation or communications.
 */
export type Role = "PMO" | "TECH_LEAD" | "LINE_MANAGER" | "MANAGEMENT" | "EMPLOYEE";
export type Principal = { userId: string; role: Role; employeeId: string | null; name: string };

export const PERMISSIONS = {
  "case.view": { roles: ["PMO", "TECH_LEAD", "LINE_MANAGER", "MANAGEMENT", "EMPLOYEE"], ownCaseOnlyFor: ["EMPLOYEE"], label: "View a case" },
  "case.recompute": { roles: ["PMO", "TECH_LEAD"], label: "Re-run deterministic analysis" },
  "evidence.add": { roles: ["PMO", "TECH_LEAD", "LINE_MANAGER", "EMPLOYEE"], ownCaseOnlyFor: ["EMPLOYEE"], label: "Add evidence" },
  "evidence.review": { roles: ["PMO", "TECH_LEAD"], label: "Review evidence and claims" },
  "claim.reviewTechnical": { roles: ["TECH_LEAD"], label: "Approve KT / technical claims" },
  "access.confirmUsable": { roles: ["EMPLOYEE"], ownCaseOnlyFor: ["EMPLOYEE"], label: "Confirm own access usability" },
  "finding.decide": { roles: ["PMO", "TECH_LEAD"], label: "Resolve, dismiss or accept findings" },
  "dependency.decide": { roles: ["PMO", "TECH_LEAD"], label: "Confirm or reject dependencies" },
  "validation.record": { roles: ["TECH_LEAD"], label: "Record technical readiness validation" },
  "communication.approve": { roles: ["PMO"], label: "Edit, approve and send (simulated) follow-ups" },
  "communication.recordResponse": { roles: ["PMO"], label: "Record a follow-up response" },
  "roadmap.decideTechnical": { roles: ["TECH_LEAD"], label: "Approve KT / technical roadmap items" },
  "roadmap.decideLogistics": { roles: ["PMO"], label: "Approve logistics roadmap items" },
  "material.manage": { roles: ["TECH_LEAD"], label: "Approve training materials" },
  "assessment.take": { roles: ["EMPLOYEE"], ownCaseOnlyFor: ["EMPLOYEE"], label: "Take a KT assessment" },
  "assessment.generate": { roles: ["TECH_LEAD", "EMPLOYEE"], ownCaseOnlyFor: ["EMPLOYEE"], label: "Generate a KT assessment" },
  "ai.run": { roles: ["PMO", "TECH_LEAD"], label: "Run AI agents (investigate, suggest, draft)" },
  "simulator.run": { roles: ["PMO", "TECH_LEAD", "LINE_MANAGER", "MANAGEMENT", "EMPLOYEE"], ownCaseOnlyFor: ["EMPLOYEE"], label: "Run what-if simulations" },
  "briefing.generate": { roles: ["PMO", "TECH_LEAD", "LINE_MANAGER", "MANAGEMENT"], label: "Generate a management briefing" },
  "insights.view": { roles: ["PMO", "TECH_LEAD", "MANAGEMENT"], label: "View organizational insights" },
  "audit.view": { roles: ["PMO", "TECH_LEAD", "MANAGEMENT", "EMPLOYEE"], ownCaseOnlyFor: ["EMPLOYEE"], label: "View case history" },
} as const satisfies Record<string, { roles: readonly Role[]; ownCaseOnlyFor?: readonly Role[]; label: string }>;

export type Permission = keyof typeof PERMISSIONS;

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export function can(principal: Pick<Principal, "role" | "employeeId">, permission: Permission, ctx: { employeeId?: string | null } = {}): boolean {
  const rule = PERMISSIONS[permission] as { roles: readonly Role[]; ownCaseOnlyFor?: readonly Role[] };
  if (!rule.roles.includes(principal.role)) return false;
  if (rule.ownCaseOnlyFor?.includes(principal.role)) {
    return Boolean(principal.employeeId) && (ctx.employeeId === undefined || ctx.employeeId === principal.employeeId);
  }
  return true;
}

export function assertCan(principal: Principal, permission: Permission, ctx: { employeeId?: string | null } = {}): void {
  if (!can(principal, permission, ctx)) throw new PermissionError(`Your role (${principal.role}) is not allowed to: ${PERMISSIONS[permission].label.toLowerCase()}.`);
}
