import Link from "next/link";
import { redirect } from "next/navigation";
import { Send, Users } from "lucide-react";
import { casesWith, loadCaseRows, type CaseRow } from "@/modules/home/queries";
import { loadFollowUpQueue } from "@/modules/followups/service";
import { loadPreboarding } from "@/modules/preboarding/queries";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, ButtonLink, Card, EmptyState, PhaseStepper, SampleTag, StatCard } from "@/components/ui/primitives";
import { PreboardingBoard } from "@/components/preboarding/Board";

const GROUPS = [
  { phase: "PRE_BOARDING", title: "Pre-boarding" },
  { phase: "ONBOARDING", title: "Onboarding" },
  { phase: "READY", title: "Ready" },
] as const;

/** Line Manager home: their employees grouped by phase, pre-boarding items to update, and follow-ups for the team. */
export default async function MyTeamPage() {
  const scope = await getScope();
  const team = casesWith(scope, "LM");
  if (!team.length && scope.principal.role !== "LINE_MANAGER") redirect("/");
  const ids = team.map((c) => c.employeeId);
  const [rows, preboarding, queue] = await Promise.all([loadCaseRows(scope, ids), loadPreboarding(scope, undefined, { employeeIds: ids }), loadFollowUpQueue(undefined, scope)]);
  const teamFollowUps = queue.groups.flatMap((g) => g.items.filter((i) => ids.includes(i.employeeId)));
  const drafts = queue.communications.filter((c) => c.status === "DRAFT" || c.status === "APPROVED").length;

  return (
    <>
      <PageHeader title="My team" subtitle="Your employees, the phase each one is in, and what's next." breadcrumbs={[{ label: "My team" }]} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="People" value={rows.length} />
        <StatCard label="In pre-boarding" value={rows.filter((r) => r.phase === "PRE_BOARDING").length} />
        <StatCard label="In onboarding" value={rows.filter((r) => r.phase === "ONBOARDING").length} tone="brand" />
        <StatCard label="Follow-ups open for your team" value={teamFollowUps.length} tone={teamFollowUps.length ? "amber" : "neutral"} href="/follow-ups" />
      </div>
      {!rows.length && <EmptyState icon={Users} title="Nobody reports to you yet." />}
      <div className="space-y-6">
        {GROUPS.map((g) => {
          const list = rows.filter((r) => r.phase === g.phase);
          if (!list.length) return null;
          return (
            <section key={g.phase} data-testid={`phase-group-${g.phase}`}>
              <h2 className="mb-3 text-base font-semibold text-ink">{g.title} <span className="tabular text-sm font-normal text-subtle">{list.length}</span></h2>
              <div className="grid gap-3 lg:grid-cols-2">{list.map((r) => <TeamCard key={r.employeeId} r={r} />)}</div>
            </section>
          );
        })}
        {preboarding.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-ink">Pre-boarding items you can update</h2>
            <PreboardingBoard rows={preboarding} openFirst={preboarding.length === 1} />
          </section>
        )}
        <Card title="Follow-ups for your team" actions={<ButtonLink href="/follow-ups" size="sm"><Send size={14} />Open follow-ups</ButtonLink>}>
          <p className="text-sm text-muted">{teamFollowUps.length ? `${teamFollowUps.length} open ${teamFollowUps.length === 1 ? "item" : "items"} to chase` : "Nothing to chase right now"}{drafts ? `, ${drafts} ${drafts === 1 ? "draft" : "drafts"} waiting for approval.` : "."}</p>
        </Card>
      </div>
    </>
  );
}

function TeamCard({ r }: { r: CaseRow }) {
  return (
    <Link href={`/employees/${r.employeeId}`} data-testid="team-member" data-employee={r.name} className="block rounded-card border border-line bg-surface p-4 shadow-soft hover:border-brand-200">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={r.name} size={34} />
          <span className="min-w-0"><span className="block truncate font-medium text-ink">{r.name}{r.isSample && <SampleTag className="ml-1.5" />}</span><span className="block truncate text-xs text-subtle">{r.projectName ?? "No project recorded"}</span></span>
        </span>
        <PhaseStepper phase={r.phase} compact />
      </div>
      <dl className="mt-3 grid gap-1 text-sm">
        <div className="flex gap-2"><dt className="w-24 shrink-0 text-subtle">Blocker</dt><dd className={r.blocker ? "text-body" : "text-subtle"}>{r.blocker ?? "None"}</dd></div>
        <div className="flex gap-2"><dt className="w-24 shrink-0 text-subtle">Next step</dt><dd className="text-body">{r.next ?? "Nothing open"}</dd></div>
      </dl>
    </Link>
  );
}
