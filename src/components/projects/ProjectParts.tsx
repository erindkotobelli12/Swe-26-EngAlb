import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { HEALTH_LABEL, label, plural } from "@/lib/labels";
import type { PersonLite, ProjectSummary } from "@/modules/projects/queries";
import { Avatar, cn, PersonChip, PhaseStepper, SampleTag, StackedBar, StatusPill, toneFor } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";

export const PHASE_SEGMENTS = [
  { key: "PRE_BOARDING", label: "Pre-boarding", tone: "slate" },
  { key: "ONBOARDING", label: "Onboarding", tone: "brand" },
  { key: "READY", label: "Ready", tone: "green" },
] as const;

export function HealthPill({ status }: { status: string }) {
  return <StatusPill tone={toneFor.health(status)}>{HEALTH_LABEL[status] ?? status}</StatusPill>;
}

export function PhaseBar({ byPhase }: { byPhase: Record<string, number> }) {
  return (
    <div>
      <StackedBar segments={PHASE_SEGMENTS.map((s) => ({ value: byPhase[s.key] ?? 0, tone: s.tone, label: s.label }))} />
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle">
        {PHASE_SEGMENTS.map((s) => <span key={s.key} className="tabular">{s.label} <b className="font-semibold text-body">{byPhase[s.key] ?? 0}</b></span>)}
      </div>
    </div>
  );
}

function AvatarFor({ p, role }: { p: PersonLite | null; role: string }) {
  if (!p) {
    return (
      <Tooltip content={`${role}: not assigned`}>
        <span tabIndex={0} className="inline-grid h-7 w-7 place-items-center rounded-full border border-dashed border-amber-400 bg-amber-50 text-[10px] font-semibold text-amber-700 ring-2 ring-white" aria-label={`${role} not assigned`}>?</span>
      </Tooltip>
    );
  }
  return (
    <Tooltip content={`${role}: ${p.name ?? "known by role only"}${p.isSample ? " (sample data)" : ""}`}>
      <span tabIndex={0} aria-label={`${role}: ${p.name ?? "known by role only"}`}><Avatar name={p.name} size={28} muted={!p.name} /></span>
    </Tooltip>
  );
}

/** One project as a card: health and its reason, people per phase, who owns it, and open problems. */
export function ProjectCard({ p }: { p: ProjectSummary }) {
  return (
    <Link href={`/projects/${p.id}`} data-testid="project-card" data-project={p.name} className="block rounded-card border border-line bg-surface p-5 shadow-soft transition-colors hover:border-brand-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">{p.name}{p.isSimulated && <SampleTag className="ml-2" />}</p>
          <p className="text-xs text-subtle">{p.code ?? "No project code"}{p.status === "CLOSED" ? " · Closed" : ""}</p>
        </div>
        <HealthPill status={p.health.status} />
      </div>
      <p className="mt-2 text-sm text-muted" data-testid="health-reason">{p.health.headline}</p>
      <div className="mt-4"><PhaseBar byPhase={p.byPhase} /></div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex items-center -space-x-1.5">
          <AvatarFor p={p.additionalManager} role="Additional Manager" />
          {p.lineManagers.length ? p.lineManagers.map((lm) => <AvatarFor key={lm.id} p={lm} role="Line Manager" />) : <AvatarFor p={null} role="Line Manager" />}
          {p.techLeads.length ? p.techLeads.map((tl) => <AvatarFor key={`tl-${tl.id}`} p={tl} role="Technical Lead" />) : <AvatarFor p={null} role="Technical Lead" />}
        </div>
        <div className="flex items-center gap-3 text-xs text-subtle">
          <span className={cn("inline-flex items-center gap-1 tabular", p.openBlockers > 0 && "text-red-700")}><AlertTriangle size={13} aria-hidden />{plural(p.openBlockers, "blocker")}</span>
          <span className={cn("inline-flex items-center gap-1 tabular", p.overdue > 0 && "text-amber-700")}><Clock size={13} aria-hidden />{p.overdue} overdue</span>
        </div>
      </div>
    </Link>
  );
}

/** Hierarchy as an indented tree: Additional Manager → Line Managers → employees; the Technical Lead beside it. */
export function TeamTree({ p, actions }: { p: ProjectSummary; actions?: (assignmentId: string, name: string) => React.ReactNode }) {
  const unassigned = p.employees.filter((e) => !p.lineManagers.some((lm) => lm.id === e.lineManagerId));
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="rounded-card border border-line bg-surface p-5 shadow-soft" data-testid="team-tree">
        <TreeRow person={p.additionalManager} role="Additional Manager" />
        <ul className="ml-3 mt-2 space-y-3 border-l border-line pl-5">
          {p.lineManagers.map((lm) => {
            const team = p.employees.filter((e) => e.lineManagerId === lm.id);
            return (
              <li key={lm.id}>
                <TreeRow person={lm} role={p.techLeads.some((t) => t.id === lm.id) ? "Line Manager and Technical Lead" : "Line Manager"} action={actions?.(lm.assignmentId!, lm.name ?? "")} />
                <ul className="ml-3 mt-2 space-y-2 border-l border-line pl-5">
                  {team.length ? team.map((e) => (
                    <li key={e.personId} className="flex flex-wrap items-center justify-between gap-2">
                      <PersonChip name={e.name} href={e.employeeId ? `/employees/${e.employeeId}` : undefined} isSample={e.isSample} role={label("movement", e.movement)} />
                      <span className="flex items-center gap-3"><PhaseStepper phase={e.phase} compact />{actions?.(e.assignmentId, e.name)}</span>
                    </li>
                  )) : <li className="text-sm text-subtle">No employees yet</li>}
                </ul>
              </li>
            );
          })}
          {!p.lineManagers.length && <li><TreeRow person={undefined} role="Line Manager" /></li>}
          {unassigned.length > 0 && (
            <li>
              <p className="text-sm font-medium text-amber-700">Employees without a Line Manager</p>
              <ul className="ml-3 mt-2 space-y-2 border-l border-line pl-5">{unassigned.map((e) => <li key={e.personId}><PersonChip name={e.name} href={e.employeeId ? `/employees/${e.employeeId}` : undefined} isSample={e.isSample} /></li>)}</ul>
            </li>
          )}
        </ul>
      </div>
      <aside className="h-fit rounded-card border border-line bg-surface p-5 shadow-soft">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">Beside the reporting line</p>
        <div className="mt-3 space-y-2">
          {p.techLeads.length ? p.techLeads.map((t) => <TreeRow key={t.id} person={t} role={p.lineManagers.some((lm) => lm.id === t.id) ? "Technical Lead (also a Line Manager)" : "Technical Lead"} />) : <TreeRow person={undefined} role="Technical Lead" />}
        </div>
        <p className="mt-3 text-xs text-subtle">The Technical Lead handles onboarding and validates readiness. They can be one of the Line Managers.</p>
      </aside>
    </div>
  );
}

function TreeRow({ person, role, action }: { person: PersonLite | null | undefined; role: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {person ? <PersonChip name={person.name} role={role} isSample={person.isSample} href={`/people/${person.id}`} size={30} /> : <PersonChip name={undefined} missingLabel={`${role}: not assigned`} size={30} />}
      {action}
    </div>
  );
}
