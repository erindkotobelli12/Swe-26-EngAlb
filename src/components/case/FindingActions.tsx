"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Search, Send, ThumbsUp, X } from "lucide-react";
import { acceptProposalAction, createActionAction, dismissFindingAction, investigateCaseAction, resolveFindingAction } from "@/server/actions/findings";
import type { InvestigationSummary } from "@/modules/detective/investigate";
import { ErrorBox } from "@/components/ui/badges";

const TYPES = [
  ["CONFIRMED_SOURCE", "Confirmed one source as correct"],
  ["NEW_EVIDENCE", "New evidence attached"],
  ["NOT_AN_ISSUE", "Not an issue"],
  ["NEEDS_FOLLOW_UP", "Needs follow-up (stays open)"],
] as const;

export function FindingActions({ findingId, status, evidenceIds, caseEvidence }: { findingId: string; status: string; evidenceIds: string[]; caseEvidence: { id: string; title: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "resolve" | "dismiss">("idle");
  const [type, setType] = useState<(typeof TYPES)[number][0]>(evidenceIds.length > 1 ? "CONFIRMED_SOURCE" : "NOT_AN_ISSUE");
  const [winner, setWinner] = useState(evidenceIds[0] ?? "");
  const [evidenceId, setEvidenceId] = useState(caseEvidence[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>) {
    setError(""); setInfo("");
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Failed.");
      if (typeof r.data === "string") setInfo(r.data);
      setMode("idle"); setNote("");
      router.refresh();
    });
  }
  if (status === "RESOLVED" || status === "DISMISSED") return null;

  return (
    <div className="flex min-w-60 flex-col items-end gap-2" data-testid={`finding-actions-${findingId}`}>
      <div className="flex flex-wrap justify-end gap-1.5">
        {status === "PROPOSED" && <button type="button" disabled={pending} onClick={() => run(() => acceptProposalAction(findingId))} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white"><ThumbsUp size={12} />Accept</button>}
        <button type="button" onClick={() => setMode(mode === "resolve" ? "idle" : "resolve")} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold"><CheckCircle2 size={12} />Resolve</button>
        <button type="button" onClick={() => setMode(mode === "dismiss" ? "idle" : "dismiss")} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold"><X size={12} />Dismiss</button>
        <button type="button" disabled={pending} onClick={() => run(() => createActionAction(findingId))} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-brand-700"><Send size={12} />Create follow-up</button>
      </div>
      {mode === "resolve" && (
        <div className="w-80 space-y-2 rounded-lg border border-line bg-canvas p-3 text-xs">
          <label className="block">Resolution type
            <select aria-label="Resolution type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="field mt-1">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          {type === "CONFIRMED_SOURCE" && <label className="block">Correct source<select aria-label="Correct source" value={winner} onChange={(e) => setWinner(e.target.value)} className="field mt-1">{evidenceIds.map((id) => <option key={id} value={id}>{caseEvidence.find((x) => x.id === id)?.title ?? (id.startsWith("TRACKER-") ? "Tracker entry" : "Source")}</option>)}</select></label>}
          {type === "NEW_EVIDENCE" && <label className="block">Evidence<select aria-label="Attached evidence" value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)} className="field mt-1">{caseEvidence.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}
          <label className="block">Note (required)<textarea aria-label="Resolution note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="field mt-1" /></label>
          <p className="text-[11px] text-subtle">Evidence is never deleted. The decision is recorded with your name in the audit log.</p>
          <button type="button" disabled={pending} onClick={() => run(() => resolveFindingAction({ findingId, resolutionType: type, note, winnerEvidenceId: type === "CONFIRMED_SOURCE" ? winner : undefined, evidenceId: type === "NEW_EVIDENCE" ? evidenceId : undefined }))} className="rounded bg-brand-600 px-3 py-1 font-semibold text-white">{pending ? "Saving…" : "Record decision"}</button>
        </div>
      )}
      {mode === "dismiss" && (
        <div className="w-80 space-y-2 rounded-lg border border-line bg-canvas p-3 text-xs">
          <label className="block">Reason (required)<textarea aria-label="Dismiss reason" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="field mt-1" /></label>
          <button type="button" disabled={pending} onClick={() => run(() => dismissFindingAction({ findingId, reason: note }))} className="rounded bg-slate-700 px-3 py-1 font-semibold text-white">{pending ? "Saving…" : "Dismiss finding"}</button>
        </div>
      )}
      {info && <p role="status" className="text-xs text-emerald-700">{info}</p>}
      {error && <div className="w-80"><ErrorBox message={error} /></div>}
    </div>
  );
}

function summaryText(s: InvestigationSummary): string {
  if (!s.ok) return "";
  return `Reviewed ${s.reviewed} rule finding(s): ${s.confirmed} confirmed, ${s.notAnIssue} judged not an issue. ${s.proposed} new proposal(s)${s.duplicates ? `, ${s.duplicates} duplicate(s) skipped` : ""}.${s.dropped.length ? ` Dropped by verification: ${s.dropped.join("; ")}.` : ""}${s.cached ? " (cached result for unchanged input)" : ""}`;
}

export function InvestigateButton({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  function go() {
    setError(""); setInfo("");
    start(async () => {
      const r = await investigateCaseAction(employeeId);
      if (!r.ok) return setError(r.error);
      if (!r.data.ok) return setError(`Detective Agent failed: ${r.data.error} Deterministic findings below are unaffected.`);
      setInfo(summaryText(r.data));
      router.refresh();
    });
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={go} disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}{pending ? "Detective Agent investigating on the local model…" : "Investigate with AI"}
      </button>
      {pending && <p role="status" className="text-xs text-subtle">This can take a minute or two on a local 7–8B model. Rule findings remain available meanwhile.</p>}
      {info && <p role="status" className="max-w-3xl rounded-lg border border-violet-200 bg-violet-50 p-2 text-xs text-violet-900">{info}</p>}
      {error && <ErrorBox message={error} onRetry={go} />}
    </div>
  );
}

export function InvestigateAllButton({ employees }: { employees: { id: string; name: string }[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<{ name: string; text: string; ok: boolean }[]>([]);
  async function go() {
    setRunning(true);
    setLog([]);
    for (const e of employees) {
      setLog((l) => [...l, { name: e.name, text: "running…", ok: true }]);
      const r = await investigateCaseAction(e.id).catch(() => ({ ok: false as const, error: "Could not reach the server." }));
      const text = !r.ok ? r.error : r.data.ok ? summaryText(r.data) : `AI failed: ${r.data.error}`;
      const ok = r.ok && r.data.ok;
      setLog((l) => l.map((x, i) => (i === l.length - 1 ? { name: e.name, text, ok } : x)));
    }
    setRunning(false);
    router.refresh();
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={go} disabled={running} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{running ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}{running ? `Investigating ${log.length}/${employees.length}…` : "Investigate all open cases"}</button>
      {log.length > 0 && <ul className="max-w-3xl space-y-1 rounded-lg border border-line bg-white p-3 text-xs">{log.map((l, i) => <li key={i} className={l.ok ? "text-body" : "text-red-700"}><b>{l.name}:</b> {l.text}</li>)}</ul>}
    </div>
  );
}
