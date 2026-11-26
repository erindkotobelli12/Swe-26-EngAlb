import { ArrowRight, Clock, UserRound } from "lucide-react";
import { roleLabel } from "@/domain/types";
import { PHASES, type PlanItem, type PlanStatus } from "@/modules/roadmap/backbone";
import { EvidenceChip, OriginBadge, ProvenanceBadge } from "@/components/ui/badges";
import { DecideButtons } from "./RoadmapControls";

const TONE: Record<PlanStatus, string> = {
  DONE: "border-emerald-300 bg-emerald-50", IN_PROGRESS: "border-amber-300 bg-amber-50", BLOCKED: "border-red-300 bg-red-50",
  TODO: "border-slate-300 bg-white", UNKNOWN: "border-slate-300 bg-slate-50",
};
const LABEL: Record<PlanStatus, string> = { DONE: "Done", IN_PROGRESS: "In progress", BLOCKED: "Blocked", TODO: "To do", UNKNOWN: "Unknown" };

export type ExtraItem = { id: string; type: string; kind: string; phase: number; title: string; description: string; ownerRole: string; completionCriteria: string; relatesToKey: string | null; rationale: string; evidenceIds: string[]; status: string; origin: string; decidedBy: string | null };

/** Horizontal three-phase timeline: deterministic backbone (actual) plus AI proposals (dashed) and approved plan items. */
export default function RoadmapTimeline({ backbone, extras, canDecide }: { backbone: PlanItem[]; extras: ExtraItem[]; canDecide: (kind: string) => boolean }) {
  const title = (key: string | null) => (key ? backbone.find((b) => b.key === key)?.title ?? key : null);
  return (
    <div className="grid gap-4 lg:grid-cols-3" data-testid="roadmap">
      {([1, 2, 3] as const).map((phase) => (
        <section key={phase} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Clock size={14} className="text-indigo-600" />{PHASES[phase]}</h3>
          <ol className="mt-3 space-y-2">
            {backbone.filter((b) => b.phase === phase).map((b) => (
              <li key={b.key} className={`rounded-lg border-2 p-2.5 text-sm ${TONE[b.status]} ${b.proposed ? "border-dashed" : ""}`} data-plan={b.key} data-status={b.status}>
                <div className="flex items-start justify-between gap-2"><b className="leading-tight">{b.title}</b><span className="shrink-0 text-[11px] font-bold uppercase text-slate-500">{LABEL[b.status]}</span></div>
                {b.proposed && <ProvenanceBadge state="proposed" className="mt-1" />}
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-600"><UserRound size={11} />{b.owner}</p>
                <p className="mt-0.5 text-xs text-slate-500">Done when: {b.completion}</p>
                {b.waitsFor.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-700"><ArrowRight size={11} />Waits for: {b.waitsFor.join(", ")}</p>}
                {b.evidenceIds.length > 0 && <p className="mt-1">{b.evidenceIds.slice(0, 3).map((id) => <EvidenceChip key={id} id={id} />)}</p>}
              </li>
            ))}
            {extras.filter((x) => x.phase === phase && !(x.type === "ADD" && x.kind === "KT" && x.status === "APPROVED")).map((x) => (
              <li key={x.id} className={`rounded-lg border-2 p-2.5 text-sm ${x.status === "PROPOSED" ? "border-dashed border-violet-300 bg-violet-50/40" : x.status === "REJECTED" ? "border-slate-200 bg-white opacity-60" : "border-indigo-300 bg-indigo-50/50"}`} data-roadmap-item={x.title} data-status={x.status}>
                <div className="flex flex-wrap items-center gap-1.5"><OriginBadge origin={x.origin} />{x.status === "PROPOSED" ? <ProvenanceBadge state="proposed" /> : <span className="text-[11px] font-bold uppercase text-slate-500">{x.status.toLowerCase()}{x.decidedBy ? ` by ${x.decidedBy}` : ""}</span>}<span className="text-[11px] font-semibold uppercase text-violet-700">{x.type === "ALTERNATIVE" ? "while blocked" : x.type.toLowerCase()}</span></div>
                <b className="mt-1 block leading-tight">{x.title}</b>
                <p className="mt-1 text-xs text-slate-600">{x.description}</p>
                {x.relatesToKey && <p className="mt-1 text-xs text-slate-500">{x.type === "SKIP" ? "Skips" : x.type === "ALTERNATIVE" ? "While waiting for" : "Relates to"}: {title(x.relatesToKey)}</p>}
                <p className="mt-0.5 text-xs text-slate-500">Owner: {roleLabel(x.ownerRole)} · Done when: {x.completionCriteria}</p>
                <p className="mt-1 text-xs italic text-slate-500">Why: {x.rationale}</p>
                {x.evidenceIds.length > 0 && <p className="mt-1">{x.evidenceIds.map((id) => <EvidenceChip key={id} id={id} />)}</p>}
                {x.status === "PROPOSED" && (canDecide(x.kind) ? <DecideButtons id={x.id} /> : <p className="mt-1 text-[11px] text-slate-500">Awaiting {x.kind === "LOGISTICS" || x.kind === "OWNERSHIP" ? "PMO" : "Technical Lead"} approval.</p>)}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
