import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SEVERITY_RANK } from "@/domain/types";
import { FINDING_CATEGORY_LABEL, SEVERITY_LABEL, humanize } from "@/lib/labels";
import { loadPortfolio } from "@/modules/case/portfolio";
import FindingCard from "@/components/case/FindingCard";
import { FindingActions, InvestigateAllButton } from "@/components/case/FindingActions";
import { can, visibleEmployeeIds } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn, EmptyState } from "@/components/ui/primitives";
import { Search } from "lucide-react";

/** Cross-case findings for the cases in the user's scope. Rule findings are deterministic; AI findings await a decision. */
export default async function InvestigationsPage({ searchParams }: { searchParams: Promise<{ category?: string; severity?: string }> }) {
  const session = await getSession();
  if (session.role === "EMPLOYEE") redirect("/");
  const scope = await getScope();
  const { category, severity } = await searchParams;
  const portfolio = await loadPortfolio(undefined, visibleEmployeeIds(scope));
  const rows = portfolio
    .flatMap((c) => [...c.open, ...c.proposed].map((f) => ({ f, c })))
    .filter(({ f }) => (!category || f.category === category) && (!severity || f.severity === severity))
    .sort((a, b) => SEVERITY_RANK[b.f.severity] - SEVERITY_RANK[a.f.severity] || a.c.state.employee.name.localeCompare(b.c.state.employee.name));
  const categories = [...new Set(portfolio.flatMap((c) => [...c.open, ...c.proposed].map((f) => f.category)))].sort();
  const link = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ category, severity, ...q }).filter((e): e is [string, string] => Boolean(e[1])));
    return `/investigations${p.size ? `?${p}` : ""}`;
  };
  const chip = (active: boolean) => cn("rounded-full border px-3 py-1 text-sm", active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-muted hover:text-ink");
  const investigable = portfolio.filter((c) => c.open.length && can(scope, "ai.run", { employeeId: c.state.employee.id }));

  return (
    <>
      <PageHeader title="Investigations" subtitle="Problems found in the records of the people you work with. Each one keeps its sources." breadcrumbs={[{ label: "Investigations" }]}
        actions={investigable.length ? <InvestigateAllButton employees={investigable.map((c) => ({ id: c.state.employee.id, name: c.state.employee.name }))} /> : undefined} />
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <Link href={link({ category: undefined })} className={chip(!category)}>All types</Link>
        {categories.map((c) => <Link key={c} href={link({ category: c })} className={chip(category === c)}>{FINDING_CATEGORY_LABEL[c] ?? humanize(c)}</Link>)}
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => <Link key={s} href={link({ severity: severity === s ? undefined : s })} className={chip(severity === s)}>{SEVERITY_LABEL[s]}</Link>)}
      </div>
      <div className="space-y-4">
        {rows.length ? rows.map(({ f, c }) => (
          <FindingCard key={f.id} finding={f} state={c.state} showCase
            actions={can(scope, "finding.decide", { employeeId: c.state.employee.id, findingCategory: f.category }) ? <FindingActions findingId={f.id} status={f.status} evidenceIds={f.evidenceIds} caseEvidence={c.state.evidence.filter((e) => e.sourceType !== "TRACKER").map((e) => ({ id: e.id, title: e.title }))} /> : undefined} />
        )) : <EmptyState icon={Search} title={category || severity ? "No findings match these filters." : "No open findings for the people you work with."} />}
      </div>
    </>
  );
}
