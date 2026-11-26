import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, AlertTriangle, Info, Pencil, ShieldAlert } from "lucide-react";
import { formatDate } from "@/lib/clock";
import { label, roleLabel } from "@/lib/labels";
import { getSession } from "@/lib/auth";
import { can } from "@/modules/permissions";
import { loadProjectDetail } from "@/modules/projects/queries";
import { techLeadCandidates } from "@/modules/projects/service";
import { briefingRolesFor } from "@/modules/briefing/service";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink, Card, EmptyState, LinkTabs, PersonChip, SampleTag, StatCard, StatusPill, toneFor } from "@/components/ui/primitives";
import { HealthPill, TeamTree } from "@/components/projects/ProjectParts";
import { ChooseTechLead, EndAssignmentButton } from "@/components/projects/ProjectActions";
import { BriefingPanel } from "@/components/briefing/BriefingPanel";
import { PreboardingBoard } from "@/components/preboarding/Board";
import { loadPreboarding } from "@/modules/preboarding/queries";
import { SEVERITY_LABEL } from "@/lib/labels";

type Tab = "overview" | "team" | "preboarding" | "briefing";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp, scope, session] = await Promise.all([params, searchParams, getScope(), getSession()]);
  const detail = await loadProjectDetail(id, scope);
  if (!detail) {
    return <EmptyState icon={ShieldAlert} title="This project isn't available." action={<ButtonLink href="/">Go to my home page</ButtonLink>}>It doesn&apos;t exist, or it isn&apos;t one of your projects.</EmptyState>;
  }
  const p = detail.summary;
  const tabs: { id: Tab; label: string; count?: number }[] = [{ id: "overview", label: "Overview" }, { id: "team", label: "Team" }, { id: "preboarding", label: "Pre-boarding", count: p.byPhase.PRE_BOARDING }, { id: "briefing", label: "Briefing" }];
  const tab: Tab = tabs.find((t) => t.id === sp.tab)?.id ?? "overview";
  const canChooseTl = can(scope, "project.chooseTechLead", { projectId: id });
  const canManage = can(scope, "project.manage");
  const briefingRole = briefingRolesFor(scope)[0];

  return (
    <>
      <PageHeader title={<span className="flex items-center gap-3">{p.name}<HealthPill status={p.health.status} />{p.isSimulated && <SampleTag />}</span>}
        subtitle={[p.code, p.startDate ? `Started ${formatDate(p.startDate)}` : null, p.status === "CLOSED" ? "Closed" : null].filter(Boolean).join(" · ") || p.description || undefined}
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: p.name }]}
        actions={<>
          {canChooseTl && <ChooseTechLead projectId={id} candidates={await techLeadCandidates(id)} currentId={p.techLeads[0]?.id ?? null} />}
          {canManage && <ButtonLink href={`/projects/${id}/edit`}><Pencil size={15} />Edit project</ButtonLink>}
        </>} />
      <div className="mb-6"><LinkTabs current={tab} tabs={tabs.map((t) => ({ ...t, href: `/projects/${id}?tab=${t.id}` }))} label="Project sections" /></div>

      {tab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card title="Health" subtitle="Worked out from counts, with every reason shown.">
              <ul className="space-y-2" data-testid="health-reasons">
                {p.health.reasons.map((r) => (
                  <li key={r.text} className="flex items-start gap-2 text-sm text-body">
                    {r.level === "CRITICAL" ? <AlertCircle size={16} className="mt-0.5 text-red-600" /> : r.level === "AT_RISK" ? <AlertTriangle size={16} className="mt-0.5 text-amber-600" /> : <Info size={16} className="mt-0.5 text-slate-400" />}
                    {r.text}
                  </li>
                ))}
              </ul>
            </Card>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Pre-boarding" value={p.byPhase.PRE_BOARDING} />
              <StatCard label="Onboarding" value={p.byPhase.ONBOARDING} tone="brand" />
              <StatCard label="Ready" value={p.byPhase.READY} tone="green" />
            </div>
            <Card title="Key risks">
              {detail.risks.length ? (
                <ul className="divide-y divide-line">
                  {detail.risks.map((r) => (
                    <li key={r.finding.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="min-w-0 text-sm"><Link href={`/employees/${r.employeeId}?tab=investigation`} className="font-medium text-ink hover:underline">{r.employeeName}</Link><span className="text-muted"> · {r.finding.title}</span></span>
                      <StatusPill tone={toneFor.severity(r.finding.severity)}>{SEVERITY_LABEL[r.finding.severity]}</StatusPill>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-subtle">No high or critical findings open.</p>}
            </Card>
            <Card title="Recent changes">
              {detail.recent.length ? (
                <ul className="space-y-2.5">
                  {detail.recent.map((a) => (
                    <li key={a.id} className="text-sm">
                      <p className="text-body"><span className="font-medium text-ink">{label("audit", a.action)}</span> — {a.details}</p>
                      <p className="text-xs text-subtle">{a.actor} · {formatDate(a.timestamp)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-subtle">No changes recorded yet.</p>}
            </Card>
          </div>
          <Card title="People">
            <div className="space-y-3">
              {p.additionalManager ? <PersonChip name={p.additionalManager.name} role="Additional Manager" isSample={p.additionalManager.isSample} href={`/people/${p.additionalManager.id}`} /> : <PersonChip name={undefined} missingLabel="Additional Manager: not assigned" />}
              {p.lineManagers.length ? p.lineManagers.map((lm) => <PersonChip key={lm.id} name={lm.name} role="Line Manager" isSample={lm.isSample} href={`/people/${lm.id}`} />) : <PersonChip name={undefined} missingLabel="Line Manager: not assigned" />}
              {p.techLeads.length ? p.techLeads.map((t) => <PersonChip key={`tl-${t.id}`} name={t.name} role="Technical Lead" isSample={t.isSample} href={`/people/${t.id}`} />) : <PersonChip name={undefined} missingLabel="Technical Lead: not assigned" />}
            </div>
            <p className="mt-4 border-t border-line pt-3 text-xs text-subtle">{p.employees.length} {p.employees.length === 1 ? "employee" : "employees"} on the project.</p>
          </Card>
        </div>
      )}

      {tab === "team" && (
        <div className="space-y-6">
          <TeamTree p={p} actions={canManage ? (assignmentId, name) => <EndAssignmentButton assignmentId={assignmentId} name={name} /> : undefined} />
          {detail.pastMembers.length > 0 && (
            <Card title="Earlier members">
              <ul className="divide-y divide-line">
                {detail.pastMembers.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <PersonChip name={m.person.name} role={roleLabel(m.role)} isSample={m.person.isSample} href={`/people/${m.person.id}`} />
                    <span className="text-xs text-subtle">{label("assignment", m.status)}{m.endDate ? ` ${formatDate(m.endDate)}` : ""}{m.endReason ? ` · ${m.endReason}` : ""}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "preboarding" && <PreboardingBoard rows={await loadPreboarding(scope, undefined, { projectId: id })} emptyText={p.byPhase.PRE_BOARDING ? "Pre-boarding on this project isn't visible to you." : "Nobody on this project is in pre-boarding."} />}

      {tab === "briefing" && (briefingRole
        ? <BriefingPanel role={briefingRole} userId={session.userId} projectId={id} roleLabel={roleLabel(briefingRole)} />
        : <EmptyState title="Briefings aren't available for your role." />)}
    </>
  );
}
