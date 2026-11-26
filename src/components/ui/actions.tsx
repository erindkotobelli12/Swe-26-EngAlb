"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/server/principal";
import { Dialog } from "./overlays";
import { buttonClass, cn, type ButtonVariant } from "./primitives";
import { useToast } from "./Toast";

/** Runs a server action with a loading state, a toast on completion and a router refresh. */
export function useServerAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  function run<T>(action: () => Promise<ActionResult<T>>, opts: { success?: string | ((data: T) => string); onDone?: (data: T) => void } = {}) {
    start(async () => {
      try {
        const result = await action();
        if (!result.ok) { toast.error(result.error); return; }
        const msg = typeof opts.success === "function" ? opts.success(result.data) : opts.success ?? (typeof result.data === "string" ? result.data : "Saved.");
        toast.success(msg);
        opts.onDone?.(result.data);
        router.refresh();
      } catch {
        toast.error("Could not reach the server. Try again.");
      }
    });
  }
  return { pending, run };
}

export function ActionButton({ action, label, pendingLabel, variant = "secondary", size = "md", icon, success, className, testId }: {
  action: () => Promise<ActionResult<unknown>>; label: string; pendingLabel?: string; variant?: ButtonVariant; size?: "sm" | "md"; icon?: React.ReactNode;
  success?: string; className?: string; testId?: string;
}) {
  const { pending, run } = useServerAction();
  return (
    <button type="button" data-testid={testId} disabled={pending} onClick={() => run(action, { success })} className={cn(buttonClass(variant, size), className)}>
      {pending ? <Loader2 size={15} className="animate-spin" /> : icon}
      {pending ? pendingLabel ?? "Working…" : label}
    </button>
  );
}

/**
 * Consequential actions (validation, phase change, check-off undo, removal) ask for confirmation with a reason.
 * The reason is passed to the server action and recorded in the audit log.
 */
export function ConfirmAction({ action, triggerLabel, title, description, confirmLabel, variant = "secondary", size = "md", reasonLabel = "Reason", minReason = 3, success, icon, testId }: {
  action: (reason: string) => Promise<ActionResult<unknown>>; triggerLabel: string; title: string; description?: React.ReactNode; confirmLabel: string;
  variant?: ButtonVariant; size?: "sm" | "md"; reasonLabel?: string; minReason?: number; success?: string; icon?: React.ReactNode; testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, run } = useServerAction();
  const valid = reason.trim().length >= minReason;
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setReason(""); }} title={title} description={description}
      trigger={<button type="button" data-testid={testId} className={buttonClass(variant, size)}>{icon}{triggerLabel}</button>}
      footer={<>
        <button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" data-testid={testId ? `${testId}-confirm` : undefined} disabled={!valid || pending} className={buttonClass(variant === "danger" ? "danger" : "primary")}
          onClick={() => run(() => action(reason.trim()), { success, onDone: () => { setOpen(false); setReason(""); } })}>
          {pending && <Loader2 size={15} className="animate-spin" />}{confirmLabel}
        </button>
      </>}>
      <label className="label" htmlFor="confirm-reason">{reasonLabel}</label>
      <textarea id="confirm-reason" className="field min-h-[88px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why. This is saved in the audit log." />
      {!valid && reason.length > 0 && <p className="mt-1 text-xs text-subtle">Please write at least {minReason} characters.</p>}
    </Dialog>
  );
}
