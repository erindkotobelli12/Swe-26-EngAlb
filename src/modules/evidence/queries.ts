import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import type { EvidenceCardData } from "@/components/evidence/EvidenceCard";

export async function listEvidenceCards(where: Prisma.EvidenceWhereInput): Promise<EvidenceCardData[]> {
  const rows = await prisma.evidence.findMany({ where, include: { employee: true, claims: { orderBy: { field: "asc" } } }, orderBy: [{ timestamp: "desc" }, { id: "asc" }] });
  return rows.map((e) => ({
    id: e.id, title: e.title, sourceType: e.sourceType, author: e.author, senderRole: e.senderRole,
    recipients: parseJson(e.recipients, [] as { name: string | null; role: string }[]), timestamp: e.timestamp, content: e.content,
    reviewStatus: e.reviewStatus, isRequest: e.isRequest, inReplyToId: e.inReplyToId, isSimulated: e.isSimulated, employeeName: e.employee?.name ?? null,
    claims: e.claims.map((c) => ({ id: c.id, field: c.field, value: c.editedValue ?? c.extractedValue, excerpt: c.excerpt, reviewStatus: c.reviewStatus, origin: c.origin, reviewReason: c.reviewReason, aiRunId: c.aiRunId })),
  }));
}

/** Field suggestions for the manual-claim form, built from the case's records. */
export async function fieldSuggestions(employeeId: string | null): Promise<string[]> {
  const base = ["case.ktOwner", "case.techLead", "case.lineManager", "case.projectRole", "case.project", "case.expectedReadyAt", "case.readinessReviewAt", "readiness.reported", "onboarding.closed"];
  if (!employeeId) return base;
  const [access, kt] = await Promise.all([
    prisma.accessRequest.findMany({ where: { employeeId }, select: { application: true } }),
    prisma.kTActivity.findMany({ where: { employeeId, status: { not: "REJECTED" } }, select: { title: true } }),
  ]);
  return [...access.map((a) => `access.${a.application}.status`), ...kt.map((k) => `kt.${k.title}.stage`), ...base];
}

export async function replyTargets() {
  const requests = await prisma.evidence.findMany({ where: { isRequest: true, reviewStatus: { not: "REJECTED" } }, include: { employee: true }, orderBy: { timestamp: "desc" } });
  return requests.filter((r) => r.employeeId).map((r) => ({ id: r.id, employeeId: r.employeeId!, label: `${r.id} · ${r.title}` }));
}
