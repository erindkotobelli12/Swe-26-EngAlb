import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, AlertTriangle, GitCompareArrows, KeyRound, MailQuestion, RefreshCw, Timer, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate, getEvaluationDate } from "@/lib/clock";
import { headline, kpis, loadPortfolio } from "@/modules/case/portfolio";
import { can } from "@/modules/permissions";
import { levelLabel } from "@/modules/readiness/evaluate";
import { recomputeAllAction } from "@/server/actions/case";
import DashboardEmployeeTable from "@/components/DashboardEmployeeTable";
import ActionButton from "@/components/ActionButton";
import { Card, EmptyState, ProvenanceBadge, SeverityBadge } from "@/components/ui/badges";

const SUBTITLE: Record<string, string> = {
  PMO: "PMO overview — cross-project blockers, ownership gaps and follow-ups",
  TECH_LEAD: "Technical Lead overview — KT gaps and pending validations",
  LINE_MANAGER: "Line Manager overview — local practical blockers",
  MANAGEMENT: "Management overview — readiness distribution and risk",
};

export default async function Dashboard() {
  const session = await getSession();
  if (session.role === "EMPLOYEE") redirect("/workspace");
  const [portfolio, runs] = await Promise.all([loadPortfolio(), prisma.aIRun.findMany({ orderBy: { createdAt: "desc" }, take: 5 })]);
  const k = kpis(portfolio);
  const cards = [
    ["Official cases", k.total, Users, "text-indigo-600"],
    ["Need intervention", k.needIntervention, AlertTriangle, "text-amber-600"],
    ["Access items not usable", k.accessNotUsable, KeyRound, "text-red-600"],
    ["Open conflicts", k.conflicts, GitCompareArrows, "text-violet-600"],
    ["Unanswered requests", k.unanswered, MailQuestion, "text-orange-600"],
    ["Stale cases", k.stale, Timer, "text-slate-600"],
  ] as const;
  const issues = portfolio
    .map((c) => ({ c, line: headline(c), top: c.open[0] }))
    .filter((x): x is typeof x & { line: string } => Boolean(x.line && x.top))
    .sort((a, b) => ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(a.top!.severity) - ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(b.top!.severity));

  return (
    <div className="px-5 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{SUBTITLE[session.role]}</p>
          <h1 className="mt-1 text-2xl font-bold">Onboarding command center</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Evaluation date <b className="ml-2 text-slate-800">{formatDate(getEvaluationDate())}</b></div>
          {can(session, "case.recompute") && <ActionButton action={recomputeAllAction} label="Re-run analysis" pendingLabel="Recomputing…" icon={<RefreshCw size={15} />} variant="secondary" />}
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value, Icon, color]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex justify-between gap-2"><p className="text-xs font-medium text-slate-500">{label}</p><Icon size={17} className={color} /></div>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>
      <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><ProvenanceBadge state="actual" /> All figures are computed from stored records by deterministic rules; nothing on this page is AI-generated.</p>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <DashboardEmployeeTable
          employees={portfolio.map((c) => ({
            id: c.state.employee.id, name: c.state.employee.name, movement: c.state.employee.movement, project: c.state.employee.projectName ?? "Unknown",
            reported: c.readiness.reported, assessed: levelLabel(c.readiness.assessed), validated: c.readiness.validated ? levelLabel(c.readiness.validated) : "Not validated",
            reliability: null, topIssue: c.open[0]?.title ?? null, topSeverity: c.open[0]?.severity ?? null, lastUpdate: formatDate(c.state.employee.lastUpdate),
          }))}
        />
        <aside className="space-y-5">
          <Card title="Top issues" actions={<Link href="/investigations" className="text-xs font-bold text-indigo-600">All findings →</Link>}>
            {issues.length ? (
              <ol className="space-y-2">
                {issues.slice(0, 8).map(({ c, line, top }) => (
                  <li key={c.state.employee.id}>
                    <Link href={`/employees/${c.state.employee.id}?tab=investigation`} className="block rounded-lg border border-slate-100 p-3 hover:border-indigo-200 hover:bg-indigo-50/40">
                      <div className="flex items-center justify-between gap-2"><b className="text-sm">{c.state.employee.name}</b><SeverityBadge severity={top!.severity} /></div>
                      <p className="mt-1 text-xs text-slate-600">{line}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{c.open.length} open finding(s){c.proposed.length ? ` · ${c.proposed.length} AI proposal(s)` : ""}</p>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : <EmptyState title="No open findings" />}
          </Card>
          <Card title={<span className="flex items-center gap-2"><Activity size={16} className="text-violet-600" />AI activity</span>} actions={<Link href="/ai-activity" className="text-xs font-bold text-indigo-600">Log →</Link>}>
            {runs.length ? (
              <ul className="space-y-2 text-xs">
                {runs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span><b className="capitalize">{r.agent.replaceAll("_", " ")}</b> · {r.model}</span>
                    <span className={r.status === "OK" ? "text-emerald-700" : "text-red-700"}>{r.status.toLowerCase().replaceAll("_", " ")}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">No AI runs yet. AI agents run only when a user asks (Investigate, Extract, Draft…).</p>}
          </Card>
        </aside>
      </section>
    </div>
  );
}
