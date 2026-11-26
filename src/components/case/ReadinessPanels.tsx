import { CheckCircle2, ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/clock";
import type { CaseState, Gate } from "@/domain/types";
import { levelLabel, type ReadinessResult } from "@/modules/readiness/evaluate";
import { EvidenceChip, GateIcon, ProvenanceBadge } from "@/components/ui/badges";

/** Reported, Assessed and Validated readiness — always shown separately. */
export function ReadinessTriple({ readiness, reliability }: { readiness: ReadinessResult; reliability?: React.ReactNode }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase text-slate-400">Reported</p><ProvenanceBadge state="actual" /></div>
        <p className="mt-2 text-lg font-bold">{readiness.reported}</p>
        <p className="mt-1 text-xs text-slate-500">Tracker status, as recorded.</p>
        {reliability && <div className="mt-2">{reliability}</div>}
      </div>
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
        <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase text-indigo-500">Assessed</p><span className="text-[11px] font-semibold text-indigo-600">computed by rules</span></div>
        <p className="mt-2 text-lg font-bold text-indigo-900" data-testid="assessed-level">{levelLabel(readiness.assessed)}</p>
        <ul className="mt-1 space-y-1 text-xs text-slate-600">{readiness.assessedReasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase text-slate-400">Validated</p>{readiness.validated && <ProvenanceBadge state="actual" />}</div>
        <p className="mt-2 text-lg font-bold" data-testid="validated-level">{readiness.validated ? levelLabel(readiness.validated) : "Not validated"}</p>
        <p className="mt-1 text-xs text-slate-500">{readiness.validated ? `By ${readiness.validatedBy}` : "Only a human Technical Lead can validate readiness."}</p>
      </div>
    </div>
  );
}

export function GateList({ gates, compact = false }: { gates: Gate[]; compact?: boolean }) {
  const satisfied = gates.filter((g) => g.status === "SATISFIED").length;
  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">{satisfied} of {gates.length} gates satisfied · unknown is never counted as satisfied</p>
      <ul className="divide-y divide-slate-100">
        {gates.map((g) => (
          <li key={g.id} className="flex gap-3 py-2" data-gate={g.id} data-status={g.status}>
            <GateIcon status={g.status} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{g.label}</b><span className="text-[11px] font-bold uppercase text-slate-400">{g.status.toLowerCase()}</span></div>
              {!compact && <ul className="mt-0.5 space-y-0.5 text-xs text-slate-600">{g.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              {!compact && g.evidenceIds.length > 0 && <div className="mt-1">{g.evidenceIds.slice(0, 4).map((id) => <EvidenceChip key={id} id={id} />)}</div>}
            </div>
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
  const blockerOwners = g("BLOCKERS_OWNED");
  const items: { label: string; status: "SATISFIED" | "UNSATISFIED" | "UNKNOWN"; note?: string }[] = [
    { label: "Start date and movement confirmed", status: "SATISFIED", note: `${formatDate(state.employee.startDate)} · ${state.employee.movement} (tracker)` },
    { label: "Project and exact role confirmed", status: g("SCOPE_CONFIRMED") },
    { label: "Line Manager, Technical Lead and KT owner identified", status: g("OWNERS_ASSIGNED") },
    { label: "Required applications identified", status: g("ACCESS_IDENTIFIED") },
    { label: "Access requests tracked (usable)", status: g("ACCESS_USABLE") },
    { label: "KT topics agreed", status: g("KT_AGREED") },
    { label: "Shadowing, supported and independent execution evidence captured", status: g("EXECUTION_OBSERVED") },
    { label: "Expected readiness date recorded", status: g("READINESS_DATE_RECORDED") },
    { label: "Final status validated by the technical owner", status: g("TECH_VALIDATION_APPROVED") },
    { label: "Reusable KT documents or folder location recorded", status: docs ? "SATISFIED" : "UNKNOWN", note: docs ? `${docs.location}${docs.copyAllowed ? "" : " (reference only — do not copy)"}` : "No project knowledge resource recorded" },
    { label: "Blockers owned and followed to closure", status: blockerOwners },
  ];
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-start gap-2 text-sm"><GateIcon status={i.status} /><span>{i.label}{i.note && <span className="block text-xs text-slate-500">{i.note}</span>}</span></li>
      ))}
    </ul>
  );
}

export function ChecklistIcon() {
  return <ClipboardList size={16} className="text-indigo-600" />;
}
export function DoneIcon() {
  return <CheckCircle2 size={16} className="text-emerald-600" />;
}
