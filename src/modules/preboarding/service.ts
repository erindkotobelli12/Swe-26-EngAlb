import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { addDays, auditTimestamp } from "@/lib/clock";
import { PREBOARDING_STATUSES, PREBOARDING_TEMPLATE, isClosedItem } from "@/config/preboarding";
import { audit, type Actor } from "@/modules/audit";
import { recomputeCase } from "@/modules/case/recompute";
import { DecisionError } from "@/modules/detective/decisions";
import { assertAllowed, type Principal } from "@/modules/permissions";
import { changePhase } from "@/modules/phase/transition";

/**
 * Pre-boarding: HR owns the pipeline; the Line Manager may update items for their own employees.
 * The hand-over to onboarding needs every HR-owned item done (or not applicable) and the Line Manager's confirmation.
 */

const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });

/** Creates the default checklist for a case (idempotent per template item). */
export async function createDefaultChecklist(db: PrismaClient, employeeId: string, actor: Actor): Promise<number> {
  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { startDate: true } });
  if (!employee) return 0;
  let created = 0;
  for (const [i, t] of PREBOARDING_TEMPLATE.entries()) {
    const exists = await db.preboardingItem.findUnique({ where: { employeeId_templateKey: { employeeId, templateKey: t.key } } });
    if (exists) continue;
    await db.preboardingItem.create({
      data: { employeeId, templateKey: t.key, title: t.title, category: t.category, ownerRole: t.ownerRole, status: "TODO", dueDate: addDays(employee.startDate, -t.daysBeforeStart), sortOrder: i, updatedBy: actor.label, updatedAt: auditTimestamp() },
    });
    created++;
  }
  return created;
}

export const ItemUpdateSchema = z.object({
  itemId: z.string().min(1),
  status: z.enum(PREBOARDING_STATUSES),
  blockerReason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
}).refine((v) => v.status !== "BLOCKED" || (v.blockerReason ?? "").length >= 3, "Say what is blocking this item");

export async function updatePreboardingItem(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const input = ItemUpdateSchema.parse(raw);
  const item = await db.preboardingItem.findUnique({ where: { id: input.itemId }, include: { employee: { select: { name: true } } } });
  if (!item) throw new DecisionError("Unknown checklist item.");
  await assertAllowed(principal, "preboarding.update", { employeeId: item.employeeId }, db);
  const data = { status: input.status, blockerReason: input.status === "BLOCKED" ? input.blockerReason! : null, note: input.note ?? item.note, updatedBy: principal.name, updatedAt: auditTimestamp() };
  await db.preboardingItem.update({ where: { id: item.id }, data });
  await audit({
    actor: actorOf(principal), action: "PREBOARDING_ITEM_UPDATED", entityType: "PreboardingItem", entityId: item.id, employeeId: item.employeeId,
    before: { status: item.status, blockerReason: item.blockerReason }, after: { status: data.status, blockerReason: data.blockerReason },
    details: `${item.employee.name}: "${item.title}" ${item.status} → ${input.status}${data.blockerReason ? ` (${data.blockerReason})` : ""}.`,
  }, db);
}

/** HR-owned items that still block the hand-over. */
export async function openHrItems(employeeId: string, db: PrismaClient = prisma) {
  return db.preboardingItem.findMany({ where: { employeeId, ownerRole: "HR" } }).then((xs) => xs.filter((x) => !isClosedItem(x.status)));
}

/** The Line Manager confirms the hand-over: the case moves to onboarding and the Technical Lead takes over. */
export async function confirmHandover(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const input = z.object({ employeeId: z.string().min(1), note: z.string().trim().max(500).optional() }).parse(raw);
  await assertAllowed(principal, "handover.confirm", { employeeId: input.employeeId }, db);
  const open = await openHrItems(input.employeeId, db);
  if (open.length) throw new DecisionError(`HR still has open items: ${open.map((o) => o.title).join("; ")}.`);
  const actor = actorOf(principal);
  const changed = await changePhase(db, { employeeId: input.employeeId, to: "ONBOARDING", reason: `Hand-over confirmed by the Line Manager${input.note ? `: ${input.note}` : ""}`, actor, allowedFrom: ["PRE_BOARDING"] });
  if (!changed) throw new DecisionError("This case is not in pre-boarding.");
  await audit({ actor, action: "HANDOVER_CONFIRMED", entityType: "OnboardingCase", entityId: `CASE-${input.employeeId}`, employeeId: input.employeeId, before: { phase: "PRE_BOARDING" }, after: { phase: "ONBOARDING" }, details: `Hand-over to onboarding confirmed${input.note ? `: ${input.note}` : ""}.` }, db);
  await recomputeCase(input.employeeId, "hand-over to onboarding", actor, db);
}
