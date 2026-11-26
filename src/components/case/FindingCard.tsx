import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";
import { AUTHORITY_LABEL, authorityFor, domainForField } from "@/domain/authority";
import { roleLabel, type CaseState, type EvidenceItem, type FindingItem } from "@/domain/types";
import { formatDate } from "@/lib/clock";
import { parseJson } from "@/lib/json";
import type { AIReview } from "@/modules/detective/investigate";
import { EvidenceChip, FactOrAssumption, OriginBadge, ProvenanceBadge, SeverityBadge } from "@/components/ui/badges";

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
    parts.push(<mark key={i} className="rounded bg-yellow-200 px-0.5">{content.slice(r.start, r.start + r.len)}</mark>);
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
          <article key={id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-600">{id} · {ev.senderName ?? `${roleLabel(ev.senderRole)} (name not recorded)`} · {formatDate(ev.timestamp)}</p>
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${authority === "AUTHORITATIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{AUTHORITY_LABEL[authority]}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Role: {roleLabel(ev.senderRole)}</p>
            <p className="mt-2 font-semibold">{items.map((i) => i.fact.statement).join(" ")}</p>
            <blockquote className="mt-2 border-l-4 border-yellow-300 pl-3 text-sm leading-6 text-slate-700"><Highlighted content={ev.content} excerpts={items.map((i) => i.fact.excerpt)} /></blockquote>
          </article>
        );
      })}
    </div>
  );
}

export default function FindingCard({ finding, state, actions, showCase }: { finding: FindingItem; state: CaseState; actions?: React.ReactNode; showCase?: boolean }) {
  const evidence = [...state.evidence, ...state.projectEvidence];
  const closed = finding.status === "RESOLVED" || finding.status === "DISMISSED";
  const review = parseJson<AIReview | null>(finding.aiAnalysis, null);
  return (
    <article id={finding.id} data-finding-type={finding.type} className={`rounded-xl border bg-white p-5 ${finding.status === "PROPOSED" ? "border-dashed border-amber-300" : closed ? "border-slate-200 opacity-80" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <OriginBadge origin={finding.origin} />
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">{finding.category.toLowerCase().replaceAll("_", " ")}</span>
            {finding.status === "PROPOSED" ? <ProvenanceBadge state="proposed" /> : <span className="text-[11px] font-bold uppercase text-slate-400">{finding.status.toLowerCase()}</span>}
          </div>
          <h3 className="mt-2 font-bold">{showCase && <Link href={`/employees/${state.employee.id}?tab=investigation#${finding.id}`} className="text-indigo-700 hover:underline">{state.employee.name}: </Link>}{finding.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{finding.description}</p>
        </div>
        {actions}
      </div>

      {finding.category === "CONFLICT" && finding.facts.length > 1 && <div className="mt-4"><ConflictViewer finding={finding} evidence={evidence} /></div>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase text-emerald-700">Confirmed facts</p>
          <div className="mt-2 space-y-2">
            {finding.facts.length ? finding.facts.map((f, i) => <FactOrAssumption key={i} kind="fact" statement={f.statement} evidenceId={f.evidenceId} excerpt={f.excerpt} />) : <p className="text-sm text-slate-500">No verbatim source supports this finding; it is based on a missing record.</p>}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-amber-700">Assumptions and hypotheses</p>
          <div className="mt-2 space-y-2">
            {finding.assumptions.map((a, i) => <FactOrAssumption key={`a${i}`} kind="assumption" statement={a.statement} basis={a.basis} />)}
            {finding.rootCauses.map((r, i) => <FactOrAssumption key={`r${i}`} kind="assumption" statement={`Root-cause hypothesis: ${r.hypothesis}`} basis={r.supportingEvidenceIds.length ? `Related sources: ${r.supportingEvidenceIds.join(", ")}` : "No supporting source cited"} />)}
            {!finding.assumptions.length && !finding.rootCauses.length && <p className="text-sm text-slate-500">None recorded{finding.origin === "RULE" && !review ? ". Run the AI Detective for root-cause hypotheses." : "."}</p>}
          </div>
        </div>
      </div>

      {review && (
        <div className="mt-4 rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-3" data-testid="ai-review">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <OriginBadge origin="AI" /><ProvenanceBadge state="proposed" />
            <b className="text-violet-900">Detective review: {review.verdict === "CONFIRMED" ? "confirmed" : review.verdict === "NOT_AN_ISSUE" ? "suggests this is not an issue — a human must decide" : "unsure"}</b>
            <Link href={`/ai-activity#${review.aiRunId}`} className="text-violet-700 hover:underline">{review.model} · run {review.aiRunId.slice(-6)} · {new Date(review.at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</Link>
          </div>
          <p className="mt-2 text-sm text-slate-700">{review.explanation}</p>
          {review.recommendedActions.length > 0 && (
            <ul className="mt-2 space-y-1">{review.recommendedActions.map((a, i) => <li key={i} className="flex items-start gap-2 text-sm"><ArrowRight size={14} className="mt-0.5 shrink-0 text-violet-500" /><span>{a.action} <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 text-xs font-semibold text-violet-800"><UserRound size={11} />{roleLabel(a.ownerRole)}</span></span></li>)}</ul>
          )}
        </div>
      )}

      {finding.recommendedActions.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-slate-500">Recommended next actions</p>
          <ul className="mt-2 space-y-1.5">
            {finding.recommendedActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm"><ArrowRight size={15} className="mt-0.5 shrink-0 text-indigo-500" /><span>{a.action} <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 text-xs font-semibold text-indigo-700"><UserRound size={11} />{roleLabel(a.ownerRole)}</span><span className="block text-xs text-slate-500">{a.rationale}</span></span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>Owner: {finding.ownerRole ? roleLabel(finding.ownerRole) : <b className="text-red-600">not recorded</b>}</span>
        {finding.firstDetectedAt && <span>First detected {formatDate(finding.firstDetectedAt)}</span>}
        {finding.aiRunId && <Link href={`/ai-activity#${finding.aiRunId}`} className="font-semibold text-violet-700 hover:underline">AI run {finding.aiRunId.slice(-6)}</Link>}
        {finding.evidenceIds.map((id) => <EvidenceChip key={id} id={id} />)}
        {closed && <span className="w-full text-slate-600">{finding.status === "DISMISSED" ? "Dismissed" : "Resolved"} by {finding.resolvedBy ?? "unknown"} · {finding.resolutionType?.toLowerCase().replaceAll("_", " ")}{finding.resolution ? ` — ${finding.resolution}` : ""}</span>}
      </div>
    </article>
  );
}
