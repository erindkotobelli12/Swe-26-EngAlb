"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import { generateHypothesesAction } from "@/server/actions/insights";
import type { Hypothesis } from "@/modules/insights/service";
import { ErrorBox } from "@/components/ui/badges";

// Single-series magnitude charts: one hue (validated: #257de0 on white passes all checks), recessive grid,
// 4px rounded data ends, hover tooltip listing the cases, value labels (≤ 10 bars), table view below each chart.
const SERIES = "#257de0";
const INK = "#666666";

type Datum = { label: string; value: number; caseIds: string[]; detail?: string };

function CasesTooltip({ active, payload, employees }: { active?: boolean; payload?: { payload: Datum }[]; employees: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow">
      <p className="font-bold text-slate-800">{d.label}: {d.value}</p>
      {d.detail && <p className="text-slate-500">{d.detail}</p>}
      <p className="mt-1 text-slate-600">{d.caseIds.map((id) => employees[id] ?? id).join(", ")}</p>
    </div>
  );
}

export function BarPanel({ title, unit, data, employees, empty, simulated = false }: { title: string; unit: string; data: Datum[]; employees: Record<string, string>; empty: string; simulated?: boolean }) {
  const [table, setTable] = useState(false);
  return (
    <section className={`rounded-xl border bg-white p-4 ${simulated ? "border-violet-300" : "border-slate-200"}`} aria-label={title}>
      {simulated && <p className="sim-banner -mx-4 -mt-4 mb-3 rounded-t-xl px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white">Simulated data — not actual cases</p>}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {data.length > 0 && <button type="button" onClick={() => setTable((t) => !t)} className="text-xs font-semibold text-indigo-600">{table ? "Chart" : "Table"}</button>}
      </div>
      <p className="text-xs text-slate-500">{unit}</p>
      {data.length === 0 ? <p className="mt-6 text-sm text-slate-500">{empty}</p> : table ? (
        <table className="mt-3 w-full text-left text-xs">
          <thead className="text-slate-500"><tr><th className="py-1">Item</th><th className="py-1">Value</th><th className="py-1">Cases</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label} className="border-t border-slate-100"><td className="py-1 pr-2">{d.label}</td><td className="py-1 pr-2 font-semibold">{d.value}</td><td className="py-1">{d.caseIds.map((id) => simulated ? <span key={id} className="mr-1">{id}</span> : <Link key={id} href={`/employees/${id}`} className="mr-1 text-indigo-700 hover:underline">{employees[id] ?? id}</Link>)}</td></tr>)}</tbody>
        </table>
      ) : (
        <div style={{ height: Math.max(120, data.length * 34 + 30) }} className="mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 8 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} stroke="#eeeeee" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#f1f5f9" }} content={<CasesTooltip employees={employees} />} />
              <Bar dataKey="value" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: INK }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export function HypothesesPanel({ employees }: { employees: Record<string, string> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ hypotheses: Hypothesis[]; rejected: number; model: string; runId: string } | null>(null);
  const [error, setError] = useState("");
  function go() {
    setError("");
    start(async () => {
      const r = await generateHypothesesAction();
      if (!r.ok) return setError(r.error);
      if (!r.data.ok) return setError(`Bottleneck Insight Agent failed: ${r.data.error}. The figures above are unaffected.`);
      setResult({ hypotheses: r.data.hypotheses, rejected: r.data.rejected, model: r.data.run.model, runId: r.data.run.id });
    });
  }
  return (
    <section className="rounded-xl border border-dashed border-violet-300 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold"><Lightbulb size={16} className="text-amber-600" />Root-cause hypotheses (AI)</h3>
        <button type="button" disabled={pending} onClick={go} className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">{pending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}Generate hypotheses</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Hypotheses, not findings. Each must cite the figures above and only the cases they count; anything else is rejected. Ten cases cannot show a trend.</p>
      {pending && <p role="status" className="mt-2 text-xs text-slate-500">Asking the local model…</p>}
      {error && <div className="mt-2"><ErrorBox message={error} onRetry={go} /></div>}
      {result && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-slate-500">{result.model} · run {result.runId.slice(-6)}{result.rejected ? ` · ${result.rejected} hypothesis(es) rejected for invalid citations` : ""}</p>
          {result.hypotheses.length === 0 && <p className="text-sm text-slate-500">No hypothesis passed validation.</p>}
          {result.hypotheses.map((h, i) => (
            <article key={i} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-sm">
              <p><span className="mr-1 text-[11px] font-bold uppercase text-amber-700">Hypothesis</span>{h.hypothesis}</p>
              <p className="mt-1"><span className="mr-1 text-[11px] font-bold uppercase text-indigo-700">Recommendation</span>{h.recommendation}</p>
              <p className="mt-1 text-xs text-slate-500">Cites: {h.figureKeys.join(", ")} · cases: {h.caseIds.map((id) => employees[id] ?? id).join(", ") || "—"}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
