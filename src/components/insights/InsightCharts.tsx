"use client";
import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import { generateHypothesesAction } from "@/server/actions/insights";
import type { Hypothesis } from "@/modules/insights/service";
import { useToast } from "@/components/ui/Toast";
import { AiChip } from "@/components/ui/provenance";
import { buttonClass, SimulatedPill } from "@/components/ui/primitives";
import { CreateImprovementDialog, type OwnerOption, type ProjectOption } from "@/components/improvements/Improvements";

// Single-series magnitude charts in the brand hue, recessive grid, rounded bar ends, case list in the tooltip,
// value labels, and a table view for each chart.
const SERIES = "#4a6cf7";
const INK = "#667085";

type Datum = { label: string; value: number; caseIds: string[]; detail?: string };

function CasesTooltip({ active, payload, employees }: { active?: boolean; payload?: { payload: Datum }[]; employees: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="font-semibold text-ink">{d.label}: {d.value}</p>
      {d.detail && <p className="text-subtle">{d.detail}</p>}
      <p className="mt-1 text-muted">{d.caseIds.map((id) => employees[id] ?? id).join(", ")}</p>
    </div>
  );
}

export function BarPanel({ title, unit, data, employees, empty, simulated = false }: { title: string; unit: string; data: Datum[]; employees: Record<string, string>; empty: string; simulated?: boolean }) {
  const [table, setTable] = useState(false);
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-soft" aria-label={title}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">{title}{simulated && <SimulatedPill />}</h3>
          <p className="text-xs text-subtle">{unit}</p>
        </div>
        {data.length > 0 && <button type="button" onClick={() => setTable((t) => !t)} className={buttonClass("ghost", "sm")}>{table ? "Show chart" : "Show table"}</button>}
      </div>
      {data.length === 0 ? <p className="mt-6 text-sm text-subtle">{empty}</p> : table ? (
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs text-subtle"><tr><th className="py-1.5 font-medium">Item</th><th className="py-1.5 font-medium">Count</th><th className="py-1.5 font-medium">People</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label} className="border-t border-line"><td className="py-1.5 pr-2">{d.label}</td><td className="tabular py-1.5 pr-2 font-medium">{d.value}</td><td className="py-1.5">{d.caseIds.map((id) => simulated ? <span key={id} className="mr-1.5">{id}</span> : <Link key={id} href={`/employees/${id}`} className="mr-1.5 text-brand-700 hover:underline">{employees[id] ?? id}</Link>)}</td></tr>)}</tbody>
        </table>
      ) : (
        <div style={{ height: Math.max(120, data.length * 34 + 30) }} className="mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 8 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} stroke="#eef0f3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#f2f4f7" }} content={<CasesTooltip employees={employees} />} />
              <Bar dataKey="value" fill={simulated ? "#8b5cf6" : SERIES} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: INK }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/** AI root-cause hypotheses over the figures. Each recommendation can pre-fill an improvement; only a person creates it. */
export function HypothesesPanel({ employees, owners, projects, canCreate }: { employees: Record<string, string>; owners: OwnerOption[]; projects: ProjectOption[]; canCreate: boolean }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ hypotheses: Hypothesis[]; rejected: number; model: string; at: string } | null>(null);
  async function go() {
    setPending(true);
    try {
      const r = await generateHypothesesAction();
      if (!r.ok) toast.error(r.error);
      else if (!r.data.ok) toast.error(`The AI couldn't produce hypotheses (${r.data.error}). The figures are unaffected.`);
      else setResult({ hypotheses: r.data.hypotheses, rejected: r.data.rejected, model: r.data.run.model, at: new Date().toISOString() });
    } catch {
      toast.error("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Lightbulb size={16} className="text-amber-600" />Possible causes</h3>
        <button type="button" disabled={pending} onClick={go} className={buttonClass("secondary", "sm")}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{pending ? "Thinking…" : "Suggest causes"}</button>
      </div>
      <p className="mt-1 text-xs text-subtle">Hypotheses, not findings. Each must cite the figures and only the cases they count; anything else is rejected.</p>
      {result && (
        <div className="mt-3 space-y-3">
          {result.hypotheses.length === 0 && <p className="text-sm text-subtle">No suggestion passed the checks{result.rejected ? ` (${result.rejected} rejected)` : ""}.</p>}
          {result.hypotheses.map((h, i) => (
            <article key={i} className="rounded-lg border border-line p-3 text-sm">
              <div className="mb-1"><AiChip model={result.model} at={result.at} note="Hypothesis only — needs your judgement" /></div>
              <p className="text-body">{h.hypothesis}</p>
              <p className="mt-1 text-body"><span className="font-medium">Recommendation:</span> {h.recommendation}</p>
              <p className="mt-1 text-xs text-subtle">People: {h.caseIds.map((id) => employees[id] ?? id).join(", ") || "—"}</p>
              {canCreate && (
                <div className="mt-2">
                  <CreateImprovementDialog owners={owners} projects={projects} source="INSIGHT"
                    prefill={{ title: h.recommendation.slice(0, 120), description: `${h.recommendation}\n\nWhy: ${h.hypothesis}`, refs: [...h.figureKeys.map((k) => `figure:${k}`), ...h.caseIds.map((id) => `case:${id}`)] }} />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
