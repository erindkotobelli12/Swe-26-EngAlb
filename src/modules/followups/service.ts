import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditTimestamp, getEvaluationDate } from "@/lib/clock";
import { parseJson, toJson } from "@/lib/json";
import { PERSON_ROLES, type PersonRole } from "@/domain/types";
import { runAgent, type AIRunInfo } from "@/ai/runAgent";
import * as prompt from "@/ai/prompts/followup";
import { audit, type Actor } from "@/modules/audit";
import { loadPortfolio } from "@/modules/case/portfolio";
import { recomputeCase } from "@/modules/case/recompute";
import { DecisionError } from "@/modules/detective/decisions";
import { ingestEvidence } from "@/modules/evidence/pipeline";
import { assertCan, type Principal } from "@/modules/permissions";
import { buildFollowUps, templateDraft, type FollowUpGroup, type FollowUpItem } from "./candidates";

const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });
const ACTIVE = ["DRAFT", "APPROVED", "SENT_SIMULATED"];

/** Read-only queue: deterministic groups plus the persisted communications. */
export async function loadFollowUpQueue(db: PrismaClient = prisma) {
  const [portfolio, people, actions, communications] = await Promise.all([
    loadPortfolio(db),
    db.person.findMany(),
    db.actionItem.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, employeeId: { not: null } } }),
    db.communication.findMany({ orderBy: [{ createdAt: "desc" }] }),
  ]);
  const covered = new Set(communications.filter((c) => ACTIVE.includes(c.status)).flatMap((c) => parseJson<FollowUpItem[]>(c.itemsJson, []).map((i) => i.key)));
  const groups = buildFollowUps(
    portfolio,
    people.map((p) => ({ id: p.id, name: p.name, role: p.role, projectId: p.projectId, note: p.note })),
    actions.map((a) => ({ id: a.id, employeeId: a.employeeId!, findingId: a.findingId, title: a.title, description: a.description, ownerRole: a.ownerRole, dueDate: a.dueDate, priority: a.priority, evidenceIds: parseJson(a.evidenceIds, []) })),
    covered,
  );
  return { groups, communications, employees: new Map(portfolio.map((c) => [c.state.employee.id, c.state.employee.name])) };
}

/** Persists one consolidated DRAFT per stakeholder group (deterministic template). Idempotent per item. */
export async function createDrafts(stakeholderKeys: string[] | "ALL", principal: Principal, db: PrismaClient = prisma): Promise<number> {
  assertCan(principal, "communication.approve");
  const { groups } = await loadFollowUpQueue(db);
  const chosen = stakeholderKeys === "ALL" ? groups : groups.filter((g) => stakeholderKeys.includes(g.stakeholder.key));
  for (const g of chosen) await createDraftForGroup(g, principal, db);
  return chosen.length;
}

async function createDraftForGroup(g: FollowUpGroup, principal: Principal, db: PrismaClient) {
  const draft = templateDraft(g);
  const c = await db.communication.create({
    data: {
      stakeholderKey: g.stakeholder.key, stakeholderRole: g.stakeholder.role, stakeholderPersonId: g.stakeholder.personId, stakeholderLabel: g.stakeholder.label,
      channel: g.stakeholder.channel, subject: draft.subject, body: draft.body, itemsJson: toJson(g.items), employeeIds: toJson([...new Set(g.items.map((i) => i.employeeId))]),
      requestEvidenceIds: toJson([...new Set(g.items.map((i) => i.requestEvidenceId).filter(Boolean))]), status: "DRAFT", priorityScore: g.score,
      escalationLevel: g.escalationLevel, escalationRecommendation: g.escalationRecommendation, draftOrigin: "TEMPLATE", createdAt: auditTimestamp(), createdBy: principal.name,
    },
  });
  await audit({ actor: actorOf(principal), action: "FOLLOW_UP_DRAFTED", entityType: "Communication", entityId: c.id, after: { stakeholder: g.stakeholder.label, items: g.items.length, origin: "TEMPLATE" }, evidenceIds: g.items.flatMap((i) => i.facts.map((f) => f.evidenceId)), details: `Template draft for ${g.stakeholder.label} covering ${g.items.length} item(s).` }, db);
}

async function loadComm(db: PrismaClient, id: string) {
  const c = await db.communication.findUnique({ where: { id } });
  if (!c) throw new DecisionError("Unknown follow-up.");
  return c;
}

export type PersonaliseResult = { ok: true; run: AIRunInfo; warnings: string[] } | { ok: false; error: string; run?: AIRunInfo };

/** AI rewrites the draft from the grouped facts. Guards: only allowed names, every employee covered. The human still approves. */
export async function personaliseDraft(id: string, principal: Principal, db: PrismaClient = prisma): Promise<PersonaliseResult> {
  assertCan(principal, "communication.approve");
  assertCan(principal, "ai.run");
  const c = await loadComm(db, id);
  if (c.status !== "DRAFT") throw new DecisionError("Only drafts can be rewritten.");
  const items = parseJson<FollowUpItem[]>(c.itemsJson, []);
  const people = await db.person.findMany({ where: { name: { not: null } } });
  const employeeNames = [...new Set(items.map((i) => i.employeeName))];
  const recipientName = c.stakeholderPersonId ? people.find((p) => p.id === c.stakeholderPersonId)?.name ?? null : null;
  const allowedNames = [...employeeNames, ...(recipientName ? [recipientName] : [])];
  const input: prompt.DraftInput = {
    channel: c.channel === "TEAMS" ? "TEAMS" : "EMAIL", recipient: c.stakeholderLabel, greeting: recipientName ? recipientName.split(" ")[0] : `${c.stakeholderLabel.split(" (")[0]} team`,
    sender: "PMO Coordinator", allowedNames,
    items: items.map((i) => ({ employee: i.employeeName, title: i.title, ask: i.ask, daysOpen: i.daysOpen, quotes: i.facts.slice(0, 2) })),
  };
  const outcome = await runAgent({ agent: "followup_drafting", promptVersion: prompt.PROMPT_VERSION, input, inputRefs: [c.id, ...items.flatMap((i) => i.facts.map((f) => f.evidenceId))], system: prompt.SYSTEM, user: prompt.buildUser(input), schema: prompt.DraftSchema, db });
  if (!outcome.ok) return { ok: false, error: outcome.error, run: outcome.run };
  const forbidden = people.map((p) => p.name!).filter((n) => !allowedNames.includes(n) && outcome.data.body.includes(n));
  const employees = await db.employee.findMany({ select: { name: true } });
  const otherEmployees = employees.map((e) => e.name).filter((n) => !employeeNames.includes(n) && outcome.data.body.includes(n));
  if (forbidden.length || otherEmployees.length) {
    return { ok: false, error: `The AI draft named people outside this follow-up (${[...forbidden, ...otherEmployees].join(", ")}); it was discarded and the template draft kept.`, run: outcome.run };
  }
  const warnings = employeeNames.filter((n) => !outcome.data.body.includes(n.split(" ")[0])).map((n) => `The AI draft does not mention ${n}; check it covers every item.`);
  await db.communication.update({ where: { id }, data: { subject: outcome.data.subject, body: outcome.data.body, draftOrigin: "AI", aiRunId: outcome.run.id } });
  await audit({ actor: actorOf(principal), action: "FOLLOW_UP_AI_DRAFTED", entityType: "Communication", entityId: id, before: { origin: c.draftOrigin }, after: { origin: "AI", aiRunId: outcome.run.id }, details: `Follow-Up Drafting Agent rewrote the draft for ${c.stakeholderLabel}.` }, db);
  return { ok: true, run: outcome.run, warnings };
}

export const EditSchema = z.object({ id: z.string().min(1), subject: z.string().trim().min(3).max(200), body: z.string().trim().min(20).max(5000) });

export async function saveEdit(input: z.infer<typeof EditSchema>, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  assertCan(principal, "communication.approve");
  const data = EditSchema.parse(input);
  const c = await loadComm(db, data.id);
  if (!["DRAFT", "APPROVED"].includes(c.status)) throw new DecisionError("Sent follow-ups cannot be edited.");
  await db.communication.update({ where: { id: c.id }, data: { subject: data.subject, body: data.body, draftOrigin: "HUMAN_EDITED", status: "DRAFT", approvedBy: null, approvedAt: null } });
  await audit({ actor: actorOf(principal), action: "FOLLOW_UP_EDITED", entityType: "Communication", entityId: c.id, before: { subject: c.subject, status: c.status }, after: { subject: data.subject, status: "DRAFT" }, details: "Draft edited by a human (approval reset)." }, db);
}

export async function approve(id: string, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  assertCan(principal, "communication.approve");
  const c = await loadComm(db, id);
  if (c.status !== "DRAFT") throw new DecisionError("Only drafts can be approved.");
  await db.communication.update({ where: { id }, data: { status: "APPROVED", approvedBy: principal.name, approvedAt: auditTimestamp() } });
  await audit({ actor: actorOf(principal), action: "FOLLOW_UP_APPROVED", entityType: "Communication", entityId: id, before: { status: "DRAFT" }, after: { status: "APPROVED" }, details: `Approved follow-up to ${c.stakeholderLabel}.` }, db);
}

/**
 * "Send (simulated)": nothing leaves the machine. The message is placed in the simulated outbox and stored as a
 * simulated request evidence on each case, so replies can be linked and unanswered follow-ups detected.
 */
export async function sendSimulated(id: string, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  assertCan(principal, "communication.approve");
  const c = await loadComm(db, id);
  if (c.status !== "APPROVED") throw new DecisionError("A follow-up must be approved before it is sent.");
  const now = auditTimestamp();
  const outbox: string[] = [];
  for (const employeeId of parseJson<string[]>(c.employeeIds, [])) {
    const employee = await db.employee.findUnique({ where: { id: employeeId }, include: { case: true } });
    if (!employee?.case) continue;
    const evId = `OUT-${c.id.slice(-6).toUpperCase()}-${employeeId}`;
    await db.evidence.create({
      data: {
        id: evId, title: `Follow-up sent (simulated): ${c.subject}`, sourceType: c.channel === "TEAMS" ? "TEAMS_MESSAGE" : "EMAIL", author: principal.name, senderRole: "PMO",
        recipients: toJson([{ name: null, role: c.stakeholderRole }]), authorityLevel: "SECONDARY", timestamp: getEvaluationDate(), content: c.body, employeeId,
        projectId: employee.projectId, caseId: employee.case.id, reviewStatus: "APPROVED", isRequest: true, isSimulated: true, ingestedAt: now, ingestedBy: principal.userId,
        sourceRef: `Simulated outbox — communication ${c.id}`,
      },
    });
    outbox.push(evId);
  }
  await db.communication.update({ where: { id }, data: { status: "SENT_SIMULATED", sentAt: now, outboxEvidenceIds: toJson(outbox) } });
  await audit({ actor: actorOf(principal), action: "FOLLOW_UP_SENT_SIMULATED", entityType: "Communication", entityId: id, before: { status: "APPROVED" }, after: { status: "SENT_SIMULATED", outbox }, evidenceIds: outbox, details: `Placed in the simulated outbox for ${c.stakeholderLabel}. Nothing was sent.` }, db);
}

export const ResponseSchema = z.object({
  id: z.string().min(1),
  employeeId: z.string().min(1),
  content: z.string().trim().min(10).max(5000),
  senderName: z.string().trim().max(120).optional(),
});

/** Records the stakeholder's reply as new (simulated) evidence through the evidence pipeline. */
export async function recordResponse(input: z.infer<typeof ResponseSchema>, principal: Principal, db: PrismaClient = prisma): Promise<string> {
  assertCan(principal, "communication.recordResponse");
  const data = ResponseSchema.parse(input);
  const c = await loadComm(db, data.id);
  if (c.status !== "SENT_SIMULATED" && c.status !== "RESPONDED") throw new DecisionError("Record a response only for a sent follow-up.");
  const outbox = parseJson<string[]>(c.outboxEvidenceIds, []).find((x) => x.endsWith(data.employeeId));
  if (!outbox) throw new DecisionError("This follow-up did not include that employee.");
  const evidenceId = await ingestEvidence({
    title: `Response from ${c.stakeholderLabel}`, sourceType: c.channel === "TEAMS" ? "TEAMS_MESSAGE" : "EMAIL", senderName: data.senderName || undefined,
    senderRole: (PERSON_ROLES as readonly string[]).includes(c.stakeholderRole) ? (c.stakeholderRole as PersonRole) : "PMO", recipientRole: "PMO", content: data.content, employeeId: data.employeeId, inReplyToId: outbox, isRequest: false, isSimulated: true,
  }, principal, db);
  await db.communication.update({ where: { id: c.id }, data: { status: "RESPONDED", respondedAt: auditTimestamp(), responseEvidenceId: evidenceId } });
  await audit({ actor: actorOf(principal), action: "FOLLOW_UP_RESPONDED", entityType: "Communication", entityId: c.id, employeeId: data.employeeId, before: { status: c.status }, after: { status: "RESPONDED", responseEvidenceId: evidenceId }, evidenceIds: [evidenceId], details: `Response recorded from ${c.stakeholderLabel}; pending review in the evidence pipeline.` }, db);
  await recomputeCase(data.employeeId, "follow-up response recorded", actorOf(principal), db);
  return evidenceId;
}

export async function closeCommunication(id: string, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  assertCan(principal, "communication.approve");
  const c = await loadComm(db, id);
  if (c.status === "CLOSED") return;
  await db.communication.update({ where: { id }, data: { status: "CLOSED", closedAt: auditTimestamp() } });
  await audit({ actor: actorOf(principal), action: "FOLLOW_UP_CLOSED", entityType: "Communication", entityId: id, before: { status: c.status }, after: { status: "CLOSED" }, details: `Follow-up to ${c.stakeholderLabel} closed.` }, db);
  for (const e of parseJson<string[]>(c.employeeIds, [])) await recomputeCase(e, "follow-up closed", actorOf(principal), db);
}
