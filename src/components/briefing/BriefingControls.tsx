"use client";
import { FileText, Loader2, Printer } from "lucide-react";
import { generateBriefingAction } from "@/server/actions/briefing";
import { useServerAction } from "@/components/ui/actions";
import { buttonClass } from "@/components/ui/primitives";

export function GenerateBriefingButton({ role, projectId, label = "Generate briefing", variant = "primary" }: { role: string; projectId?: string | null; label?: string; variant?: "primary" | "secondary" }) {
  const { pending, run } = useServerAction();
  return (
    <button type="button" data-testid="generate-briefing" disabled={pending} className={`no-print ${buttonClass(variant)}`}
      onClick={() => run(() => generateBriefingAction(role, projectId ?? null), { success: "Briefing generated." })}>
      {pending ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
      {pending ? "Writing briefing…" : label}
    </button>
  );
}

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className={`no-print ${buttonClass("ghost", "sm")}`}><Printer size={14} />Print or save as PDF</button>;
}
