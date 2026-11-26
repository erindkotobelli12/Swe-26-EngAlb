"use client";
import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { addEvidenceAction } from "@/server/actions/evidence";
import { PERSON_ROLES, ROLE_LABEL } from "@/domain/types";

type Option = { id: string; label: string };

export default function AddEvidenceForm({ employees, fixedEmployeeId, replyTargets, defaultDate, defaultOpen = false, allowSimulated = true }: {
  employees: Option[];
  fixedEmployeeId?: string;
  replyTargets: (Option & { employeeId: string })[];
  defaultDate: string;
  defaultOpen?: boolean;
  allowSimulated?: boolean;
}) {
  const [state, action, pending] = useActionState(addEvidenceAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4" open={defaultOpen}>
      <summary className="cursor-pointer font-bold text-indigo-700">Add evidence</summary>
      <p className="mt-2 text-xs text-slate-500">Evidence is stored verbatim and immutable, pending review. Paste the original text; do not paraphrase. Never paste passwords or credentials.</p>
      <form ref={formRef} action={action} className="mt-4 grid gap-3 md:grid-cols-2">
        {fixedEmployeeId ? <input type="hidden" name="employeeId" value={fixedEmployeeId} /> : (
          <label className="text-sm">Employee case
            <select name="employeeId" required className="mt-1 w-full rounded-lg border px-3 py-2">{employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
          </label>
        )}
        <label className="text-sm">Source title<input name="title" required minLength={3} placeholder="e.g. Helix access confirmed" className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Source type
          <select name="sourceType" className="mt-1 w-full rounded-lg border px-3 py-2"><option value="EMAIL">Email</option><option value="TEAMS_MESSAGE">Teams message</option><option value="EMPLOYEE_UPDATE">Employee update</option><option value="MEETING_NOTE">Meeting note</option><option value="TRACKER_NOTE">Tracker note</option></select>
        </label>
        <label className="text-sm">Sender role
          <select name="senderRole" required className="mt-1 w-full rounded-lg border px-3 py-2">{PERSON_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        </label>
        <label className="text-sm">Sender name (if stated)<input name="senderName" placeholder="Leave empty if not recorded" className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Recipient role
          <select name="recipientRole" className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Not recorded</option>{PERSON_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        </label>
        <label className="text-sm">Source date<input type="date" name="date" defaultValue={defaultDate} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Reply to an earlier request
          <select name="inReplyToId" className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Not a reply</option>{replyTargets.filter((t) => !fixedEmployeeId || t.employeeId === fixedEmployeeId).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        </label>
        <label className="text-sm md:col-span-2">Original content (verbatim)<textarea name="content" required minLength={10} rows={4} placeholder="Paste the original message text" className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <div className="flex flex-wrap items-center gap-4 text-sm md:col-span-2">
          <label className="flex items-center gap-2"><input type="checkbox" name="isRequest" /> This source asks for something (track replies)</label>
          {allowSimulated && <label className="flex items-center gap-2"><input type="checkbox" name="isSimulated" /> Simulated (demo) source</label>}
        </div>
        <div className="flex items-center gap-3 md:col-span-2">
          <button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{pending && <Loader2 size={15} className="animate-spin" />}Save evidence</button>
          {state?.ok && <span role="status" className="text-sm text-emerald-700">Saved {state.data} — pending review.</span>}
          {state && !state.ok && <span role="alert" className="text-sm text-red-700">{state.error}</span>}
        </div>
      </form>
    </details>
  );
}
