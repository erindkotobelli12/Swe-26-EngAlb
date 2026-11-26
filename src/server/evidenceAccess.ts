import { can, type Principal } from "@/modules/permissions";

/** Whether the principal may read a piece of evidence (case evidence follows case visibility). */
export async function canSeeEvidence(principal: Principal, e: { employeeId: string | null; projectId: string | null }): Promise<boolean> {
  if (e.employeeId) return can(principal, "case.view", { employeeId: e.employeeId });
  return principal.role !== "EMPLOYEE";
}
