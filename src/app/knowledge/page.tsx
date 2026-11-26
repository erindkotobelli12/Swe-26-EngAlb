import { PageHeader } from "@/components/ui/PageHeader";
import { Library, Lock, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { EmptyState, EvidenceChip } from "@/components/ui/badges";

export default async function KnowledgePage() {
  const resources = await prisma.knowledgeResource.findMany({ include: { project: true }, orderBy: { title: "asc" } });
  return (
    <div className="">
      <PageHeader title="Knowledge" subtitle="Reusable onboarding documents, indexed by reference. Project-owned documents are never copied here — only their location." breadcrumbs={[{ label: "Knowledge" }]} />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {resources.length ? resources.map((r) => (
          <article key={r.id} className="rounded-card border border-line bg-surface shadow-soft p-5">
            <div className="flex gap-3"><Library className="shrink-0 text-brand-700" /><div>
              <h2 className="font-semibold">{r.title}</h2>
              <p className="mt-1 text-xs text-subtle">{r.project?.name ?? "Cross-project"} · Owner: {r.owner}</p>
              <p className="mt-3 text-sm text-muted">{r.description}</p>
              <p className="mt-3 flex items-center gap-1 text-xs font-medium text-muted"><MapPin size={13} />{r.location}</p>
              {!r.copyAllowed && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-800"><Lock size={13} />Reference only — must not be copied outside its location. No assessment questions can be generated from it.</p>}
              {r.sourceEvidenceId && <p className="mt-2 text-xs text-subtle">Source: <EvidenceChip id={r.sourceEvidenceId} /></p>}
            </div></div>
          </article>
        )) : <EmptyState title="No knowledge resources indexed yet" />}
      </div>
    </div>
  );
}
