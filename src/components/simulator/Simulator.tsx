"use client";
import { useState, useTransition } from "react";
import { ArrowRight, FlaskConical, Loader2, Sparkles } from "lucide-react";
import { explainSimulationAction, runSimulationAction, type Explanation } from "@/server/actions/simulator";
import { overridesFrom, type Choice } from "@/modules/simulator/choices";
import type { SimulationResult, Toggle } from "@/modules/simulator/simulate";
import { ErrorBox, GateIcon, ProvenanceBadge } from "@/components/ui/badges";

export function SimulationBanner() {
  return (
    <div className="sticky top-16 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-violet-50 px-4 py-2 text-violet-800 ring-1 ring-inset ring-violet-200" role="note" data-testid="simulation-banner">
      <p className="flex items-center gap-2 text-sm font-medium"><FlaskConical size={16} />Simulation — not actual employee readiness</p>
      <p className="text-xs text-violet-700">Computed on a copy of the case. Nothing here is saved to the employee record.</p>
    </div>
  );
}

export default function Simulator({ employeeId, toggles, initialChoice, initialResult, actualLevel }: { employeeId: string; toggles: Toggle[]; initialChoice: Choice; initialResult: SimulationResult; actualLevel: string }) {
  const [choice, setChoiceState] = useState<Choice>(initialChoice);
  const [includeProposed, setIncludeProposed] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(initialResult);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [explaining, startExplain] = useTransition();
  const [explanation, setExplanation] = useState<Explanation | null>(null);

  /** Re-simulates on the server (read-only) whenever a toggle changes. */
  function update(nextChoice: Choice, nextInclude: boolean) {
    setChoiceState(nextChoice);
    setIncludeProposed(nextInclude);
    setExplanation(null);
    start(async () => {
      const r = await runSimulationAction(employeeId, overridesFrom(toggles, nextChoice, nextInclude));
      if (!r.ok) { setError(r.error); return; }
      setError("");
      setResult(r.data);
    });
  }
  const setChoice = (next: Choice) => update(next, includeProposed);

  function explain() {
    startExplain(async () => {
      const r = await explainSimulationAction(employeeId, overridesFrom(toggles, choice, includeProposed));
      setExplanation(r.ok ? r.data : { ok: false, error: r.error, aiRunId: "" });
    });
  }

  const groups = [...new Set(toggles.map((t) => t.group))];
  return (
    <div className="space-y-4">
      <SimulationBanner />
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <section className="sim-stripes rounded-xl border border-violet-300 p-4" aria-label="What-if toggles">
          <h3 className="font-semibold text-violet-900">What if…</h3>
          <p className="text-xs text-violet-800">Toggles come from this case&apos;s actual unsatisfied items.</p>
          {toggles.length === 0 && <p className="mt-3 text-sm">Nothing left to simulate — every item is satisfied.</p>}
          {groups.map((g) => (
            <div key={g} className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">{g}</p>
              <div className="mt-1 space-y-2">
                {toggles.filter((t) => t.group === g).map((t) => t.kind === "check" ? (
                  <label key={t.key} className="flex items-start gap-2 rounded-lg bg-white/80 p-2 text-sm"><input type="checkbox" checked={Boolean(choice[t.key])} onChange={(e) => setChoice({ ...choice, [t.key]: e.target.checked ? "on" : "" })} className="mt-1" data-toggle={t.key} />{t.label}</label>
                ) : (
                  <label key={t.key} className="block rounded-lg bg-white/80 p-2 text-sm">{t.label}
                    <select aria-label={`Simulate ${t.label}`} data-toggle={t.key} value={choice[t.key] ?? ""} onChange={(e) => setChoice({ ...choice, [t.key]: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-sm">
                      <option value="">No change</option>
                      {t.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm"><input type="checkbox" checked={includeProposed} onChange={(e) => update(choice, e.target.checked)} className="mt-1" data-toggle="include-proposed" />Include proposed dependencies and KT requirements (off by default)</label>
          <button type="button" onClick={() => setChoice({})} className="mt-3 text-xs font-semibold text-violet-800 underline">Reset all toggles</button>
        </section>

        <section className="space-y-4" aria-label="Simulation result">
          {error && <ErrorBox message={error} />}
          {!result && pending && <p role="status" className="flex items-center gap-2 text-sm text-subtle"><Loader2 size={15} className="animate-spin" />Simulating…</p>}
          {result && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-card border border-line bg-surface shadow-soft p-4">
                  <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-subtle">Current (actual)</p><ProvenanceBadge state="actual" /></div>
                  <p className="mt-2 text-xl font-semibold" data-testid="sim-current">{result.current.level}</p>
                  <p className="mt-1 text-xs text-subtle">Stored assessed level: {actualLevel} — unchanged by simulation.</p>
                </div>
                <div className="sim-stripes rounded-xl border-2 border-violet-400 p-4">
                  <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-violet-700">Simulated</p><ProvenanceBadge state="simulated" /></div>
                  <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-violet-900" data-testid="sim-result">{result.current.level !== result.simulated.level && <ArrowRight size={18} />}{result.simulated.level}</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-violet-900">{result.simulated.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  {result.usedProposed && <p className="mt-2 text-xs font-semibold text-amber-800">Uses proposed (unconfirmed) dependencies.</p>}
                </div>
              </div>
              {pending && <p role="status" className="text-xs text-subtle">Updating…</p>}
              <div className="grid gap-3 lg:grid-cols-2">
                <ResultList title="Gates flipped" empty="No gate changes." items={result.gatesFlipped.map((g) => <span key={g.id} className="flex items-center gap-2"><GateIcon status={g.before} /><ArrowRight size={12} /><GateIcon status={g.after} />{g.label}</span>)} testId="sim-gates" />
                <ResultList title="Blockers that disappear" empty="None." items={result.blockersRemoved.map((b) => <span key={b}>{b}</span>)} testId="sim-blockers" />
                <ResultList title="Activities that become unblocked" empty="None." items={result.unblockedActivities.map((b) => <span key={b}>{b}</span>)} />
                <ResultList title="Simulated changes" empty="No toggles selected." items={result.changes.map((c) => <span key={c}>{c}</span>)} />
              </div>
              <div className="rounded-card border border-line bg-surface shadow-soft p-4" data-testid="sim-order">
                <p className="font-semibold">Remaining prerequisites — minimal set in recommended order ({result.recommendedOrder.length})</p>
                <p className="mt-1 text-xs text-subtle">Assumption: the dependency graph is AND-only, so the unsatisfied confirmed ancestors of Readiness are exactly what must still be resolved. Order: dependencies first, ties broken by downstream impact.</p>
                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm">{result.recommendedOrder.map((r) => <li key={r} className={result.rootBlockersAfter.includes(r) ? "font-semibold text-red-700" : ""}>{r}</li>)}</ol>
              </div>
              <div className="rounded-xl border border-violet-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">AI explanation</p><button type="button" onClick={explain} disabled={explaining} className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{explaining ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}Explain this simulation</button></div>
                {!explanation && !explaining && <p className="mt-2 text-xs text-subtle">Optional. Narrates only the deterministic result above; the diff stays available if the model is down.</p>}
                {explanation?.ok && <div className="mt-2"><ProvenanceBadge state="simulated" /> <span className="text-[11px] text-subtle">AI-written · {explanation.model} · run {explanation.aiRunId.slice(-6)}</span><p className="mt-1 text-sm text-body">{explanation.narrative}</p>{explanation.references.length > 0 && <p className="mt-1 text-xs text-subtle">Refers to: {explanation.references.join("; ")}</p>}</div>}
                {explanation && !explanation.ok && <div className="mt-2"><ErrorBox message={`AI explanation unavailable: ${explanation.error}`} onRetry={explain} /></div>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ResultList({ title, items, empty, testId }: { title: string; items: React.ReactNode[]; empty: string; testId?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface shadow-soft p-4" data-testid={testId}>
      <p className="text-sm font-semibold">{title}</p>
      {items.length ? <ul className="mt-2 space-y-1 text-sm">{items.map((i, n) => <li key={n}>{i}</li>)}</ul> : <p className="mt-2 text-sm text-subtle">{empty}</p>}
    </div>
  );
}
