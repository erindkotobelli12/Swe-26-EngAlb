import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getEvaluationDate } from "@/lib/clock";
import { can } from "@/modules/permissions";
import { fieldSuggestions, listEvidenceCards, replyTargets } from "@/modules/evidence/queries";
import EvidenceCard from "@/components/evidence/EvidenceCard";
import AddEvidenceForm from "@/components/evidence/AddEvidenceForm";
import { ClaimReview, EvidenceTools } from "@/components/evidence/ReviewControls";
import { EmptyState } from "@/components/ui/badges";

export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await getSession();
  if (session.role === "EMPLOYEE") redirect("/workspace");
  const { show } = await searchParams;
  const includeTracker = show === "tracker";
  const [pending, reviewed, employees, targets] = await Promise.all([
    listEvidenceCards({ OR: [{ reviewStatus: "PENDING_REVIEW" }, { claims: { some: { reviewStatus: "PENDING" } } }] }),
    listEvidenceCards({ reviewStatus: { not: "PENDING_REVIEW" }, claims: { none: { reviewStatus: "PENDING" } }, ...(includeTracker ? {} : { sourceType: { not: "TRACKER" } }) }),
    prisma.employee.findMany({ where: { isSimulated: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    replyTargets(),
  ]);
  const canReview = can(session, "evidence.review");
  const canRunAI = can(session, "ai.run");
  const employeeOf = new Map((await prisma.evidence.findMany({ where: { id: { in: pending.map((p) => p.id) } }, select: { id: true, employeeId: true } })).map((e) => [e.id, e.employeeId]));
  const suggestions = new Map<string, string[]>();
  for (const p of pending) suggestions.set(p.id, await fieldSuggestions(employeeOf.get(p.id) ?? null));

  return (
    <div className="px-5 py-6 md:px-8">
      <header><p className="text-sm text-slate-500">Human review inbox</p><h1 className="mt-1 text-2xl font-bold">Evidence</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">New sources are stored verbatim and wait for review. The Extraction Agent proposes structured claims with verbatim excerpts; nothing changes case state until a human approves a claim.</p>
      </header>
      {can(session, "evidence.add") && <div className="mt-5"><AddEvidenceForm employees={employees.map((e) => ({ id: e.id, label: `${e.name} (${e.id})` }))} replyTargets={targets} defaultDate={getEvaluationDate()} /></div>}

      <h2 className="mt-8 text-lg font-bold">Needs review <span className="text-sm font-normal text-slate-500">({pending.length})</span></h2>
      <div className="mt-3 grid gap-3">
        {pending.length ? pending.map((e) => (
          <EvidenceCard key={e.id} e={e}
            controls={(canReview || canRunAI) ? <EvidenceTools evidenceId={e.id} reviewStatus={e.reviewStatus} canRunAI={canRunAI && Boolean(e.employeeName)} canReview={canReview} fields={suggestions.get(e.id) ?? []} /> : undefined}
            claimControls={canReview ? (claimId) => <ClaimReview claimId={claimId} value={e.claims.find((c) => c.id === claimId)?.value ?? ""} /> : undefined}
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
