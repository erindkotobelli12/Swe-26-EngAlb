import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getEvaluationDate } from "@/lib/clock";
import { can, visibleEmployeeIds } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { evidenceVisible } from "@/server/evidenceAccess";
import { fieldSuggestions, listEvidenceCards, replyTargets } from "@/modules/evidence/queries";
import EvidenceCard from "@/components/evidence/EvidenceCard";
import AddEvidenceForm from "@/components/evidence/AddEvidenceForm";
import { ClaimReview, EvidenceTools } from "@/components/evidence/ReviewControls";
import { EmptyState } from "@/components/ui/badges";

export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await getSession();
  if (session.role === "EMPLOYEE") redirect("/workspace");
  const scope = await getScope();
  const { show } = await searchParams;
  const includeTracker = show === "tracker";
  const [allPending, allReviewed, allEmployees, allTargets, owners] = await Promise.all([
    listEvidenceCards({ OR: [{ reviewStatus: "PENDING_REVIEW" }, { claims: { some: { reviewStatus: "PENDING" } } }] }),
    listEvidenceCards({ reviewStatus: { not: "PENDING_REVIEW" }, claims: { none: { reviewStatus: "PENDING" } }, ...(includeTracker ? {} : { sourceType: { not: "TRACKER" } }) }),
    prisma.employee.findMany({ where: { id: { in: visibleEmployeeIds(scope) } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    replyTargets(),
    prisma.evidence.findMany({ select: { id: true, employeeId: true, projectId: true } }),
  ]);
  const ownerOf = new Map(owners.map((e) => [e.id, e]));
  const visible = (id: string) => { const o = ownerOf.get(id); return Boolean(o && evidenceVisible(scope, o)); };
  const pending = allPending.filter((e) => visible(e.id));
  const reviewed = allReviewed.filter((e) => visible(e.id));
  const employees = allEmployees.filter((e) => can(scope, "evidence.add", { employeeId: e.id }));
  const targets = allTargets.filter((t) => scope.cases[t.employeeId]);
  const employeeOf = new Map(owners.map((e) => [e.id, e.employeeId]));
  const canReviewOf = (id: string) => can(scope, "evidence.review", { employeeId: ownerOf.get(id)?.employeeId, projectId: ownerOf.get(id)?.projectId });
  const canRunAIOf = (id: string) => Boolean(ownerOf.get(id)?.employeeId) && can(scope, "ai.run", { employeeId: ownerOf.get(id)?.employeeId });
  const suggestions = new Map<string, string[]>();
  for (const p of pending) suggestions.set(p.id, await fieldSuggestions(employeeOf.get(p.id) ?? null));

  return (
    <div className="px-5 py-6 md:px-8">
      <header><p className="text-sm text-slate-500">Human review inbox</p><h1 className="mt-1 text-2xl font-bold">Evidence</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">New sources are stored verbatim and wait for review. The Extraction Agent proposes structured claims with verbatim excerpts; nothing changes case state until a human approves a claim.</p>
      </header>
      {employees.length > 0 && <div className="mt-5"><AddEvidenceForm employees={employees.map((e) => ({ id: e.id, label: `${e.name} (${e.id})` }))} replyTargets={targets} defaultDate={getEvaluationDate()} /></div>}

      <h2 className="mt-8 text-lg font-bold">Needs review <span className="text-sm font-normal text-slate-500">({pending.length})</span></h2>
      <div className="mt-3 grid gap-3">
        {pending.length ? pending.map((e) => (
          <EvidenceCard key={e.id} e={e}
            controls={(canReviewOf(e.id) || canRunAIOf(e.id)) ? <EvidenceTools evidenceId={e.id} reviewStatus={e.reviewStatus} canRunAI={canRunAIOf(e.id) && Boolean(e.employeeName)} canReview={canReviewOf(e.id)} fields={suggestions.get(e.id) ?? []} /> : undefined}
            claimControls={canReviewOf(e.id) ? (claimId) => <ClaimReview claimId={claimId} value={e.claims.find((c) => c.id === claimId)?.value ?? ""} /> : undefined}
          />
        )) : <EmptyState title="Nothing waiting for review">New evidence and AI-proposed claims appear here.</EmptyState>}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Reviewed sources <span className="text-sm font-normal text-slate-500">({reviewed.length})</span></h2>
        <Link href={includeTracker ? "/evidence" : "/evidence?show=tracker"} className="text-xs font-bold text-indigo-600">{includeTracker ? "Hide tracker entries" : "Show tracker entries"}</Link>
      </div>
      <div className="mt-3 grid gap-3">{reviewed.map((e) => <EvidenceCard key={e.id} e={e} />)}</div>
    </div>
  );
}
