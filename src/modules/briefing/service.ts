import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditTimestamp, formatDate, getEvaluationDate } from "@/lib/clock";
import { parseJson, toJson } from "@/lib/json";
import { runAgent } from "@/ai/runAgent";
import * as prompt from "@/ai/prompts/briefing";
import { audit } from "@/modules/audit";
import { loadPortfolio } from "@/modules/case/portfolio";
import { loadFollowUpQueue } from "@/modules/followups/service";
import { assertAllowed, heldRoles, type Principal, type Scope } from "@/modules/permissions";
import { DecisionError } from "@/modules/detective/decisions";
import { selectBriefing, snapshotOf, type BriefingRole, type Section, type Snapshot, type Statement } from "./select";

export const BRIEFING_ROLES: BriefingRole[] = ["PMO", "ADDITIONAL_MANAGER", "LINE_MANAGER", "TECH_LEAD", "HR"];

/** Briefing variants a user may generate: one per role they hold (never another role's variant). */
export function briefingRolesFor(scope: Scope): BriefingRole[] {
  const held = heldRoles(scope);
  return BRIEFING_ROLES.filter((r) => held.includes(r));
}

/** Cases a briefing covers: the PMO's whole portfolio, otherwise only the cases in the author's scope (optionally one project). */
function inScope(scope: Scope, role: BriefingRole, projectId?: string | null) {
  return (c: { state: { employee: { id: string; projectId: string | null } } }) => {
    if (projectId && c.state.employee.projectId !== projectId) return false;
    if (role === "PMO") return scope.isPMO;
    const rel = scope.cases[c.state.employee.id]?.relations ?? [];
    if (role === "HR") return rel.includes("HR");
    if (role === "ADDITIONAL_MANAGER") return rel.includes("AM");
    if (role === "LINE_MANAGER") return rel.includes("LM");
    return rel.includes("TL");
  };
}

/** A statement is valid only if every ref exists in the deterministic selection for that section. */
export function validateStatements(statements: Statement[], allowedRefs: Set<string>): { valid: Statement[]; rejected: number } {
  const valid: Statement[] = [];
  let rejected = 0;
  for (const s of statements) {
    if (s.refs.length > 0 && s.refs.every((r) => allowedRefs.has(r))) valid.push({ text: s.text.trim(), refs: [...new Set(s.refs)] });
    else rejected++;
  }
  return { valid, rejected };
}

export async function generateBriefing(role: BriefingRole, principal: Principal, db: PrismaClient = prisma, opts: { projectId?: string | null } = {}): Promise<string> {
  const scope = await assertAllowed(principal, "briefing.generate", {}, db);
  if (!briefingRolesFor(scope).includes(role)) throw new DecisionError("You can only generate the briefing for a role you hold.");
  if (opts.projectId) await assertAllowed(principal, "project.view", { projectId: opts.projectId }, db);
  const keep = inScope(scope, role, opts.projectId);
  const [allCases, queue, actions, previousRow] = await Promise.all([
    loadPortfolio(db),
    loadFollowUpQueue(db, scope),
    db.actionItem.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, include: { employee: true } }),
    db.briefing.findFirst({ where: { role, scopeKey: scopeKeyOf(opts.projectId), generatedById: principal.userId }, orderBy: { generatedAt: "desc" } }),
  ]);
  const portfolio = allCases.filter(keep);
  const ids = new Set(portfolio.map((c) => c.state.employee.id));
  const groups = queue.groups.map((g) => ({ ...g, items: g.items.filter((i) => ids.has(i.employeeId)) })).filter((g) => g.items.length);
  const evaluationDate = getEvaluationDate();
  const previous = previousRow ? { snapshot: parseJson<Snapshot>(previousRow.snapshotJson, { levels: {}, openFindings: {}, resolved: [] }), generatedAt: previousRow.generatedAt } : null;
  const deterministic = selectBriefing(role, portfolio, groups, actions.filter((a) => a.employeeId && ids.has(a.employeeId)).map((a) => ({ id: a.id, employeeName: a.employee?.name ?? "Unknown", title: a.title, dueDate: a.dueDate, ownerRole: a.ownerRole })), previous, evaluationDate);

  const outcome = await runAgent({
    agent: "briefing", promptVersion: prompt.PROMPT_VERSION, input: { role, deterministic }, inputRefs: [...new Set(deterministic.flatMap((s) => s.statements.flatMap((x) => x.refs)))].slice(0, 200),
    system: prompt.SYSTEM, user: prompt.buildUser(role, deterministic), schema: prompt.BriefingSchema, db,
  });

  let rejected = 0;
  let sections: Section[] = deterministic.map((s) => ({ ...s, source: "DETERMINISTIC" as const }));
  if (outcome.ok) {
    sections = deterministic.map((s) => {
      const ai = outcome.data.sections.find((x) => x.key === s.key);
      if (!ai || !s.statements.length) return { ...s, source: "DETERMINISTIC" as const };
      const check = validateStatements(ai.statements, new Set(s.statements.flatMap((x) => x.refs)));
      rejected += check.rejected;
      return check.valid.length ? { ...s, statements: check.valid, source: "AI" as const } : { ...s, source: "DETERMINISTIC" as const };
    });
  }
  const row = await db.briefing.create({
    data: {
      role, scopeKey: scopeKeyOf(opts.projectId), generatedAt: auditTimestamp(), generatedBy: principal.name, generatedById: principal.userId, evaluationDate, sectionsJson: toJson(sections), snapshotJson: toJson(snapshotOf(portfolio)),
      narrativeSource: outcome.ok && sections.some((s) => s.source === "AI") ? "AI" : "DETERMINISTIC", aiRunId: outcome.run.id, aiError: outcome.ok ? null : outcome.error, rejectedCount: rejected,
    },
  });
  await audit({ actor: { userId: principal.userId, label: principal.name, role: principal.role }, action: "BRIEFING_GENERATED", entityType: "Briefing", entityId: row.id, after: { role, narrativeSource: row.narrativeSource, rejected, aiRunId: outcome.run.id }, details: `${role} briefing generated (${row.narrativeSource === "AI" ? "AI narrative over deterministic facts" : "deterministic statements"}${rejected ? `; ${rejected} AI statement(s) rejected for missing or invalid refs` : ""}).` }, db);
  return row.id;
}

export const scopeKeyOf = (projectId?: string | null) => (projectId ? `project:${projectId}` : "ALL");

/** A user's own briefings for one role and scope (whole scope or one project). */
export async function listBriefings(role: BriefingRole, userId: string, projectId?: string | null, db: PrismaClient = prisma) {
  return db.briefing.findMany({ where: { role, generatedById: userId, scopeKey: scopeKeyOf(projectId) }, orderBy: { generatedAt: "desc" }, take: 20 });
}

export function toMarkdown(b: { role: string; generatedAt: string; evaluationDate: string; narrativeSource: string; sectionsJson: string }): string {
  const sections = parseJson<Section[]>(b.sectionsJson, []);
  return [
    `# OnboardIQ daily briefing — ${b.role.replaceAll("_", " ")}`,
    "",
    `Evaluation date: ${formatDate(b.evaluationDate)} · generated ${b.generatedAt.slice(0, 16).replace("T", " ")} UTC · ${b.narrativeSource === "AI" ? "AI narrative over deterministic, referenced facts" : "deterministic statements"}`,
    "",
    ...sections.flatMap((s) => [`## ${s.title}`, "", ...(s.statements.length ? s.statements.map((x) => `- ${x.text} _[${x.refs.join(", ")}]_`) : [`_${s.note ?? "Nothing to report."}_`]), ""]),
    "---",
    "Every statement references its source records. AI proposes wording only; all facts come from deterministic rules over stored evidence.",
  ].join("\n");
}
