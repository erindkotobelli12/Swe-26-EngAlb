import { RELIABILITY_LABEL } from "@/lib/labels";
import type { Reliability } from "@/modules/reliability/classify";
import { Popover } from "./overlays";
import { StatusPill, toneFor } from "./primitives";
import { SourceChip } from "./provenance";

/** Reliability (how trustworthy a status is, separate from readiness), with the rule's reasons one click away. */
export default function ReliabilityBadge({ r, compact = false }: { r: Reliability; compact?: boolean }) {
  return (
    <Popover width={320} trigger={
      <button type="button" data-reliability={r.category} className="rounded-full" aria-label={`Reliability: ${RELIABILITY_LABEL[r.category]}. Show why`}>
        <StatusPill tone={toneFor.reliability(r.category)} dot={false}>{compact ? "" : "Reliability: "}{RELIABILITY_LABEL[r.category]}</StatusPill>
      </button>
    }>
      <p className="font-medium text-ink">Why “{RELIABILITY_LABEL[r.category].toLowerCase()}”?</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-body">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
      {r.sourceIds.length > 0 && <p className="mt-2">{r.sourceIds.map((id) => <SourceChip key={id} id={id} label={id.startsWith("TRACKER-") ? "Tracker entry" : "Source"} />)}</p>}
      <p className="mt-2 text-[11px] text-subtle">A fixed rule checks, in order: conflicting, not enough evidence, out of date, unverified, verified, well supported.</p>
    </Popover>
  );
}
