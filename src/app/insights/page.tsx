import Link from "next/link";
import { redirect } from "next/navigation";
import { FlaskConical, Lock } from "lucide-react";
import { thresholds } from "@/config/thresholds";
import { prisma } from "@/lib/db";
import { can } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { loadInsights } from "@/modules/insights/service";
import { improvementOwners, listImprovements } from "@/modules/improvements/service";
import { simulatedMetrics, type Metric } from "@/modules/insights/aggregate";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink, Card, cn, SimulatedPill } from "@/components/ui/primitives";
import { BarPanel, HypothesesPanel } from "@/components/insights/InsightCharts";
import { ImprovementList, NewImprovementButton } from "@/components/improvements/Improvements";

function MetricTile({ m, simulated = false }: { m: Metric; simulated?: boolean }) {
  return (
    <div className={cn("rounded-card border bg-surface p-4 shadow-soft", simulated ? "border-violet-200" : "border-line")} data-metric={m.key}>
      <p className="flex items-center gap-2 text-xs font-medium text-subtle">{m.label}{simulated && <SimulatedPill />}</p>
      {m.sufficient ? <p className="tabular mt-1 text-2xl font-semibold text-ink">{m.value} <span className="text-sm font-normal text-subtle">{m.unit} on average</span></p>
        : <p className="mt-1 text-base font-medium text-subtle">Not enough data yet</p>}
      <p className="mt-1 text-xs text-subtle">Based on {m.n} {m.n === 1 ? "case" : "cases"}; shown from {thresholds.MIN_SAMPLE_SIZE}.</p>
    </div>
  );
}

/** PMO: organisational bottlenecks (deterministic figures) and the improvements created from them. */
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ sim?: string }> }) {
  const scope = await getScope();
  if (!can(scope, "insights.view")) redirect("/");
  const { sim } = await searchParams;
  const includeSim = sim === "1";
  const [i, improvements, owners, projects] = await Promise.all([
    loadInsights(undefined, scope.isPMO ? undefined : Object.keys(scope.cases)),
    listImprovements(scope),
    improvementOwners(),
    prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const simData = includeSim ? simulatedMetrics() : null;
  const e = i.employees;
  const canCreate = can(scope, "improvement.create");

  return (
    <>
      <PageHeader title="Insights & improvements" subtitle={`Patterns across ${Object.keys(e).length} cases, counted from the records. With this few cases these are leads to investigate, not statistics.`}
        breadcrumbs={[{ label: "Insights & improvements" }]}
        actions={<>
          {canCreate && <NewImprovementButton owners={owners} projects={projects} />}
          <ButtonLink href={includeSim ? "/insights" : "/insights?sim=1"}><FlaskConical size={15} />{includeSim ? "Hide simulated history" : "Show simulated history"}</ButtonLink>
        </>} />

      <Card id="improvements" title="Improvements" subtitle="Created and approved by the PMO; owned and updated by an Additional Manager." className="mb-6">
        <ImprovementList items={improvements} />
      </Card>

      <h2 className="mb-3 text-base font-semibold text-ink">Bottlenecks</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarPanel title="Applications most often not working" unit="People whose access to this application doesn't work yet" data={i.appsNotUsable} employees={e} empty="Every required application works." />
        <BarPanel title="Where access is waiting" unit="People waiting on each role or step" data={i.handlingBottlenecks} employees={e} empty="No access is waiting." />
        <BarPanel title="Open findings by project" unit="Open findings per project" data={i.findingsByProject} employees={e} empty="No open findings." />
        <BarPanel title="Open findings by type" unit="Open findings per type" data={i.findingsByCategory} employees={e} empty="No open findings." />
        <BarPanel title="Often not recorded" unit="People for whom this isn't recorded" data={i.missingResponsibilities} employees={e} empty="Nothing missing." />
        <BarPanel title="Recurring unanswered requests" unit="People with an unanswered request, by recipient" data={i.unansweredByRecipient} employees={e} empty="No unanswered requests." />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <HypothesesPanel employees={e} owners={owners} projects={projects} canCreate={canCreate} />
        <Card title="Knowledge transfer that is late or unfinished">
          {i.delayedKT.length ? (
            <ul className="divide-y divide-line text-sm">{i.delayedKT.map((k) => <li key={`${k.caseId}${k.activity}`} className="flex justify-between gap-2 py-2"><span><Link href={`/employees/${k.caseId}`} className="font-medium text-ink hover:underline">{k.employee}</Link> · {k.activity}</span><span className="tabular text-subtle">{k.days} days</span></li>)}</ul>
          ) : <p className="text-sm text-subtle">None.</p>}
        </Card>
        <Card title="Dependencies affecting several people">
          {i.sharedDependencies.length ? <ul className="space-y-1 text-sm">{i.sharedDependencies.map((d) => <li key={d.key}>{d.label}: {d.caseIds.map((id) => e[id] ?? id).join(", ")}</li>)}</ul> : <p className="text-sm text-subtle">No dependency is shared by several people yet.</p>}
        </Card>
        <Card title="Training material that could be reused">
          {i.reusableMaterials.map((r) => (
            <div key={r.id} className="text-sm">
              <p className="font-medium text-ink">{r.title}</p>
              <p className="text-subtle">{r.project ?? "Cross-project"} · {r.location}</p>
              {!r.copyAllowed && <p className="mt-1 flex items-center gap-1 text-xs text-amber-800"><Lock size={12} />Owned by the project: reuse by reference only, don&apos;t copy.</p>}
              <p className="mt-1 text-xs text-subtle">Projects without indexed material: {r.projectsWithoutMaterial.join(", ")}.</p>
            </div>
          ))}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">Over time</h2>
      <div className="grid gap-3 md:grid-cols-3">{i.metrics.map((m) => <MetricTile key={m.key} m={m} />)}</div>

      {simData && (
        <section className="mt-6 space-y-4" data-testid="simulated-history">
          <p className="rounded-lg bg-violet-50 px-4 py-2 text-sm text-violet-800 ring-1 ring-inset ring-violet-200">Simulated history: made-up cases, shown separately and never mixed with real data.</p>
          <div className="grid gap-3 md:grid-cols-2">{simData.metrics.map((m) => <MetricTile key={m.key} m={m} simulated />)}</div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BarPanel title="Days to readiness by project" unit="Simulated days from start to readiness" data={simData.byProject} employees={{}} empty="—" simulated />
            <BarPanel title="Top delay causes" unit="Simulated cases per cause" data={simData.causes} employees={{}} empty="—" simulated />
          </div>
        </section>
      )}
    </>
  );
}
