import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { SEVERITY_RANK } from "@/domain/types";
import { label, READINESS_LABEL, RELIABILITY_LABEL, SEVERITY_LABEL } from "@/lib/labels";
import { loadPortfolio } from "@/modules/case/portfolio";
import { casesWith, loadCaseRows, skillsToConfirm } from "@/modules/home/queries";
import { can } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, DataTable, EmptyState, PersonChip, StatCard, StatusPill, toneFor } from "@/components/ui/primitives";
import { SkillDecision } from "@/components/requirements/Controls";

/** Technical Lead home: people in onboarding, sign-offs waiting, findings to decide, skills to confirm. */
export default async function OnboardingHome() {
  const scope = await getScope();
  if (!Object.values(scope.projectRoles).some((r) => r.includes("TECH_LEAD"))) redirect("/");
  const ids = casesWith(scope, "TL").map((c) => c.employeeId);
  const [rows, portfolio, skills] = await Promise.all([loadCaseRows(scope, ids), loadPortfolio(undefined, ids), skillsToConfirm(scope)]);
  const signOff = portfolio.filter((c) => scope.cases[c.state.employee.id]?.phase === "ONBOARDING" && ["READY_WITH_SUPPORT", "PARTIALLY_READY", "INDEPENDENTLY_READY"].includes(c.readiness.assessed) && c.readiness.gates.find((g) => g.id === "TECH_VALIDATION_APPROVED")?.status !== "SATISFIED");
  const decisions = portfolio.flatMap((c) => [...c.open, ...c.proposed].filter((f) => can(scope, "finding.decide", { employeeId: c.state.employee.id, findingCategory: f.category })).map((f) => ({ f, c })))
    .sort((a, b) => SEVERITY_RANK[b.f.severity] - SEVERITY_RANK[a.f.severity]);

  return (
    <>
      <PageHeader title="Onboarding" subtitle="People in onboarding on your projects and the decisions waiting for you." breadcrumbs={[{ label: "Onboarding" }]} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="People in onboarding" value={rows.filter((r) => r.phase === "ONBOARDING").length} />
        <StatCard label="Waiting for your sign-off" value={signOff.length} tone={signOff.length ? "amber" : "neutral"} />
        <StatCard label="Findings to decide" value={decisions.length} tone={decisions.length ? "amber" : "neutral"} href="/investigations" />
        <StatCard label="Skills to confirm" value={skills.length} />
      </div>
      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-ink">People</h2>
        <DataTable rows={rows} rowKey={(r) => r.employeeId} caption="People in onboarding"
          empty={<EmptyState icon={GraduationCap} title="Nobody is in onboarding on your projects." />}
          columns={[
            { key: "name", header: "Person", cell: (r) => <PersonChip name={r.name} role={r.projectName ?? undefined} href={`/employees/${r.employeeId}`} isSample={r.isSample} /> },
            { key: "phase", header: "Phase", cell: (r) => label("phase", r.phase) },
            { key: "level", header: "Readiness", cell: (r) => <StatusPill tone={toneFor.readiness(r.assessed)}>{READINESS_LABEL[r.assessed]}</StatusPill> },
            { key: "rel", header: "Reliability", cell: (r) => <StatusPill tone={toneFor.reliability(r.reliability)} dot={false}>{RELIABILITY_LABEL[r.reliability]}</StatusPill> },
            { key: "req", header: "Requirements", cell: (r) => (r.requirements.total ? <Link href={`/employees/${r.employeeId}?tab=requirements`} className="tabular hover:underline">{r.requirements.done} of {r.requirements.total}</Link> : <span className="text-subtle">None defined</span>) },
          ]} />
      </section>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Waiting for your sign-off">
          {signOff.length ? <ul className="space-y-2">{signOff.map((c) => <li key={c.state.employee.id} className="flex items-center justify-between gap-2 text-sm"><Link href={`/employees/${c.state.employee.id}#validation`} className="font-medium text-ink hover:underline">{c.state.employee.name}</Link><StatusPill tone="amber">{READINESS_LABEL[c.readiness.assessed]}</StatusPill></li>)}</ul> : <p className="text-sm text-subtle">No one is waiting.</p>}
        </Card>
        <Card title="Findings that need a decision">
          {decisions.length ? <ul className="space-y-2.5">{decisions.slice(0, 6).map(({ f, c }) => <li key={f.id} className="text-sm"><Link href={`/employees/${c.state.employee.id}?tab=investigation`} className="font-medium text-ink hover:underline">{c.state.employee.name}</Link><span className="ml-2"><StatusPill tone={toneFor.severity(f.severity)}>{SEVERITY_LABEL[f.severity]}</StatusPill></span><span className="block text-muted">{f.title}</span></li>)}</ul> : <p className="text-sm text-subtle">Nothing to decide.</p>}
        </Card>
        <Card title="Skills waiting for confirmation">
          {skills.length ? <ul className="space-y-3" data-testid="skills-to-confirm">{skills.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span><Link href={`/people/${s.personId}#skills`} className="font-medium text-ink hover:underline">{s.person}</Link><span className="block text-xs text-subtle">{s.skill} · {label("skillLevel", s.level)}</span></span><SkillDecision recordId={s.id} name={s.skill} level={s.level} /></li>)}</ul> : <p className="text-sm text-subtle">No claimed skills to review.</p>}
        </Card>
      </div>
    </>
  );
}
