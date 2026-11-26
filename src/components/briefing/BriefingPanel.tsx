import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/clock";
import { parseJson } from "@/lib/json";
import type { Section } from "@/modules/briefing/select";
import { AiChip, SourceChip } from "@/components/ui/provenance";
import { buttonClass, EmptyState, Meta } from "@/components/ui/primitives";
import { GenerateBriefingButton, PrintButton } from "./BriefingControls";

type BriefingRow = { id: string; role: string; generatedAt: string; generatedBy: string; evaluationDate: string; sectionsJson: string; narrativeSource: string; aiError: string | null; rejectedCount: number; aiRunId: string | null };

/**
 * A stored briefing, shown calmly: plain statements with small source chips. Every statement keeps its references
 * (findings open the case, evidence opens the verbatim source); AI wording is marked with an AI chip.
 */
export async function BriefingView({ briefing, title }: { briefing: BriefingRow; title?: string }) {
  const sections = parseJson<Section[]>(briefing.sectionsJson, []);
  const refs = sections.flatMap((s) => s.statements.flatMap((x) => x.refs));
  const findingIds = refs.filter((r) => r.startsWith("finding:")).map((r) => r.slice(8));
  const evidenceIds = refs.filter((r) => r.startsWith("evidence:")).map((r) => r.slice(9));
  const [findings, evidence, run] = await Promise.all([
    prisma.finding.findMany({ where: { id: { in: findingIds } }, select: { id: true, title: true, case: { select: { employeeId: true, employee: { select: { name: true } } } } } }),
    prisma.evidence.findMany({ where: { id: { in: evidenceIds } }, select: { id: true, title: true } }),
    briefing.aiRunId ? prisma.aIRun.findUnique({ where: { id: briefing.aiRunId }, select: { model: true, createdAt: true } }) : Promise.resolve(null),
  ]);
  const findingOf = new Map(findings.map((f) => [f.id, f]));
  const evidenceTitle = new Map(evidence.map((e) => [e.id, e.title]));

  return (
    <article className="rounded-card border border-line bg-surface p-6 shadow-soft" data-testid="briefing">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
          <Meta>Generated {formatDate(briefing.generatedAt)} by {briefing.generatedBy}</Meta>
        </div>
        <div className="flex items-center gap-1">
          {briefing.narrativeSource === "AI" && <AiChip model={run?.model} at={run?.createdAt} note="Wording by AI; every fact comes from referenced records" />}
          <a href={`/api/briefing/${briefing.id}/markdown`} className={`no-print ${buttonClass("ghost", "sm")}`}><Download size={14} />Markdown</a>
          <PrintButton />
        </div>
      </div>
      {briefing.aiError && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">The AI wording wasn&apos;t available, so the rule-based statements are shown.</p>}
      <div className="mt-2 divide-y divide-line">
        {sections.map((s) => (
          <section key={s.key} className="py-4">
            <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
            {s.statements.length ? (
              <ul className="mt-2 space-y-2">
                {s.statements.map((x, i) => (
                  <li key={i} className="flex gap-2 text-sm text-body" data-statement>
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                    <span>
                      {x.text}
                      {x.refs.map((r) => {
                        const [type, id] = [r.slice(0, r.indexOf(":")), r.slice(r.indexOf(":") + 1)];
                        if (type === "evidence") return <SourceChip key={r} id={id} label={evidenceTitle.get(id) ?? "Source"} />;
                        if (type === "finding") {
                          const f = findingOf.get(id);
                          return f ? <Link key={r} href={`/employees/${f.case.employeeId}?tab=investigation`} className="mx-0.5 inline-flex items-center rounded-md border border-line px-1.5 py-px align-middle text-[11px] font-medium text-muted hover:border-brand-200 hover:text-brand-700">{f.case.employee.name}</Link> : null;
                        }
                        if (type === "action") return <Link key={r} href="/follow-ups" className="mx-0.5 inline-flex items-center rounded-md border border-line px-1.5 py-px align-middle text-[11px] font-medium text-muted hover:text-brand-700">Follow-up</Link>;
                        return null;
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-subtle">{s.note ?? "Nothing to report."}</p>}
          </section>
        ))}
      </div>
      <p className="border-t border-line pt-3 text-xs text-subtle">Facts come from stored records. No briefing changes any record.</p>
    </article>
  );
}

/** Latest briefing for a role/author/scope with a generate button, or an empty state. */
export async function BriefingPanel({ role, userId, projectId, roleLabel }: { role: string; userId: string; projectId?: string | null; roleLabel: string }) {
  const latest = await prisma.briefing.findFirst({ where: { role, generatedById: userId, scopeKey: projectId ? `project:${projectId}` : "ALL" }, orderBy: { generatedAt: "desc" } });
  if (!latest) {
    return (
      <EmptyState icon={FileText} title={`No ${roleLabel} briefing yet${projectId ? " for this project" : ""}`} action={<GenerateBriefingButton role={role} projectId={projectId} />}>
        A briefing summarises what needs attention, with a source for every statement.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><GenerateBriefingButton role={role} projectId={projectId} label="Generate a new briefing" variant="secondary" /></div>
      <BriefingView briefing={latest} />
    </div>
  );
}
