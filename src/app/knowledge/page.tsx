import { Library, Lock, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { EmptyState, EvidenceChip } from "@/components/ui/badges";

export default async function KnowledgePage() {
  const resources = await prisma.knowledgeResource.findMany({ include: { project: true }, orderBy: { title: "asc" } });
  return (
    <div className="px-5 py-6 md:px-8">
      <header><p className="text-sm text-slate-500">Central onboarding index</p><h1 className="mt-1 text-2xl font-bold">Knowledge repository</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Reusable KT documents are indexed by reference. Project-owned documents are never copied into OnboardIQ — only their folder location is stored.</p>
      </header>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {resources.length ? resources.map((r) => (
          <article key={r.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex gap-3"><Library className="shrink-0 text-indigo-600" /><div>
              <h2 className="font-bold">{r.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{r.project?.name ?? "Cross-project"} · Owner: {r.owner}</p>
              <p className="mt-3 text-sm text-slate-600">{r.description}</p>
              <p className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-600"><MapPin size={13} />{r.location}</p>
              {!r.copyAllowed && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-800"><Lock size={13} />Reference only — must not be copied outside its location. No assessment questions can be generated from it.</p>}
              {r.sourceEvidenceId && <p className="mt-2 text-xs text-slate-500">Source: <EvidenceChip id={r.sourceEvidenceId} /></p>}
            </div></div>
          </article>
        )) : <EmptyState title="No knowledge resources indexed yet" />}
      </div>
    </div>
  );
}
