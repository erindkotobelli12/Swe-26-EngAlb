import Link from "next/link";
import { AlertTriangle, CalendarClock, ChevronDown, ClipboardList, UserX } from "lucide-react";
import { thresholds } from "@/config/thresholds";
import { formatDate } from "@/lib/clock";
import type { PreboardingRow } from "@/modules/preboarding/queries";
import { Avatar, EmptyState, SampleTag, StackedBar, StatusPill } from "@/components/ui/primitives";
import { PreboardingChecklist } from "./Checklist";

export function startLabel(daysToStart: number): string {
  if (daysToStart > 1) return `Starts in ${daysToStart} days`;
  if (daysToStart === 1) return "Starts tomorrow";
  if (daysToStart === 0) return "Starts today";
  return `Started ${-daysToStart} ${daysToStart === -1 ? "day" : "days"} ago`;
}

/** Everyone in pre-boarding, each with progress, blockers, start date and missing contacts; the checklist opens inline. */
export function PreboardingBoard({ rows, openFirst = false, emptyText = "Nobody is in pre-boarding right now." }: { rows: PreboardingRow[]; openFirst?: boolean; emptyText?: string }) {
  if (!rows.length) return <EmptyState icon={ClipboardList} title={emptyText}>People appear here when the PMO assigns them to a project.</EmptyState>;
  return (
    <ul className="space-y-3">
      {rows.map((r, idx) => {
        const soon = r.daysToStart >= 0 && r.daysToStart <= thresholds.UPCOMING_START_DAYS;
        return (
          <li key={r.employeeId}>
            <details open={openFirst && idx === 0} className="group rounded-card border border-line bg-surface shadow-soft" data-testid="preboarding-row" data-employee={r.name}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 px-5 py-4">
                <span className="flex min-w-[220px] flex-1 items-center gap-3">
                  <Avatar name={r.name} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{r.name}{r.isSample && <SampleTag className="ml-1.5" />}</span>
                    <span className="block truncate text-xs text-subtle">{r.projectName ?? "No project"} · Line Manager: {r.lineManager ?? "not assigned"}</span>
                  </span>
                </span>
                <span className="w-40">
                  <StackedBar segments={[{ value: r.done, tone: "green", label: "Done" }, { value: r.total - r.done, tone: "slate", label: "Open" }]} total={r.total} height={6} />
                  <span className="tabular mt-1 block text-xs text-subtle">{r.done} of {r.total} done</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <StatusPill tone={soon ? "amber" : "slate"} dot={false}><CalendarClock size={12} />{startLabel(r.daysToStart)} · {formatDate(r.startDate)}</StatusPill>
                  {r.blocked.length > 0 && <StatusPill tone="red" dot={false}><AlertTriangle size={12} />{r.blocked.length} blocked</StatusPill>}
                  {r.missingContacts.length > 0 && <StatusPill tone="amber" dot={false}><UserX size={12} />No {r.missingContacts.join(" or ")}</StatusPill>}
                </span>
                <ChevronDown size={16} className="text-subtle transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="border-t border-line px-5 pb-4 pt-1">
                <PreboardingChecklist employeeId={r.employeeId} name={r.name} items={r.items} canEdit={r.canEdit} canHandover={r.canHandover} hrOpen={r.hrOpen} />
                <p className="mt-3 text-xs"><Link href={`/employees/${r.employeeId}`} className="font-medium text-brand-700 hover:underline">Open the onboarding case</Link></p>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
