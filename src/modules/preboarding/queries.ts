import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { daysBetween, getEvaluationDate } from "@/lib/clock";
import { isClosedItem } from "@/config/preboarding";
import { can, type Scope } from "@/modules/permissions";

/** Read-only pre-boarding pipeline for the cases in the user's scope (HR: everyone in pre-boarding; Line Manager: their reports). */
export type ChecklistItem = { id: string; title: string; category: string; ownerRole: string; status: string; blockerReason: string | null; note: string | null; dueDate: string | null; overdue: boolean; updatedBy: string; updatedAt: string; evidenceId: string | null };
export type PreboardingRow = {
  employeeId: string; personId: string | null; name: string; isSample: boolean; projectId: string | null; projectName: string | null;
  lineManager: string | null; techLead: string | null; startDate: string; daysToStart: number; items: ChecklistItem[];
  done: number; total: number; blocked: ChecklistItem[]; hrOpen: number; missingContacts: string[]; canEdit: boolean; canHandover: boolean;
};

export async function loadPreboarding(scope: Scope, db: PrismaClient = prisma, opts: { projectId?: string; employeeIds?: string[] } = {}): Promise<PreboardingRow[]> {
  const ids = Object.values(scope.cases).filter((c) => c.phase === "PRE_BOARDING" && (!opts.projectId || c.projectId === opts.projectId) && (!opts.employeeIds || opts.employeeIds.includes(c.employeeId))).map((c) => c.employeeId);
  if (!ids.length) return [];
  const today = getEvaluationDate();
  const [employees, tls, lms] = await Promise.all([
    db.employee.findMany({ where: { id: { in: ids } }, include: { project: true, person: true, preboarding: { orderBy: { sortOrder: "asc" } } }, orderBy: { startDate: "asc" } }),
    db.projectAssignment.findMany({ where: { role: "TECH_LEAD", status: "ACTIVE" }, include: { person: true } }),
    db.person.findMany({ where: { role: "LINE_MANAGER" } }),
  ]);
  return employees.map((e) => {
    const items: ChecklistItem[] = e.preboarding.map((i) => ({
      id: i.id, title: i.title, category: i.category, ownerRole: i.ownerRole, status: i.status, blockerReason: i.blockerReason, note: i.note, dueDate: i.dueDate,
      overdue: Boolean(i.dueDate && i.dueDate < today && !isClosedItem(i.status)), updatedBy: i.updatedBy, updatedAt: i.updatedAt, evidenceId: i.evidenceId,
    }));
    const tl = tls.find((t) => t.projectId === e.projectId);
    const lm = lms.find((p) => p.id === e.lineManagerId)?.name ?? e.manager;
    const missingContacts = [...(lm ? [] : ["Line Manager"]), ...(tl ? [] : ["Technical Lead"])];
    return {
      employeeId: e.id, personId: e.personId, name: e.name, isSample: e.person?.isSimulated ?? false, projectId: e.projectId, projectName: e.project?.name ?? null,
      lineManager: lm ?? null, techLead: tl ? tl.person.name ?? "Known by role only" : null, startDate: e.startDate, daysToStart: daysBetween(today, e.startDate), items,
      done: items.filter((i) => isClosedItem(i.status)).length, total: items.length, blocked: items.filter((i) => i.status === "BLOCKED"),
      hrOpen: items.filter((i) => i.ownerRole === "HR" && !isClosedItem(i.status)).length, missingContacts,
      canEdit: can(scope, "preboarding.update", { employeeId: e.id }), canHandover: can(scope, "handover.confirm", { employeeId: e.id }),
    };
  });
}
