import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Plus, Search } from "lucide-react";
import { HEALTH_LABEL } from "@/lib/labels";
import { can } from "@/modules/permissions";
import { loadProjectSummaries } from "@/modules/projects/queries";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink, cn, EmptyState } from "@/components/ui/primitives";
import { ProjectCard } from "@/components/projects/ProjectParts";

const FILTERS = ["ALL", "CRITICAL", "AT_RISK", "ON_TRACK", "NOT_STARTED"] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ health?: string; q?: string; closed?: string }> }) {
  const scope = await getScope();
  if (!can(scope, "project.view")) redirect("/");
  const sp = await searchParams;
  const health = FILTERS.includes(sp.health as (typeof FILTERS)[number]) ? sp.health! : "ALL";
  const q = (sp.q ?? "").trim().toLowerCase();
  const all = await loadProjectSummaries(scope, undefined, { includeClosed: sp.closed === "1" });
  const shown = all.filter((p) => (health === "ALL" || p.health.status === health) && (!q || `${p.name} ${p.code ?? ""}`.toLowerCase().includes(q)));
  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === "ALL" ? all.length : all.filter((p) => p.health.status === f).length]));
  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(Object.entries({ health: health === "ALL" ? undefined : health, q: sp.q, closed: sp.closed, ...patch }).filter((e): e is [string, string] => Boolean(e[1])));
    return `/projects${params.size ? `?${params}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Projects" subtitle={scope.isPMO ? "Every project, its health and who runs it." : "Projects you work on."} breadcrumbs={[{ label: "Projects" }]}
        actions={can(scope, "project.manage") ? <ButtonLink href="/projects/new" variant="primary"><Plus size={15} />Create project</ButtonLink> : undefined} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by health" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link key={f} href={href({ health: f === "ALL" ? undefined : f })} aria-current={health === f ? "true" : undefined}
              className={cn("rounded-full border px-3 py-1 text-sm", health === f ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-muted hover:text-ink")}>
              {f === "ALL" ? "All" : HEALTH_LABEL[f]} <span className="tabular opacity-80">{counts[f]}</span>
            </Link>
          ))}
        </nav>
        <form className="flex items-center gap-2" action="/projects">
          {health !== "ALL" && <input type="hidden" name="health" value={health} />}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-subtle" aria-hidden />
            <input name="q" defaultValue={sp.q} aria-label="Search projects" placeholder="Search projects" className="field w-56 pl-9" />
          </div>
          <label className="flex items-center gap-1.5 text-sm text-muted"><input type="checkbox" name="closed" value="1" defaultChecked={sp.closed === "1"} className="accent-brand-600" />Include closed</label>
          <button className="sr-only" type="submit">Search</button>
        </form>
      </div>
      {shown.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
      ) : (
        <EmptyState icon={FolderKanban} title={all.length ? "No projects match these filters." : "There are no projects yet."}
          action={can(scope, "project.manage") && !all.length ? <ButtonLink href="/projects/new" variant="primary"><Plus size={15} />Create project</ButtonLink> : <ButtonLink href="/projects">Clear filters</ButtonLink>} />
      )}
    </>
  );
}
