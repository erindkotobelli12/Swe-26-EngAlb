import Link from "next/link";
import { redirect } from "next/navigation";
import { ListChecks } from "lucide-react";
import { plural } from "@/lib/labels";
import { loadRequirementMatrix, loadTechLeadProjects } from "@/modules/requirements/queries";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn, EmptyState, SampleTag } from "@/components/ui/primitives";
import { RequirementsSection } from "@/components/requirements/Matrix";

/** Technical Lead: onboarding requirements for each of their projects, with the progress matrix. */
export default async function RequirementsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const scope = await getScope();
  const projects = await loadTechLeadProjects(scope);
  if (!projects.length) {
    if (!Object.values(scope.projectRoles).some((r) => r.includes("TECH_LEAD"))) redirect("/");
    return <EmptyState icon={ListChecks} title="You aren't the Technical Lead of a project yet." />;
  }
  const { project } = await searchParams;
  const current = projects.find((p) => p.id === project) ?? projects[0];
  const m = await loadRequirementMatrix(current.id, scope);
  return (
    <>
      <PageHeader title="Onboarding requirements" subtitle="Define what people need on your projects. Confirmed skills tick requirements off automatically." breadcrumbs={[{ label: "Requirements" }, { label: current.name }]} />
      {projects.length > 1 && (
        <nav aria-label="Projects" className="mb-6 flex flex-wrap gap-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/requirements?project=${p.id}`} aria-current={p.id === current.id ? "page" : undefined}
              className={cn("rounded-lg border px-3 py-2 text-sm", p.id === current.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-surface text-muted hover:text-ink")}>
              <span className="font-medium">{p.name}</span>{p.isSample && <SampleTag className="ml-1.5" />}
              <span className="ml-2 text-xs">{plural(p.requirements, "requirement")} · {plural(p.employees, "person", "people")}</span>
            </Link>
          ))}
        </nav>
      )}
      {m && <RequirementsSection m={m} />}
    </>
  );
}
