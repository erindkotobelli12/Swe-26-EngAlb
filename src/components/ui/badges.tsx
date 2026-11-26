import { AlertOctagon, CheckCircle2, CircleHelp, Lightbulb, ShieldCheck, XCircle } from "lucide-react";
import type { GateStatus, Severity } from "@/domain/types";
import { SEVERITY_LABEL } from "@/lib/labels";
import { Card as UICard, EmptyState as UIEmptyState, SimulatedPill, StatusPill, toneFor, type Tone } from "./primitives";
import { SourceChip } from "./provenance";

/**
 * Legacy badge API, restyled on the shared design tokens. Provenance stays visible but calm:
 * "actual" is a quiet marker, "proposed" a violet AI chip style, "simulated" a violet pill.
 */
export type Provenance = "actual" | "proposed" | "simulated";

export function ProvenanceBadge({ state, className = "" }: { state: Provenance; className?: string }) {
  if (state === "simulated") return <SimulatedPill className={className} />;
  if (state === "proposed") return <span data-provenance="proposed" title="Suggested by AI or rules — awaiting a human decision" className={`inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200 ${className}`}>Proposed</span>;
  return <span data-provenance="actual" title="Approved and stored" className={`inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ${className}`}>Recorded</span>;
}

/** Facts (with the verbatim excerpt) and assumptions are shown in two visibly different styles. */
export function FactOrAssumption({ kind, statement, evidenceId, excerpt, basis }: { kind: "fact" | "assumption"; statement: string; evidenceId?: string; excerpt?: string; basis?: string }) {
  if (kind === "fact") {
    return (
      <div className="rounded-lg border border-line bg-surface p-3" data-kind="fact">
        <div className="flex items-start gap-2 text-sm"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /><span className="text-body">{statement}</span></div>
        {excerpt && evidenceId && <p className="mt-2 border-l-2 border-emerald-300 pl-3 text-[13px] italic text-muted">“{excerpt}” <SourceChip id={evidenceId} excerpt={excerpt} /></p>}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3" data-kind="assumption">
      <div className="flex items-start gap-2 text-sm"><Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden /><span className="text-body">{statement}</span></div>
      {basis && <p className="mt-1 pl-6 text-xs text-amber-800">Basis: {basis}</p>}
    </div>
  );
}

/** Kept for existing call sites: a source chip that opens the verbatim evidence. */
export function EvidenceChip({ id, label }: { id: string; label?: string }) {
  return <SourceChip id={id} label={label ?? (id.startsWith("TRACKER-") ? "Tracker entry" : "Source")} />;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <StatusPill tone={toneFor.severity(severity)}>{SEVERITY_LABEL[severity] ?? severity}</StatusPill>;
}

export function OriginBadge({ origin }: { origin: string }) {
  if (origin === "AI") return <span data-provenance="proposed" className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">AI</span>;
  const text = origin === "RULE" ? "Rule" : origin === "TEMPLATE" ? "Template" : origin === "HUMAN" ? "Person" : origin === "SEED" ? "Starter pack" : origin.toLowerCase();
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{text}</span>;
}

export function GateIcon({ status }: { status: GateStatus }) {
  if (status === "SATISFIED") return <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-label="Done" />;
  if (status === "UNSATISFIED") return <XCircle size={16} className="shrink-0 text-red-500" aria-label="Not done" />;
  return <CircleHelp size={16} className="shrink-0 text-slate-400" aria-label="Unknown" />;
}

export function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "indigo" | "green" | "amber" | "red" | "violet" }) {
  const map: Record<string, Tone> = { slate: "slate", indigo: "brand", green: "green", amber: "amber", red: "red", violet: "violet" };
  return <StatusPill tone={map[tone]} dot={false}>{children}</StatusPill>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return <UIEmptyState title={title}>{children}</UIEmptyState>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <span className="flex items-center gap-2"><AlertOctagon size={16} />{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">Retry</button>}
    </div>
  );
}

export function Card({ title, actions, children, className = "", id }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return <UICard title={title} actions={actions} className={className} id={id}>{children}</UICard>;
}
