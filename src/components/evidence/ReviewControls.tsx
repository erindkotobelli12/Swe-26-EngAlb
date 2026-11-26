"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { addManualClaimAction, extractClaimsAction, reviewClaimAction, reviewEvidenceAction } from "@/server/actions/evidence";
import type { PipelineStep } from "@/modules/evidence/pipeline";
import { ErrorBox } from "@/components/ui/badges";

export function PipelineSteps({ steps }: { steps: PipelineStep[] }) {
  const tone = { done: "text-emerald-700", changed: "text-brand-700", none: "text-subtle", skipped: "text-subtle" };
  return (
    <ol className="mt-3 space-y-1 rounded-lg border border-indigo-100 bg-brand-50/40 p-3 text-xs" data-testid="pipeline-steps">
      <li className="mb-1 font-semibold text-indigo-900">Evidence pipeline</li>
      {steps.map((s) => <li key={s.step} className="flex gap-2"><b className={`w-36 shrink-0 ${tone[s.status]}`}>{s.step}</b><span className="text-body">{s.detail}</span></li>)}
    </ol>
  );
}

export function ClaimReview({ claimId, value }: { claimId: string; value: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "edit" | "reject">("idle");
  const [edited, setEdited] = useState(value);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [steps, setSteps] = useState<PipelineStep[] | null>(null);

  function submit(decision: "APPROVE" | "REJECT") {
    setError("");
    start(async () => {
      const r = await reviewClaimAction({ claimId, decision, editedValue: mode === "edit" ? edited : undefined, reason: reason || undefined });
      if (!r.ok) return setError(r.error);
      setSteps(r.data.steps);
      router.refresh();
    });
  }

  if (steps) return <PipelineSteps steps={steps} />;
  return (
    <div className="mt-2 space-y-2">
      {mode === "edit" && <input aria-label="Edited value" value={edited} onChange={(e) => setEdited(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />}
      {mode === "reject" && <input aria-label="Rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="w-full rounded border px-2 py-1 text-sm" />}
      <div className="flex flex-wrap gap-2">
        {mode !== "reject" && <button type="button" disabled={pending} onClick={() => submit("APPROVE")} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">{pending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}{mode === "edit" ? "Approve edited value" : "Approve claim"}</button>}
        {mode === "idle" && <button type="button" onClick={() => setMode("edit")} className="rounded-md border px-3 py-1 text-xs font-semibold">Edit</button>}
        {mode !== "reject" ? <button type="button" onClick={() => setMode("reject")} className="rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">Reject</button>
          : <button type="button" disabled={pending} onClick={() => submit("REJECT")} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"><XCircle size={13} />Confirm rejection</button>}
        {mode !== "idle" && <button type="button" onClick={() => setMode("idle")} className="px-2 text-xs text-subtle">Cancel</button>}
      </div>
      {error && <ErrorBox message={error} onRetry={() => submit(mode === "reject" ? "REJECT" : "APPROVE")} />}
    </div>
  );
}

export function EvidenceTools({ evidenceId, reviewStatus, canRunAI, canReview, fields }: { evidenceId: string; reviewStatus: string; canRunAI: boolean; canReview: boolean; fields: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [manual, setManual] = useState(false);
  const [claim, setClaim] = useState({ field: fields[0] ?? "", value: "", excerpt: "" });
  const [reason, setReason] = useState("");

  function extract() {
    setError(""); setInfo("");
    start(async () => {
      const r = await extractClaimsAction(evidenceId);
      if (!r.ok) return setError(r.error);
      if (!r.data.ok) return setError(`AI extraction failed: ${r.data.error} (logged as AI run ${r.data.run.id.slice(-6)}). Nothing was stored; you can add claims manually.`);
      setInfo(`${r.data.created} claim(s) proposed by ${r.data.run.model}${r.data.cached ? " (cached result)" : ""}.${r.data.dropped.length ? ` ${r.data.dropped.length} dropped by server checks: ${r.data.dropped.map((d) => `${d.field} — ${d.reason}`).join("; ")}.` : ""}`);
      router.refresh();
    });
  }
  function saveManual() {
    setError("");
    start(async () => {
      const r = await addManualClaimAction({ evidenceId, ...claim });
      if (!r.ok) return setError(r.error);
      setManual(false); setClaim({ field: fields[0] ?? "", value: "", excerpt: "" });
      router.refresh();
    });
  }
  function review(decision: "APPROVED" | "REJECTED") {
    setError("");
    start(async () => {
      const r = await reviewEvidenceAction({ evidenceId, decision, reason });
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {canRunAI && <button type="button" disabled={pending} onClick={extract} className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{pending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}Extract claims (AI)</button>}
        {canReview && <button type="button" onClick={() => setManual((m) => !m)} className="rounded-md border px-3 py-1.5 text-xs font-semibold">Add claim manually</button>}
        {canReview && reviewStatus === "PENDING_REVIEW" && <>
          <button type="button" disabled={pending} onClick={() => review("APPROVED")} className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700">Accept source</button>
          <input aria-label="Source rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason to reject" className="rounded border px-2 py-1 text-xs" />
          <button type="button" disabled={pending} onClick={() => review("REJECTED")} className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Reject source</button>
        </>}
      </div>
      {pending && <p role="status" className="text-xs text-subtle">Working… AI calls run on the local model and can take up to a minute.</p>}
      {manual && (
        <div className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-3">
          <label className="text-xs">Field<input list={`fields-${evidenceId}`} value={claim.field} onChange={(e) => setClaim({ ...claim, field: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm" /></label>
          <datalist id={`fields-${evidenceId}`}>{fields.map((f) => <option key={f} value={f} />)}</datalist>
          <label className="text-xs">Value<input value={claim.value} onChange={(e) => setClaim({ ...claim, value: e.target.value })} placeholder="e.g. USABLE" className="mt-1 w-full rounded border px-2 py-1 text-sm" /></label>
          <label className="text-xs">Verbatim excerpt<input value={claim.excerpt} onChange={(e) => setClaim({ ...claim, excerpt: e.target.value })} placeholder="Copy exact words from the source" className="mt-1 w-full rounded border px-2 py-1 text-sm" /></label>
          <button type="button" disabled={pending} onClick={saveManual} className="w-fit rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Save as pending claim</button>
        </div>
      )}
      {info && <p role="status" className="text-xs text-emerald-700">{info}</p>}
      {error && <ErrorBox message={error} onRetry={undefined} />}
    </div>
  );
}
