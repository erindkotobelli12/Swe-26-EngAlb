import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditTimestamp } from "@/lib/clock";
import { parseJson, toJson } from "@/lib/json";
import { audit, type Actor } from "@/modules/audit";
import { DecisionError } from "@/modules/detective/decisions";
import { assertAllowed, can, type Principal, type Scope } from "@/modules/permissions";

/**
 * Improvements: how the PMO acts on insights. Only a human creates or approves an improvement (an AI recommendation can
 * only pre-fill the form). The owner — usually an Additional Manager — updates progress. Every change is audited.
 */
const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ImprovementSchema = z.object({
  title: z.string().trim().min(3, "Give the improvement a title").max(140),
  description: z.string().trim().min(10, "Describe the change (at least 10 characters)").max(2000),
  source: z.enum(["INSIGHT", "BRIEFING", "MANUAL"]),
  refs: z.array(z.string().min(1).max(120)).max(50).default([]),
  projectId: z.string().min(1).nullish(),
  ownerPersonId: z.string().min(1, "Choose an owner"),
  dueDate: isoDate.optional().or(z.literal("")).transform((v) => v || null),
  approve: z.boolean().default(false),
});

export async function createImprovement(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<string> {
  await assertAllowed(principal, "improvement.create", {}, db);
  const input = ImprovementSchema.parse(raw);
  const owner = await db.person.findUnique({ where: { id: input.ownerPersonId } });
  if (!owner?.name) throw new DecisionError("Unknown owner.");
  if (input.projectId && !(await db.project.findUnique({ where: { id: input.projectId } }))) throw new DecisionError("Unknown project.");
  const at = auditTimestamp();
  const row = await db.improvement.create({
    data: {
      title: input.title, description: input.description, source: input.source, refs: toJson(input.refs), projectId: input.projectId ?? null, ownerPersonId: owner.id,
      dueDate: input.dueDate, status: input.approve ? "APPROVED" : "PROPOSED", createdById: principal.userId, createdAt: at,
      approvedById: input.approve ? principal.userId : null, approvedAt: input.approve ? at : null,
    },
  });
  await audit({ actor: actorOf(principal), action: "IMPROVEMENT_CREATED", entityType: "Improvement", entityId: row.id, after: { title: row.title, status: row.status, owner: owner.name, source: row.source, refs: input.refs }, details: `Improvement "${row.title}" ${row.status === "APPROVED" ? "created and approved" : "proposed"}, owned by ${owner.name}.` }, db);
  return row.id;
}

export const UpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["PROPOSED", "APPROVED", "IN_PROGRESS", "DONE", "DROPPED"]),
  outcomeNote: z.string().trim().max(1000).optional(),
});

/** PMO approves (PROPOSED → APPROVED) or drops; the owner moves an approved improvement forward and records the outcome. */
export async function updateImprovement(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const input = UpdateSchema.parse(raw);
  const row = await db.improvement.findUnique({ where: { id: input.id } });
  if (!row) throw new DecisionError("Unknown improvement.");
  const scope = await assertAllowed(principal, "improvement.update", { ownerPersonId: row.ownerPersonId }, db);
  if (input.status === row.status) return;
  const approving = row.status === "PROPOSED" && input.status === "APPROVED";
  if (row.status === "PROPOSED" && input.status !== "DROPPED" && !approving) throw new DecisionError("An improvement must be approved before work starts.");
  if (approving && !can(scope, "improvement.approve")) throw new DecisionError("Only the PMO approves improvements.");
  if ((input.status === "DONE" || input.status === "DROPPED") && (input.outcomeNote ?? "").length < 3) throw new DecisionError("Record the outcome (what changed, or why it was dropped).");
  const at = auditTimestamp();
  await db.improvement.update({ where: { id: row.id }, data: { status: input.status, outcomeNote: input.outcomeNote ?? row.outcomeNote, updatedAt: at, ...(approving ? { approvedById: principal.userId, approvedAt: at } : {}) } });
  await audit({ actor: actorOf(principal), action: "IMPROVEMENT_UPDATED", entityType: "Improvement", entityId: row.id, before: { status: row.status }, after: { status: input.status, outcomeNote: input.outcomeNote ?? null }, details: `Improvement "${row.title}": ${row.status} → ${input.status}${input.outcomeNote ? ` — ${input.outcomeNote}` : ""}.` }, db);
}

export type ImprovementView = { id: string; title: string; description: string; source: string; status: string; refs: string[]; projectId: string | null; projectName: string | null; owner: { id: string; name: string | null; isSample: boolean } | null; dueDate: string | null; outcomeNote: string | null; createdAt: string; canUpdate: boolean; canApprove: boolean };

/** Improvements visible to the user: PMO all; others those they own or that concern their projects. */
export async function listImprovements(scope: Scope, db: PrismaClient = prisma, opts: { projectId?: string; ownerPersonId?: string } = {}): Promise<ImprovementView[]> {
  const rows = await db.improvement.findMany({ where: { ...(opts.projectId ? { projectId: opts.projectId } : {}), ...(opts.ownerPersonId ? { ownerPersonId: opts.ownerPersonId } : {}) }, orderBy: { createdAt: "desc" } });
  const [people, projects] = await Promise.all([
    db.person.findMany({ where: { id: { in: rows.map((r) => r.ownerPersonId).filter((x): x is string => Boolean(x)) } } }),
    db.project.findMany({ select: { id: true, name: true } }),
  ]);
  return rows
    .filter((r) => scope.isPMO || r.ownerPersonId === scope.personId || (r.projectId && scope.projectRoles[r.projectId]?.some((x) => x !== "EMPLOYEE")))
    .map((r) => {
      const owner = people.find((p) => p.id === r.ownerPersonId);
      return {
        id: r.id, title: r.title, description: r.description, source: r.source, status: r.status, refs: parseJson<string[]>(r.refs, []), projectId: r.projectId,
        projectName: projects.find((p) => p.id === r.projectId)?.name ?? null, owner: owner ? { id: owner.id, name: owner.name, isSample: owner.isSimulated } : null,
        dueDate: r.dueDate, outcomeNote: r.outcomeNote, createdAt: r.createdAt,
        canUpdate: can(scope, "improvement.update", { ownerPersonId: r.ownerPersonId }), canApprove: can(scope, "improvement.approve"),
      };
    });
}

/** People who can own an improvement (Additional Managers first). */
export async function improvementOwners(db: PrismaClient = prisma) {
  const people = await db.person.findMany({ where: { role: { in: ["ADDITIONAL_MANAGER", "PMO"] }, name: { not: null } }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return people.map((p) => ({ id: p.id, name: p.name!, role: p.role, isSample: p.isSimulated }));
}
