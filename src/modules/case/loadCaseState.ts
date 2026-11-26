import type { Person, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getEvaluationDate } from "@/lib/clock";
import { parseJson } from "@/lib/json";
import type {
  AccessItem, AccessStatus, CaseState, ClaimItem, CommunicationItem, DependencyItem, EvidenceItem, FindingItem, KTItem,
  KTStage, PersonRef, ReadinessLevel, RequirementItem, Severity, SkillCover, StageBasis, ValidationItem,
} from "@/domain/types";

const personRef = (p: Person | null | undefined): PersonRef | null =>
  p ? { id: p.id, name: p.name, role: p.role, projectId: p.projectId, isSimulated: p.isSimulated } : null;

type EvidenceRow = {
  id: string; title: string; sourceType: string; author: string | null; senderRole: string | null; recipients: string; authorityLevel: string | null;
  timestamp: string; content: string; reviewStatus: string; isRequest: boolean; inReplyToId: string | null; isSimulated: boolean; employeeId: string | null; projectId: string | null;
};

export const toEvidenceItem = (e: EvidenceRow): EvidenceItem => ({
  id: e.id, title: e.title, sourceType: e.sourceType, senderName: e.author, senderRole: e.senderRole,
  recipients: parseJson(e.recipients, [] as { name: string | null; role: string }[]), authorityLevel: e.authorityLevel,
  timestamp: e.timestamp, content: e.content, reviewStatus: e.reviewStatus, isRequest: e.isRequest, inReplyToId: e.inReplyToId,
  isSimulated: e.isSimulated, employeeId: e.employeeId, projectId: e.projectId,
});

export async function loadCaseState(employeeId: string, db: PrismaClient = prisma, evaluationDate = getEvaluationDate()): Promise<CaseState | null> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: {
      project: true,
      access: { orderBy: { application: "asc" } },
      activities: { orderBy: { title: "asc" } },
      evidence: { include: { claims: true }, orderBy: { timestamp: "asc" } },
      case: { include: { findings: true, validations: true, dependencies: true } },
    },
  });
  if (!employee || !employee.case) return null;
  const c = employee.case;

  const personIds = [employee.lineManagerId, employee.technicalLeadId, c.ktOwnerId].filter((x): x is string => Boolean(x));
  const [people, projectPeople, projectEvidence, resources, communications, reqRows] = await Promise.all([
    personIds.length ? db.person.findMany({ where: { id: { in: personIds } } }) : Promise.resolve([] as Person[]),
    employee.projectId ? db.person.findMany({ where: { projectId: employee.projectId } }) : Promise.resolve([] as Person[]),
    employee.projectId ? db.evidence.findMany({ where: { projectId: employee.projectId, employeeId: null } }) : Promise.resolve([]),
    employee.projectId ? db.knowledgeResource.findMany({ where: { projectId: employee.projectId } }) : Promise.resolve([]),
    loadCommunications(db, employeeId),
    db.employeeRequirementStatus.findMany({ where: { employeeId, requirement: { status: "ACTIVE" } }, include: { requirement: { include: { skill: true } } } }),
  ]);
  const coverIds = reqRows.map((r) => r.satisfiedBySkillId).filter((x): x is string => Boolean(x));
  const covers = coverIds.length ? await db.employeeSkill.findMany({ where: { id: { in: coverIds } }, include: { skill: true } }) : [];
  const coverOf = (id: string | null): SkillCover | null => {
    const s = id ? covers.find((c) => c.id === id) : undefined;
    return s ? { recordId: s.id, skillName: s.skill.name, level: s.level, evidenceId: s.evidenceId } : null;
  };
  const requirements: RequirementItem[] = reqRows.map((r) => ({
    id: r.requirementId, statusId: r.id, title: r.requirement.title, type: r.requirement.type as RequirementItem["type"], mandatory: r.requirement.mandatory,
    status: r.status as RequirementItem["status"], skillName: r.requirement.skill?.name ?? null, requiredLevel: r.requirement.requiredLevel,
    completionCriteria: r.requirement.completionCriteria, satisfiedBySkill: r.status === "SATISFIED_BY_EXISTING_SKILL" ? coverOf(r.satisfiedBySkillId) : null,
  }));
  const byId = new Map(people.map((p) => [p.id, p]));

  const access: AccessItem[] = employee.access.map((a) => ({
    id: a.id, application: a.application, requiredScope: a.requiredScope, status: a.status as AccessStatus, required: a.required,
    requestDate: a.requestDate, owner: a.owner, handlerRole: a.handlerRole, approverRole: a.approverRole, blockerReason: a.blockerReason,
    evidenceId: a.evidenceId, requestEvidenceId: a.requestEvidenceId, usableConfirmedAt: a.usableConfirmedAt, usableEvidenceId: a.usableEvidenceId,
    lastUpdate: a.lastUpdate, nextFollowUp: a.nextFollowUp,
  }));
  const kt: KTItem[] = employee.activities.map((k) => ({
    id: k.id, title: k.title, description: k.description, scopeType: k.scopeType === "COMPLEX" ? "COMPLEX" : "CORE", stage: k.stage as KTStage,
    stageBasis: k.stageBasis as StageBasis, owner: k.owner, required: k.requiredForReady, requiredApps: parseJson(k.requiredApps, [] as string[]),
    status: k.status as KTItem["status"], origin: k.origin, originNote: k.originNote, evidenceId: k.evidenceId,
    coveredBySkill: k.requirementId ? requirements.find((r) => r.id === k.requirementId)?.satisfiedBySkill ?? null : null,
  }));
  const evidence = employee.evidence.map(toEvidenceItem);
  const claims: ClaimItem[] = employee.evidence.flatMap((e) => e.claims.map((cl) => ({
    id: cl.id, evidenceId: cl.evidenceId, entity: cl.entity, field: cl.field, value: cl.editedValue ?? cl.extractedValue, excerpt: cl.excerpt,
    excerptVerified: cl.excerptVerified, reviewStatus: cl.reviewStatus, origin: cl.origin, effectiveDate: cl.effectiveDate,
  })));
  const findings: FindingItem[] = c.findings.map((f) => ({
    id: f.id, fingerprint: f.fingerprint, type: f.type, category: f.category, origin: f.origin === "AI" ? "AI" : "RULE", severity: f.severity as Severity,
    title: f.title, description: f.description, status: f.status as FindingItem["status"], evidenceIds: parseJson(f.evidenceIds, []),
    facts: parseJson(f.facts, []), assumptions: parseJson(f.assumptions, []), rootCauses: parseJson(f.rootCauses, []),
    recommendedActions: parseJson(f.recommendedActions, []), affectedEntities: parseJson(f.affectedEntities, []), ownerRole: f.ownerRole,
    aiRunId: f.aiRunId, aiAnalysis: f.aiAnalysis, firstDetectedAt: f.firstDetectedAt, resolvedAt: f.resolvedAt, resolvedBy: f.resolvedBy,
    resolutionType: f.resolutionType, resolution: f.resolution,
  }));
  const dependencies: DependencyItem[] = c.dependencies.map((d) => ({
    id: d.id, fromType: d.fromType as DependencyItem["fromType"], fromId: d.fromId, toType: d.toType as DependencyItem["toType"], toId: d.toId,
    kind: d.kind as DependencyItem["kind"], status: d.status as DependencyItem["status"], origin: d.origin as DependencyItem["origin"],
    rationale: d.rationale, evidenceIds: parseJson(d.evidenceIds, []), excerpts: parseJson(d.excerpts, []), confirmedBy: d.confirmedBy, confirmedAt: d.confirmedAt,
  }));
  const validations: ValidationItem[] = c.validations.map((v) => ({
    id: v.id, state: v.state as ValidationItem["state"], validatedLevel: (v.validatedLevel as ReadinessLevel | null) ?? null, reviewerRole: v.reviewerRole,
    reviewerName: v.reviewerName, evidenceIds: parseJson(v.evidenceIds, v.evidenceId ? [v.evidenceId] : []), comment: v.comment, timestamp: v.timestamp,
  }));

  return {
    evaluationDate,
    caseId: c.id,
    employee: {
      id: employee.id, name: employee.name, startDate: employee.startDate, movement: employee.movement, trackerStatus: employee.trackerStatus,
      lastUpdate: employee.lastUpdate, projectId: employee.projectId, projectName: employee.project?.name ?? null, role: employee.role, isSimulated: employee.isSimulated,
    },
    people: {
      lineManager: personRef(employee.lineManagerId ? byId.get(employee.lineManagerId) : null),
      lineManagerText: employee.manager,
      techLead: personRef(employee.technicalLeadId ? byId.get(employee.technicalLeadId) : null),
      ktOwner: personRef(c.ktOwnerId ? byId.get(c.ktOwnerId) : null),
      projectPeople: projectPeople.map((p) => personRef(p)!),
    },
    caseInfo: { expectedReadyAt: c.expectedReadyAt, readinessReviewAt: c.readinessReviewAt, validatedStatus: c.validatedStatus },
    access, kt, evidence,
    projectEvidence: projectEvidence.map(toEvidenceItem),
    claims, findings, dependencies, validations, communications,
    knowledgeResources: resources.map((r) => ({ id: r.id, title: r.title, location: r.location, copyAllowed: r.copyAllowed })),
    requirements,
  };
}

/** Follow-up communications that include this employee (SQLite JSON column, filtered in memory). */
async function loadCommunications(db: PrismaClient, employeeId: string): Promise<CommunicationItem[]> {
  const rows = await db.communication.findMany({ where: { employeeIds: { contains: `"${employeeId}"` } }, orderBy: { createdAt: "desc" } });
  return rows
    .filter((c) => parseJson<string[]>(c.employeeIds, []).includes(employeeId))
    .map((c) => ({
      id: c.id, stakeholderRole: c.stakeholderRole, stakeholderLabel: c.stakeholderLabel, status: c.status, subject: c.subject,
      requestEvidenceIds: parseJson(c.requestEvidenceIds, [] as string[]), outboxEvidenceIds: parseJson(c.outboxEvidenceIds, [] as string[]),
      sentAt: c.sentAt, respondedAt: c.respondedAt,
    }));
}

export async function listCaseEmployeeIds(db: PrismaClient = prisma, includeSimulated = false): Promise<string[]> {
  const rows = await db.employee.findMany({ where: includeSimulated ? {} : { isSimulated: false }, select: { id: true }, orderBy: { id: "asc" } });
  return rows.map((r) => r.id);
}
