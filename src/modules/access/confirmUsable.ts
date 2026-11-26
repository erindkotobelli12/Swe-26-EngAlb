import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditTimestamp, getEvaluationDate } from "@/lib/clock";
import { audit } from "@/modules/audit";
import { recomputeCase, type RecomputeSummary } from "@/modules/case/recompute";
import { applyClaim } from "@/modules/evidence/fieldMapper";
import { PipelineError } from "@/modules/evidence/pipeline";
import { assertAllowed, type Principal } from "@/modules/permissions";

/**
 * An employee confirms successful use of their OWN access. The employee is the authoritative source for
 * successful use, so the statement is stored as evidence (verbatim) and applied through the same field mapper.
 */
export async function confirmOwnAccessUsable(accessId: string, principal: Principal, db: PrismaClient = prisma): Promise<RecomputeSummary | null> {
  const access = await db.accessRequest.findUnique({ where: { id: accessId }, include: { employee: { include: { case: true } } } });
  if (!access?.employee.case) throw new PipelineError("Unknown access request.");
  await assertAllowed(principal, "access.confirmUsable", { employeeId: access.employeeId }, db);
  if (access.status === "USABLE") throw new PipelineError(`${access.application} is already confirmed usable.`);

  const date = getEvaluationDate();
  const evidenceId = `EV-${Date.now().toString(36).toUpperCase()}`;
  const content = `I confirm I logged in to ${access.application} successfully.`;
  await db.evidence.create({
    data: {
      id: evidenceId, title: `Successful use confirmed: ${access.application}`, sourceType: "EMPLOYEE_UPDATE", author: access.employee.name, senderRole: "EMPLOYEE",
      authorityLevel: "SELF_REPORT", recipients: "[]", timestamp: date, content, employeeId: access.employeeId, projectId: access.employee.projectId,
      caseId: access.employee.case.id, reviewStatus: "APPROVED", ingestedAt: auditTimestamp(), ingestedBy: principal.userId, sourceRef: "Confirmed by the employee in My workspace",
    },
  });
  const field = `access.${access.application}.status`;
  const change = await applyClaim(db, { employeeId: access.employeeId, caseId: access.employee.case.id, field, value: "USABLE", evidenceId, evidenceDate: date, senderRole: "EMPLOYEE" });
  await db.evidenceClaim.create({ data: { evidenceId, entity: access.employeeId, field, extractedValue: "USABLE", excerpt: content, excerptVerified: true, effectiveDate: date, origin: "HUMAN", reviewStatus: "APPROVED", reviewerId: principal.userId, reviewedAt: auditTimestamp(), reviewReason: "Employee confirmed own successful use", appliedChange: JSON.stringify(change) } });
  await audit({ actor: { userId: principal.userId, label: principal.name, role: principal.role }, action: "ACCESS_USE_CONFIRMED", entityType: "AccessRequest", entityId: access.id, employeeId: access.employeeId, before: { status: access.status }, after: { status: "USABLE" }, evidenceIds: [evidenceId], details: `${access.employee.name} confirmed successful use of ${access.application}.` }, db);
  return recomputeCase(access.employeeId, `employee confirmed ${access.application} usable`, { userId: principal.userId, label: principal.name, role: principal.role }, db);
}
