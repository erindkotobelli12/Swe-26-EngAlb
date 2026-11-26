import * as L from "@/lib/labels";

/**
 * Plain, Prisma-free domain types. Every deterministic engine (gates, detectors, dependency propagation,
 * reliability, simulator, follow-ups) is a pure function over `CaseState`, so the simulator can reuse
 * exactly the same code on a cloned state.
 */

export const PERSON_ROLES = [
  "EMPLOYEE", "LINE_MANAGER", "TECH_LEAD", "KT_OWNER", "PMO", "HR", "ACCESS_SUPPORT",
  "APP_OWNER", "TECH_MANAGER", "ADDITIONAL_MANAGER", "PROJECT_MANAGER",
] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

/** Labels come from the single labels module (src/lib/labels.ts). */
export const ROLE_LABEL = L.ROLE_LABEL as Record<PersonRole, string>;
export const roleLabel = L.roleLabel;

export const ACCESS_STATUSES = ["NOT_REQUESTED", "REQUESTED", "APPROVAL_PENDING", "APPROVED", "PROVISIONED", "USABLE", "REJECTED"] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];
export const ACCESS_STATUS_LABEL = L.ACCESS_STATUS_LABEL as Record<AccessStatus, string>;

export const KT_STAGES = ["NOT_STARTED", "SHADOWING", "SUPPORTED_EXECUTION", "INDEPENDENT_EXECUTION"] as const;
export type KTStage = (typeof KT_STAGES)[number];
export const KT_STAGE_LABEL = L.KT_STAGE_LABEL as Record<KTStage, string>;
export type StageBasis = "OBSERVED" | "SELF_REPORTED" | "REPORTED" | "ASSESSMENT" | "UNKNOWN";

export const READINESS_LEVELS = [
  "UNKNOWN", "PRE_ONBOARDING", "BLOCKED", "SHADOWING", "SUPPORTED_EXECUTION",
  "PARTIALLY_READY", "READY_WITH_SUPPORT", "INDEPENDENTLY_READY",
] as const;
export type ReadinessLevel = (typeof READINESS_LEVELS)[number];
export const READINESS_LABEL = L.READINESS_LABEL as Record<ReadinessLevel, string>;

export const GATE_IDS = [
  "SCOPE_CONFIRMED", "OWNERS_ASSIGNED", "ACCESS_IDENTIFIED", "ACCESS_USABLE", "KT_AGREED",
  "EXECUTION_OBSERVED", "NO_MATERIAL_CONFLICT", "READINESS_DATE_RECORDED", "TECH_VALIDATION_APPROVED", "BLOCKERS_OWNED",
] as const;
export type GateId = (typeof GATE_IDS)[number];
export const GATE_LABEL: Record<GateId, string> = {
  SCOPE_CONFIRMED: "Project and exact role confirmed",
  OWNERS_ASSIGNED: "Line Manager, Technical Lead and KT owner identified",
  ACCESS_IDENTIFIED: "Required applications identified",
  ACCESS_USABLE: "All required access usable",
  KT_AGREED: "KT topics agreed",
  EXECUTION_OBSERVED: "Independent execution observed",
  NO_MATERIAL_CONFLICT: "No unresolved material conflict",
  READINESS_DATE_RECORDED: "Expected readiness date recorded",
  TECH_VALIDATION_APPROVED: "Final status validated by technical owner",
  BLOCKERS_OWNED: "Blockers owned",
};
export type GateStatus = "SATISFIED" | "UNSATISFIED" | "UNKNOWN";
export type Gate = { id: GateId; label: string; status: GateStatus; reasons: string[]; evidenceIds: string[] };

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export const SEVERITY_RANK: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export type Fact = { statement: string; evidenceId: string; excerpt: string };
export type Assumption = { statement: string; basis: string };
export type RootCause = { hypothesis: string; supportingEvidenceIds: string[]; isAssumption: true };
export type RecommendedAction = { action: string; ownerRole: string; ownerPersonId?: string | null; rationale: string };
export type EntityRef = { type: "access" | "kt" | "case" | "evidence" | "gate" | "person" | "finding"; id: string; label?: string };

export type PersonRef = { id: string; name: string | null; role: string; projectId: string | null; isSimulated: boolean };

export type AccessItem = {
  id: string;
  application: string;
  requiredScope: string;
  status: AccessStatus;
  required: boolean;
  requestDate: string | null;
  owner: string | null;
  handlerRole: string | null;
  approverRole: string | null;
  blockerReason: string | null;
  evidenceId: string | null;
  requestEvidenceId: string | null;
  usableConfirmedAt: string | null;
  usableEvidenceId: string | null;
  lastUpdate: string | null;
  nextFollowUp: string | null;
};

export type KTItem = {
  id: string;
  title: string;
  description: string;
  scopeType: "CORE" | "COMPLEX";
  stage: KTStage;
  stageBasis: StageBasis;
  owner: string | null;
  required: boolean;
  requiredApps: string[];
  status: "PROPOSED" | "CONFIRMED" | "REJECTED";
  origin: string;
  originNote: string | null;
  evidenceId: string | null;
  /** Set when the onboarding requirement behind this activity is ticked off by a confirmed skill. */
  coveredBySkill?: SkillCover | null;
};

/** A confirmed skill record that satisfies a requirement (the rule's evidence). */
export type SkillCover = { recordId: string; skillName: string; level: string; evidenceId: string | null };

/** One onboarding requirement as it applies to this case. */
export type RequirementItem = {
  id: string;
  statusId: string;
  title: string;
  type: "SKILL" | "KT_ACTIVITY" | "ACCESS" | "DOCUMENT";
  mandatory: boolean;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "SATISFIED_BY_EXISTING_SKILL" | "WAIVED";
  skillName: string | null;
  requiredLevel: string | null;
  completionCriteria: string;
  satisfiedBySkill: SkillCover | null;
};

export type EvidenceItem = {
  id: string;
  title: string;
  sourceType: string;
  senderName: string | null;
  senderRole: string | null;
  recipients: { name: string | null; role: string }[];
  authorityLevel: string | null;
  timestamp: string;
  content: string;
  reviewStatus: string;
  isRequest: boolean;
  inReplyToId: string | null;
  isSimulated: boolean;
  employeeId: string | null;
  projectId: string | null;
};

export type ClaimItem = {
  id: string;
  evidenceId: string;
  entity: string;
  field: string;
  value: string;
  excerpt: string;
  excerptVerified: boolean;
  reviewStatus: string;
  origin: string;
  effectiveDate: string | null;
};

export type FindingItem = {
  id: string;
  fingerprint: string | null;
  type: string;
  category: string;
  origin: "RULE" | "AI";
  severity: Severity;
  title: string;
  description: string;
  status: "OPEN" | "PROPOSED" | "RESOLVED" | "DISMISSED";
  evidenceIds: string[];
  facts: Fact[];
  assumptions: Assumption[];
  rootCauses: RootCause[];
  recommendedActions: RecommendedAction[];
  affectedEntities: EntityRef[];
  ownerRole: string | null;
  aiRunId: string | null;
  aiAnalysis: string | null;
  firstDetectedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionType: string | null;
  resolution: string | null;
};

export type DependencyItem = {
  id: string;
  fromType: NodeType;
  fromId: string;
  toType: NodeType;
  toId: string;
  kind: "REQUIRES" | "ENABLES" | "BLOCKS";
  status: "PROPOSED" | "CONFIRMED" | "REJECTED";
  origin: "RULE" | "TEMPLATE" | "AI" | "HUMAN";
  rationale: string;
  evidenceIds: string[];
  excerpts: string[];
  confirmedBy: string | null;
  confirmedAt: string | null;
};

export type NodeType = "access" | "kt" | "gate" | "readiness" | "finding" | "competency" | "responsibility";

export type ValidationItem = {
  id: string;
  state: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_MORE_EVIDENCE";
  validatedLevel: ReadinessLevel | null;
  reviewerRole: string | null;
  reviewerName: string | null;
  evidenceIds: string[];
  comment: string | null;
  timestamp: string | null;
};

export type CommunicationItem = {
  id: string;
  stakeholderRole: string;
  stakeholderLabel: string;
  status: string;
  /** Original requests (e.g. an unanswered email) this follow-up chases. */
  requestEvidenceIds: string[];
  outboxEvidenceIds: string[];
  subject: string;
  sentAt: string | null;
  respondedAt: string | null;
};

export type CaseState = {
  evaluationDate: string;
  caseId: string;
  employee: {
    id: string;
    name: string;
    startDate: string;
    movement: string;
    trackerStatus: string;
    lastUpdate: string;
    projectId: string | null;
    projectName: string | null;
    role: string | null;
    isSimulated: boolean;
  };
  people: {
    lineManager: PersonRef | null;
    lineManagerText: string | null;
    techLead: PersonRef | null;
    ktOwner: PersonRef | null;
    projectPeople: PersonRef[];
  };
  caseInfo: { expectedReadyAt: string | null; readinessReviewAt: string | null; validatedStatus: string };
  access: AccessItem[];
  kt: KTItem[];
  evidence: EvidenceItem[];
  projectEvidence: EvidenceItem[];
  claims: ClaimItem[];
  findings: FindingItem[];
  dependencies: DependencyItem[];
  validations: ValidationItem[];
  communications: CommunicationItem[];
  knowledgeResources: { id: string; title: string; location: string; copyAllowed: boolean }[];
  /** Active onboarding requirements of the case's project (empty when none are defined). */
  requirements?: RequirementItem[];
};
