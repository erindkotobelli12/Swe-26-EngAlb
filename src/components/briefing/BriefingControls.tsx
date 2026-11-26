"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText, Loader2, Printer } from "lucide-react";
import { generateBriefingAction } from "@/server/actions/briefing";
import { ErrorBox } from "@/components/ui/badges";

export function GenerateBriefingButton({ role }: { role: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  function go() {
    setError("");
    start(async () => {
      const r = await generateBriefingAction(role);
      if (!r.ok) return setError(r.error);
      router.push(`/briefing?role=${role}&id=${r.data}`);
      router.refresh();
    });
  }
  return (
    <div className="no-print space-y-2">
      <button type="button" disabled={pending} onClick={go} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{pending ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}{pending ? "Selecting facts and writing narrative…" : "Generate briefing"}</button>
      {pending && <p role="status" className="text-xs text-slate-500">Facts are selected by rules; the local model only rewrites them. If it is unavailable, the deterministic statements are kept.</p>}
      {error && <ErrorBox message={error} onRetry={go} />}
    </div>
  );
}

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="no-print inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-bold"><Printer size={13} />Print / save as PDF</button>;
}
