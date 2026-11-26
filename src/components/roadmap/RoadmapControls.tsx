"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { approveBaselineAction, decideRoadmapItemAction, suggestRoadmapAction } from "@/server/actions/roadmap";
import { ErrorBox } from "@/components/ui/badges";

export function SuggestRoadmapButton({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  function go() {
    setError(""); setInfo("");
    start(async () => {
      const r = await suggestRoadmapAction(employeeId);
      if (!r.ok) return setError(r.error);
      if (!r.data.ok) return setError(`Roadmap Agent failed: ${r.data.error}. The deterministic plan is unaffected.`);
      setInfo(`${r.data.created} proposal(s) from ${r.data.run.model}.${r.data.rejected.length ? ` Rejected by server checks: ${r.data.rejected.join("; ")}.` : ""}`);
      router.refresh();
    });
  }
  return (
    <div className="space-y-1">
      <button type="button" disabled={pending} onClick={go} className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{pending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}{pending ? "Personalising on the local model…" : "Suggest adjustments (AI)"}</button>
      {info && <p role="status" className="max-w-md text-xs text-emerald-700">{info}</p>}
      {error && <ErrorBox message={error} onRetry={go} />}
    </div>
  );
}

export function DecideButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const act = (decision: "APPROVE" | "REJECT") => start(async () => {
    setError("");
    const r = await decideRoadmapItemAction({ id, decision, reason: reason || undefined });
    if (!r.ok) return setError(r.error);
    router.refresh();
  });
  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" disabled={pending} onClick={() => act("APPROVE")} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white"><Check size={11} />Approve</button>
        <input aria-label="Rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="w-24 rounded border px-1.5 py-0.5 text-[11px]" />
        <button type="button" disabled={pending} onClick={() => act("REJECT")} className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700"><X size={11} />Reject</button>
      </div>
      {error && <p role="alert" className="text-[11px] text-red-700">{error}</p>}
    </div>
  );
}

export function BaselineButton({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await approveBaselineAction(employeeId); if (!r.ok) setError(r.error); else router.refresh(); })} className="rounded-md border px-3 py-1.5 text-xs font-semibold">{pending ? "Saving…" : "Approve current plan as baseline"}</button>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
