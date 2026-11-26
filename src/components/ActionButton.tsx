"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/server/principal";

/**
 * Calls a bound server action with visible pending, success and error-with-retry states.
 * If the action returns a string, it is shown as the success message.
 */
export default function ActionButton({
  action, label, pendingLabel, confirmText, className, icon, variant = "primary",
}: {
  action: () => Promise<ActionResult<unknown>>;
  label: string;
  pendingLabel?: string;
  confirmText?: string;
  className?: string;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const styles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variant];

  function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setError("");
    setMessage("");
    start(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.error);
        else {
          if (typeof result.data === "string") setMessage(result.data);
          router.refresh();
        }
      } catch {
        setError("Could not reach the server. Try again.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={run} disabled={pending} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-60 ${styles} ${className ?? ""}`}>
        {pending ? <Loader2 size={15} className="animate-spin" /> : icon}
        {pending ? pendingLabel ?? "Working…" : label}
      </button>
      {error && <span role="alert" className="flex items-center gap-2 text-xs text-red-700">{error}<button type="button" className="font-bold underline" onClick={run}>Retry</button></span>}
      {message && <span role="status" className="text-xs text-emerald-700">{message}</span>}
    </span>
  );
}
