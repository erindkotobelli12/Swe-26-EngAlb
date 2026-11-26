import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { escalationsFor } from "@/modules/home/queries";
import { listImprovements } from "@/modules/improvements/service";
import { loadProjectSummaries } from "@/modules/projects/queries";
import { techLeadCandidates } from "@/modules/projects/service";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, DataTable, PersonChip, StatCard } from "@/components/ui/primitives";
import { ProjectCard } from "@/components/projects/ProjectParts";
import { ChooseTechLead } from "@/components/projects/ProjectActions";
import { ImprovementList } from "@/components/improvements/Improvements";

/** Additional Manager home: their projects, their Line Managers' teams, escalations and Technical Lead gaps. */
export default async function MyProjectsPage() {
  const [scope, session] = await Promise.all([getScope(), getSession()]);
  const mine = Object.entries(scope.projectRoles).filter(([, r]) => r.includes("ADDITIONAL_MANAGER")).map(([id]) => id);
  if (!mine.length) redirect("/");
  const [projects, escalations, improvements] = await Promise.all([loadProjectSummaries(scope, undefined, { projectIds: mine }), escalationsFor(scope), listImprovements(scope, undefined, { ownerPersonId: session.personId ?? "-" })]);
  const needTl = projects.filter((p) => !p.techLeads.length);
  const candidates = Object.fromEntries(await Promise.all(needTl.map(async (p) => [p.id, await techLeadCandidates(p.id)] as const)));
  const managers = projects.flatMap((p) => p.lineManagers.map((lm) => {
    const team = p.employees.filter((e) => e.lineManagerId === lm.id);
    return { key: `${p.id}-${lm.id}`, lm, project: p, size: team.length, blocked: team.filter((e) => e.blocked).length, overdue: team.reduce((n, e) => n + e.overdue, 0) };
  }));
  const people = projects.reduce((n, p) => n + p.employees.length, 0);
  const blocked = projects.reduce((n, p) => n + p.employees.filter((e) => e.blocked).length, 0);

  return (
    <>
      <PageHeader title="My projects" subtitle="Your projects, your Line Managers and their teams." breadcrumbs={[{ label: "My projects" }]} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="People on your projects" value={people} />
        <StatCard label="People blocked" value={blocked} tone={blocked ? "red" : "neutral"} />
        <StatCard label="Escalations waiting for you" value={escalations.reduce((n, g) => n + g.items.length, 0)} tone={escalations.length ? "amber" : "neutral"} href="/escalations" />
      </div>

      {needTl.length > 0 && (
        <Card title="Projects that need a Technical Lead" className="mb-6">
          <ul className="divide-y divide-line">
            {needTl.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-needs-tl={p.name}>
                <span><Link href={`/projects/${p.id}`} className="font-medium text-ink hover:underline">{p.name}</Link><span className="ml-2 text-sm text-subtle">{p.employees.length} {p.employees.length === 1 ? "person" : "people"}</span></span>
                <ChooseTechLead projectId={p.id} candidates={candidates[p.id] ?? []} currentId={null} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">Line Managers</h2>
          <DataTable rows={managers} rowKey={(m) => m.key} caption="Line Managers"
            empty={<Card><p className="text-sm text-subtle">No Line Managers assigned yet.</p></Card>}
            columns={[
              { key: "lm", header: "Line Manager", cell: (m) => <PersonChip name={m.lm.name} isSample={m.lm.isSample} href={`/people/${m.lm.id}`} role={m.project.name} /> },
              { key: "size", header: "Team", cell: (m) => <span className="tabular">{m.size}</span> },
              { key: "blocked", header: "Blocked", cell: (m) => <span className={m.blocked ? "tabular font-medium text-red-700" : "tabular text-subtle"}>{m.blocked}</span> },
              { key: "overdue", header: "Overdue", cell: (m) => <span className={m.overdue ? "tabular font-medium text-amber-700" : "tabular text-subtle"}>{m.overdue}</span> },
              { key: "team", header: "", cell: (m) => <Link href={`/team#${m.lm.id}`} className="text-sm font-medium text-brand-700 hover:underline">View team</Link> },
            ]} />
        </section>
        <Card title="Improvements you own">
          <ImprovementList items={improvements} emptyText="No improvements assigned to you." />
        </Card>
      </div>
    </>
  );
}
