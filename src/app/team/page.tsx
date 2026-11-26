import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { loadProjectSummaries } from "@/modules/projects/queries";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, EmptyState, PersonChip, PhaseStepper, StatusPill, toneFor } from "@/components/ui/primitives";
import { SEVERITY_LABEL, label } from "@/lib/labels";

/** Additional Manager: each Line Manager on their projects with their team. */
export default async function TeamPage() {
  const scope = await getScope();
  const mine = Object.entries(scope.projectRoles).filter(([, r]) => r.includes("ADDITIONAL_MANAGER")).map(([id]) => id);
  if (!mine.length) redirect("/");
  const projects = await loadProjectSummaries(scope, undefined, { projectIds: mine });
  const groups = projects.flatMap((p) => p.lineManagers.map((lm) => ({ p, lm, team: p.employees.filter((e) => e.lineManagerId === lm.id) })));
  return (
    <>
      <PageHeader title="Team" subtitle="Line Managers on your projects and the people they look after." breadcrumbs={[{ label: "Team" }]} />
      {groups.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(({ p, lm, team }) => (
            <Card key={`${p.id}-${lm.id}`} id={lm.id} title={<PersonChip name={lm.name} isSample={lm.isSample} role={`Line Manager · ${p.name}`} href={`/people/${lm.id}`} size={30} />}>
              {team.length ? (
                <ul className="divide-y divide-line">
                  {team.map((e) => (
                    <li key={e.personId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="min-w-0">
                        <Link href={e.employeeId ? `/employees/${e.employeeId}` : "#"} className="text-sm font-medium text-ink hover:underline">{e.name}</Link>
                        <span className="block text-xs text-subtle">{e.topFinding ? e.topFinding.title : "No open findings"} · {label("movement", e.movement)}</span>
                      </span>
                      <span className="flex items-center gap-2">{e.topFinding && <StatusPill tone={toneFor.severity(e.topFinding.severity)}>{SEVERITY_LABEL[e.topFinding.severity]}</StatusPill>}<PhaseStepper phase={e.phase} compact /></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-subtle">No employees yet.</p>}
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={Users} title="No Line Managers on your projects yet." />}
    </>
  );
}
