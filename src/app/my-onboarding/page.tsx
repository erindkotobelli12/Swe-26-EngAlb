import Link from "next/link";
import { CheckCircle2, CircleArrowRight, Hourglass, KeyRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ACCESS_STATUS_LABEL, roleLabel } from "@/lib/labels";
import { loadPortfolio } from "@/modules/case/portfolio";
import { nextStep, waitingOn } from "@/modules/home/queries";
import { loadRequirementMatrix } from "@/modules/requirements/queries";
import { confirmAccessUsableAction } from "@/server/actions/access";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/actions";
import { Card, EmptyState, PersonChip, PhaseStepper, StatusPill, toneFor } from "@/components/ui/primitives";
import { EmployeeRequirements } from "@/components/requirements/Matrix";

/** Employee home: where I am, what's next, what I'm waiting on, my contacts, requirements and access. Only my own case. */
export default async function MyOnboarding() {
  const [session, scope] = await Promise.all([getSession(), getScope()]);
  if (!session.employeeId) return <EmptyState title="This page is for employees.">Switch to an employee demo account (for example Leo Marin) to see their onboarding.</EmptyState>;
  const [c] = await loadPortfolio(undefined, [session.employeeId]);
  if (!c) return <EmptyState title="No onboarding case is linked to your account." />;
  const s = c.state;
  const phase = scope.cases[s.employee.id]?.phase ?? "ONBOARDING";
  const [tlAssignment, hr, matrix] = await Promise.all([
    s.employee.projectId ? prisma.projectAssignment.findFirst({ where: { projectId: s.employee.projectId, role: "TECH_LEAD", status: "ACTIVE" }, include: { person: true } }) : Promise.resolve(null),
    prisma.person.findFirst({ where: { role: "HR", name: { not: null } } }),
    s.employee.projectId ? loadRequirementMatrix(s.employee.projectId, scope) : Promise.resolve(null),
  ]);
  const next = nextStep(c);
  const waits = waitingOn(c);
  const myActions = [
    ...s.access.filter((a) => a.required && a.status === "PROVISIONED").map((a) => `Try logging in to ${a.application} and confirm it works`),
    ...s.findings.filter((f) => f.status === "OPEN" && f.category !== "ACCESS").flatMap((f) => f.recommendedActions.filter((r) => r.ownerRole === "EMPLOYEE").map((r) => r.action)),
  ];

  return (
    <>
      <PageHeader title="My onboarding" subtitle={`${s.employee.projectName ? `Employee on ${s.employee.projectName}` : "Project not recorded yet"}`} breadcrumbs={[{ label: "My onboarding" }]} meta={<PhaseStepper phase={phase} />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="What to do next">
          <ul className="space-y-3 text-sm" data-testid="next-steps">
            {[...new Set(myActions)].map((a) => <li key={a} className="flex gap-2"><CircleArrowRight size={17} className="mt-0.5 shrink-0 text-brand-600" /><span className="text-body">{a}</span></li>)}
            {next && <li className="flex gap-2"><CircleArrowRight size={17} className="mt-0.5 shrink-0 text-brand-600" /><span><span className="text-body">{next.title}</span><span className="block text-xs text-subtle">With {next.owner}</span></span></li>}
            {!myActions.length && !next && <li className="text-subtle">Nothing is waiting on you right now.</li>}
          </ul>
        </Card>
        <Card title="What I'm waiting on">
          {waits.length ? <ul className="space-y-3 text-sm" data-testid="waiting-on">{waits.map((w) => <li key={w.what} className="flex gap-2"><Hourglass size={16} className="mt-0.5 shrink-0 text-amber-600" /><span><span className="text-body">{w.what}</span><span className="block text-xs text-subtle">From {w.who}</span></span></li>)}</ul> : <p className="text-sm text-subtle">You aren&apos;t waiting on anyone.</p>}
        </Card>
        <Card title="My contacts">
          <div className="space-y-3" data-testid="contacts">
            {s.people.lineManager?.name || s.people.lineManagerText ? <PersonChip name={s.people.lineManager?.name ?? s.people.lineManagerText} role="Line Manager" /> : <PersonChip name={undefined} missingLabel="Line Manager: not assigned" />}
            {tlAssignment ? <PersonChip name={tlAssignment.person.name} role="Technical Lead" isSample={tlAssignment.person.isSimulated} /> : <PersonChip name={undefined} missingLabel="Technical Lead: not assigned" />}
            {hr ? <PersonChip name={hr.name} role="HR" isSample={hr.isSimulated} /> : <PersonChip name={undefined} missingLabel="HR: not assigned" />}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {matrix ? <EmployeeRequirements m={matrix} employeeId={s.employee.id} canDecide={false} /> : <Card title="My requirements"><p className="text-sm text-subtle">No project recorded yet, so no requirements apply.</p></Card>}
        <Card title={<span className="flex items-center gap-2"><KeyRound size={16} />My access</span>}>
          {s.access.length ? (
            <ul className="space-y-3">
              {s.access.map((a) => (
                <li key={a.id} className="text-sm" data-access={a.application}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{a.application}</span>
                    {a.status === "USABLE" ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={14} />Working</span> : <StatusPill tone={toneFor.access(a.status)}>{ACCESS_STATUS_LABEL[a.status]}</StatusPill>}
                  </div>
                  {a.status !== "USABLE" && <p className="mt-0.5 text-xs text-subtle">{a.blockerReason ?? "Waiting"}{a.handlerRole ? ` · handled by ${roleLabel(a.handlerRole)}` : ""}</p>}
                  {(a.status === "PROVISIONED" || a.status === "APPROVED") && (
                    <div className="mt-2"><ActionButton action={confirmAccessUsableAction.bind(null, a.id)} label="Confirm it works" pendingLabel="Saving…" size="sm" success={`${a.application} confirmed as working.`} testId={`confirm-access-${a.application}`} /></div>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-subtle">No access is recorded for you. If you need tools, ask your Line Manager.</p>}
          <p className="mt-3 text-xs text-subtle">Never enter passwords here. Only confirm that you could log in.</p>
        </Card>
      </div>
      <p className="mt-6 text-sm"><Link href="/profile" className="font-medium text-brand-700 hover:underline">My profile: skills and earlier projects</Link></p>
    </>
  );
}
