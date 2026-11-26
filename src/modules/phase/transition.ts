import type { PrismaClient } from "@prisma/client";
import { auditTimestamp } from "@/lib/clock";
import { audit, type Actor } from "@/modules/audit";
import type { Phase } from "@/modules/permissions";

/**
 * The only writer of OnboardingCase.phase. Callers are human-triggered server modules that already checked
 * permissions (hand-over by the Line Manager, technical validation by the Technical Lead, the PMO ending an
 * assignment). AI modules have no import path to this file (enforced by tests/unit/permissions.test.ts).
 * Every change is audited with who, when and why.
 */
export async function changePhase(
  db: PrismaClient,
  input: { employeeId: string; to: Phase; reason: string; actor: Actor; allowedFrom: Phase[] },
): Promise<{ from: Phase; to: Phase } | null> {
  const c = await db.onboardingCase.findUnique({ where: { employeeId: input.employeeId }, include: { employee: { select: { name: true } } } });
  if (!c) return null;
  const from = c.phase as Phase;
  if (from === input.to || !input.allowedFrom.includes(from)) return null;
  const at = auditTimestamp();
  await db.onboardingCase.update({ where: { id: c.id }, data: { phase: input.to, phaseChangedAt: at, phaseChangedBy: input.actor.label } });
  await audit({
    actor: input.actor, action: "PHASE_CHANGED", entityType: "OnboardingCase", entityId: c.id, employeeId: input.employeeId,
    before: { phase: from }, after: { phase: input.to }, details: `${c.employee.name}: ${from} → ${input.to}. Reason: ${input.reason}`,
  }, db);
  return { from, to: input.to };
}
