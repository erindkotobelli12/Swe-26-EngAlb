import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditTimestamp } from "@/lib/clock";
import { audit, type Actor } from "@/modules/audit";
import { DecisionError } from "@/modules/detective/decisions";
import { assertAllowed, type Principal } from "@/modules/permissions";
import { SKILL_LEVELS } from "@/modules/requirements/checkoff";
import { syncForPerson } from "@/modules/requirements/service";

/**
 * Skills on profiles. A person may add a skill to their own profile; it stays CLAIMED until a Technical Lead in scope
 * confirms it (only CONFIRMED skills tick off requirements). Every change is audited and re-runs the check-off rule.
 */
const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });

export const ClaimSchema = z.object({ personId: z.string().min(1), skillId: z.string().min(1), level: z.enum(SKILL_LEVELS), note: z.string().trim().max(300).optional() });

export async function claimSkill(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const input = ClaimSchema.parse(raw);
  await assertAllowed(principal, "skill.claim", { personId: input.personId }, db);
  const skill = await db.skill.findUnique({ where: { id: input.skillId } });
  if (!skill) throw new DecisionError("Unknown skill.");
  const existing = await db.employeeSkill.findUnique({ where: { personId_skillId: { personId: input.personId, skillId: input.skillId } } });
  if (existing?.status === "CONFIRMED") throw new DecisionError(`${skill.name} is already confirmed on your profile.`);
  const at = auditTimestamp();
  const rec = await db.employeeSkill.upsert({
    where: { personId_skillId: { personId: input.personId, skillId: input.skillId } },
    update: { level: input.level, status: "CLAIMED", source: "SELF_DECLARED", note: input.note ?? null, confirmedById: null, confirmedAt: null, updatedAt: at },
    create: { personId: input.personId, skillId: input.skillId, level: input.level, status: "CLAIMED", source: "SELF_DECLARED", note: input.note ?? null, createdAt: at },
  });
  await audit({ actor: actorOf(principal), action: "SKILL_CLAIMED", entityType: "EmployeeSkill", entityId: rec.id, before: existing ? { status: existing.status, level: existing.level } : null, after: { status: "CLAIMED", level: input.level }, details: `${principal.name} added ${skill.name} (${input.level.toLowerCase()}) to their profile; waiting for a Technical Lead to confirm.` }, db);
}

export const DecideSkillSchema = z.object({ skillRecordId: z.string().min(1), decision: z.enum(["CONFIRM", "REJECT"]), level: z.enum(SKILL_LEVELS).optional(), reason: z.string().trim().max(500).optional() });

export async function decideSkill(raw: unknown, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const input = DecideSkillSchema.parse(raw);
  const rec = await db.employeeSkill.findUnique({ where: { id: input.skillRecordId }, include: { skill: true, person: true } });
  if (!rec) throw new DecisionError("Unknown skill record.");
  await assertAllowed(principal, "skill.confirm", { personId: rec.personId }, db);
  if (input.decision === "REJECT" && (input.reason ?? "").length < 3) throw new DecisionError("Give a reason for rejecting the skill.");
  const at = auditTimestamp();
  const status = input.decision === "CONFIRM" ? "CONFIRMED" : "REJECTED";
  const level = input.level ?? rec.level;
  await db.employeeSkill.update({ where: { id: rec.id }, data: { status, level, source: status === "CONFIRMED" && rec.source === "SELF_DECLARED" ? "TL_CONFIRMED" : rec.source, confirmedById: principal.userId, confirmedAt: at, updatedAt: at, note: input.reason ?? rec.note } });
  await audit({
    actor: actorOf(principal), action: status === "CONFIRMED" ? "SKILL_CONFIRMED" : "SKILL_REJECTED", entityType: "EmployeeSkill", entityId: rec.id,
    before: { status: rec.status, level: rec.level }, after: { status, level }, details: `${rec.person.name}: ${rec.skill.name} ${status.toLowerCase()}${input.reason ? ` — ${input.reason}` : ""}.`,
  }, db);
  await syncForPerson(db, rec.personId, actorOf(principal), `skill ${rec.skill.name} ${status.toLowerCase()}`);
}
