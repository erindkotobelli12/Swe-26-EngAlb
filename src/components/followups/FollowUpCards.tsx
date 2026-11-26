"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, FilePlus2, Inbox, Loader2, Mail, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { approveAction, closeAction, createDraftsAction, personaliseDraftAction, recordResponseAction, saveEditAction, sendSimulatedAction } from "@/server/actions/followups";
import type { FollowUpItem } from "@/modules/followups/candidates";
import { ErrorBox, ProvenanceBadge } from "@/components/ui/badges";
import { SourceChip } from "@/components/ui/provenance";
import { StatusPill } from "@/components/ui/primitives";

export function ItemList({ items }: { items: FollowUpItem[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((i) => (
        <li key={i.key} className="rounded-lg border border-line bg-canvas/60 p-2.5 text-sm" data-item={i.key}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><Link href={`/employees/${i.employeeId}?tab=followups`} className="font-semibold text-brand-700 hover:underline">{i.employeeName}</Link> · {i.title}</span>
            <span className="flex items-center gap-2 text-xs text-subtle"><span className="tabular">Open {i.daysOpen} {i.daysOpen === 1 ? "day" : "days"}</span>{i.escalationLevel === 2 ? <StatusPill tone="amber" dot={false}>Escalate</StatusPill> : i.escalationLevel === 1 ? <StatusPill tone="slate" dot={false}>Reminder due</StatusPill> : null}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted">Ask: {i.ask}</p>
          {i.facts.slice(0, 2).map((f, n) => <p key={n} className="mt-0.5 text-xs italic text-subtle">“{f.excerpt}” <SourceChip id={f.evidenceId} excerpt={f.excerpt} /></p>)}
          <details className="mt-1 text-[11px] text-subtle"><summary className="cursor-pointer">Why this order?</summary>impact {i.breakdown.impact} (downstream nodes × 5) + severity {i.breakdown.severity} ({i.severity.toLowerCase()}) + overdue {i.breakdown.overdue} (days beyond follow-up threshold × 2) + escalation {i.breakdown.escalation} (level × 10)</details>
        </li>
      ))}
    </ul>
  );
}

export function CreateDraftButton({ keys, label }: { keys: string[] | "ALL"; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await createDraftsAction(keys); if (!r.ok) setError(r.error); else router.refresh(); })} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{pending ? <Loader2 size={13} className="animate-spin" /> : <FilePlus2 size={13} />}{label}</button>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}

type Comm = { id: string; stakeholderLabel: string; channel: string; subject: string; body: string; status: string; draftOrigin: string; priorityScore: number; escalationRecommendation: string | null; approvedBy: string | null; sentAt: string | null; aiRunId: string | null; responseEvidenceId: string | null; items: FollowUpItem[]; employees: { id: string; name: string }[] };

const STATUS_TONE: Record<string, string> = { DRAFT: "bg-amber-50 text-amber-800", APPROVED: "bg-sky-50 text-sky-800", SENT_SIMULATED: "bg-violet-100 text-violet-800", RESPONDED: "bg-emerald-50 text-emerald-800", CLOSED: "bg-slate-100 text-muted" };

export function CommunicationCard({ c, canAct }: { c: Comm; canAct: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subject, setSubject] = useState(c.subject);
  const [body, setBody] = useState(c.body);
  const [responseFor, setResponseFor] = useState(c.employees[0]?.id ?? "");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const editable = canAct && (c.status === "DRAFT" || c.status === "APPROVED");
  const dirty = subject !== c.subject || body !== c.body;

  function run(fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, onOk?: (data: unknown) => void) {
    setError(""); setInfo("");
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Failed.");
      onOk?.(r.data);
      router.refresh();
    });
  }

  return (
    <article className={`rounded-xl border bg-white p-5 ${c.status === "SENT_SIMULATED" || c.status === "RESPONDED" ? "border-violet-300" : "border-line"}`} data-communication={c.stakeholderLabel} data-status={c.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">{c.channel === "TEAMS" ? <MessageSquare size={15} /> : <Mail size={15} />}{c.stakeholderLabel}</p>
          <p className="mt-1 text-xs text-subtle">{c.channel === "TEAMS" ? "Teams message" : "Email"} · draft: {c.draftOrigin === "AI" ? "AI-written" : c.draftOrigin === "HUMAN_EDITED" ? "edited by a human" : "template (no AI)"}{c.approvedBy ? ` · approved by ${c.approvedBy}` : ""}</p>
        </div>
        <span className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[c.status] ?? ""}`}>{c.status === "SENT_SIMULATED" ? "Sent (simulated)" : c.status.toLowerCase()}</span>{c.status === "DRAFT" && <ProvenanceBadge state="proposed" />}{(c.status === "SENT_SIMULATED" || c.status === "RESPONDED") && <ProvenanceBadge state="simulated" />}</span>
      </div>
      {c.escalationRecommendation && <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-900">{c.escalationRecommendation}</p>}
      {(c.status === "SENT_SIMULATED" || c.status === "RESPONDED") && <p className="sim-banner mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white">SIMULATED OUTBOX — nothing was sent outside this machine.</p>}
      <div className="mt-3 space-y-2">
        <input aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold disabled:bg-canvas" />
        <textarea aria-label="Message body" value={body} onChange={(e) => setBody(e.target.value)} disabled={!editable} rows={Math.min(14, body.split("\n").length + 1)} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono text-xs leading-5 disabled:bg-canvas" />
      </div>
      {canAct && (
        <div className="mt-2 flex flex-wrap gap-2">
          {c.status === "DRAFT" && <button type="button" disabled={pending} onClick={() => run(() => personaliseDraftAction(c.id), (d) => { const r = d as { ok: boolean; error?: string; warnings?: string[] }; if (!r.ok) setError(`AI draft failed: ${r.error} The current draft is unchanged.`); else if (r.warnings?.length) setInfo(r.warnings.join(" ")); })} className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"><Sparkles size={13} />Personalise with AI</button>}
          {editable && dirty && <button type="button" disabled={pending} onClick={() => run(() => saveEditAction({ id: c.id, subject, body }))} className="rounded-md border px-3 py-1.5 text-xs font-semibold">Save edit</button>}
          {c.status === "DRAFT" && !dirty && <button type="button" disabled={pending} onClick={() => run(() => approveAction(c.id))} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><CheckCircle2 size={13} />Approve</button>}
          {c.status === "APPROVED" && !dirty && <button type="button" disabled={pending} onClick={() => run(() => sendSimulatedAction(c.id))} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"><Send size={13} />Send (simulated)</button>}
          {c.status !== "CLOSED" && <button type="button" disabled={pending} onClick={() => run(() => closeAction(c.id))} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold text-muted"><X size={13} />Close</button>}
          {pending && <Loader2 size={15} className="animate-spin text-subtle" />}
        </div>
      )}
      {canAct && c.status === "SENT_SIMULATED" && (
        <div className="mt-3 space-y-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3" data-testid="record-response">
          <p className="flex items-center gap-2 text-xs font-semibold text-violet-900"><Inbox size={14} />Record response (stored verbatim as new evidence, pending review)</p>
          {c.employees.length > 1 && <select aria-label="Response is about" value={responseFor} onChange={(e) => setResponseFor(e.target.value)} className="rounded border px-2 py-1 text-xs">{c.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}
          <textarea aria-label="Response text" value={response} onChange={(e) => setResponse(e.target.value)} rows={3} placeholder="Paste the stakeholder's reply exactly" className="w-full rounded border px-2 py-1 text-sm" />
          <button type="button" disabled={pending || response.trim().length < 10} onClick={() => run(() => recordResponseAction({ id: c.id, employeeId: responseFor, content: response }), (ev) => setInfo(`Saved as ${ev as string}. Review and approve its claims in the Evidence tab.`))} className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Record response</button>
        </div>
      )}
      {c.responseEvidenceId && <p className="mt-2 text-xs">Response: <Link href={`/employees/${c.employees[0]?.id}?tab=evidence#${c.responseEvidenceId}`} className="font-semibold text-brand-700">{c.responseEvidenceId}</Link> — approve its claims to update the case.</p>}
      {info && <p role="status" className="mt-2 text-xs text-emerald-700">{info}</p>}
      {error && <div className="mt-2"><ErrorBox message={error} /></div>}
      <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-subtle">Items covered ({c.items.length})</summary><ItemList items={c.items} /></details>
    </article>
  );
}
