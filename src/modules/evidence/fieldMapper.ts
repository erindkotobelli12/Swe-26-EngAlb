import type { PrismaClient } from "@prisma/client";
import type { AccessStatus, KTStage } from "@/domain/types";
import { normalizeValue, parseField } from "@/domain/claimFields";

export { FIELD_VOCABULARY, normalizeValue, parseField, requiresTechnicalReviewer, type ParsedField } from "@/domain/claimFields";

export type AppliedChange = { entityType: string; entityId: string; label: string; before: unknown; after: unknown } | null;

const basisForSender = (role: string | null) => (role === "TECH_LEAD" || role === "KT_OWNER" ? "OBSERVED" : role === "EMPLOYEE" ? "SELF_REPORTED" : "REPORTED");

/**
 * Applies an approved claim. Pure Prisma parameterised writes; returns the before/after for the audit log.
 */
export async function applyClaim(
  db: PrismaClient,
  input: { employeeId: string; caseId: string; field: string; value: string; evidenceId: string; evidenceDate: string; senderRole: string | null },
): Promise<AppliedChange> {
  const parsed = parseField(input.field);
  const value = normalizeValue(parsed, input.value);
  if (parsed.kind === "INFO" || value === null) return null;

  switch (parsed.kind) {
    case "ACCESS_STATUS": {
      const status = value as AccessStatus;
      const existing = (await db.accessRequest.findMany({ where: { employeeId: input.employeeId } })).find((a) => a.application.toLowerCase() === parsed.application.toLowerCase());
      const usable = status === "USABLE" ? { usableConfirmedAt: input.evidenceDate, usableEvidenceId: input.evidenceId } : {};
      if (existing) {
        const updated = await db.accessRequest.update({ where: { id: existing.id }, data: { status, evidenceId: input.evidenceId, lastUpdate: input.evidenceDate, blockerReason: status === "USABLE" ? null : existing.blockerReason, ...usable } });
        return { entityType: "AccessRequest", entityId: existing.id, label: existing.application, before: { status: existing.status }, after: { status: updated.status, ...usable } };
      }
      const created = await db.accessRequest.create({ data: { employeeId: input.employeeId, application: parsed.application, requiredScope: "Identified from evidence", status, evidenceId: input.evidenceId, requestDate: status === "REQUESTED" ? input.evidenceDate : null, lastUpdate: input.evidenceDate, ...usable } });
      return { entityType: "AccessRequest", entityId: created.id, label: created.application, before: null, after: { status } };
    }
    case "KT_STAGE": {
      const stage = value as KTStage;
      const existing = (await db.kTActivity.findMany({ where: { employeeId: input.employeeId } })).find((k) => k.title.toLowerCase() === parsed.activity.toLowerCase());
      const stageBasis = basisForSender(input.senderRole);
      if (existing) {
        await db.kTActivity.update({ where: { id: existing.id }, data: { stage, stageBasis, evidenceId: input.evidenceId, completionDate: stage === "INDEPENDENT_EXECUTION" ? input.evidenceDate : existing.completionDate } });
        return { entityType: "KTActivity", entityId: existing.id, label: existing.title, before: { stage: existing.stage, stageBasis: existing.stageBasis }, after: { stage, stageBasis } };
      }
      const created = await db.kTActivity.create({ data: { employeeId: input.employeeId, title: parsed.activity, description: "Identified from evidence", scope: parsed.activity, stage, stageBasis, evidenceId: input.evidenceId, status: "CONFIRMED", origin: "EVIDENCE" } });
      return { entityType: "KTActivity", entityId: created.id, label: created.title, before: null, after: { stage, stageBasis } };
    }
    case "CASE_OWNER": {
      const employee = await db.employee.findUniqueOrThrow({ where: { id: input.employeeId }, include: { case: true } });
      const person = await db.person.create({ data: { id: `P-${parsed.role}-${input.employeeId}-${Date.now().toString(36)}`, name: value, role: parsed.role, projectId: employee.projectId, note: `From evidence ${input.evidenceId}` } });
      if (parsed.role === "KT_OWNER") {
        await db.onboardingCase.update({ where: { id: input.caseId }, data: { ktOwnerId: person.id } });
        return { entityType: "OnboardingCase", entityId: input.caseId, label: "KT owner", before: { ktOwnerId: employee.case?.ktOwnerId ?? null }, after: { ktOwnerId: person.id, name: value } };
      }
      if (parsed.role === "TECH_LEAD") {
        await db.employee.update({ where: { id: input.employeeId }, data: { technicalLeadId: person.id } });
        return { entityType: "Employee", entityId: input.employeeId, label: "Technical Lead", before: { technicalLeadId: employee.technicalLeadId }, after: { technicalLeadId: person.id, name: value } };
      }
      await db.employee.update({ where: { id: input.employeeId }, data: { lineManagerId: person.id, manager: value } });
      return { entityType: "Employee", entityId: input.employeeId, label: "Line Manager", before: { manager: employee.manager }, after: { manager: value } };
    }
    case "CASE_ROLE": {
      const employee = await db.employee.findUniqueOrThrow({ where: { id: input.employeeId } });
      await db.employee.update({ where: { id: input.employeeId }, data: { role: value } });
      return { entityType: "Employee", entityId: input.employeeId, label: "Exact role", before: { role: employee.role }, after: { role: value } };
    }
    case "CASE_PROJECT": {
      const project = (await db.project.findMany()).find((p) => p.name.toLowerCase() === value.toLowerCase());
      if (!project) return null;
      const employee = await db.employee.findUniqueOrThrow({ where: { id: input.employeeId } });
      await db.employee.update({ where: { id: input.employeeId }, data: { projectId: project.id } });
      return { entityType: "Employee", entityId: input.employeeId, label: "Project", before: { projectId: employee.projectId }, after: { projectId: project.id } };
    }
    case "CASE_DATE": {
      const c = await db.onboardingCase.findUniqueOrThrow({ where: { id: input.caseId } });
      await db.onboardingCase.update({ where: { id: input.caseId }, data: { [parsed.which]: value } });
      return { entityType: "OnboardingCase", entityId: input.caseId, label: parsed.which === "expectedReadyAt" ? "Expected readiness date" : "Readiness review date", before: { [parsed.which]: c[parsed.which] }, after: { [parsed.which]: value } };
    }
  }
}
