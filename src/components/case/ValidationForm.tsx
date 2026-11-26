"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { recordValidationAction } from "@/server/actions/validation";
import { ErrorBox } from "@/components/ui/badges";

const LEVELS = [["READY_WITH_SUPPORT", "Ready with Support"], ["PARTIALLY_READY", "Partially Ready"], ["INDEPENDENTLY_READY", "Independently Ready"]] as const;

/** Technical Lead only. The gates, reliability and evidence are shown next to this form so the decision is made with full context. */
export default function ValidationForm({ employeeId, evidence }: { employeeId: string; evidence: { id: string; title: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<"APPROVED" | "REJECTED" | "NEEDS_MORE_EVIDENCE">("NEEDS_MORE_EVIDENCE");
  const [level, setLevel] = useState<(typeof LEVELS)[number][0]>("READY_WITH_SUPPORT");
  const [linked, setLinked] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  function submit() {
    setError(""); setDone("");
    start(async () => {
      const r = await recordValidationAction({ employeeId, state, validatedLevel: state === "APPROVED" ? level : undefined, evidenceIds: linked, comment });
      if (!r.ok) return setError(r.error);
      setDone(r.data); setComment(""); setLinked([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 text-sm" data-testid="validation-form">
      <label className="block">Decision
        <select aria-label="Validation decision" value={state} onChange={(e) => setState(e.target.value as typeof state)} className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2">
          <option value="NEEDS_MORE_EVIDENCE">Needs more evidence</option>
          <option value="APPROVED">Approve a readiness level</option>
          <option value="REJECTED">Reject (not ready)</option>
        </select>
      </label>
      {state === "APPROVED" && (
        <label className="block">Validated level
          <select aria-label="Validated level" value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2">{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
      )}
      <fieldset>
        <legend>Evidence relied on (required)</legend>
        <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2">
          {evidence.map((e) => (
            <label key={e.id} className="flex items-start gap-2 text-xs"><input type="checkbox" checked={linked.includes(e.id)} onChange={(x) => setLinked(x.target.checked ? [...linked, e.id] : linked.filter((i) => i !== e.id))} />{e.title}</label>
          ))}
        </div>
      </fieldset>
      <label className="block">Comment (required)<textarea aria-label="Validation comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="What did you observe? What is still missing?" className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2" /></label>
      <button type="button" disabled={pending} onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-60"><ShieldCheck size={15} />{pending ? "Recording…" : "Record validation decision"}</button>
      <p className="text-xs text-subtle">Recorded with your name and audited. AI agents cannot call this action.</p>
      {done && <p role="status" className="text-emerald-700">{done}</p>}
      {error && <ErrorBox message={error} />}
    </div>
  );
}
