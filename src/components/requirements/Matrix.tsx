import Link from "next/link";
import { ListChecks } from "lucide-react";
import { REQUIREMENT_STATUS_LABEL, REQUIREMENT_TYPE_LABEL, SKILL_LEVEL_LABEL } from "@/lib/labels";
import type { loadRequirementMatrix } from "@/modules/requirements/queries";
import { Card, EmptyState, SampleTag, StatusPill } from "@/components/ui/primitives";
import { CellIcon, MatrixCellView, RequirementDialog, RetireRequirement } from "./Controls";

type Matrix = NonNullable<Awaited<ReturnType<typeof loadRequirementMatrix>>>;

const LEGEND = ["SATISFIED_BY_EXISTING_SKILL", "DONE", "IN_PROGRESS", "POSSIBLY_COVERED", "TODO", "WAIVED"];

/** Requirements editor (Technical Lead edits; everyone else reads) and the requirements × employees matrix. */
export function RequirementsSection({ m }: { m: Matrix }) {
  const active = m.requirements.filter((r) => r.status === "ACTIVE");
  const retired = m.requirements.filter((r) => r.status === "RETIRED");
  return (
    <div className="space-y-6">
      <Card title="Onboarding requirements" subtitle={m.canManage ? "What everyone on this project needs. You can add, edit or retire requirements." : "Defined by the project's Technical Lead."}
        actions={m.canManage ? <RequirementDialog projectId={m.project.id} skills={m.skills} /> : undefined}>
        {active.length ? (
          <ul className="divide-y divide-line" data-testid="requirements-list">
            {active.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{r.title}{!r.mandatory && <span className="ml-2 text-xs font-normal text-subtle">optional</span>}</p>
                  <p className="text-xs text-subtle">{REQUIREMENT_TYPE_LABEL[r.type]}{r.skillName ? ` · ${r.skillName}, ${SKILL_LEVEL_LABEL[r.requiredLevel ?? "BASIC"].toLowerCase()} or higher` : ""} · {r.completionCriteria}</p>
                </div>
                {m.canManage && (
                  <span className="flex items-center gap-1">
                    <RequirementDialog projectId={m.project.id} skills={m.skills} initial={{ id: r.id, title: r.title, description: r.description, type: r.type, skillId: r.skillId ?? "", requiredLevel: r.requiredLevel ?? "BASIC", completionCriteria: r.completionCriteria, mandatory: r.mandatory }} />
                    <RetireRequirement id={r.id} title={r.title} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={ListChecks} title="No onboarding requirements yet." action={m.canManage ? <RequirementDialog projectId={m.project.id} skills={m.skills} /> : undefined}>{m.canManage ? "Add what people need for this project. Confirmed skills tick requirements off automatically." : "The project's Technical Lead hasn't defined any yet."}</EmptyState>}
        {retired.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer text-subtle">Retired ({retired.length})</summary><ul className="mt-2 space-y-1 text-subtle">{retired.map((r) => <li key={r.id}>{r.title}</li>)}</ul></details>}
      </Card>

      {active.length > 0 && (
        <Card title="Progress" subtitle="Requirements down the side, people across the top. Select a cell for details.">
          {m.employees.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" data-testid="requirements-matrix">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 bg-surface px-3 py-2 text-left text-xs font-medium text-subtle">Requirement</th>
                    {m.employees.map((e) => (
                      <th key={e.employeeId} scope="col" className="px-2 py-2 text-center text-xs font-medium text-subtle">
                        <Link href={`/employees/${e.employeeId}?tab=requirements`} className="block whitespace-nowrap text-ink hover:underline">{e.name}</Link>
                        {e.isSample && <SampleTag />}
                        <span className="tabular mt-0.5 block font-normal">{m.progress[e.employeeId]?.done ?? 0} of {m.progress[e.employeeId]?.total ?? 0}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left font-normal"><span className="text-ink">{r.title}</span><span className="block text-xs text-subtle">{REQUIREMENT_TYPE_LABEL[r.type]}</span></th>
                      {m.employees.map((e) => {
                        const cell = m.cells[r.id]?.[e.employeeId];
                        return <td key={e.employeeId} className="px-2 py-1 text-center">{cell ? <MatrixCellView cell={cell} requirement={r.title} employee={e.name} canDecide={m.canManage} /> : null}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-subtle">No employees on this project yet.</p>}
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-subtle" aria-label="Legend">
            {LEGEND.map((s) => <li key={s} className="flex items-center gap-1.5"><CellIcon status={s} size={14} />{REQUIREMENT_STATUS_LABEL[s]}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** One employee's column of the matrix, as a list. */
export function EmployeeRequirements({ m, employeeId, canDecide }: { m: Matrix; employeeId: string; canDecide: boolean }) {
  const active = m.requirements.filter((r) => r.status === "ACTIVE");
  const employee = m.employees.find((e) => e.employeeId === employeeId);
  if (!active.length || !employee) return <EmptyState icon={ListChecks} title="No onboarding requirements for this project yet.">The project&apos;s Technical Lead defines them.</EmptyState>;
  const p = m.progress[employeeId];
  return (
    <Card title="Onboarding requirements" subtitle={`${p?.done ?? 0} of ${p?.total ?? 0} done or already covered by a confirmed skill.`}>
      <ul className="divide-y divide-line" data-testid="employee-requirements">
        {active.map((r) => {
          const cell = m.cells[r.id]?.[employeeId];
          if (!cell) return null;
          return (
            <li key={r.id} className="flex items-center gap-3 py-2.5" data-requirement={r.title} data-status={cell.status}>
              <MatrixCellView cell={cell} requirement={r.title} employee={employee.name} canDecide={canDecide} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{r.title}</p>
                <p className="text-xs text-subtle">{cell.status === "SATISFIED_BY_EXISTING_SKILL" && cell.skill ? `Already has this skill: ${cell.skill.name} (${SKILL_LEVEL_LABEL[cell.skill.level].toLowerCase()}, confirmed)` : r.completionCriteria}</p>
              </div>
              <StatusPill tone={cell.status === "DONE" || cell.status === "SATISFIED_BY_EXISTING_SKILL" ? "green" : cell.status === "POSSIBLY_COVERED" || cell.status === "IN_PROGRESS" ? "amber" : "slate"}>{REQUIREMENT_STATUS_LABEL[cell.status]}</StatusPill>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
