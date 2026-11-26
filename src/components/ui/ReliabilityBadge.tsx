import { EvidenceChip } from "./badges";
import { RELIABILITY_LABEL, type Reliability } from "@/modules/reliability/classify";

const TONE: Record<Reliability["category"], string> = {
  CONFLICTING: "bg-red-100 text-red-800 border-red-300",
  INSUFFICIENT_EVIDENCE: "bg-slate-100 text-slate-700 border-slate-300",
  OUTDATED: "bg-orange-50 text-orange-800 border-orange-300",
  UNVERIFIED: "bg-amber-50 text-amber-800 border-amber-300",
  WELL_SUPPORTED: "bg-sky-50 text-sky-800 border-sky-300",
  VERIFIED: "bg-emerald-50 text-emerald-800 border-emerald-300",
};

/** Reliability badge with an expandable "Why?" listing each rule that fired and its sources. Separate from readiness. */
export default function ReliabilityBadge({ r, compact = false }: { r: Reliability; compact?: boolean }) {
  return (
    <details className="group inline-block align-middle" data-reliability={r.category}>
      <summary className={`inline-flex cursor-pointer list-none items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${TONE[r.category]}`}>
        {compact ? "" : "Reliability: "}{RELIABILITY_LABEL[r.category]}<span className="font-normal underline">Why?</span>
      </summary>
      <div className="mt-1 max-w-sm rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-sm">
        <ul className="list-disc space-y-0.5 pl-4">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
        {r.sourceIds.length > 0 && <p className="mt-1">{r.sourceIds.map((id) => <EvidenceChip key={id} id={id} />)}</p>}
        <p className="mt-1 text-[10px] text-slate-400">Deterministic rule (precedence: conflicting → insufficient → outdated → unverified → verified → well-supported).</p>
      </div>
    </details>
  );
}
