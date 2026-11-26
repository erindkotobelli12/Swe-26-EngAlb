import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditTimestamp } from "@/lib/clock";
import { READINESS_LEVELS } from "@/domain/types";
import { audit } from "@/modules/audit";
import { recomputeCase } from "@/modules/case/recompute";
import { DecisionError } from "@/modules/detective/decisions";
import { changePhase } from "@/modules/phase/transition";
import { assertAllowed, type Principal } from "@/modules/permissions";

/**
 * The only path to a validated readiness level. Human Technical Lead only, with mandatory evidence links and comment.
 * No AI module imports this file (enforced by tests/unit/permissions.test.ts).
 */
export const ValidationSchema = z.object({
  employeeId: z.string().min(1),
  state: z.enum(["APPROVED", "REJECTED", "NEEDS_MORE_EVIDENCE"]),
  validatedLevel: z.enum(READINESS_LEVELS).optional(),
  evidenceIds: z.array(z.string().min(1)).min(1, "Link at least one evidence record"),
  comment: z.string().trim().min(10, "Explain the decision (at least 10 characters)").max(2000),
});

export async function recordValidation(input: z.infer<typeof ValidationSchema>, principal: Principal, db: PrismaClient = prisma): Promise<string> {
  const data = ValidationSchema.parse(input);
  await assertAllowed(principal, "validation.record", { employeeId: data.employeeId }, db);
  if (data.state === "APPROVED" && !data.validatedLevel) throw new DecisionError("Choose the readiness level you are validating.");
  if (data.state === "APPROVED" && ["UNKNOWN", "PRE_ONBOARDING", "BLOCKED"].includes(data.validatedLevel!)) throw new DecisionError("That level cannot be validated as readiness.");
  const caseRow = await db.onboardingCase.findUnique({ where: { employeeId: data.employeeId }, include: { employee: true } });
  if (!caseRow) throw new DecisionError("Unknown case.");
  const evidence = await db.evidence.findMany({ where: { id: { in: data.evidenceIds } } });
  const belongs = (e: (typeof evidence)[number]) => e.employeeId === data.employeeId || (e.employeeId === null && e.projectId !== null && e.projectId === caseRow.employee.projectId);
  if (evidence.length !== data.evidenceIds.length || !evidence.every(belongs)) {
    throw new DecisionError("Every linked evidence record must exist and belong to this case.");
  }
  const v = await db.readinessValidation.create({
    data: {
      caseId: caseRow.id, state: data.state, validatedLevel: data.state === "APPROVED" ? data.validatedLevel : null, reviewerRole: "TECH_LEAD",
      reviewerName: principal.name, reviewerId: principal.userId, evidenceId: data.evidenceIds[0], evidenceIds: JSON.stringify(data.evidenceIds), comment: data.comment, timestamp: auditTimestamp(),
    },
  });
  const actor = { userId: principal.userId, label: principal.name, role: principal.role };
  await audit({
    actor, action: "READINESS_VALIDATION_RECORDED", entityType: "ReadinessValidation", entityId: v.id, employeeId: data.employeeId,
    before: { validatedStatus: caseRow.validatedStatus }, after: { state: data.state, validatedLevel: v.validatedLevel },
    evidenceIds: data.evidenceIds, details: `Technical validation: ${data.state.replaceAll("_", " ").toLowerCase()}${v.validatedLevel ? ` (${v.validatedLevel})` : ""} — ${data.comment}`,
  }, db);
  // READY is reachable only here: a human Technical Lead's approved validation of independent readiness.
  if (data.state === "APPROVED" && data.validatedLevel === "INDEPENDENTLY_READY") {
    await changePhase(db, { employeeId: data.employeeId, to: "READY", reason: `Technical Lead validated independent readiness: ${data.comment}`, actor, allowedFrom: ["ONBOARDING"] });
  }
  await recomputeCase(data.employeeId, `technical validation ${data.state.toLowerCase()}`, actor, db);
  return v.id;
}
