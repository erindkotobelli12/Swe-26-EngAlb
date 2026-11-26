import { formatDate } from "@/lib/clock";
import { gateSentence, label } from "@/lib/labels";
import type { CaseState, Gate } from "@/domain/types";
import { levelLabel, type ReadinessResult } from "@/modules/readiness/evaluate";
import { EvidenceChip, GateIcon } from "@/components/ui/badges";
import { StatusPill, toneFor } from "@/components/ui/primitives";

/** Reported, assessed and validated readiness — always shown separately. */
export function ReadinessTriple({ readiness, reliability }: { readiness: ReadinessResult; reliability?: React.ReactNode }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
        <p className="text-xs font-medium text-subtle">Reported in the tracker</p>
        <p className="mt-1 text-lg font-semibold text-ink">{readiness.reported}</p>
        {reliability && <div className="mt-2">{reliability}</div>}
      </div>
      <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
        <p className="text-xs font-medium text-subtle">Assessed from the evidence</p>
        <p className="mt-1" data-testid="assessed-level"><StatusPill tone={toneFor.readiness(readiness.assessed)}>{levelLabel(readiness.assessed)}</StatusPill></p>
        <ul className="mt-2 space-y-1 text-xs text-muted">{readiness.assessedReasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
      <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
        <p className="text-xs font-medium text-subtle">Validated by the Technical Lead</p>
        <p className="mt-1 text-lg font-semibold text-ink" data-testid="validated-level">{readiness.validated ? levelLabel(readiness.validated) : "Not validated"}</p>
        <p className="mt-1 text-xs text-subtle">{readiness.validated ? `By ${readiness.validatedBy}` : "Only the project's Technical Lead can validate readiness."}</p>
      </div>
    </div>
  );
}

/** Gates as plain sentences ("Waiting for technical sign-off"); reasons and sources on demand. */
export function GateList({ gates, compact = false }: { gates: Gate[]; compact?: boolean }) {
  const satisfied = gates.filter((g) => g.status === "SATISFIED").length;
  return (
    <div>
      <p className="mb-2 text-xs text-subtle"><span className="tabular">{satisfied} of {gates.length}</span> done. Unknown never counts as done.</p>
      <ul className="divide-y divide-line">
        {gates.map((g) => (
          <li key={g.id} className="py-2" data-gate={g.id} data-status={g.status}>
            {compact ? (
              <div className="flex items-center gap-3"><GateIcon status={g.status} /><span className="text-sm text-body">{gateSentence(g.id, g.status)}</span></div>
            ) : (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <GateIcon status={g.status} />
                  <span className="flex-1 text-sm text-body">{gateSentence(g.id, g.status)}</span>
                  <span className="text-xs text-subtle group-open:hidden">Details</span>
                </summary>
                <div className="ml-7 mt-1">
                  <ul className="space-y-0.5 text-xs text-muted">{g.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  {g.evidenceIds.length > 0 && <div className="mt-1">{g.evidenceIds.slice(0, 4).map((id) => <EvidenceChip key={id} id={id} />)}</div>}
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Starter pack §6 checklist mapped to gates, plus the two items that are not gates. */
export function ChecklistPanel({ state, gates }: { state: CaseState; gates: Gate[] }) {
  const g = (id: Gate["id"]) => gates.find((x) => x.id === id)!.status;
  const docs = state.knowledgeResources[0];
  const items: { label: string; status: "SATISFIED" | "UNSATISFIED" | "UNKNOWN"; note?: string }[] = [
    { label: "Start date and movement confirmed", status: "SATISFIED", note: `${formatDate(state.employee.startDate)} · ${label("movement", state.employee.movement).toLowerCase()} (tracker)` },
    { label: "Project and exact role confirmed", status: g("SCOPE_CONFIRMED") },
    { label: "Line Manager, Technical Lead and KT owner identified", status: g("OWNERS_ASSIGNED") },
    { label: "Required applications identified", status: g("ACCESS_IDENTIFIED") },
    { label: "Access working", status: g("ACCESS_USABLE") },
    { label: "Knowledge-transfer topics agreed", status: g("KT_AGREED") },
    { label: "Shadowing, supported and independent work observed", status: g("EXECUTION_OBSERVED") },
    { label: "Expected readiness date recorded", status: g("READINESS_DATE_RECORDED") },
    { label: "Final status validated by the Technical Lead", status: g("TECH_VALIDATION_APPROVED") },
    { label: "Reusable documents or folder location recorded", status: docs ? "SATISFIED" : "UNKNOWN", note: docs ? `${docs.location}${docs.copyAllowed ? "" : " (reference only, don't copy)"}` : "No project knowledge resource recorded" },
    { label: "Blockers owned and followed to closure", status: g("BLOCKERS_OWNED") },
  ];
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-start gap-2 text-sm"><GateIcon status={i.status} /><span className="text-body">{i.label}{i.note && <span className="block text-xs text-subtle">{i.note}</span>}</span></li>
      ))}
    </ul>
  );
}
