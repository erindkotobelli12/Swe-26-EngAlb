"use client";
import { useState } from "react";
import { AlertTriangle, ArrowRightCircle, Loader2 } from "lucide-react";
import { confirmHandoverAction, updatePreboardingItemAction } from "@/server/actions/preboarding";
import { ConfirmAction, useServerAction } from "@/components/ui/actions";
import { buttonClass, cn, StatusPill, toneFor } from "@/components/ui/primitives";
import { SourceChip } from "@/components/ui/provenance";
import { ITEM_STATUS_LABEL, PREBOARDING_CATEGORY_LABEL } from "@/lib/labels";
import type { ChecklistItem } from "@/modules/preboarding/queries";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED", "NOT_APPLICABLE"] as const;
const OWNER = { HR: "HR", LINE_MANAGER: "Line Manager" } as Record<string, string>;
const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }) : "No due date");

/** One person's pre-boarding checklist. HR and the person's Line Manager can update items. */
export function PreboardingChecklist({ employeeId, name, items, canEdit, canHandover, hrOpen }: { employeeId: string; name: string; items: ChecklistItem[]; canEdit: boolean; canHandover: boolean; hrOpen: number }) {
  return (
    <div>
      <ul className="divide-y divide-line" data-testid={`checklist-${employeeId}`}>
        {items.map((i) => <ItemRow key={i.id} item={i} canEdit={canEdit} />)}
      </ul>
      {canHandover && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-canvas px-4 py-3">
          <p className="text-sm text-muted">{hrOpen ? `Hand-over is possible once HR finishes ${hrOpen} more ${hrOpen === 1 ? "item" : "items"}.` : "HR's items are done. Confirm the hand-over to start onboarding with the Technical Lead."}</p>
          {hrOpen ? (
            <button type="button" disabled className={buttonClass("secondary")}><ArrowRightCircle size={15} />Confirm hand-over</button>
          ) : (
            <ConfirmAction testId={`handover-${employeeId}`} triggerLabel="Confirm hand-over" icon={<ArrowRightCircle size={15} />} variant="primary" confirmLabel="Move to onboarding"
              title={`Move ${name} to onboarding?`} description="The Technical Lead takes over and pre-boarding items can no longer be changed. This is recorded in the audit log."
              reasonLabel="Hand-over note" action={(note) => confirmHandoverAction({ employeeId, note })} success={`${name} is now in onboarding.`} />
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, canEdit }: { item: ChecklistItem; canEdit: boolean }) {
  const { pending, run } = useServerAction();
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState("");
  const save = (status: string, blockerReason?: string) => run(() => updatePreboardingItemAction({ itemId: item.id, status, blockerReason }), { success: "Checklist item updated.", onDone: () => { setBlocking(false); setReason(""); } });
  return (
    <li className="py-3" data-item={item.title}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", item.status === "DONE" || item.status === "NOT_APPLICABLE" ? "text-muted" : "text-ink")}>{item.title}</p>
          <p className="text-xs text-subtle">
            {PREBOARDING_CATEGORY_LABEL[item.category]} · {OWNER[item.ownerRole] ?? item.ownerRole} ·{" "}
            <span className={item.overdue ? "font-medium text-amber-700" : undefined}>{item.overdue ? "Overdue since " : "Due "}{fmt(item.dueDate)}</span>
          </p>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-2">
            {pending && <Loader2 size={14} className="animate-spin text-subtle" />}
            <label className="sr-only" htmlFor={`st-${item.id}`}>Status of {item.title}</label>
            <select id={`st-${item.id}`} className="field w-40 py-1.5" value={blocking ? "BLOCKED" : item.status} disabled={pending}
              onChange={(e) => (e.target.value === "BLOCKED" ? setBlocking(true) : (setBlocking(false), save(e.target.value)))}>
              {STATUSES.map((s) => <option key={s} value={s}>{ITEM_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        ) : <StatusPill tone={toneFor.item(item.status)}>{ITEM_STATUS_LABEL[item.status]}</StatusPill>}
      </div>
      {blocking && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input aria-label="What is blocking this item?" className="field max-w-md" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is blocking this item?" autoFocus />
          <button type="button" className={buttonClass("primary", "sm")} disabled={reason.trim().length < 3 || pending} onClick={() => save("BLOCKED", reason)}>Save</button>
          <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setBlocking(false)}>Cancel</button>
        </div>
      )}
      {item.status === "BLOCKED" && item.blockerReason && !blocking && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-700"><AlertTriangle size={13} />{item.blockerReason}</p>}
      {item.note && <p className="mt-1 text-xs text-subtle">{item.note}{item.evidenceId && <SourceChip id={item.evidenceId} label="Tracker entry" />}</p>}
    </li>
  );
}
