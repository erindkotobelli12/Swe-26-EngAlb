/**
 * Official starter-pack data (Engineering Albania — Employee Onboarding & Knowledge Transfer).
 * Evidence bodies are VERBATIM. Only names that appear in the starter pack are used; any other stakeholder
 * is a role-only record (name = null). Evaluation date: 14 Oct 2026.
 */

export const PROJECTS = ["Aurora", "Nimbus", "Helios", "Orion", "Atlas", "Nova", "Pulse", "Vega"].map((name) => ({ id: name.toUpperCase(), name }));

/** Starter pack §4 tracker rows, exactly as published (dates in tracker format and ISO). */
export const CASES = [
  { id: "ONB-001", name: "Mila Rowan", start: "05-Oct-26", startIso: "2026-10-05", movement: "New Hire", project: "Aurora", manager: "Jon Vale", status: "Shadowing", last: "13-Oct", lastIso: "2026-10-13" },
  { id: "ONB-002", name: "Leo Marin", start: "07-Oct-26", startIso: "2026-10-07", movement: "Reallocation", project: "Nimbus", manager: "Sara Neri", status: "Access Pending", last: "14-Oct", lastIso: "2026-10-14" },
  { id: "ONB-003", name: "Nora Venn", start: "28-Sep-26", startIso: "2026-09-28", movement: "New Hire", project: null, manager: "Tomas Reed", status: "On Track", last: "30-Sep", lastIso: "2026-09-30" },
  { id: "ONB-004", name: "Aron Bell", start: "01-Oct-26", startIso: "2026-10-01", movement: "Reallocation", project: "Helios", manager: null, status: "KT Started", last: "11-Oct", lastIso: "2026-10-11" },
  { id: "ONB-005", name: "Eva Stone", start: "21-Sep-26", startIso: "2026-09-21", movement: "New Hire", project: "Orion", manager: "Luca Gray", status: "Ready with Support", last: "13-Oct", lastIso: "2026-10-13" },
  { id: "ONB-006", name: "Noah Lane", start: "12-Oct-26", startIso: "2026-10-12", movement: "New Hire", project: "Atlas", manager: "Maya Ford", status: "Pre-Onboarding", last: "12-Oct", lastIso: "2026-10-12" },
  { id: "ONB-007", name: "Iris Moon", start: "15-Sep-26", startIso: "2026-09-15", movement: "Reallocation", project: "Nova", manager: "Rita Cole", status: "On Track", last: "20-Sep", lastIso: "2026-09-20" },
  { id: "ONB-008", name: "Theo Park", start: "03-Oct-26", startIso: "2026-10-03", movement: "New Hire", project: "Pulse", manager: "Mark Hale", status: "Blocked", last: "14-Oct", lastIso: "2026-10-14" },
  { id: "ONB-009", name: "Lina West", start: "06-Oct-26", startIso: "2026-10-06", movement: "Reallocation", project: null, manager: "Nina Cross", status: "KT Started", last: "09-Oct", lastIso: "2026-10-09" },
  { id: "ONB-010", name: "Owen Hart", start: "29-Sep-26", startIso: "2026-09-29", movement: "New Hire", project: "Vega", manager: "Alex North", status: "Partially Ready", last: "14-Oct", lastIso: "2026-10-14" },
] as const;

export const slug = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
export const lineManagerId = (name: string) => `P-LM-${slug(name)}`;

/** Role-only stakeholders that appear in the evidence without a name. */
export const ROLE_ONLY_PEOPLE = [
  { id: "P-PM-NIMBUS", role: "PROJECT_MANAGER", projectId: "NIMBUS", note: "Sender of EMAIL-001 (project code NIM-482); name not recorded." },
  { id: "P-ACCESS-SUPPORT", role: "ACCESS_SUPPORT", projectId: null, note: "Sender of EMAIL-002; name not recorded." },
  { id: "P-APP-OWNER-ORION-PORTAL", role: "APP_OWNER", projectId: null, note: "Application owner of Orion Portal (approval pending per EMAIL-002); name not recorded." },
  { id: "P-TL-ORION", role: "TECH_LEAD", projectId: "ORION", note: "Sender of EMAIL-003 (Eva Stone's weekly KT update); name not recorded." },
  { id: "P-PMO", role: "PMO", projectId: null, note: "Sender of EMAIL-005; name not recorded." },
  { id: "P-TECH-MANAGER", role: "TECH_MANAGER", projectId: null, note: "Recipient of EMAIL-005 about Lina West; name and project not recorded." },
  { id: "P-KT-OWNER-ATLAS", role: "KT_OWNER", projectId: "ATLAS", note: "Sender of EMAIL-008 (Project Atlas documentation); name not recorded." },
] as const;

export const trackerContent = (c: (typeof CASES)[number]) => [
  `Case: ${c.id}`,
  `Employee: ${c.name}`,
  `Start: ${c.start}`,
  `Movement: ${c.movement}`,
  `Project: ${c.project ?? "—"}`,
  `Manager: ${c.manager ?? "—"}`,
  `Status: ${c.status}`,
  `Last update: ${c.last}`,
].join("\n");

type Recipient = { name: string | null; role: string };
export type EvidenceSeed = {
  id: string; title: string; sourceType: string; author: string | null; senderRole: string; senderPersonId: string | null;
  recipients: Recipient[]; timestamp: string; content: string; employeeId: string | null; projectId: string | null;
  isRequest?: boolean; inReplyToId?: string;
};

/** Appendix A — verbatim. */
export const EVIDENCE: EvidenceSeed[] = [
  {
    id: "EMAIL-001", title: "Access request: Leo Marin", sourceType: "EMAIL", author: null, senderRole: "PROJECT_MANAGER", senderPersonId: "P-PM-NIMBUS",
    recipients: [{ name: null, role: "ACCESS_SUPPORT" }], timestamp: "2026-10-07", employeeId: "ONB-002", projectId: "NIMBUS", isRequest: true,
    content: "Please create Leo's Nova VPN, Orion Portal and Helix Service Desk accounts before his project start. Project code: NIM-482.",
  },
  {
    id: "EMAIL-002", title: "Delayed account: Leo Marin", sourceType: "EMAIL", author: null, senderRole: "ACCESS_SUPPORT", senderPersonId: "P-ACCESS-SUPPORT",
    recipients: [{ name: null, role: "PROJECT_MANAGER" }], timestamp: "2026-10-14", employeeId: "ONB-002", projectId: "NIMBUS", inReplyToId: "EMAIL-001",
    content: "Nova VPN is active. Orion Portal is still awaiting application-owner approval. Helix Service Desk has not yet been provisioned.",
  },
  {
    id: "EMAIL-003", title: "Weekly KT update: Eva Stone", sourceType: "EMAIL", author: null, senderRole: "TECH_LEAD", senderPersonId: "P-TL-ORION",
    recipients: [], timestamp: "2026-10-13", employeeId: "ONB-005", projectId: "ORION",
    content: "Eva completed the first training topics and can handle standard requests with occasional support. Two complex scenarios still need to be covered. The Technical Lead classifies her as Ready with Support.",
  },
  {
    id: "EMAIL-004", title: "Conflicting progress update: Eva Stone", sourceType: "EMAIL", author: null, senderRole: "LINE_MANAGER", senderPersonId: null,
    recipients: [], timestamp: "2026-10-13", employeeId: "ONB-005", projectId: "ORION",
    content: "From the local side everything looks complete and Eva is working independently. The Line Manager considers onboarding closed.",
  },
  {
    id: "EMAIL-005", title: "Unanswered request: Lina West", sourceType: "EMAIL", author: null, senderRole: "PMO", senderPersonId: "P-PMO",
    recipients: [{ name: null, role: "TECH_MANAGER" }], timestamp: "2026-10-08", employeeId: "ONB-009", projectId: null, isRequest: true,
    content: "Request to confirm Lina's exact project role, assigned KT owner and expected readiness date. No response recorded as of 14 Oct 2026.",
  },
  {
    id: "UPDATE-006", title: "Employee check-in: Owen Hart", sourceType: "EMPLOYEE_UPDATE", author: "Owen Hart", senderRole: "EMPLOYEE", senderPersonId: null,
    recipients: [], timestamp: "2026-10-14", employeeId: "ONB-010", projectId: "VEGA",
    content: "I can complete the daily standard activities alone, but I still need help for exceptions and production changes. All tools are available. I have not yet received a date for the final readiness review.",
  },
  {
    id: "UPDATE-007", title: "Stale tracker note: Iris Moon", sourceType: "TRACKER_NOTE", author: null, senderRole: "TRACKER", senderPersonId: null,
    recipients: [], timestamp: "2026-09-20", employeeId: "ONB-007", projectId: "NOVA",
    content: "Shadowing started; access expected next week. No later tracker update exists.",
  },
  {
    id: "EMAIL-008", title: "Documentation location: Project Atlas", sourceType: "EMAIL", author: null, senderRole: "KT_OWNER", senderPersonId: "P-KT-OWNER-ATLAS",
    recipients: [], timestamp: "2026-10-11", employeeId: null, projectId: "ATLAS",
    content: "Training guide and runbook are available in /Team/Operations/Onboarding. The documents are project-owned and should not be copied outside that location. Keep only the folder reference in a central onboarding index.",
  },
];

/** Structured claims transcribed from the evidence (human-reviewed at seed time). Every excerpt is a verbatim substring. */
export const CLAIMS: { evidenceId: string; entity: string; field: string; value: string; excerpt: string; effectiveDate: string }[] = [
  { evidenceId: "EMAIL-001", entity: "ONB-002", field: "access.Nova VPN.status", value: "REQUESTED", excerpt: "Please create Leo's Nova VPN, Orion Portal and Helix Service Desk accounts before his project start.", effectiveDate: "2026-10-07" },
  { evidenceId: "EMAIL-001", entity: "ONB-002", field: "access.Orion Portal.status", value: "REQUESTED", excerpt: "Please create Leo's Nova VPN, Orion Portal and Helix Service Desk accounts before his project start.", effectiveDate: "2026-10-07" },
  { evidenceId: "EMAIL-001", entity: "ONB-002", field: "access.Helix Service Desk.status", value: "REQUESTED", excerpt: "Please create Leo's Nova VPN, Orion Portal and Helix Service Desk accounts before his project start.", effectiveDate: "2026-10-07" },
  { evidenceId: "EMAIL-002", entity: "ONB-002", field: "access.Nova VPN.status", value: "PROVISIONED", excerpt: "Nova VPN is active.", effectiveDate: "2026-10-14" },
  { evidenceId: "EMAIL-002", entity: "ONB-002", field: "access.Orion Portal.status", value: "APPROVAL_PENDING", excerpt: "Orion Portal is still awaiting application-owner approval.", effectiveDate: "2026-10-14" },
  { evidenceId: "EMAIL-002", entity: "ONB-002", field: "access.Helix Service Desk.status", value: "REQUESTED", excerpt: "Helix Service Desk has not yet been provisioned.", effectiveDate: "2026-10-14" },
  { evidenceId: "EMAIL-003", entity: "ONB-005", field: "kt.Standard requests.stage", value: "INDEPENDENT_EXECUTION", excerpt: "can handle standard requests with occasional support", effectiveDate: "2026-10-13" },
  { evidenceId: "EMAIL-003", entity: "ONB-005", field: "kt.Complex scenarios.stage", value: "NOT_STARTED", excerpt: "Two complex scenarios still need to be covered.", effectiveDate: "2026-10-13" },
  { evidenceId: "EMAIL-003", entity: "ONB-005", field: "readiness.reported", value: "READY_WITH_SUPPORT", excerpt: "The Technical Lead classifies her as Ready with Support.", effectiveDate: "2026-10-13" },
  { evidenceId: "EMAIL-004", entity: "ONB-005", field: "readiness.reported", value: "INDEPENDENTLY_READY", excerpt: "Eva is working independently", effectiveDate: "2026-10-13" },
  { evidenceId: "EMAIL-004", entity: "ONB-005", field: "onboarding.complete", value: "true", excerpt: "From the local side everything looks complete", effectiveDate: "2026-10-13" },
  { evidenceId: "EMAIL-004", entity: "ONB-005", field: "onboarding.closed", value: "true", excerpt: "The Line Manager considers onboarding closed.", effectiveDate: "2026-10-13" },
  { evidenceId: "UPDATE-006", entity: "ONB-010", field: "kt.Daily standard activities.stage", value: "INDEPENDENT_EXECUTION", excerpt: "I can complete the daily standard activities alone", effectiveDate: "2026-10-14" },
  { evidenceId: "UPDATE-006", entity: "ONB-010", field: "kt.Production changes.stage", value: "SUPPORTED_EXECUTION", excerpt: "I still need help for exceptions and production changes", effectiveDate: "2026-10-14" },
  { evidenceId: "UPDATE-006", entity: "ONB-010", field: "kt.Exception handling.stage", value: "SUPPORTED_EXECUTION", excerpt: "I still need help for exceptions and production changes", effectiveDate: "2026-10-14" },
  { evidenceId: "UPDATE-006", entity: "ONB-010", field: "access.All tools.available", value: "true", excerpt: "All tools are available.", effectiveDate: "2026-10-14" },
  { evidenceId: "UPDATE-006", entity: "ONB-010", field: "case.readinessReviewAt", value: "NOT_SET", excerpt: "I have not yet received a date for the final readiness review.", effectiveDate: "2026-10-14" },
  { evidenceId: "UPDATE-007", entity: "ONB-007", field: "kt.Project shadowing.stage", value: "SHADOWING", excerpt: "Shadowing started", effectiveDate: "2026-09-20" },
  { evidenceId: "UPDATE-007", entity: "ONB-007", field: "access.Project access (system not named).status", value: "REQUESTED", excerpt: "access expected next week", effectiveDate: "2026-09-20" },
  { evidenceId: "EMAIL-008", entity: "ATLAS", field: "docs.location", value: "/Team/Operations/Onboarding", excerpt: "Training guide and runbook are available in /Team/Operations/Onboarding.", effectiveDate: "2026-10-11" },
  { evidenceId: "EMAIL-008", entity: "ATLAS", field: "docs.copyAllowed", value: "false", excerpt: "The documents are project-owned and should not be copied outside that location.", effectiveDate: "2026-10-11" },
];

/** Access requests derived from the evidence above. Credentials are never stored. */
export const ACCESS = [
  { id: "ACC-LEO-NOVA", employeeId: "ONB-002", application: "Nova VPN", requiredScope: "VPN connectivity for project work", status: "PROVISIONED", requestDate: "2026-10-07", owner: "Leo Marin (confirm successful use)", handlerRole: "ACCESS_SUPPORT", approverRole: null, blockerReason: "Active; successful use not yet confirmed by the employee", evidenceId: "EMAIL-002", requestEvidenceId: "EMAIL-001", lastUpdate: "2026-10-14" },
  { id: "ACC-LEO-ORION", employeeId: "ONB-002", application: "Orion Portal", requiredScope: "Application portal access", status: "APPROVAL_PENDING", requestDate: "2026-10-07", owner: "Application owner (approval)", ownerPersonId: "P-APP-OWNER-ORION-PORTAL", handlerRole: "ACCESS_SUPPORT", approverRole: "APP_OWNER", blockerReason: "Awaiting application-owner approval", evidenceId: "EMAIL-002", requestEvidenceId: "EMAIL-001", lastUpdate: "2026-10-14" },
  { id: "ACC-LEO-HELIX", employeeId: "ONB-002", application: "Helix Service Desk", requiredScope: "Service desk operations", status: "REQUESTED", requestDate: "2026-10-07", owner: null, handlerRole: "ACCESS_SUPPORT", approverRole: null, blockerReason: "Not yet provisioned; provisioning owner not recorded", evidenceId: "EMAIL-002", requestEvidenceId: "EMAIL-001", lastUpdate: "2026-10-14" },
  { id: "ACC-IRIS-PROJECT", employeeId: "ONB-007", application: "Project access (system not named)", requiredScope: "Access for Nova project work (systems not named in the source)", status: "REQUESTED", requestDate: null, owner: null, handlerRole: null, approverRole: null, blockerReason: "Expected 'next week' per the 20 Sep note; never confirmed", evidenceId: "UPDATE-007", requestEvidenceId: null, lastUpdate: "2026-09-20" },
] as const;

export const KT = [
  { id: "KT-EVA-STANDARD", employeeId: "ONB-005", title: "Standard requests", description: "Handle standard requests", scope: "Standard request scenarios", scopeType: "CORE", owner: "Technical Lead — Orion (name not recorded)", ownerPersonId: "P-TL-ORION", stage: "INDEPENDENT_EXECUTION", stageBasis: "OBSERVED", evidenceId: "EMAIL-003" },
  { id: "KT-EVA-COMPLEX", employeeId: "ONB-005", title: "Complex scenarios", description: "Two complex scenarios still to be covered", scope: "Two complex scenarios", scopeType: "COMPLEX", owner: "Technical Lead — Orion (name not recorded)", ownerPersonId: "P-TL-ORION", stage: "NOT_STARTED", stageBasis: "OBSERVED", evidenceId: "EMAIL-003" },
  { id: "KT-OWEN-DAILY", employeeId: "ONB-010", title: "Daily standard activities", description: "Daily standard activities", scope: "Daily standard activities", scopeType: "CORE", owner: null, ownerPersonId: null, stage: "INDEPENDENT_EXECUTION", stageBasis: "SELF_REPORTED", evidenceId: "UPDATE-006" },
  { id: "KT-OWEN-CHANGES", employeeId: "ONB-010", title: "Production changes", description: "Production changes", scope: "Production changes", scopeType: "CORE", owner: null, ownerPersonId: null, stage: "SUPPORTED_EXECUTION", stageBasis: "SELF_REPORTED", evidenceId: "UPDATE-006" },
  { id: "KT-OWEN-EXCEPTIONS", employeeId: "ONB-010", title: "Exception handling", description: "Exceptions", scope: "Exceptions", scopeType: "COMPLEX", owner: null, ownerPersonId: null, stage: "SUPPORTED_EXECUTION", stageBasis: "SELF_REPORTED", evidenceId: "UPDATE-006" },
  { id: "KT-IRIS-SHADOW", employeeId: "ONB-007", title: "Project shadowing", description: "Shadowing on Nova", scope: "Shadowing", scopeType: "CORE", owner: null, ownerPersonId: null, stage: "SHADOWING", stageBasis: "REPORTED", evidenceId: "UPDATE-007" },
] as const;
