import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";
import { AUTHORITY_LABEL, authorityFor, domainForField } from "@/domain/authority";
import { roleLabel, type CaseState, type EvidenceItem, type FindingItem } from "@/domain/types";
import { formatDate } from "@/lib/clock";
import { parseJson } from "@/lib/json";
import type { AIReview } from "@/modules/detective/investigate";
import { EvidenceChip, FactOrAssumption, SeverityBadge } from "@/components/ui/badges";
import { Drawer } from "@/components/ui/overlays";
import { AiChip } from "@/components/ui/provenance";
import { buttonClass, InternalId } from "@/components/ui/primitives";
import { FINDING_CATEGORY_LABEL, FINDING_STATUS_LABEL, humanize } from "@/lib/labels";

/** Renders verbatim source text with every cited excerpt highlighted. */
export function Highlighted({ content, excerpts }: { content: string; excerpts: string[] }) {
  const ranges = excerpts
    .map((x) => ({ start: content.indexOf(x), len: x.length }))
    .filter((r) => r.start >= 0)
    .sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start < cursor) return;
    parts.push(content.slice(cursor, r.start));
    parts.push(<mark key={i} className="rounded bg-amber-100 px-0.5">{content.slice(r.start, r.start + r.len)}</mark>);
    cursor = r.start + r.len;
  });
  parts.push(content.slice(cursor));
  return <>{parts}</>;
}

/** Side-by-side viewer: each source with sender, role, authority, date and the highlighted verbatim excerpt. */
export function ConflictViewer({ finding, evidence }: { finding: FindingItem; evidence: EvidenceItem[] }) {
  const sources = finding.facts.map((f) => ({ fact: f, ev: evidence.find((e) => e.id === f.evidenceId) })).filter((x): x is { fact: typeof x.fact; ev: EvidenceItem } => Boolean(x.ev));
  const bySource = new Map<string, typeof sources>();
  for (const s of sources) bySource.set(s.ev.id, [...(bySource.get(s.ev.id) ?? []), s]);
  const domain = domainForField(finding.fingerprint?.split(":")[1] ?? "readiness.reported");
  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="conflict-viewer">
      {[...bySource.entries()].map(([id, items]) => {
        const ev = items[0].ev;
        const authority = authorityFor(ev.senderRole, domain);
        return (
          <article key={id} className="rounded-lg border border-line bg-canvas/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted">{ev.title} · {ev.senderName ?? `${roleLabel(ev.senderRole)} (name not recorded)`} · {formatDate(ev.timestamp)}</p>
              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${authority === "AUTHORITATIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-body"}`}>{AUTHORITY_LABEL[authority]}</span>
            </div>
            <p className="mt-1 text-xs text-subtle">Role: {roleLabel(ev.senderRole)}</p>
            <p className="mt-2 font-semibold">{items.map((i) => i.fact.statement).join(" ")}</p>
            <blockquote className="mt-2 border-l-4 border-amber-300 pl-3 text-sm leading-6 text-body"><Highlighted content={ev.content} excerpts={items.map((i) => i.fact.excerpt)} /></blockquote>
          </article>
        );
      })}
    </div>
  );
}

/**
 * A finding, calm by default: what is wrong, how serious, what to do next. Facts (with verbatim excerpts) and
 * assumptions, the AI review and internal IDs are one click away in the details drawer.
 */
export default function FindingCard({ finding, state, actions, showCase }: { finding: FindingItem; state: CaseState; actions?: React.ReactNode; showCase?: boolean }) {
  const evidence = [...state.evidence, ...state.projectEvidence];
  const closed = finding.status === "RESOLVED" || finding.status === "DISMISSED";
  const review = parseJson<AIReview | null>(finding.aiAnalysis, null);
  return (
    <article id={finding.id} data-finding-type={finding.type} className={`rounded-card border bg-surface p-5 shadow-soft ${finding.status === "PROPOSED" ? "border-dashed border-violet-300" : "border-line"} ${closed ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            {finding.origin === "AI" && <AiChip note={finding.status === "PROPOSED" ? "Needs your decision" : "Accepted by a person"} />}
            <span className="text-xs text-subtle">{FINDING_CATEGORY_LABEL[finding.category] ?? humanize(finding.category)}{finding.status !== "OPEN" ? ` · ${FINDING_STATUS_LABEL[finding.status]}` : ""}</span>
          </div>
          <h3 className="mt-2 font-semibold text-ink">{showCase && <Link href={`/employees/${state.employee.id}?tab=investigation#${finding.id}`} className="text-brand-700 hover:underline">{state.employee.name}: </Link>}{finding.title}</h3>
          <p className="mt-1 text-sm text-muted">{finding.description}</p>
        </div>
        {actions}
      </div>

      {finding.category === "CONFLICT" && finding.facts.length > 1 && <div className="mt-4"><ConflictViewer finding={finding} evidence={evidence} /></div>}

      {finding.recommendedActions.length > 0 && !closed && (
        <ul className="mt-3 space-y-1.5">
          {finding.recommendedActions.slice(0, 2).map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm"><ArrowRight size={15} className="mt-0.5 shrink-0 text-brand-500" /><span className="text-body">{a.action} <span className="text-xs text-subtle">· {roleLabel(a.ownerRole)}</span></span></li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-subtle">
        <span>Owner: {finding.ownerRole ? roleLabel(finding.ownerRole) : <span className="text-red-700">not recorded</span>}{finding.firstDetectedAt ? ` · first seen ${formatDate(finding.firstDetectedAt)}` : ""}</span>
        <Drawer title={finding.title} description={`${state.employee.name} · ${FINDING_CATEGORY_LABEL[finding.category] ?? humanize(finding.category)}`}
          trigger={<button type="button" className={buttonClass("ghost", "sm")} data-testid="finding-details">Facts and sources</button>}>
          <section>
            <h4 className="text-sm font-semibold text-ink">Facts</h4>
            <p className="text-xs text-subtle">Each quoted word for word from a source.</p>
            <div className="mt-2 space-y-2">
              {finding.facts.length ? finding.facts.map((f, i) => <FactOrAssumption key={i} kind="fact" statement={f.statement} evidenceId={f.evidenceId} excerpt={f.excerpt} />) : <p className="text-sm text-subtle">No source supports this directly; it is based on a missing record.</p>}
            </div>
          </section>
          <section className="mt-6">
            <h4 className="text-sm font-semibold text-ink">Assumptions</h4>
            <p className="text-xs text-subtle">Hypotheses that still need checking.</p>
            <div className="mt-2 space-y-2">
              {finding.assumptions.map((a, i) => <FactOrAssumption key={`a${i}`} kind="assumption" statement={a.statement} basis={a.basis} />)}
              {finding.rootCauses.map((r, i) => <FactOrAssumption key={`r${i}`} kind="assumption" statement={`Possible cause: ${r.hypothesis}`} basis={r.supportingEvidenceIds.length ? `${r.supportingEvidenceIds.length} related source(s)` : "No supporting source cited"} />)}
              {!finding.assumptions.length && !finding.rootCauses.length && <p className="text-sm text-subtle">None recorded.</p>}
            </div>
          </section>
          {review && (
            <section className="mt-6" data-testid="ai-review">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">Detective review <AiChip model={review.model} at={review.at} note="A person decides" /></h4>
              <p className="mt-1 text-sm text-body">{review.verdict === "CONFIRMED" ? "The AI agrees this is a real issue." : review.verdict === "NOT_AN_ISSUE" ? "The AI suggests this may not be an issue — a person must decide." : "The AI is unsure."} {review.explanation}</p>
              {review.recommendedActions.length > 0 && <ul className="mt-2 space-y-1">{review.recommendedActions.map((a, i) => <li key={i} className="flex items-start gap-2 text-sm"><ArrowRight size={14} className="mt-0.5 shrink-0 text-violet-500" /><span>{a.action} <span className="inline-flex items-center gap-1 text-xs text-subtle"><UserRound size={11} />{roleLabel(a.ownerRole)}</span></span></li>)}</ul>}
            </section>
          )}
          {finding.recommendedActions.length > 2 && (
            <section className="mt-6">
              <h4 className="text-sm font-semibold text-ink">All recommended actions</h4>
              <ul className="mt-2 space-y-1.5">{finding.recommendedActions.map((a, i) => <li key={i} className="text-sm text-body">{a.action} <span className="text-xs text-subtle">· {roleLabel(a.ownerRole)} — {a.rationale}</span></li>)}</ul>
            </section>
          )}
          {closed && <p className="mt-6 text-sm text-body">{finding.status === "DISMISSED" ? "Dismissed" : "Resolved"} by {finding.resolvedBy ?? "unknown"}{finding.resolutionType ? ` (${humanize(finding.resolutionType).toLowerCase()})` : ""}{finding.resolution ? `: ${finding.resolution}` : ""}</p>}
          <div className="mt-6 border-t border-line pt-3 text-xs text-subtle">
            <p>Sources: {finding.evidenceIds.length ? finding.evidenceIds.map((id) => <EvidenceChip key={id} id={id} label={evidence.find((e) => e.id === id)?.title} />) : "none"}</p>
            <p className="mt-1">Finding <InternalId>{finding.id}</InternalId>{finding.aiRunId && <> · AI run <Link href={`/ai-activity#${finding.aiRunId}`} className="hover:underline"><InternalId>{finding.aiRunId.slice(-8)}</InternalId></Link></>}</p>
          </div>
        </Drawer>
      </div>
    </article>
  );
}
