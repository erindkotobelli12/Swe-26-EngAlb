"use client";
import { useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { createImprovementAction, updateImprovementAction } from "@/server/actions/improvements";
import { useServerAction } from "@/components/ui/actions";
import { Dialog } from "@/components/ui/overlays";
import { buttonClass, EmptyState, SampleTag, StatusPill, toneFor, type ButtonVariant } from "@/components/ui/primitives";
import { IMPROVEMENT_SOURCE_LABEL, IMPROVEMENT_STATUS_LABEL, roleLabel } from "@/lib/labels";
import type { ImprovementView } from "@/modules/improvements/service";

export type OwnerOption = { id: string; name: string; role: string; isSample: boolean };
export type ProjectOption = { id: string; name: string };
type Prefill = { title?: string; description?: string; refs?: string[]; projectId?: string | null };

/**
 * Create an improvement. When opened from an insight or an AI recommendation, the form is pre-filled — but only the
 * PMO's own save creates it, and the AI never approves anything.
 */
export function CreateImprovementDialog({ owners, projects, source, prefill, triggerLabel = "Create improvement", variant = "secondary", size = "sm" }: {
  owners: OwnerOption[]; projects: ProjectOption[]; source: "INSIGHT" | "BRIEFING" | "MANUAL"; prefill?: Prefill; triggerLabel?: string; variant?: ButtonVariant; size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const firstOwner = owners.find((o) => o.role === "ADDITIONAL_MANAGER")?.id ?? owners[0]?.id ?? "";
  const [f, setF] = useState({ title: prefill?.title ?? "", description: prefill?.description ?? "", projectId: prefill?.projectId ?? "", ownerPersonId: firstOwner, dueDate: "", approve: true });
  const { pending, run } = useServerAction();
  const valid = f.title.trim().length >= 3 && f.description.trim().length >= 10 && f.ownerPersonId;
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Create improvement" description={source === "INSIGHT" ? "Pre-filled from an insight. Check and adjust it — you decide what is created." : "Describe the change and who owns it."} width={560}
      trigger={<button type="button" data-testid="create-improvement" className={buttonClass(variant, size)}><Lightbulb size={14} />{triggerLabel}</button>}
      footer={<>
        <button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" data-testid="save-improvement" disabled={!valid || pending} className={buttonClass("primary")}
          onClick={() => run(() => createImprovementAction({ ...f, projectId: f.projectId || null, source, refs: prefill?.refs ?? [] }), { onDone: () => setOpen(false) })}>
          {pending && <Loader2 size={15} className="animate-spin" />}{f.approve ? "Create and approve" : "Create as proposal"}
        </button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label" htmlFor="im-title">Title</label><input id="im-title" className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="im-desc">What should change?</label><textarea id="im-desc" className="field min-h-[100px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><label className="label" htmlFor="im-owner">Owner</label>
          <select id="im-owner" className="field" value={f.ownerPersonId} onChange={(e) => setF({ ...f, ownerPersonId: e.target.value })}>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name} · {roleLabel(o.role)}{o.isSample ? " (sample)" : ""}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="im-project">Project</label>
          <select id="im-project" className="field" value={f.projectId ?? ""} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
            <option value="">Across the organisation</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="im-due">Due date (optional)</label><input id="im-due" type="date" className="field" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
        <label className="flex items-end gap-2 pb-2 text-sm text-body"><input type="checkbox" className="accent-brand-600" checked={f.approve} onChange={(e) => setF({ ...f, approve: e.target.checked })} />Approve now</label>
      </div>
      {prefill?.refs?.length ? <p className="mt-3 text-xs text-subtle">Based on {prefill.refs.length} linked {prefill.refs.length === 1 ? "record" : "records"}; the links are kept with the improvement.</p> : null}
    </Dialog>
  );
}

const NEXT: Record<string, { to: string; label: string; needsNote?: boolean; approveOnly?: boolean }[]> = {
  PROPOSED: [{ to: "APPROVED", label: "Approve", approveOnly: true }, { to: "DROPPED", label: "Drop", needsNote: true }],
  APPROVED: [{ to: "IN_PROGRESS", label: "Start" }, { to: "DROPPED", label: "Drop", needsNote: true }],
  IN_PROGRESS: [{ to: "DONE", label: "Mark done", needsNote: true }, { to: "DROPPED", label: "Drop", needsNote: true }],
};

function StatusControl({ item }: { item: ImprovementView }) {
  const { pending, run } = useServerAction();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const options = (NEXT[item.status] ?? []).filter((o) => !o.approveOnly || item.canApprove);
  if (!item.canUpdate || !options.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pending && <Loader2 size={14} className="animate-spin text-subtle" />}
      {noteFor ? (
        <>
          <input aria-label="Outcome" className="field w-64 py-1.5" value={note} onChange={(e) => setNote(e.target.value)} placeholder={noteFor === "DONE" ? "What changed?" : "Why is it dropped?"} autoFocus />
          <button type="button" className={buttonClass("primary", "sm")} disabled={note.trim().length < 3 || pending} onClick={() => run(() => updateImprovementAction({ id: item.id, status: noteFor, outcomeNote: note }), { onDone: () => { setNoteFor(null); setNote(""); } })}>Save</button>
          <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setNoteFor(null)}>Cancel</button>
        </>
      ) : options.map((o) => (
        <button key={o.to} type="button" data-testid={`improvement-${o.to.toLowerCase()}`} disabled={pending} className={buttonClass(o.to === "DROPPED" ? "ghost" : "secondary", "sm")}
          onClick={() => (o.needsNote ? setNoteFor(o.to) : run(() => updateImprovementAction({ id: item.id, status: o.to })))}>{o.label}</button>
      ))}
    </div>
  );
}

export function ImprovementList({ items, emptyText = "No improvements yet.", action }: { items: ImprovementView[]; emptyText?: string; action?: React.ReactNode }) {
  if (!items.length) return <EmptyState icon={Lightbulb} title={emptyText} action={action}>Turn an insight or a briefing finding into a concrete change with an owner.</EmptyState>;
  return (
    <ul className="divide-y divide-line" data-testid="improvements">
      {items.map((i) => (
        <li key={i.id} className="py-3" data-improvement={i.title}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-ink">{i.title}</p>
              <p className="mt-0.5 text-sm text-muted">{i.description}</p>
              <p className="mt-1 text-xs text-subtle">
                {i.owner ? <>Owner: {i.owner.name}{i.owner.isSample && <SampleTag className="ml-1" />}</> : "No owner"} · {i.projectName ?? "Across the organisation"} · {IMPROVEMENT_SOURCE_LABEL[i.source]}{i.dueDate ? ` · due ${i.dueDate}` : ""}
              </p>
              {i.outcomeNote && <p className="mt-1 text-xs text-body">Outcome: {i.outcomeNote}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusPill tone={toneFor.improvement(i.status)}>{IMPROVEMENT_STATUS_LABEL[i.status]}</StatusPill>
              <StatusControl item={i} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function NewImprovementButton(props: { owners: OwnerOption[]; projects: ProjectOption[] }) {
  return <CreateImprovementDialog {...props} source="MANUAL" triggerLabel="New improvement" variant="primary" size="md" />;
}
