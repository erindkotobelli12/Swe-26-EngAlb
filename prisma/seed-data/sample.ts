/**
 * SAMPLE data for the demo. Nothing in this file comes from the starter pack.
 *
 * The starter pack names no Additional Manager, HR person or Technical Lead (Orion's Technical Lead exists only as a
 * role), and records no skills or previous projects. To demonstrate the organisation model these people, two sample
 * projects (Lumen, Cirrus), skills and project histories are created here. Every record is marked isSimulated and the
 * UI shows a "Sample data" tag on it. Sample records never change starter-pack facts: sample Technical Leads are not
 * copied onto official cases, so the official readiness gates and findings stay exactly as derived from the pack.
 */

export const SAMPLE_NOTE = "Sample person created for the demo — not in the starter pack.";

export const SAMPLE_PROJECTS = [
  { id: "LUMEN", name: "Lumen", code: "LUM-210", description: "Sample project. Shows a Line Manager who is also the Technical Lead.", startDate: "2025-02-03", status: "ACTIVE", isSimulated: true },
  { id: "CIRRUS", name: "Cirrus", code: "CIR-118", description: "Sample, completed project used for employees' previous-project histories.", startDate: "2024-06-03", status: "CLOSED", isSimulated: true },
] as const;

export const SAMPLE_PEOPLE = [
  { id: "P-S-PMO", name: "Petra Lind", role: "PMO", projectId: null },
  { id: "P-S-HR", name: "Hana Ilic", role: "HR", projectId: null },
  { id: "P-S-AM-MARCO", name: "Marco Ruiz", role: "ADDITIONAL_MANAGER", projectId: null },
  { id: "P-S-AM-ELENA", name: "Elena Sato", role: "ADDITIONAL_MANAGER", projectId: null },
  { id: "P-S-TL-BEN", name: "Ben Okafor", role: "TECH_LEAD", projectId: null },
  { id: "P-S-IVA", name: "Iva Duka", role: "LINE_MANAGER", projectId: "LUMEN" },
  // Available for a new assignment: one with a previous project (reallocation), one without (new hire).
  { id: "P-S-RINA", name: "Rina Kola", role: "EMPLOYEE", projectId: null },
  { id: "P-S-DREN", name: "Dren Leka", role: "EMPLOYEE", projectId: null },
] as const;

/** Additional Manager per project (sample). */
export const SAMPLE_AM_BY_PROJECT: Record<string, string> = {
  AURORA: "P-S-AM-MARCO", NIMBUS: "P-S-AM-MARCO", ORION: "P-S-AM-MARCO", VEGA: "P-S-AM-MARCO", LUMEN: "P-S-AM-MARCO",
  HELIOS: "P-S-AM-ELENA", ATLAS: "P-S-AM-ELENA", NOVA: "P-S-AM-ELENA", PULSE: "P-S-AM-ELENA", CIRRUS: "P-S-AM-ELENA",
};

/** Sample Technical Leads on official projects (Orion keeps its role-only Technical Lead from EMAIL-003). */
export const SAMPLE_TL_BY_PROJECT: Record<string, string> = { NIMBUS: "P-S-TL-BEN", AURORA: "P-S-TL-BEN" };

/** Previous (COMPLETED) project assignments for reallocated employees and the bench person. Dates are sample data. */
export const SAMPLE_PAST_ASSIGNMENTS = [
  { person: "employee:ONB-002", projectId: "LUMEN", startDate: "2025-04-01", endDate: "2026-09-30", reportsTo: "P-S-IVA" },
  { person: "employee:ONB-007", projectId: "LUMEN", startDate: "2025-02-03", endDate: "2026-09-12", reportsTo: "P-S-IVA" },
  { person: "employee:ONB-004", projectId: "CIRRUS", startDate: "2024-10-01", endDate: "2026-09-26", reportsTo: "P-S-IVA" },
  { person: "employee:ONB-009", projectId: "CIRRUS", startDate: "2025-01-13", endDate: "2026-10-03", reportsTo: "P-S-IVA" },
  { person: "P-S-RINA", projectId: "CIRRUS", startDate: "2024-06-03", endDate: "2026-09-30", reportsTo: "P-S-IVA" },
] as const;

export const SKILLS = [
  { id: "SK-INCIDENT", name: "Incident triage", category: "TECHNICAL", description: "Classify, prioritise and route incidents." },
  { id: "SK-ITIL-CHANGE", name: "ITIL change management", category: "PROCESS", description: "Raise and follow standard and normal changes." },
  { id: "SK-SQL", name: "SQL reporting", category: "TECHNICAL", description: "Write and maintain operational SQL reports." },
  { id: "SK-JIRA-SM", name: "Jira Service Management", category: "APPLICATION", description: "Work queues, SLAs and request types." },
  { id: "SK-K8S", name: "Kubernetes basics", category: "TECHNICAL", description: "Read deployments, pods and logs." },
  { id: "SK-PAYMENTS", name: "Payments domain", category: "DOMAIN", description: "Card and transfer payment flows." },
  { id: "SK-RUNBOOK", name: "Runbook operations", category: "PROCESS", description: "Follow and update operational runbooks." },
  { id: "SK-PYTHON", name: "Python scripting", category: "TECHNICAL", description: "Automate routine tasks with Python." },
  { id: "SK-STAKEHOLDER", name: "Stakeholder communication", category: "PROCESS", description: "Status updates and expectation management." },
] as const;

/**
 * Sample skills. CONFIRMED skills come from the previous (sample) project and were confirmed by its Technical Lead.
 * None of Leo's skills concern Helix Service Desk, so his access-blocker story is unchanged.
 */
export const SAMPLE_SKILLS = [
  { person: "employee:ONB-002", skillId: "SK-INCIDENT", level: "ADVANCED", source: "PREVIOUS_PROJECT", status: "CONFIRMED", projectId: "LUMEN" },
  { person: "employee:ONB-002", skillId: "SK-ITIL-CHANGE", level: "INTERMEDIATE", source: "PREVIOUS_PROJECT", status: "CONFIRMED", projectId: "LUMEN" },
  { person: "employee:ONB-002", skillId: "SK-SQL", level: "INTERMEDIATE", source: "SELF_DECLARED", status: "CLAIMED", projectId: null },
  { person: "employee:ONB-007", skillId: "SK-RUNBOOK", level: "INTERMEDIATE", source: "PREVIOUS_PROJECT", status: "CONFIRMED", projectId: "LUMEN" },
  { person: "employee:ONB-007", skillId: "SK-JIRA-SM", level: "BASIC", source: "PREVIOUS_PROJECT", status: "CONFIRMED", projectId: "LUMEN" },
  { person: "employee:ONB-004", skillId: "SK-K8S", level: "INTERMEDIATE", source: "PREVIOUS_PROJECT", status: "CONFIRMED", projectId: "CIRRUS" },
  { person: "employee:ONB-004", skillId: "SK-PYTHON", level: "ADVANCED", source: "PREVIOUS_PROJECT", status: "CONFIRMED", projectId: "CIRRUS" },
  { person: "employee:ONB-009", skillId: "SK-PAYMENTS", level: "INTERMEDIATE", source: "PREVIOUS_PROJECT", status: "CONFIRMED", projectId: "CIRRUS" },
  { person: "employee:ONB-009", skillId: "SK-STAKEHOLDER", level: "BASIC", source: "SELF_DECLARED", status: "CLAIMED", projectId: null },
  { person: "P-S-RINA", skillId: "SK-INCIDENT", level: "INTERMEDIATE", source: "PREVIOUS_PROJECT", status: "CONFIRMED", projectId: "CIRRUS" },
  { person: "P-S-RINA", skillId: "SK-JIRA-SM", level: "ADVANCED", source: "PREVIOUS_PROJECT", status: "CONFIRMED", projectId: "CIRRUS" },
  { person: "P-S-RINA", skillId: "SK-SQL", level: "BASIC", source: "SELF_DECLARED", status: "CLAIMED", projectId: null },
] as const;

/** Demo accounts. Starter-pack names are used only for people the starter pack names (Sara Neri, Jon Vale, Leo, Mila). */
export const DEMO_USERS = [
  { id: "demo-pmo", name: "Petra Lind", email: "pmo@onboardiq.demo", role: "PMO", personId: "P-S-PMO" },
  { id: "demo-am", name: "Marco Ruiz", email: "am@onboardiq.demo", role: "ADDITIONAL_MANAGER", personId: "P-S-AM-MARCO" },
  { id: "demo-lm-sara", name: "Sara Neri", email: "sara@onboardiq.demo", role: "LINE_MANAGER", personId: "P-LM-SARA-NERI" },
  { id: "demo-lm-jon", name: "Jon Vale", email: "jon@onboardiq.demo", role: "LINE_MANAGER", personId: "P-LM-JON-VALE" },
  { id: "demo-lm-tl", name: "Iva Duka", email: "iva@onboardiq.demo", role: "LINE_MANAGER", personId: "P-S-IVA" },
  { id: "demo-tl", name: "Ben Okafor", email: "tl@onboardiq.demo", role: "TECH_LEAD", personId: "P-S-TL-BEN" },
  { id: "demo-hr", name: "Hana Ilic", email: "hr@onboardiq.demo", role: "HR", personId: "P-S-HR" },
  { id: "employee-leo", name: "Leo Marin", email: "leo@onboardiq.demo", role: "EMPLOYEE", employeeId: "ONB-002", personId: "employee:ONB-002" },
  { id: "employee-mila", name: "Mila Rowan", email: "mila@onboardiq.demo", role: "EMPLOYEE", employeeId: "ONB-001", personId: "employee:ONB-001" },
] as const;

/** Person id for an official employee. */
export const employeePersonId = (caseId: string) => `P-EMP-${caseId}`;
export const resolvePerson = (ref: string) => (ref.startsWith("employee:") ? employeePersonId(ref.slice("employee:".length)) : ref);
