"use client";
import Link from "next/link";
import { useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { Popover, Tooltip } from "./overlays";
import { cn } from "./primitives";

type EvidencePreview = { id: string; title: string; sourceType: string; sender: string; date: string; content: string; isSimulated: boolean };

/**
 * A quiet chip for a source. Opens the verbatim evidence excerpt in a popover (fetched on demand and
 * permission-checked server-side), so traceability stays one click away without filling the screen.
 */
export function SourceChip({ id, label, excerpt }: { id: string; label?: string; excerpt?: string }) {
  const [data, setData] = useState<EvidencePreview | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  async function load(open: boolean) {
    if (!open || data || state === "loading") return;
    setState("loading");
    try {
      const res = await fetch(`/api/evidence/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error();
      setData((await res.json()) as EvidencePreview);
      setState("idle");
    } catch {
      setState("error");
    }
  }
  return (
    <Popover onOpenChange={load} trigger={
      <button type="button" data-testid="source-chip" data-evidence-id={id} className="mx-0.5 inline-flex max-w-[220px] items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-px align-middle text-[11px] font-medium not-italic text-muted hover:border-brand-200 hover:text-brand-700">
        <FileText size={11} aria-hidden /><span className="truncate">{label ?? "Source"}</span>
      </button>
    }>
      {state === "loading" && <p className="flex items-center gap-2 text-subtle"><Loader2 size={14} className="animate-spin" />Loading source…</p>}
      {state === "error" && <p className="text-subtle">This source isn&apos;t available to you.</p>}
      {data && (
        <div>
          <p className="font-semibold text-ink">{data.title}</p>
          <p className="mt-0.5 text-xs text-subtle">{data.sender} · {data.date}{data.isSimulated ? " · simulated" : ""}</p>
          {excerpt && <p className="mt-3 border-l-2 border-emerald-300 bg-emerald-50/60 py-1 pl-2.5 text-sm italic text-body">“{excerpt}”</p>}
          <p className={cn("mt-3 whitespace-pre-wrap rounded-md bg-canvas p-2.5 text-[13px] text-body", excerpt && "text-xs")}>{data.content}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <code className="font-mono text-[11px] text-subtle">{data.id}</code>
            <Link href={`/evidence?focus=${encodeURIComponent(data.id)}`} className="text-xs font-medium text-brand-700 hover:underline">Open in evidence</Link>
          </div>
        </div>
      )}
    </Popover>
  );
}

/** Marks AI output. Details (model, time, approval need) are in the tooltip. */
export function AiChip({ model, at, note = "Needs your approval" }: { model?: string | null; at?: string | null; note?: string }) {
  return (
    <Tooltip content={<span>AI suggestion{model ? ` · ${model}` : ""}{at ? ` · ${at.slice(0, 16).replace("T", " ")}` : ""}<br />{note}</span>}>
      <span data-provenance="proposed" tabIndex={0} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
        <Sparkles size={11} aria-hidden />AI suggestion
      </span>
    </Tooltip>
  );
}

export function InfoTip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return <Tooltip content={content}><span tabIndex={0} className="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2">{children}</span></Tooltip>;
}
