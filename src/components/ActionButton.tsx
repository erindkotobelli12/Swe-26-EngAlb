"use client";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/server/principal";
import { useServerAction } from "@/components/ui/actions";
import { buttonClass, cn } from "@/components/ui/primitives";

/** Calls a bound server action with a loading state and a toast when it finishes (string results become the toast text). */
export default function ActionButton({
  action, label, pendingLabel, confirmText, className, icon, variant = "primary", size = "md",
}: {
  action: () => Promise<ActionResult<unknown>>;
  label: string;
  pendingLabel?: string;
  confirmText?: string;
  className?: string;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  const { pending, run } = useServerAction();
  return (
    <button type="button" disabled={pending} className={cn(buttonClass(variant, size), className)}
      onClick={() => { if (confirmText && !window.confirm(confirmText)) return; run(action); }}>
      {pending ? <Loader2 size={15} className="animate-spin" /> : icon}
      {pending ? pendingLabel ?? "Working…" : label}
    </button>
  );
}
