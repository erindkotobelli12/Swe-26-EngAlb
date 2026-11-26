"use client";
import { useMemo, useState } from "react";
import { History } from "lucide-react";

export type AuditEntry = { id: string; timestamp: string; actor: string; action: string; entityType: string; entityId: string; details: string; before: string | null; after: string | null; evidenceIds: string[] };

function pretty(json: string | null): string {
  if (!json) return "—";
  try {
    const v: unknown = JSON.parse(json);
    if (v === null) return "—";
    if (Array.isArray(v)) return `${v.length} item(s)`;
    if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : String(x)}`).join(", ");
    return String(v);
  } catch {
    return json;
  }
}

/** Chronological audit trail with before/after values, filterable by entity type. */
export default function HistoryTimeline({ entries }: { entries: AuditEntry[] }) {
  const types = useMemo(() => [...new Set(entries.map((e) => e.entityType))].sort(), [entries]);
  const [filter, setFilter] = useState("ALL");
  const shown = entries.filter((e) => filter === "ALL" || e.entityType === filter);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-600">Entity
          <select aria-label="Filter history by entity" value={filter} onChange={(e) => setFilter(e.target.value)} className="ml-2 rounded-lg border px-2 py-1 text-sm">
            <option value="ALL">All ({entries.length})</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      {shown.length === 0 ? <p className="text-sm text-slate-500">No history entries.</p> : (
        <ol className="relative space-y-3 border-l-2 border-slate-200 pl-5">
          {shown.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full bg-white ring-2 ring-indigo-300"><History size={9} className="text-indigo-600" /></span>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><b className="text-slate-800">{e.action.replaceAll("_", " ").toLowerCase()}</b><span className="text-slate-500">{new Date(e.timestamp).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · {e.actor}</span></div>
                <p className="mt-1 text-sm text-slate-700">{e.details}</p>
                {(e.before || e.after) && e.action !== "PIPELINE_RUN" && <p className="mt-1 text-xs text-slate-500"><span className="text-red-700">before</span> {pretty(e.before)} → <span className="text-emerald-700">after</span> {pretty(e.after)}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{e.entityType} {e.entityId}{e.evidenceIds.length ? ` · evidence ${e.evidenceIds.join(", ")}` : ""}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
