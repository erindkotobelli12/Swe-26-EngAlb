import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can, type Scope } from "@/modules/permissions";

/** Read-only profile: who the person is, where they work now and where they worked before. Respects the permission scope. */
export async function loadProfile(personId: string, scope: Scope, db: PrismaClient = prisma) {
  if (!can(scope, "profile.view", { personId })) return null;
  const person = await db.person.findUnique({
    where: { id: personId },
    include: {
      assignments: { include: { project: true, reportsTo: true }, orderBy: [{ status: "asc" }, { startDate: "desc" }] },
      employee: { include: { case: { select: { phase: true, validatedStatus: true, id: true } } } },
    },
  });
  if (!person) return null;
  const active = person.assignments.filter((a) => a.status === "ACTIVE");
  const current = active.find((a) => a.role === "EMPLOYEE") ?? active[0] ?? null;
  const lineManager = person.assignments.find((a) => a.role === "EMPLOYEE" && a.status === "ACTIVE")?.reportsTo ?? null;
  const caseInfo = person.employee?.case ?? null;
  const outcomeOf = (a: (typeof person.assignments)[number]): string | null => {
    if (a.role !== "EMPLOYEE") return null;
    if (a.status === "ACTIVE" && person.employee?.projectId === a.projectId && caseInfo) {
      return caseInfo.validatedStatus && !["UNKNOWN", "NOT_VALIDATED"].includes(caseInfo.validatedStatus) ? caseInfo.validatedStatus : null;
    }
    return null;
  };
  return {
    person: { id: person.id, name: person.name, role: person.role, isSample: person.isSimulated, note: person.note },
    current: current ? { projectId: current.projectId, projectName: current.project.name, role: current.role } : null,
    lineManager: lineManager ? { id: lineManager.id, name: lineManager.name, isSample: lineManager.isSimulated } : null,
    employee: person.employee ? { id: person.employee.id, phase: caseInfo?.phase ?? null } : null,
    assignments: person.assignments.map((a) => ({
      id: a.id, projectId: a.projectId, projectName: a.project.name, projectIsSample: a.project.isSimulated, role: a.role, status: a.status,
      startDate: a.startDate, endDate: a.endDate, movement: a.movement, isSample: a.isSimulated, validated: outcomeOf(a), endReason: a.endReason,
    })),
  };
}
