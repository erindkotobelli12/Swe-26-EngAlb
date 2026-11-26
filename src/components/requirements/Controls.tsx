"use client";
import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Check, Circle, CircleDashed, Clock, Loader2, MinusCircle, Pencil, Plus } from "lucide-react";
import {
  addProjectSkillsAction, claimSkillAction, createRequirementAction, decideSkillAction, retireRequirementAction, setRequirementStatusAction, updateRequirementAction,
} from "@/server/actions/requirements";
import { ConfirmAction, useServerAction } from "@/components/ui/actions";
import { Dialog, Popover } from "@/components/ui/overlays";
import { buttonClass, cn } from "@/components/ui/primitives";
import { REQUIREMENT_STATUS_LABEL, REQUIREMENT_TYPE_LABEL, SKILL_CATEGORY_LABEL, SKILL_LEVEL_LABEL, SKILL_SOURCE_LABEL } from "@/lib/labels";

type SkillOption = { id: string; name: string; category: string };
const LEVELS = ["BASIC", "INTERMEDIATE", "ADVANCED"] as const;

function SkillSelect({ id, skills, value, onChange, allowNone }: { id: string; skills: SkillOption[]; value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  const cats = [...new Set(skills.map((s) => s.category))];
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allowNone ? "No linked skill" : "Choose a skill"}</option>
      {cats.map((c) => <optgroup key={c} label={SKILL_CATEGORY_LABEL[c] ?? c}>{skills.filter((s) => s.category === c).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
    </select>
  );
}

/* ---------- Requirements editor (Technical Lead) ---------- */

export type RequirementDraft = { id?: string; title: string; description: string; type: string; skillId: string; requiredLevel: string; completionCriteria: string; mandatory: boolean };
const EMPTY: RequirementDraft = { title: "", description: "", type: "SKILL", skillId: "", requiredLevel: "BASIC", completionCriteria: "", mandatory: true };

export function RequirementDialog({ projectId, skills, initial }: { projectId: string; skills: SkillOption[]; initial?: RequirementDraft }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<RequirementDraft>(initial ?? EMPTY);
  const { pending, run } = useServerAction();
  const editing = Boolean(initial?.id);
  const canSkill = d.type === "SKILL" || d.type === "KT_ACTIVITY";
  const valid = d.title.trim().length >= 3 && d.completionCriteria.trim().length >= 3 && (d.type !== "SKILL" || d.skillId);
  function save() {
    const payload = { projectId, title: d.title, description: d.description, type: d.type, skillId: canSkill && d.skillId ? d.skillId : null, requiredLevel: canSkill && d.skillId ? d.requiredLevel : null, completionCriteria: d.completionCriteria, mandatory: d.mandatory };
    run(() => (editing ? updateRequirementAction(initial!.id!, payload) : createRequirementAction(payload)), { onDone: () => { setOpen(false); if (!editing) setD(EMPTY); } });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen} title={editing ? "Edit requirement" : "Add a requirement"} description="What every employee on this project needs for onboarding. Confirmed skills at the required level tick it off automatically." width={560}
      trigger={editing ? <button type="button" aria-label={`Edit ${initial!.title}`} className={buttonClass("ghost", "sm")}><Pencil size={14} /></button> : <button type="button" data-testid="add-requirement" className={buttonClass("primary")}><Plus size={15} />Add requirement</button>}
      footer={<><button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>Cancel</button><button type="button" data-testid="save-requirement" disabled={!valid || pending} className={buttonClass("primary")} onClick={save}>{pending && <Loader2 size={15} className="animate-spin" />}{editing ? "Save" : "Add requirement"}</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label" htmlFor="rq-title">Title</label><input id="rq-title" className="field" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Incident triage" /></div>
        <div><label className="label" htmlFor="rq-type">Type</label>
          <select id="rq-type" className="field" value={d.type} disabled={editing} onChange={(e) => setD({ ...d, type: e.target.value })}>
            {Object.entries(REQUIREMENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-body"><input type="checkbox" className="accent-brand-600" checked={d.mandatory} onChange={(e) => setD({ ...d, mandatory: e.target.checked })} />Mandatory</label>
        {canSkill && <>
          <div><label className="label" htmlFor="rq-skill">Linked skill{d.type === "KT_ACTIVITY" ? " (optional)" : ""}</label><SkillSelect id="rq-skill" skills={skills} value={d.skillId} allowNone={d.type === "KT_ACTIVITY"} onChange={(v) => setD({ ...d, skillId: v })} /></div>
          <div><label className="label" htmlFor="rq-level">Required level</label>
            <select id="rq-level" className="field" value={d.requiredLevel} disabled={!d.skillId} onChange={(e) => setD({ ...d, requiredLevel: e.target.value })}>{LEVELS.map((l) => <option key={l} value={l}>{SKILL_LEVEL_LABEL[l]} or higher</option>)}</select>
          </div>
        </>}
        <div className="sm:col-span-2"><label className="label" htmlFor="rq-criteria">How is it completed?</label><input id="rq-criteria" className="field" value={d.completionCriteria} onChange={(e) => setD({ ...d, completionCriteria: e.target.value })} placeholder="e.g. Handles a P2 incident end to end, observed by the Technical Lead" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="rq-desc">Description (optional)</label><textarea id="rq-desc" className="field min-h-[70px]" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></div>
      </div>
      {d.type === "KT_ACTIVITY" && <p className="mt-3 text-xs text-subtle">Each employee gets a knowledge-transfer activity, tracked like any other.</p>}
      {d.type === "ACCESS" && <p className="mt-3 text-xs text-subtle">Each employee gets an access request for this application. Only confirmed use counts.</p>}
    </Dialog>
  );
}

export function RetireRequirement({ id, title }: { id: string; title: string }) {
  return <ConfirmAction triggerLabel="Retire" variant="ghost" size="sm" title={`Retire "${title}"?`} description="It stops applying to employees. Their history is kept." confirmLabel="Retire requirement" action={(reason) => retireRequirementAction({ requirementId: id, reason })} />;
}

/* ---------- Matrix cell ---------- */

export type CellData = {
  statusId: string | null; status: string; stored: string | null; derived: "KT" | "ACCESS" | null; note: string | null;
  skill: { recordId: string; personId: string; name: string; level: string; status: string; source: string; projectName: string | null } | null;
};

const CELL: Record<string, { icon: typeof Check; className: string }> = {
  SATISFIED_BY_EXISTING_SKILL: { icon: BadgeCheck, className: "text-emerald-600" },
  DONE: { icon: Check, className: "text-emerald-600" },
  IN_PROGRESS: { icon: Clock, className: "text-amber-600" },
  POSSIBLY_COVERED: { icon: CircleDashed, className: "text-amber-600" },
  WAIVED: { icon: MinusCircle, className: "text-slate-400" },
  TODO: { icon: Circle, className: "text-slate-300" },
};

export function CellIcon({ status, size = 18 }: { status: string; size?: number }) {
  const c = CELL[status] ?? CELL.TODO;
  const Icon = c.icon;
  return <Icon size={size} className={c.className} aria-hidden />;
}

export function MatrixCellView({ cell, requirement, employee, canDecide }: { cell: CellData; requirement: string; employee: string; canDecide: boolean }) {
  const { pending, run } = useServerAction();
  const label = REQUIREMENT_STATUS_LABEL[cell.status] ?? cell.status;
  const set = (status: string, reason?: string) => cell.statusId && run(() => setRequirementStatusAction({ statusId: cell.statusId, status, reason }));
  return (
    <Popover width={300} trigger={
      <button type="button" data-testid="matrix-cell" data-status={cell.status} data-requirement={requirement} data-employee={employee} aria-label={`${requirement} for ${employee}: ${label}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-canvas">
        {pending ? <Loader2 size={16} className="animate-spin text-subtle" /> : <CellIcon status={cell.status} />}
      </button>
    }>
      <p className="text-xs text-subtle">{employee} · {requirement}</p>
      <p className="mt-1 flex items-center gap-1.5 font-medium text-ink"><CellIcon status={cell.status} size={16} />{label}</p>
      {cell.skill && (
        <div className="mt-2 rounded-md bg-canvas p-2.5 text-xs text-body">
          <p><span className="font-medium">{cell.skill.name}</span> · {SKILL_LEVEL_LABEL[cell.skill.level]} · {cell.skill.status === "CONFIRMED" ? "confirmed" : "claimed, not confirmed"}</p>
          <p className="mt-0.5 text-subtle">{SKILL_SOURCE_LABEL[cell.skill.source]}{cell.skill.projectName ? ` (${cell.skill.projectName})` : ""}</p>
          <Link href={`/people/${cell.skill.personId}#skills`} className="mt-1 inline-block font-medium text-brand-700 hover:underline">Open the skill record</Link>
        </div>
      )}
      {cell.status === "POSSIBLY_COVERED" && <p className="mt-2 text-xs text-amber-800">Possibly covered: the Technical Lead needs to confirm the claimed skill first.</p>}
      {cell.derived && <p className="mt-2 text-xs text-subtle">Progress comes from the linked {cell.derived === "KT" ? "knowledge-transfer activity" : "access request"}.</p>}
      {cell.note && <p className="mt-2 text-xs text-subtle">Note: {cell.note}</p>}
      {canDecide && cell.statusId && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          {cell.stored === "SATISFIED_BY_EXISTING_SKILL" ? (
            <ConfirmAction size="sm" variant="danger" triggerLabel="Undo check-off" title="Undo the automatic check-off?" description={`${employee} will need to complete "${requirement}". The skill stays on the profile.`} confirmLabel="Undo check-off"
              action={(reason) => setRequirementStatusAction({ statusId: cell.statusId, status: "TODO", reason })} testId="undo-checkoff" />
          ) : (
            <>
              {cell.stored !== "DONE" && !cell.derived && <button type="button" className={buttonClass("secondary", "sm")} onClick={() => set("DONE")}>Mark done</button>}
              {cell.stored !== "IN_PROGRESS" && !cell.derived && <button type="button" className={buttonClass("secondary", "sm")} onClick={() => set("IN_PROGRESS")}>In progress</button>}
              {cell.stored !== "TODO" && <button type="button" className={buttonClass("ghost", "sm")} onClick={() => set("TODO")}>Reset</button>}
              {cell.stored !== "WAIVED" && <ConfirmAction size="sm" variant="ghost" triggerLabel="Waive" title={`Waive "${requirement}" for ${employee}?`} confirmLabel="Waive" action={(reason) => setRequirementStatusAction({ statusId: cell.statusId, status: "WAIVED", reason })} />}
            </>
          )}
        </div>
      )}
    </Popover>
  );
}

/* ---------- Skills on profiles ---------- */

export function AddSkillDialog({ personId, skills }: { personId: string; skills: SkillOption[] }) {
  const [open, setOpen] = useState(false);
  const [skillId, setSkillId] = useState("");
  const [level, setLevel] = useState("BASIC");
  const { pending, run } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Add a skill" description="It shows as claimed until a Technical Lead confirms it. Only confirmed skills tick off onboarding requirements."
      trigger={<button type="button" data-testid="add-skill" className={buttonClass("secondary")}><Plus size={15} />Add skill</button>}
      footer={<><button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>Cancel</button><button type="button" disabled={!skillId || pending} className={buttonClass("primary")} onClick={() => run(() => claimSkillAction({ personId, skillId, level }), { onDone: () => setOpen(false) })}>{pending && <Loader2 size={15} className="animate-spin" />}Add skill</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="sk-skill">Skill</label><SkillSelect id="sk-skill" skills={skills} value={skillId} onChange={setSkillId} /></div>
        <div><label className="label" htmlFor="sk-level">Level</label><select id="sk-level" className="field" value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l} value={l}>{SKILL_LEVEL_LABEL[l]}</option>)}</select></div>
      </div>
    </Dialog>
  );
}

export function SkillDecision({ recordId, name, level }: { recordId: string; name: string; level: string }) {
  const [open, setOpen] = useState(false);
  const [lvl, setLvl] = useState(level);
  const { pending, run } = useServerAction();
  return (
    <span className="flex items-center gap-1.5">
      <Dialog open={open} onOpenChange={setOpen} title={`Confirm ${name}?`} description="Confirmed skills tick off matching onboarding requirements automatically."
        trigger={<button type="button" data-testid={`confirm-skill-${name}`} className={buttonClass("secondary", "sm")}>Confirm</button>}
        footer={<><button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>Cancel</button><button type="button" data-testid="confirm-skill-save" disabled={pending} className={buttonClass("primary")} onClick={() => run(() => decideSkillAction({ skillRecordId: recordId, decision: "CONFIRM", level: lvl }), { onDone: () => setOpen(false) })}>{pending && <Loader2 size={15} className="animate-spin" />}Confirm skill</button></>}>
        <label className="label" htmlFor={`lvl-${recordId}`}>Confirmed level</label>
        <select id={`lvl-${recordId}`} className="field" value={lvl} onChange={(e) => setLvl(e.target.value)}>{LEVELS.map((l) => <option key={l} value={l}>{SKILL_LEVEL_LABEL[l]}</option>)}</select>
      </Dialog>
      <ConfirmAction size="sm" variant="ghost" triggerLabel="Reject" title={`Reject ${name}?`} confirmLabel="Reject skill" action={(reason) => decideSkillAction({ skillRecordId: recordId, decision: "REJECT", reason })} />
    </span>
  );
}

export function AddProjectSkillsButton({ employeeId, skills }: { employeeId: string; skills: string[] }) {
  const { pending, run } = useServerAction();
  return (
    <button type="button" disabled={pending} className={cn(buttonClass("primary", "sm"))} onClick={() => run(() => addProjectSkillsAction({ employeeId }))}>
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Add {skills.length === 1 ? skills[0] : `${skills.length} skills`} to the profile
    </button>
  );
}
