import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditTimestamp } from "@/lib/clock";
import { parseJson } from "@/lib/json";
import type { RecommendedAction } from "@/domain/types";
import { audit, type Actor } from "@/modules/audit";
import { recomputeCase } from "@/modules/case/recompute";
import { assertAllowed, type Principal } from "@/modules/permissions";

export class DecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionError";
  }
}

export const RESOLUTION_TYPES = ["CONFIRMED_SOURCE", "NEW_EVIDENCE", "NOT_AN_ISSUE", "NEEDS_FOLLOW_UP"] as const;
export const RESOLUTION_LABEL: Record<(typeof RESOLUTION_TYPES)[number], string> = {
  CONFIRMED_SOURCE: "Confirmed one source as correct",
  NEW_EVIDENCE: "New evidence attached",
  NOT_AN_ISSUE: "Not an issue",
  NEEDS_FOLLOW_UP: "Needs follow-up (stays open)",
};

export const ResolveSchema = z.object({
  findingId: z.string().min(1),
  resolutionType: z.enum(RESOLUTION_TYPES),
  note: z.string().trim().min(3, "A note is required").max(1000),
  winnerEvidenceId: z.string().optional(),
  evidenceId: z.string().optional(),
});

const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });

/** Loads a finding and checks the principal may decide it (phase owner, or the Line Manager for non-technical findings). */
async function loadFinding(db: PrismaClient, findingId: string, principal: Principal) {
  const f = await db.finding.findUnique({ where: { id: findingId }, include: { case: true } });
  if (!f) throw new DecisionError("Unknown finding.");
  await assertAllowed(principal, "finding.decide", { employeeId: f.case.employeeId, findingCategory: f.category }, db);
  return f;
}

/** Resolutions never delete or edit evidence, and conflicts are only closed by an explicit human decision. */
export async function resolveFinding(input: z.infer<typeof ResolveSchema>, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const data = ResolveSchema.parse(input);
  const f = await loadFinding(db, data.findingId, principal);
  if (f.status === "RESOLVED" || f.status === "DISMISSED") throw new DecisionError("This finding is already closed.");
  const evidenceIds = parseJson<string[]>(f.evidenceIds, []);
  if (data.resolutionType === "CONFIRMED_SOURCE" && (!data.winnerEvidenceId || !evidenceIds.includes(data.winnerEvidenceId))) {
    throw new DecisionError("Choose which of the cited sources is correct.");
  }
  if (data.resolutionType === "NEW_EVIDENCE") {
    const ev = data.evidenceId ? await db.evidence.findUnique({ where: { id: data.evidenceId } }) : null;
    if (!ev || ev.employeeId !== f.case.employeeId) throw new DecisionError("Attach an existing evidence record from this case (add it in the Evidence tab first).");
  }
  const now = auditTimestamp();
  const actor = actorOf(principal);
  if (data.resolutionType === "NEEDS_FOLLOW_UP") {
    await db.finding.update({ where: { id: f.id }, data: { resolutionType: "NEEDS_FOLLOW_UP", resolution: data.note, status: f.status === "PROPOSED" ? "OPEN" : f.status } });
    await createActionFromFinding(f.id, principal, db, data.note);
  } else {
    await db.finding.update({
      where: { id: f.id },
      data: { status: "RESOLVED", resolvedAt: now, resolvedBy: principal.name, resolutionType: data.resolutionType, resolution: data.note, resolutionEvidenceId: data.winnerEvidenceId ?? data.evidenceId ?? null },
    });
  }
  await audit({
    actor, action: data.resolutionType === "NEEDS_FOLLOW_UP" ? "FINDING_FOLLOW_UP_REQUIRED" : "FINDING_RESOLVED", entityType: "Finding", entityId: f.id, employeeId: f.case.employeeId,
    before: { status: f.status }, after: { status: data.resolutionType === "NEEDS_FOLLOW_UP" ? "OPEN" : "RESOLVED", resolutionType: data.resolutionType, winner: data.winnerEvidenceId ?? null },
    evidenceIds: [...evidenceIds, ...(data.evidenceId ? [data.evidenceId] : [])], details: `${f.title} — ${data.note}`,
  }, db);
  await recomputeCase(f.case.employeeId, `finding decision (${data.resolutionType.toLowerCase()})`, actor, db);
}

export async function dismissFinding(input: { findingId: string; reason: string }, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const reason = z.string().trim().min(3, "A reason is required to dismiss").max(1000).parse(input.reason);
  const f = await loadFinding(db, input.findingId, principal);
  if (f.status === "RESOLVED" || f.status === "DISMISSED") throw new DecisionError("This finding is already closed.");
  await db.finding.update({ where: { id: f.id }, data: { status: "DISMISSED", resolvedAt: auditTimestamp(), resolvedBy: principal.name, resolutionType: "DISMISSED", resolution: reason } });
  await audit({ actor: actorOf(principal), action: "FINDING_DISMISSED", entityType: "Finding", entityId: f.id, employeeId: f.case.employeeId, before: { status: f.status }, after: { status: "DISMISSED" }, evidenceIds: parseJson(f.evidenceIds, []), details: `${f.title} — ${reason}` }, db);
  await recomputeCase(f.case.employeeId, "finding dismissed", actorOf(principal), db);
}

/** An AI proposal becomes an actual finding only when a human accepts it. */
export async function acceptProposal(findingId: string, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const f = await loadFinding(db, findingId, principal);
  if (f.status !== "PROPOSED") throw new DecisionError("Only AI proposals can be accepted.");
  await db.finding.update({ where: { id: f.id }, data: { status: "OPEN" } });
  await audit({ actor: actorOf(principal), action: "AI_FINDING_ACCEPTED", entityType: "Finding", entityId: f.id, employeeId: f.case.employeeId, before: { status: "PROPOSED" }, after: { status: "OPEN" }, evidenceIds: parseJson(f.evidenceIds, []), details: `Accepted AI proposal: ${f.title}` }, db);
  await recomputeCase(f.case.employeeId, "AI finding accepted", actorOf(principal), db);
}

/** Hands a finding to the follow-up process as an owned action item. Due dates are never invented. */
export async function createActionFromFinding(findingId: string, principal: Principal, db: PrismaClient = prisma, note?: string): Promise<string> {
  const f = await loadFinding(db, findingId, principal);
  const existing = await db.actionItem.findFirst({ where: { findingId, status: { in: ["OPEN", "IN_PROGRESS"] } } });
  if (existing) return existing.id;
  const actions = parseJson<RecommendedAction[]>(f.recommendedActions, []);
  const first = actions[0];
  const item = await db.actionItem.create({
    data: {
      caseId: f.caseId, employeeId: f.case.employeeId, findingId: f.id, title: first?.action ?? `Follow up: ${f.title}`,
      description: note ? `${f.title}. Note: ${note}` : f.title, ownerRole: first?.ownerRole ?? f.ownerRole ?? "PMO", priority: f.severity === "CRITICAL" ? "CRITICAL" : f.severity,
      status: "OPEN", evidenceIds: f.evidenceIds, origin: f.origin === "AI" ? "AI_PROPOSED_HUMAN_CREATED" : "RULE_HUMAN_CREATED", createdBy: principal.name, createdAt: auditTimestamp(),
    },
  });
  await audit({ actor: actorOf(principal), action: "ACTION_CREATED", entityType: "ActionItem", entityId: item.id, employeeId: f.case.employeeId, after: { title: item.title, ownerRole: item.ownerRole }, evidenceIds: parseJson(f.evidenceIds, []), details: `Follow-up action created from finding: ${f.title}` }, db);
  return item.id;
}
