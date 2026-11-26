import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SEVERITY_RANK } from "@/domain/types";
import { loadPortfolio } from "@/modules/case/portfolio";
import { TYPE_META, type FindingType } from "@/modules/detective/types";
import FindingCard from "@/components/case/FindingCard";
import { EmptyState, ProvenanceBadge } from "@/components/ui/badges";

export default async function InvestigationsPage({ searchParams }: { searchParams: Promise<{ category?: string; severity?: string }> }) {
  const session = await getSession();
  if (session.role === "EMPLOYEE" || session.role === "LINE_MANAGER") redirect("/dashboard");
  const { category, severity } = await searchParams;
  const portfolio = await loadPortfolio();
  const rows = portfolio
    .flatMap((c) => [...c.open, ...c.proposed].map((f) => ({ f, c })))
    .filter(({ f }) => (!category || f.category === category) && (!severity || f.severity === severity))
    .sort((a, b) => SEVERITY_RANK[b.f.severity] - SEVERITY_RANK[a.f.severity] || a.c.state.employee.name.localeCompare(b.c.state.employee.name));
  const categories = [...new Set(portfolio.flatMap((c) => [...c.open, ...c.proposed].map((f) => f.category)))].sort();
  const link = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ category, severity, ...q }).filter((e): e is [string, string] => Boolean(e[1])));
    return `/investigations${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="px-5 py-6 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Cross-case findings queue</p>
        <h1 className="mt-1 text-2xl font-bold">Investigations</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Deterministic detectors run on every recompute. The AI Detective (per case) confirms semantic contradictions and proposes root-cause hypotheses — always as proposals with verified excerpts.</p>
      </header>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-slate-500">Category:</span>
        <Link href={link({ category: undefined })} className={`rounded-full px-3 py-1 ${!category ? "bg-indigo-600 text-white" : "bg-white border"}`}>All</Link>
        {categories.map((c) => <Link key={c} href={link({ category: c })} className={`rounded-full px-3 py-1 ${category === c ? "bg-indigo-600 text-white" : "bg-white border"}`}>{c.toLowerCase().replaceAll("_", " ")}</Link>)}
        <span className="ml-3 font-bold text-slate-500">Severity:</span>
        {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => <Link key={s} href={link({ severity: severity === s ? undefined : s })} className={`rounded-full px-3 py-1 ${severity === s ? "bg-indigo-600 text-white" : "bg-white border"}`}>{s.toLowerCase()}</Link>)}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><ProvenanceBadge state="actual" /> rule findings · <ProvenanceBadge state="proposed" /> AI findings awaiting review · {rows.length} shown</p>
      <div className="mt-4 space-y-4">
        {rows.length ? rows.map(({ f, c }) => <FindingCard key={f.id} finding={f} state={c.state} showCase />) : <EmptyState title="No findings match these filters" />}
      </div>
      <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-bold text-slate-600">Detector catalogue</summary>
        <ul className="mt-3 grid gap-1 md:grid-cols-2">{(Object.keys(TYPE_META) as FindingType[]).filter((t) => t !== "OTHER").map((t) => <li key={t}><b>{TYPE_META[t].label}</b> — base severity {TYPE_META[t].severity.toLowerCase()}, category {TYPE_META[t].category.toLowerCase().replaceAll("_", " ")}</li>)}</ul>
      </details>
    </div>
  );
}
