"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { createProjectAction, updateProjectAction } from "@/server/actions/projects";
import { useServerAction } from "@/components/ui/actions";
import { Avatar, buttonClass, cn, SampleTag } from "@/components/ui/primitives";

type Option = { id: string; name: string; isSample: boolean; projects: string[] };
type EmployeeOption = Option & { hasHistory: boolean };
type Pick = { key: string; personId?: string; newName?: string; name: string; lineManagerId: string; movement: "New Hire" | "Reallocation"; derived: "New Hire" | "Reallocation"; isSample: boolean };
export type WizardInitial = { name: string; code: string; description: string; startDate: string; additionalManagerId: string; lineManagerIds: string[] };

const STEPS = ["Details", "Additional Manager", "Line Managers", "Employees", "Review"] as const;

/**
 * Create or edit a project in four steps. Saving creates project assignments and, for each new employee,
 * an onboarding case in pre-boarding with the default checklist. Existing employees are edited on the Team tab.
 */
export default function ProjectWizard({ mode, projectId, initial, options }: {
  mode: "create" | "edit"; projectId?: string; initial: WizardInitial;
  options: { additionalManagers: Option[]; lineManagers: Option[]; employees: EmployeeOption[] };
}) {
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState({ name: initial.name, code: initial.code, description: initial.description, startDate: initial.startDate });
  const [am, setAm] = useState(initial.additionalManagerId);
  const [lms, setLms] = useState<string[]>(initial.lineManagerIds);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [newName, setNewName] = useState("");

  const nameOf = (id: string, list: Option[]) => list.find((o) => o.id === id)?.name ?? "Unknown";
  const available = useMemo(() => options.employees.filter((e) => !picks.some((p) => p.personId === e.id)), [options.employees, picks]);
  const valid = [details.name.trim().length >= 2, Boolean(am), lms.length > 0, picks.every((p) => lms.includes(p.lineManagerId)), true];

  function addExisting(e: EmployeeOption) {
    const derived = e.hasHistory ? "Reallocation" : "New Hire";
    setPicks((xs) => [...xs, { key: e.id, personId: e.id, name: e.name, lineManagerId: lms[0] ?? "", movement: derived, derived, isSample: e.isSample }]);
  }
  function addNew() {
    const n = newName.trim();
    if (n.length < 2) return;
    setPicks((xs) => [...xs, { key: `new-${Date.now()}`, newName: n, name: n, lineManagerId: lms[0] ?? "", movement: "New Hire", derived: "New Hire", isSample: false }]);
    setNewName("");
  }
  function save() {
    const payload = {
      details, additionalManagerId: am, lineManagerIds: lms,
      employees: picks.map((p) => ({ personId: p.personId, newName: p.newName, lineManagerId: p.lineManagerId, movement: p.movement })),
    };
    run(() => (mode === "create" ? createProjectAction(payload) : updateProjectAction(projectId!, payload)), {
      success: mode === "create" ? "Project created. New employees start in pre-boarding." : "Project saved.",
      onDone: (id) => router.push(`/projects/${id}?tab=team`),
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <ol className="space-y-1" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => i <= step && setStep(i)} disabled={i > step} aria-current={i === step ? "step" : undefined}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm", i === step ? "bg-brand-50 font-medium text-brand-700" : i < step ? "text-body hover:bg-canvas" : "text-subtle")}>
              <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold", i < step ? "bg-emerald-500 text-white" : i === step ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500")}>{i < step ? <Check size={12} /> : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <section className="rounded-card border border-line bg-surface p-6 shadow-soft">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label" htmlFor="p-name">Project name</label><input id="p-name" className="field" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} placeholder="e.g. Borealis" /></div>
            <div><label className="label" htmlFor="p-code">Project code (optional)</label><input id="p-code" className="field" value={details.code} onChange={(e) => setDetails({ ...details, code: e.target.value })} placeholder="e.g. BOR-101" /></div>
            <div><label className="label" htmlFor="p-start">Start date (optional)</label><input id="p-start" type="date" className="field" value={details.startDate} onChange={(e) => setDetails({ ...details, startDate: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="p-desc">Description (optional)</label><textarea id="p-desc" className="field min-h-[90px]" value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} /></div>
          </div>
        )}

        {step === 1 && (
          <PersonRadioList legend="Who is the Additional Manager?" hint="They oversee the Line Managers and choose the Technical Lead." name="am" options={options.additionalManagers} value={am} onChange={setAm} />
        )}

        {step === 2 && (
          <fieldset>
            <legend className="text-base font-semibold text-ink">Which Line Managers work on this project?</legend>
            <p className="mt-1 text-sm text-subtle">Each employee will report to one of them.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {options.lineManagers.map((o) => (
                <label key={o.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5", lms.includes(o.id) ? "border-brand-500 bg-brand-50" : "border-line hover:bg-canvas")}>
                  <input type="checkbox" className="accent-brand-600" checked={lms.includes(o.id)} onChange={(e) => setLms((xs) => (e.target.checked ? [...xs, o.id] : xs.filter((x) => x !== o.id)))} />
                  <PersonOption o={o} />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-base font-semibold text-ink">Assign employees</h2>
            <p className="mt-1 text-sm text-subtle">Each person starts in pre-boarding with the default checklist. People with an earlier project are marked as a reallocation; you can change it.</p>
            {picks.length > 0 && (
              <ul className="mt-4 divide-y divide-line rounded-lg border border-line" data-testid="picked-employees">
                {picks.map((p) => (
                  <li key={p.key} className="grid items-center gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_200px_170px_auto]">
                    <span className="flex items-center gap-2"><Avatar name={p.name} size={26} /><span className="text-sm font-medium text-ink">{p.name}</span>{p.isSample && <SampleTag />}{p.newName && <span className="text-xs text-subtle">new person</span>}</span>
                    <label className="text-xs text-subtle">Reports to
                      <select className="field mt-1" value={p.lineManagerId} onChange={(e) => setPicks((xs) => xs.map((x) => (x.key === p.key ? { ...x, lineManagerId: e.target.value } : x)))}>
                        <option value="" disabled>Choose a Line Manager</option>
                        {lms.map((id) => <option key={id} value={id}>{nameOf(id, options.lineManagers)}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-subtle">Movement{p.movement !== p.derived && <span className="ml-1 text-amber-700">(changed)</span>}
                      <select className="field mt-1" value={p.movement} onChange={(e) => setPicks((xs) => xs.map((x) => (x.key === p.key ? { ...x, movement: e.target.value as Pick["movement"] } : x)))}>
                        <option value="New Hire">New hire</option>
                        <option value="Reallocation">Reallocation</option>
                      </select>
                    </label>
                    <button type="button" aria-label={`Remove ${p.name}`} className={buttonClass("ghost", "sm")} onClick={() => setPicks((xs) => xs.filter((x) => x.key !== p.key))}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="label">Available people</p>
                {available.length ? (
                  <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-line p-1">
                    {available.map((e) => (
                      <li key={e.id}>
                        <button type="button" data-testid={`add-person-${e.id}`} onClick={() => addExisting(e)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-canvas">
                          <PersonOption o={e} sub={e.hasHistory ? "Has an earlier project · reallocation" : "No earlier project · new hire"} />
                          <Plus size={15} className="ml-auto text-subtle" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="rounded-lg border border-dashed border-line p-4 text-sm text-subtle">Everyone available has been added.</p>}
              </div>
              <div>
                <label className="label" htmlFor="new-person">Someone new</label>
                <div className="flex gap-2">
                  <input id="new-person" className="field" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } }} />
                  <button type="button" className={buttonClass("secondary")} onClick={addNew} disabled={newName.trim().length < 2}><Plus size={15} />Add</button>
                </div>
                <p className="mt-1 text-xs text-subtle">Creates a new person with an empty profile.</p>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-subtle">Project</dt><dd className="font-medium text-ink">{details.name}{details.code ? ` · ${details.code}` : ""}</dd></div>
            <div><dt className="text-xs text-subtle">Start date</dt><dd className="text-ink">{details.startDate || "Not set"}</dd></div>
            <div><dt className="text-xs text-subtle">Additional Manager</dt><dd className="text-ink">{am ? nameOf(am, options.additionalManagers) : "Not chosen"}</dd></div>
            <div><dt className="text-xs text-subtle">Line Managers</dt><dd className="text-ink">{lms.map((id) => nameOf(id, options.lineManagers)).join(", ")}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-subtle">{mode === "edit" ? "Employees to add" : "Employees"}</dt>
              <dd className="text-ink">{picks.length ? picks.map((p) => `${p.name} (${p.movement === "New Hire" ? "new hire" : "reallocation"}, reports to ${nameOf(p.lineManagerId, options.lineManagers)})`).join("; ") : "None yet"}</dd></div>
            <p className="text-xs text-subtle sm:col-span-2">The Technical Lead is chosen afterwards by the Additional Manager.</p>
          </dl>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <button type="button" className={buttonClass("ghost")} disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ChevronLeft size={15} />Back</button>
          {step < STEPS.length - 1
            ? <button type="button" data-testid="wizard-next" className={buttonClass("primary")} disabled={!valid[step]} onClick={() => setStep((s) => s + 1)}>Next<ChevronRight size={15} /></button>
            : <button type="button" data-testid="wizard-save" className={buttonClass("primary")} disabled={pending || !valid.every(Boolean)} onClick={save}>{pending && <Loader2 size={15} className="animate-spin" />}{mode === "create" ? "Create project" : "Save changes"}</button>}
        </div>
      </section>
    </div>
  );
}

function PersonOption({ o, sub }: { o: Option; sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={o.name} size={28} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{o.name}{o.isSample && <SampleTag className="ml-1.5" />}</span>
        <span className="block truncate text-xs text-subtle">{sub ?? (o.projects.length ? o.projects.join(", ") : "No current project")}</span>
      </span>
    </span>
  );
}

function PersonRadioList({ legend, hint, name, options, value, onChange }: { legend: string; hint: string; name: string; options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="text-base font-semibold text-ink">{legend}</legend>
      <p className="mt-1 text-sm text-subtle">{hint}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5", value === o.id ? "border-brand-500 bg-brand-50" : "border-line hover:bg-canvas")}>
            <input type="radio" name={name} className="accent-brand-600" checked={value === o.id} onChange={() => onChange(o.id)} />
            <PersonOption o={o} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
