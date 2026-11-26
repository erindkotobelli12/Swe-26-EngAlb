import type { AccessItem, CaseState, FindingItem, KTItem, ValidationItem } from "../../src/domain/types";

/** A fully-specified, fictional case where every gate is satisfied. Tests remove pieces to check each rule. */
export function readyState(): CaseState {
  return {
    evaluationDate: "2026-10-14",
    caseId: "CASE-TEST",
    employee: { id: "TEST-1", name: "Test Person", startDate: "2026-09-01", movement: "New Hire", trackerStatus: "Ready with Support", lastUpdate: "2026-10-13", projectId: "P", projectName: "Project", role: "Analyst", isSimulated: false },
    people: {
      lineManager: { id: "LM", name: "Line Manager Person", role: "LINE_MANAGER", projectId: "P", isSimulated: false },
      lineManagerText: "Line Manager Person",
      techLead: { id: "TL", name: "Tech Lead Person", role: "TECH_LEAD", projectId: "P", isSimulated: false },
      ktOwner: { id: "KO", name: "KT Owner Person", role: "KT_OWNER", projectId: "P", isSimulated: false },
      projectPeople: [],
    },
    caseInfo: { expectedReadyAt: "2026-10-20", readinessReviewAt: null, validatedStatus: "UNKNOWN" },
    access: [access({ id: "A1", application: "Tool", status: "USABLE" })],
    kt: [kt({ id: "K1", title: "Core work", stage: "INDEPENDENT_EXECUTION", stageBasis: "OBSERVED" })],
    evidence: [{ id: "TRACKER-TEST-1", title: "Tracker", sourceType: "TRACKER", senderName: null, senderRole: "TRACKER", recipients: [], authorityLevel: "TRACKER", timestamp: "2026-10-13", content: "Case: TEST-1\nProject: Project\nManager: Line Manager Person\nStatus: Ready with Support\nLast update: 13-Oct", reviewStatus: "APPROVED", isRequest: false, inReplyToId: null, isSimulated: false, employeeId: "TEST-1", projectId: "P" }],
    projectEvidence: [],
    claims: [],
    findings: [],
    dependencies: [],
    validations: [validation({})],
    communications: [],
    knowledgeResources: [],
  };
}

export function access(p: Partial<AccessItem> & Pick<AccessItem, "id" | "application" | "status">): AccessItem {
  return { requiredScope: "scope", required: true, requestDate: "2026-10-01", owner: "Owner", handlerRole: "ACCESS_SUPPORT", approverRole: null, blockerReason: null, evidenceId: null, requestEvidenceId: null, usableConfirmedAt: null, usableEvidenceId: null, lastUpdate: null, nextFollowUp: null, ...p };
}

export function kt(p: Partial<KTItem> & Pick<KTItem, "id" | "title">): KTItem {
  return { description: "", scopeType: "CORE", stage: "NOT_STARTED", stageBasis: "UNKNOWN", owner: "KT Owner Person", required: true, requiredApps: [], status: "CONFIRMED", origin: "EVIDENCE", originNote: null, evidenceId: null, ...p };
}

export function validation(p: Partial<ValidationItem>): ValidationItem {
  return { id: "V1", state: "APPROVED", validatedLevel: "INDEPENDENTLY_READY", reviewerRole: "TECH_LEAD", reviewerName: "Tech Lead Person", evidenceIds: ["E1"], comment: null, timestamp: "2026-10-14T10:00:00.000Z", ...p };
}

export function finding(p: Partial<FindingItem> & Pick<FindingItem, "id" | "category">): FindingItem {
  return { fingerprint: p.id, type: "OTHER", origin: "RULE", severity: "HIGH", title: "finding", description: "", status: "OPEN", evidenceIds: [], facts: [], assumptions: [], rootCauses: [], recommendedActions: [], affectedEntities: [], ownerRole: "PMO", aiRunId: null, aiAnalysis: null, firstDetectedAt: null, resolvedAt: null, resolvedBy: null, resolutionType: null, resolution: null, ...p };
}
