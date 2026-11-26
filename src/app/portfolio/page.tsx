import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/clock";
import { parseJson } from "@/lib/json";
import type { Section } from "@/modules/briefing/select";
import { topBottlenecks } from "@/modules/home/queries";
import { improvementOwners, listImprovements } from "@/modules/improvements/service";
import { loadProjectSummaries } from "@/modules/projects/queries";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink, Card, DataTable, StatCard } from "@/components/ui/primitives";
import { HealthPill, PhaseBar } from "@/components/projects/ProjectParts";
import { GenerateBriefingButton } from "@/components/briefing/BriefingControls";
import { CreateImprovementDialog, ImprovementList, NewImprovementButton } from "@/components/improvements/Improvements";

/** PMO home: project health, the latest portfolio briefing, cross-project bottlenecks and improvements. No case-level to-dos. */
export default async function PortfolioPage() {
  const [scope, session] = await Promise.all([getScope(), getSession()]);
  if (!scope.isPMO) redirect("/");
  const [projects, briefing, bottlenecks, improvements, owners] = await Promise.all([
    loadProjectSummaries(scope),
    prisma.briefing.findFirst({ where: { role: "PMO", scopeKey: "ALL", generatedById: session.userId }, orderBy: { generatedAt: "desc" } }),
    topBottlenecks(scope),
    listImprovements(scope),
    improvementOwners(),
  ]);
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));
  const count = (s: string) => projects.filter((p) => p.health.status === s).length;
  const sections = briefing ? parseJson<Section[]>(briefing.sectionsJson, []) : [];
  const urgent = sections.find((s) => s.key === "urgent")?.statements ?? [];
  const active = improvements.filter((i) => ["PROPOSED", "APPROVED", "IN_PROGRESS"].includes(i.status));

  return (
    <>
      <PageHeader title="Portfolio" subtitle="How every project is doing, and what to improve." breadcrumbs={[{ label: "Portfolio" }]}
        actions={<><ButtonLink href="/projects/new"><Plus size={15} />Create project</ButtonLink><NewImprovementButton owners={owners} projects={projectOptions} /></>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active projects" value={projects.length} href="/projects" />
        <StatCard label="Critical" value={count("CRITICAL")} tone={count("CRITICAL") ? "red" : "neutral"} href="/projects?health=CRITICAL" />
        <StatCard label="At risk" value={count("AT_RISK")} tone={count("AT_RISK") ? "amber" : "neutral"} href="/projects?health=AT_RISK" />
        <StatCard label="On track" value={count("ON_TRACK")} tone="green" href="/projects?health=ON_TRACK" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold text-ink">Project health</h2><Link href="/projects" className="text-sm font-medium text-brand-700 hover:underline">All projects</Link></div>
            <DataTable rows={projects} rowKey={(p) => p.id} caption="Project health"
              columns={[
                { key: "name", header: "Project", cell: (p) => <Link href={`/projects/${p.id}`} className="font-medium text-ink hover:underline" data-project-row={p.name}>{p.name}</Link> },
                { key: "health", header: "Health", cell: (p) => <HealthPill status={p.health.status} /> },
                { key: "reason", header: "Main reason", cell: (p) => <span className="text-muted">{p.health.headline}</span>, className: "max-w-[260px]" },
                { key: "people", header: "People by phase", cell: (p) => <div className="w-44"><PhaseBar byPhase={p.byPhase} /></div> },
              ]} />
          </section>

          <Card title="Top bottlenecks across projects" subtitle="Counted from the records. Turn one into an improvement with an owner.">
            {bottlenecks.length ? (
              <ul className="divide-y divide-line" data-testid="bottlenecks">
                {bottlenecks.map((b) => (
                  <li key={b.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{b.title}</p>
                      <p className="text-xs text-subtle"><span className="tabular">{b.value}</span> {b.value === 1 ? "case" : "cases"}: {b.cases.join(", ")}</p>
                    </div>
                    <CreateImprovementDialog owners={owners} projects={projectOptions} source="INSIGHT"
                      prefill={{ title: `Reduce: ${b.title.toLowerCase()}`, description: `${b.title} affects ${b.value} ${b.value === 1 ? "case" : "cases"} (${b.cases.join(", ")}). Agree the change that removes this bottleneck and who drives it.`, refs: [`figure:${b.key}`, ...b.caseIds.map((id) => `case:${id}`)] }} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-subtle">No repeated bottlenecks right now.</p>}
            <p className="mt-3 text-xs"><Link href="/insights" className="font-medium text-brand-700 hover:underline">See all insights <ArrowRight size={12} className="inline" /></Link></p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Portfolio briefing" subtitle={briefing ? `Generated ${formatDate(briefing.generatedAt)}` : "Not generated yet"}>
            {briefing ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-subtle">Most urgent</p>
                <ul className="mt-2 space-y-1.5 text-sm text-body">{urgent.slice(0, 4).map((s, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />{s.text}</li>)}</ul>
                {!urgent.length && <p className="text-sm text-subtle">Nothing urgent.</p>}
                <div className="mt-4 flex flex-wrap items-center gap-2"><ButtonLink href="/briefing" size="sm">Open briefing</ButtonLink><GenerateBriefingButton role="PMO" label="Regenerate" variant="secondary" /></div>
              </>
            ) : <GenerateBriefingButton role="PMO" />}
          </Card>
          <Card title="Improvements" subtitle={`${active.length} open`} actions={<Link href="/insights#improvements" className="text-sm font-medium text-brand-700 hover:underline">All</Link>}>
            <ImprovementList items={active.slice(0, 5)} emptyText="No improvements in progress." />
          </Card>
        </div>
      </div>
    </>
  );
}
