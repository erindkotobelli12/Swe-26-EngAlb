import { can, resolveScope, type Principal, type Scope } from "@/modules/permissions";

/** Whether a scope may read a piece of evidence: case evidence follows case visibility; project evidence follows project roles. */
export function evidenceVisible(scope: Scope, e: { employeeId: string | null; projectId: string | null }): boolean {
  if (e.employeeId) return can(scope, "case.view", { employeeId: e.employeeId });
  if (scope.isPMO) return true;
  if (!e.projectId) return scope.principal.role !== "EMPLOYEE";
  return Boolean(scope.projectRoles[e.projectId]) || Object.values(scope.cases).some((c) => c.projectId === e.projectId);
}

export async function canSeeEvidence(principal: Principal, e: { employeeId: string | null; projectId: string | null }): Promise<boolean> {
  return evidenceVisible(await resolveScope(principal), e);
}
