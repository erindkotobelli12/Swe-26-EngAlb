/**
 * Every user-facing label for an internal enum value lives here, in plain language and sentence case.
 * Never render a raw enum on screen: use `label(kind, value)` or one of the typed maps below.
 */

export const ROLE_LABEL: Record<string, string> = {
  PMO: "PMO",
  HR: "HR",
  ADDITIONAL_MANAGER: "Additional Manager",
  LINE_MANAGER: "Line Manager",
  TECH_LEAD: "Technical Lead",
  EMPLOYEE: "Employee",
  KT_OWNER: "KT owner",
  ACCESS_SUPPORT: "Access support",
  APP_OWNER: "Application owner",
  TECH_MANAGER: "Technical manager",
  PROJECT_MANAGER: "Project manager",
  TRACKER: "Onboarding tracker",
  SYSTEM: "System",
  SIMULATED: "Simulated",
};

export const PHASE_LABEL: Record<string, string> = {
  PRE_BOARDING: "Pre-boarding",
  ONBOARDING: "Onboarding",
  READY: "Ready",
  CLOSED: "Closed",
};
export const PHASES = ["PRE_BOARDING", "ONBOARDING", "READY", "CLOSED"] as const;

export const READINESS_LABEL: Record<string, string> = {
  UNKNOWN: "Unknown",
  PRE_ONBOARDING: "Pre-onboarding",
  BLOCKED: "Blocked",
  SHADOWING: "Shadowing",
  SUPPORTED_EXECUTION: "Supported execution",
  PARTIALLY_READY: "Partially ready",
  READY_WITH_SUPPORT: "Ready with support",
  INDEPENDENTLY_READY: "Independently ready",
  NOT_VALIDATED: "Not validated",
};

/** Gate names as plain sentences describing what is still needed or done. */
export const GATE_SENTENCE: Record<string, { done: string; open: string; unknown: string }> = {
  SCOPE_CONFIRMED: { done: "Project and role confirmed", open: "Waiting for the project and exact role", unknown: "Exact role not recorded yet" },
  OWNERS_ASSIGNED: { done: "Line Manager, Technical Lead and KT owner named", open: "Waiting for owners to be named", unknown: "Some owners known by role only" },
  ACCESS_IDENTIFIED: { done: "Required applications identified", open: "Waiting for the list of required applications", unknown: "Required applications not recorded" },
  ACCESS_USABLE: { done: "All access confirmed working", open: "Waiting for access to work", unknown: "Access not recorded yet" },
  KT_AGREED: { done: "Knowledge-transfer topics agreed", open: "Waiting for knowledge-transfer topics", unknown: "No knowledge-transfer topics agreed yet" },
  EXECUTION_OBSERVED: { done: "Independent work observed", open: "Waiting for independent work to be observed", unknown: "Independent work can't be assessed yet" },
  NO_MATERIAL_CONFLICT: { done: "No unresolved conflicts", open: "Waiting for a conflict to be resolved", unknown: "Conflicts not assessed" },
  READINESS_DATE_RECORDED: { done: "Readiness date recorded", open: "Waiting for an expected readiness date", unknown: "Readiness date unknown" },
  TECH_VALIDATION_APPROVED: { done: "Technical sign-off recorded", open: "Waiting for technical sign-off", unknown: "Technical sign-off not recorded" },
  BLOCKERS_OWNED: { done: "Every blocker has an owner", open: "Waiting for blockers to get an owner", unknown: "Blocker ownership unknown" },
};
export function gateSentence(id: string, status: string): string {
  const s = GATE_SENTENCE[id];
  if (!s) return humanize(id);
  return status === "SATISFIED" ? s.done : status === "UNKNOWN" ? s.unknown : s.open;
}

export const ACCESS_STATUS_LABEL: Record<string, string> = {
  NOT_REQUESTED: "Not requested",
  REQUESTED: "Requested",
  APPROVAL_PENDING: "Waiting for approval",
  APPROVED: "Approved",
  PROVISIONED: "Set up, not yet confirmed",
  USABLE: "Working",
  REJECTED: "Rejected",
};

export const KT_STAGE_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  SHADOWING: "Shadowing",
  SUPPORTED_EXECUTION: "Working with support",
  INDEPENDENT_EXECUTION: "Working independently",
};

export const STAGE_BASIS_LABEL: Record<string, string> = {
  OBSERVED: "Observed by the technical owner",
  SELF_REPORTED: "Self-reported",
  REPORTED: "Reported in the tracker",
  ASSESSMENT: "Assessment result",
  UNKNOWN: "Basis unknown",
};

export const SEVERITY_LABEL: Record<string, string> = { CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export const FINDING_CATEGORY_LABEL: Record<string, string> = {
  ACCESS: "Access",
  CONFLICT: "Conflicting information",
  EVIDENCE_GAP: "Missing evidence",
  FOLLOW_UP: "Unanswered request",
  MISSING_INFO: "Missing information",
  OTHER: "Other",
  OWNERSHIP: "Ownership",
  READINESS_CLAIM: "Readiness claim",
  STALE: "Out-of-date status",
};

export const FINDING_STATUS_LABEL: Record<string, string> = { OPEN: "Open", PROPOSED: "Suggested by AI", RESOLVED: "Resolved", DISMISSED: "Dismissed" };

export const RELIABILITY_LABEL: Record<string, string> = {
  CONFLICTING: "Conflicting",
  INSUFFICIENT_EVIDENCE: "Not enough evidence",
  OUTDATED: "Out of date",
  UNVERIFIED: "Unverified",
  VERIFIED: "Verified",
  WELL_SUPPORTED: "Well supported",
};

export const PREBOARDING_CATEGORY_LABEL: Record<string, string> = {
  HR_ADMIN: "HR admin",
  EQUIPMENT: "Equipment",
  ACCESS_REQUEST: "Access requests",
  WELCOME: "Welcome",
  CONTACTS: "Contacts",
};
export const ITEM_STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  BLOCKED: "Blocked",
  NOT_APPLICABLE: "Not applicable",
};

export const REQUIREMENT_TYPE_LABEL: Record<string, string> = { SKILL: "Skill", KT_ACTIVITY: "Knowledge transfer", ACCESS: "Access", DOCUMENT: "Document" };
export const REQUIREMENT_STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  SATISFIED_BY_EXISTING_SKILL: "Already has this skill",
  WAIVED: "Waived",
  POSSIBLY_COVERED: "Possibly covered",
};

export const SKILL_CATEGORY_LABEL: Record<string, string> = { APPLICATION: "Applications", TECHNICAL: "Technical", DOMAIN: "Domain", PROCESS: "Process" };
export const SKILL_LEVEL_LABEL: Record<string, string> = { BASIC: "Basic", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };
export const SKILL_SOURCE_LABEL: Record<string, string> = {
  SELF_DECLARED: "Self-declared",
  TL_CONFIRMED: "Confirmed by a Technical Lead",
  PREVIOUS_PROJECT: "From a previous project",
  ASSESSMENT: "Assessment",
};
export const SKILL_STATUS_LABEL: Record<string, string> = { CLAIMED: "Claimed", CONFIRMED: "Confirmed", REJECTED: "Rejected" };

export const ASSIGNMENT_STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", COMPLETED: "Completed", REMOVED: "Removed" };

export const HEALTH_LABEL: Record<string, string> = { ON_TRACK: "On track", AT_RISK: "At risk", CRITICAL: "Critical", NOT_STARTED: "Not started" };

export const IMPROVEMENT_STATUS_LABEL: Record<string, string> = {
  PROPOSED: "Proposed",
  APPROVED: "Approved",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  DROPPED: "Dropped",
};
export const IMPROVEMENT_SOURCE_LABEL: Record<string, string> = { INSIGHT: "From insights", BRIEFING: "From a briefing", MANUAL: "Added manually" };

export const COMMUNICATION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  SENT_SIMULATED: "Sent (simulated)",
  RESPONDED: "Responded",
  CLOSED: "Closed",
};

export const VALIDATION_STATE_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Not approved",
  NEEDS_MORE_EVIDENCE: "Needs more evidence",
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  EMAIL: "Email",
  TEAMS_MESSAGE: "Teams message",
  TRACKER: "Tracker entry",
  TRACKER_NOTE: "Tracker note",
  EMPLOYEE_UPDATE: "Employee update",
  MEETING_NOTE: "Meeting note",
  DOCUMENT: "Document",
  OTHER: "Other",
};

export const MOVEMENT_LABEL: Record<string, string> = { "New Hire": "New hire", Reallocation: "Reallocation" };

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  STATE_RECOMPUTED: "Analysis refreshed",
  PHASE_CHANGED: "Phase changed",
  ASSIGNMENT_CREATED: "Assigned to project",
  ASSIGNMENT_ENDED: "Assignment ended",
  PROJECT_CREATED: "Project created",
  PROJECT_UPDATED: "Project updated",
  TECH_LEAD_CHOSEN: "Technical Lead chosen",
  PREBOARDING_ITEM_UPDATED: "Pre-boarding item updated",
  HANDOVER_CONFIRMED: "Hand-over confirmed",
  REQUIREMENT_CREATED: "Requirement added",
  REQUIREMENT_UPDATED: "Requirement edited",
  REQUIREMENT_RETIRED: "Requirement retired",
  REQUIREMENT_CHECKED_OFF: "Requirement ticked off by an existing skill",
  REQUIREMENT_CHECKOFF_UNDONE: "Skill check-off undone",
  REQUIREMENT_STATUS_SET: "Requirement status changed",
  SKILL_CLAIMED: "Skill claimed",
  SKILL_CONFIRMED: "Skill confirmed",
  SKILL_REJECTED: "Skill rejected",
  IMPROVEMENT_CREATED: "Improvement created",
  IMPROVEMENT_UPDATED: "Improvement updated",
  READINESS_VALIDATION_RECORDED: "Technical validation recorded",
  ACCESS_USE_CONFIRMED: "Access confirmed working",
  FINDING_RESOLVED: "Finding resolved",
  FINDING_DISMISSED: "Finding dismissed",
  AI_FINDING_ACCEPTED: "AI suggestion accepted",
  DEPENDENCY_CONFIRMED: "Dependency confirmed",
  DEPENDENCY_REJECTED: "Dependency rejected",
  BRIEFING_GENERATED: "Briefing generated",
  SEED_COMPLETE: "Demo data loaded",
};

/** Turns an unknown enum into readable sentence case ("READY_WITH_SUPPORT" → "Ready with support"). */
export function humanize(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const s = value.replaceAll("_", " ").toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const MAPS = {
  role: ROLE_LABEL,
  phase: PHASE_LABEL,
  readiness: READINESS_LABEL,
  access: ACCESS_STATUS_LABEL,
  ktStage: KT_STAGE_LABEL,
  severity: SEVERITY_LABEL,
  findingCategory: FINDING_CATEGORY_LABEL,
  findingStatus: FINDING_STATUS_LABEL,
  reliability: RELIABILITY_LABEL,
  preboardingCategory: PREBOARDING_CATEGORY_LABEL,
  itemStatus: ITEM_STATUS_LABEL,
  requirementType: REQUIREMENT_TYPE_LABEL,
  requirementStatus: REQUIREMENT_STATUS_LABEL,
  skillCategory: SKILL_CATEGORY_LABEL,
  skillLevel: SKILL_LEVEL_LABEL,
  skillSource: SKILL_SOURCE_LABEL,
  skillStatus: SKILL_STATUS_LABEL,
  assignment: ASSIGNMENT_STATUS_LABEL,
  health: HEALTH_LABEL,
  improvement: IMPROVEMENT_STATUS_LABEL,
  improvementSource: IMPROVEMENT_SOURCE_LABEL,
  communication: COMMUNICATION_STATUS_LABEL,
  validation: VALIDATION_STATE_LABEL,
  sourceType: SOURCE_TYPE_LABEL,
  movement: MOVEMENT_LABEL,
  audit: AUDIT_ACTION_LABEL,
  stageBasis: STAGE_BASIS_LABEL,
} as const;
export type LabelKind = keyof typeof MAPS;

export function label(kind: LabelKind, value: string | null | undefined): string {
  if (!value) return "Unknown";
  return (MAPS[kind] as Record<string, string>)[value] ?? humanize(value);
}

export function roleLabel(role: string | null | undefined): string {
  return role ? ROLE_LABEL[role] ?? humanize(role) : "Unknown role";
}

/** "Sara Neri" → "SN". Unknown names get a neutral placeholder. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
