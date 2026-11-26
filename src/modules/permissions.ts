import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * The single permission module. Permissions depend on ROLE + RELATIONSHIP + PHASE:
 *  - organisation roles (PMO, HR) live on the account,
 *  - project roles (Additional Manager, Line Manager, Technical Lead, Employee) come from ACTIVE ProjectAssignment rows,
 *  - the relationship to a case (my report, my project, myself) and the case's phase decide what may be done.
 *
 * `resolveScope` loads the relationships once; `can` is a pure function over that scope, so every server action,
 * route handler and page asks the same question the same way. AI agents are never actors: no AI module imports the
 * actions that change readiness, phase, skills, requirements, assignments, improvements or communications.
 */

export const PERSONAS = ["PMO", "HR", "ADDITIONAL_MANAGER", "LINE_MANAGER", "TECH_LEAD", "EMPLOYEE"] as const;
export type Persona = (typeof PERSONAS)[number];
/** Kept as an alias: `Principal.role` is the account's primary persona. */
export type Role = Persona;
export const PROJECT_ROLES = ["ADDITIONAL_MANAGER", "LINE_MANAGER", "TECH_LEAD", "EMPLOYEE"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];
export type Phase = "PRE_BOARDING" | "ONBOARDING" | "READY" | "CLOSED";

export type Principal = { userId: string; role: Persona; employeeId: string | null; name: string; personId?: string | null };

/** How the principal relates to a case or a person. */
export type Relation = "PMO" | "HR" | "AM" | "LM" | "TL" | "SELF";
export type CaseScope = { employeeId: string; personId: string | null; projectId: string | null; phase: Phase; relations: Relation[] };
export type Scope = {
  principal: Principal;
  personId: string | null;
  isPMO: boolean;
  isHR: boolean;
  /** projectId → project roles the principal holds there (ACTIVE assignments only). */
  projectRoles: Record<string, ProjectRole[]>;
  /** Visible cases by employee id, with the principal's relations to each. */
  cases: Record<string, CaseScope>;
  /** personId → relations, for profile visibility and skill confirmation. */
  people: Record<string, Relation[]>;
};

export type PermissionContext = {
  employeeId?: string | null;
  employeeIds?: string[];
  projectId?: string | null;
  personId?: string | null;
  findingCategory?: string | null;
  ownerPersonId?: string | null;
};

/** Finding categories that need a technical owner; the Line Manager may decide the others for their own employees. */
export const TECHNICAL_FINDING_CATEGORIES = new Set(["CONFLICT", "READINESS_CLAIM", "EVIDENCE_GAP"]);

const rel = (s: Scope, employeeId: string | null | undefined): Relation[] => (employeeId ? s.cases[employeeId]?.relations ?? [] : []);
const has = (s: Scope, employeeId: string | null | undefined, r: Relation) => rel(s, employeeId).includes(r);
const holds = (s: Scope, role: ProjectRole, projectId?: string | null) =>
  projectId ? (s.projectRoles[projectId] ?? []).includes(role) : Object.values(s.projectRoles).some((rs) => rs.includes(role));

/** The owner of the case's current phase: HR in pre-boarding, the project's Technical Lead afterwards. */
export function isPhaseOwner(s: Scope, employeeId: string | null | undefined): boolean {
  const c = employeeId ? s.cases[employeeId] : undefined;
  if (!c) return false;
  return c.phase === "PRE_BOARDING" ? c.relations.includes("HR") : c.relations.includes("TL");
}

const decider = (s: Scope, employeeId: string | null | undefined) => isPhaseOwner(s, employeeId) || has(s, employeeId, "LM");
const allOf = (ids: string[] | undefined, fn: (id: string) => boolean) => Boolean(ids?.length) && ids!.every(fn);
const notEmployee = (s: Scope) => s.principal.role !== "EMPLOYEE";

type Rule = { label: string; check: (s: Scope, c: PermissionContext) => boolean };

export const PERMISSIONS = {
  "case.view": { label: "view this case", check: (s, c) => (c.employeeId ? rel(s, c.employeeId).length > 0 : true) },
  "case.recompute": { label: "refresh the analysis", check: (s, c) => (c.employeeId ? s.isPMO || has(s, c.employeeId, "TL") : s.isPMO || holds(s, "TECH_LEAD")) },
  "evidence.add": { label: "add evidence", check: (s, c) => (c.employeeId ? rel(s, c.employeeId).some((r) => r !== "PMO") : notEmployee(s) && !s.isPMO) },
  "evidence.review": {
    label: "review evidence and claims",
    check: (s, c) => (c.employeeId ? isPhaseOwner(s, c.employeeId) : c.projectId ? holds(s, "TECH_LEAD", c.projectId) : holds(s, "TECH_LEAD") || s.isHR),
  },
  "claim.reviewTechnical": { label: "approve knowledge-transfer or technical claims", check: (s, c) => (c.employeeId ? has(s, c.employeeId, "TL") : c.projectId ? holds(s, "TECH_LEAD", c.projectId) : holds(s, "TECH_LEAD")) },
  "access.confirmUsable": { label: "confirm access works", check: (s, c) => Boolean(c.employeeId) && has(s, c.employeeId, "SELF") },
  "finding.decide": {
    label: "decide findings",
    check: (s, c) => isPhaseOwner(s, c.employeeId) || (has(s, c.employeeId, "LM") && c.findingCategory !== undefined && !TECHNICAL_FINDING_CATEGORIES.has(c.findingCategory ?? "")),
  },
  "dependency.decide": { label: "confirm or reject dependencies", check: (s, c) => isPhaseOwner(s, c.employeeId) },
  "validation.record": {
    label: "record technical validation",
    check: (s, c) => (c.employeeId ? has(s, c.employeeId, "TL") && s.cases[c.employeeId]?.phase !== "PRE_BOARDING" : holds(s, "TECH_LEAD")),
  },
  "communication.approve": {
    label: "edit, approve and send follow-ups",
    check: (s, c) => (c.employeeIds ? allOf(c.employeeIds, (id) => decider(s, id)) : c.employeeId ? decider(s, c.employeeId) : holds(s, "TECH_LEAD") || holds(s, "LINE_MANAGER") || s.isHR),
  },
  "communication.recordResponse": {
    label: "record a follow-up response",
    check: (s, c) => (c.employeeIds ? allOf(c.employeeIds, (id) => decider(s, id)) : c.employeeId ? decider(s, c.employeeId) : holds(s, "TECH_LEAD") || holds(s, "LINE_MANAGER") || s.isHR),
  },
  "roadmap.decideTechnical": { label: "approve technical roadmap items", check: (s, c) => has(s, c.employeeId, "TL") },
  "roadmap.decideLogistics": { label: "approve logistics roadmap items", check: (s, c) => decider(s, c.employeeId) },
  "roadmap.baseline": { label: "approve the plan baseline", check: (s, c) => has(s, c.employeeId, "TL") || has(s, c.employeeId, "LM") },
  "ai.run": { label: "run AI agents", check: (s, c) => (c.employeeId ? decider(s, c.employeeId) : notEmployee(s)) },
  "simulator.run": { label: "run what-if simulations", check: (s, c) => rel(s, c.employeeId).length > 0 },
  "briefing.generate": { label: "generate a briefing", check: (s) => notEmployee(s) },
  "insights.view": { label: "view organisational insights", check: (s) => s.isPMO || holds(s, "ADDITIONAL_MANAGER") },
  "audit.view": { label: "view the audit and AI log", check: (s, c) => (c.employeeId ? rel(s, c.employeeId).length > 0 : s.isPMO || holds(s, "TECH_LEAD")) },
  "project.manage": { label: "create or edit projects and assign people", check: (s) => s.isPMO },
  "project.view": { label: "view this project", check: (s, c) => (c.projectId ? s.isPMO || s.isHR || (s.projectRoles[c.projectId] ?? []).some((r) => r !== "EMPLOYEE") : notEmployee(s)) },
  "project.chooseTechLead": { label: "choose the Technical Lead", check: (s, c) => holds(s, "ADDITIONAL_MANAGER", c.projectId) },
  "preboarding.update": { label: "update pre-boarding items", check: (s, c) => s.cases[c.employeeId ?? ""]?.phase === "PRE_BOARDING" && (has(s, c.employeeId, "HR") || has(s, c.employeeId, "LM")) },
  "handover.confirm": { label: "confirm the hand-over to onboarding", check: (s, c) => s.cases[c.employeeId ?? ""]?.phase === "PRE_BOARDING" && has(s, c.employeeId, "LM") },
  "requirement.manage": { label: "define onboarding requirements", check: (s, c) => holds(s, "TECH_LEAD", c.projectId) },
  "requirement.decide": { label: "change requirement status or undo a check-off", check: (s, c) => holds(s, "TECH_LEAD", c.projectId) },
  "skill.confirm": { label: "confirm or reject skills", check: (s, c) => Boolean(c.personId) && (s.people[c.personId!] ?? []).includes("TL") },
  "skill.claim": { label: "add a skill to your own profile", check: (s, c) => Boolean(s.personId) && c.personId === s.personId },
  "profile.view": { label: "view this profile", check: (s, c) => Boolean(c.personId) && (s.isPMO || c.personId === s.personId || (s.people[c.personId!] ?? []).length > 0) },
  "improvement.create": { label: "create improvements", check: (s) => s.isPMO },
  "improvement.approve": { label: "approve improvements", check: (s) => s.isPMO },
  "improvement.update": { label: "update this improvement", check: (s, c) => s.isPMO || (Boolean(s.personId) && c.ownerPersonId === s.personId) },
} as const satisfies Record<string, Rule>;

export type Permission = keyof typeof PERMISSIONS;

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export function can(scope: Scope, permission: Permission, ctx: PermissionContext = {}): boolean {
  return (PERMISSIONS[permission] as Rule).check(scope, ctx);
}

export function assertCan(scope: Scope, permission: Permission, ctx: PermissionContext = {}): void {
  if (!can(scope, permission, ctx)) throw new PermissionError(`You don't have permission to ${PERMISSIONS[permission].label}.`);
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Resolves scope and asserts in one step. Returns the scope for further checks. */
export async function assertAllowed(principal: Principal, permission: Permission, ctx: PermissionContext = {}, db: Db = prisma): Promise<Scope> {
  const scope = await resolveScope(principal, db);
  assertCan(scope, permission, ctx);
  return scope;
}

/**
 * Loads the principal's relationships: which projects, cases and people they can see and in which role.
 * PMO sees every case (read-only for day-to-day decisions); HR sees every case in pre-boarding; an Additional Manager
 * sees cases on their projects; a Line Manager sees their reports; a Technical Lead sees onboarding-phase cases on
 * their projects; an employee sees only themselves.
 */
export async function resolveScope(principal: Principal, db: Db = prisma): Promise<Scope> {
  const user = principal.personId === undefined ? await db.user.findUnique({ where: { id: principal.userId }, select: { personId: true } }) : null;
  const personId = principal.personId ?? user?.personId ?? null;
  const isPMO = principal.role === "PMO";
  const isHR = principal.role === "HR";

  const [mine, cases, employeeAssignments] = await Promise.all([
    personId ? db.projectAssignment.findMany({ where: { personId, status: "ACTIVE" }, select: { projectId: true, role: true } }) : Promise.resolve([]),
    db.onboardingCase.findMany({ select: { employeeId: true, phase: true, employee: { select: { projectId: true, lineManagerId: true, personId: true } } } }),
    db.projectAssignment.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, select: { personId: true, projectId: true, reportsToPersonId: true } }),
  ]);

  const projectRoles: Record<string, ProjectRole[]> = {};
  for (const a of mine) (projectRoles[a.projectId] ??= []).includes(a.role as ProjectRole) || projectRoles[a.projectId].push(a.role as ProjectRole);
  const roleOn = (projectId: string | null, r: ProjectRole) => Boolean(projectId && projectRoles[projectId]?.includes(r));

  const reportsToMe = new Set(employeeAssignments.filter((a) => personId && a.reportsToPersonId === personId).map((a) => a.personId));
  const out: Record<string, CaseScope> = {};
  for (const c of cases) {
    const e = c.employee;
    const phase = c.phase as Phase;
    const relations: Relation[] = [];
    if (isPMO) relations.push("PMO");
    if (isHR && phase === "PRE_BOARDING") relations.push("HR");
    if (roleOn(e.projectId, "ADDITIONAL_MANAGER")) relations.push("AM");
    if (personId && ((e.personId && reportsToMe.has(e.personId)) || e.lineManagerId === personId)) relations.push("LM");
    if (roleOn(e.projectId, "TECH_LEAD") && phase !== "PRE_BOARDING") relations.push("TL");
    if (principal.employeeId && principal.employeeId === c.employeeId) relations.push("SELF");
    if (relations.length) out[c.employeeId] = { employeeId: c.employeeId, personId: e.personId, projectId: e.projectId, phase, relations };
  }

  // People: everyone with an assignment on a project where I hold a managing role, plus people behind my visible cases.
  const people: Record<string, Relation[]> = {};
  const add = (pid: string | null | undefined, r: Relation) => { if (pid) (people[pid] ??= []).includes(r) || people[pid].push(r); };
  const managed = Object.entries(projectRoles).filter(([, rs]) => rs.some((r) => r !== "EMPLOYEE")).map(([p]) => p);
  if (managed.length) {
    const colleagues = await db.projectAssignment.findMany({ where: { projectId: { in: managed } }, select: { personId: true, projectId: true } });
    for (const a of colleagues) {
      const rs = projectRoles[a.projectId] ?? [];
      if (rs.includes("TECH_LEAD")) add(a.personId, "TL");
      if (rs.includes("ADDITIONAL_MANAGER")) add(a.personId, "AM");
      if (rs.includes("LINE_MANAGER")) add(a.personId, "LM");
    }
  }
  for (const c of Object.values(out)) for (const r of c.relations) if (r !== "SELF") add(c.personId, r);
  if (personId) add(personId, "SELF");

  return { principal, personId, isPMO, isHR, projectRoles, cases: out, people };
}

/** Roles the principal effectively holds (organisation role plus every active project role), for navigation. */
export function heldRoles(scope: Scope): Persona[] {
  const set = new Set<Persona>([scope.principal.role]);
  for (const rs of Object.values(scope.projectRoles)) for (const r of rs) set.add(r);
  if (scope.principal.employeeId) set.add("EMPLOYEE");
  return PERSONAS.filter((p) => set.has(p));
}

/** Employee ids visible to the principal. */
export const visibleEmployeeIds = (scope: Scope): string[] => Object.keys(scope.cases).sort();
