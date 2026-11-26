"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { confirmDependencyAction, rejectDependencyAction, suggestDependenciesAction } from "@/server/actions/dependencies";
import type { ProposedEdge } from "@/modules/dependencies/viewModel";
import { ErrorBox, OriginBadge, ProvenanceBadge } from "@/components/ui/badges";

export default function DependencySuggestions({ employeeId, proposed, canDecide, canRunAI }: { employeeId: string; proposed: ProposedEdge[]; canDecide: boolean; canRunAI: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function act(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(""); setInfo(""); setBusy(id);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) return setError(r.error ?? "Failed.");
      router.refresh();
    });
  }
  function suggest() {
    setError(""); setInfo(""); setBusy("suggest");
    start(async () => {
      const r = await suggestDependenciesAction(employeeId);
      setBusy(null);
      if (!r.ok) return setError(r.error);
      if (!r.data.ok) return setError(`Dependency Suggestion Agent failed: ${r.data.error}`);
      setInfo(`${r.data.created} new suggestion(s) from ${r.data.run.model}${r.data.cached ? " (cached)" : ""}.${r.data.rejected.length ? ` Rejected by server checks: ${r.data.rejected.join("; ")}.` : ""}`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid="suggested-dependencies">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Suggested dependencies <span className="text-sm font-normal text-slate-500">({proposed.length})</span></h3>
        {canRunAI && <button type="button" disabled={pending} onClick={suggest} className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">{busy === "suggest" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}Suggest dependencies (AI)</button>}
      </div>
      <p className="mt-1 text-xs text-slate-500">Proposed edges are dashed and do not affect calculations until a Technical Lead or PMO confirms them.</p>
      {proposed.length === 0 && <p className="mt-3 text-sm text-slate-500">No proposals waiting.</p>}
      <ul className="mt-3 space-y-2">
        {proposed.map((p) => (
          <li key={p.id} className="rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3 text-sm" data-dependency={`${p.fromLabel} → ${p.toLabel}`}>
            <div className="flex flex-wrap items-center gap-2"><b>{p.fromLabel}</b><span>→</span><b>{p.toLabel}</b><OriginBadge origin={p.origin} /><ProvenanceBadge state="proposed" /></div>
            <p className="mt-1 text-xs text-slate-600">{p.rationale}</p>
            {p.excerpts.map((x, i) => <p key={i} className="mt-1 text-xs italic text-slate-600">“{x}” <span className="not-italic font-semibold text-indigo-700">{p.evidenceIds[i] ?? p.evidenceIds[0]}</span></p>)}
            {canDecide && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" disabled={pending} onClick={() => act(p.id, () => confirmDependencyAction(p.id))} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-60">{busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}Confirm</button>
                <input aria-label="Rejection reason" value={reason[p.id] ?? ""} onChange={(e) => setReason({ ...reason, [p.id]: e.target.value })} placeholder="Reason to reject" className="rounded border px-2 py-0.5 text-xs" />
                <button type="button" disabled={pending} onClick={() => act(p.id, () => rejectDependencyAction({ dependencyId: p.id, reason: reason[p.id] ?? "" }))} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-bold text-red-700"><X size={12} />Reject</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {pending && busy === "suggest" && <p role="status" className="mt-2 text-xs text-slate-500">Asking the local model… this can take up to a minute.</p>}
      {info && <p role="status" className="mt-2 text-xs text-emerald-700">{info}</p>}
      {error && <div className="mt-2"><ErrorBox message={error} /></div>}
    </div>
  );
}
