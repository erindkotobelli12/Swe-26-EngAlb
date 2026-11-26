import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditTimestamp } from "@/lib/clock";

export type Actor = { userId: string | null; label: string; role: string };
export const SYSTEM_ACTOR: Actor = { userId: null, label: "System (deterministic rules)", role: "SYSTEM" };

type Db = PrismaClient | Prisma.TransactionClient;

export async function audit(
  entry: {
    actor: Actor;
    action: string;
    entityType: string;
    entityId: string;
    employeeId?: string | null;
    before?: unknown;
    after?: unknown;
    evidenceIds?: string[];
    details: string;
  },
  db: Db = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actor.userId,
      actorLabel: `${entry.actor.label}${entry.actor.role !== "SYSTEM" ? ` (${entry.actor.role})` : ""}`,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      employeeId: entry.employeeId ?? null,
      before: entry.before === undefined ? null : JSON.stringify(entry.before),
      after: entry.after === undefined ? null : JSON.stringify(entry.after),
      evidenceIds: JSON.stringify(entry.evidenceIds ?? []),
      details: entry.details,
      timestamp: auditTimestamp(),
    },
  });
}
