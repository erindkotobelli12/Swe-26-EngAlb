import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { thresholds } from "@/config/thresholds";
import { getSession } from "@/lib/auth";
import { can } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { loadInsights } from "@/modules/insights/service";
import { simulatedMetrics, type Metric } from "@/modules/insights/aggregate";
import { BarPanel, HypothesesPanel } from "@/components/insights/InsightCharts";
import { Card, ProvenanceBadge } from "@/components/ui/badges";

function MetricTile({ m, simulated = false }: { m: Metric; simulated?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${simulated ? "sim-stripes border-violet-300" : "border-slate-200 bg-white"}`} data-metric={m.key}>
      <p className="text-xs font-medium text-slate-500">{m.label}</p>
      {m.sufficient ? <p className="mt-2 text-2xl font-bold">{m.value} <span className="text-sm font-normal text-slate-500">{m.unit} avg</span></p>
        : <p className="mt-2 text-lg font-bold text-slate-500">Insufficient data (n = {m.n})</p>}
      <p className="mt-1 text-[11px] text-slate-400">n = {m.n}; shown only when n ≥ {thresholds.MIN_SAMPLE_SIZE}</p>
    </div>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ sim?: string }> }) {
  await getSession();
  if (!can(await getScope(), "insights.view")) redirect("/");
  const { sim } = await searchParams;
  const includeSim = sim === "1";
  const i = await loadInsights();
  const simData = includeSim ? simulatedMetrics() : null;
  const e = i.employees;

  return (
    <div className="px-5 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Organisational bottleneck intelligence</p>
          <h1 className="mt-1 text-2xl font-bold">Insights</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Deterministic aggregations over the {Object.keys(e).length} official cases. Hover a bar to see the cases; switch to the table view for links. With this few cases these are patterns to investigate, not statistics.</p>
        </div>
        <Link href={includeSim ? "/insights" : "/insights?sim=1"} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${includeSim ? "border-violet-400 bg-violet-50 text-violet-800" : "bg-white"}`}>{includeSim ? "✓ Including simulated history" : "Include simulated history"}</Link>
      </header>
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><ProvenanceBadge state="actual" /> All charts in this section are computed from actual records.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <BarPanel title="Applications most often not usable" unit="Cases with this application not yet usable" data={i.appsNotUsable} employees={e} empty="Every required application is usable." />
        <BarPanel title="Where access is waiting" unit="Cases waiting on each role / step" data={i.handlingBottlenecks} employees={e} empty="No access is waiting." />
        <BarPanel title="Open findings by project" unit="Open findings per project" data={i.findingsByProject} employees={e} empty="No open findings." />
        <BarPanel title="Open findings by category" unit="Open findings per category" data={i.findingsByCategory} employees={e} empty="No open findings." />
        <BarPanel title="Frequently missing responsibilities and data" unit="Cases where this is not recorded" data={i.missingResponsibilities} employees={e} empty="Nothing missing." />
        <BarPanel title="Recurring unanswered requests" unit="Cases with an unanswered request, by recipient" data={i.unansweredByRecipient} employees={e} empty="No unanswered requests." />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Delayed or unfinished KT activities">
          {i.delayedKT.length ? <table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th>Employee</th><th>Activity</th><th>Stage</th><th>Source age</th></tr></thead><tbody>{i.delayedKT.map((k) => <tr key={`${k.caseId}${k.activity}`} className="border-t border-slate-100"><td className="py-1"><Link href={`/employees/${k.caseId}`} className="text-indigo-700">{k.employee}</Link></td><td>{k.activity}</td><td className="text-xs">{k.stage} ({k.basis})</td><td>{k.days} d</td></tr>)}</tbody></table> : <p className="text-sm text-slate-500">None.</p>}
        </Card>
        <Card title="Dependencies affecting several employees">
          {i.sharedDependencies.length ? <ul className="space-y-1 text-sm">{i.sharedDependencies.map((d) => <li key={d.key}>{d.label}: {d.value} employee(s) — {d.caseIds.map((id) => e[id] ?? id).join(", ")}</li>)}</ul> : <p className="text-sm text-slate-500">No dependency is shared yet.</p>}
          <p className="mt-2 text-xs text-slate-500">Today only one case has dependency edges, so nothing is shared across employees yet — reported as such, not extrapolated.</p>
        </Card>
        <Card title="Training materials that could be reused">
          {i.reusableMaterials.map((r) => (
            <div key={r.id} className="text-sm">
              <p><b>{r.title}</b> ({r.project ?? "cross-project"}) — {r.location}</p>
              {!r.copyAllowed && <p className="mt-1 flex items-center gap-1 text-xs text-amber-800"><Lock size={12} />Project-owned: reuse by reference only; do not copy.</p>}
              <p className="mt-1 text-xs text-slate-500">Projects without an indexed material: {r.projectsWithoutMaterial.join(", ")}.</p>
            </div>
          ))}
        </Card>
        <HypothesesPanel employees={e} />
      </div>

      <h2 className="mt-8 text-lg font-bold">Historical metrics</h2>
      <p className="mt-1 text-sm text-slate-600">Computed only where start and end timestamps exist. Below a sample of {thresholds.MIN_SAMPLE_SIZE} the value is withheld.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">{i.metrics.map((m) => <MetricTile key={m.key} m={m} />)}</div>

      {simData && (
        <section className="mt-6 space-y-4" data-testid="simulated-history">
          <p className="sim-banner rounded-xl px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-white">Simulated data — synthetic historical cases, shown separately and never mixed with actual data</p>
          <div className="grid gap-3 md:grid-cols-2">{simData.metrics.map((m) => <MetricTile key={m.key} m={m} simulated />)}</div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BarPanel title="Days to readiness by project (simulated)" unit="Synthetic days from start to readiness" data={simData.byProject} employees={{}} empty="—" simulated />
            <BarPanel title="Top delay causes (simulated)" unit="Synthetic cases per delay cause" data={simData.causes} employees={{}} empty="—" simulated />
          </div>
        </section>
      )}
    </div>
  );
}
