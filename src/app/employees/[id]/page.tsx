import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate, getEvaluationDate } from "@/lib/clock";
import { parseJson } from "@/lib/json";
import { loadCaseState } from "@/modules/case/loadCaseState";
import { bySeverity } from "@/modules/case/portfolio";
import { can, type Scope } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { evaluateReadiness } from "@/modules/readiness/evaluate";
import { fieldSuggestions, listEvidenceCards, replyTargets } from "@/modules/evidence/queries";
import { recomputeCaseAction } from "@/server/actions/case";
import { CASE_TABS, type CaseTabId } from "@/config/caseTabs";
import type { CaseState } from "@/domain/types";
import ActionButton from "@/components/ActionButton";
import FindingCard from "@/components/case/FindingCard";
import { FindingActions, InvestigateButton } from "@/components/case/FindingActions";
import ValidationForm from "@/components/case/ValidationForm";
import DependencyMap from "@/components/map/DependencyMap";
import DependencySuggestions from "@/components/map/DependencySuggestions";
import Simulator from "@/components/simulator/Simulator";
import { buildMapData } from "@/modules/dependencies/viewModel";
import { loadFollowUpQueue } from "@/modules/followups/service";
import { buildBackbone, diffBackbone, type BaselineEntry } from "@/modules/roadmap/backbone";
import { deciderPermission } from "@/modules/roadmap/service";
import RoadmapTimeline from "@/components/roadmap/RoadmapTimeline";
import { BaselineButton, SuggestRoadmapButton } from "@/components/roadmap/RoadmapControls";
import { availableToggles, simulate } from "@/modules/simulator/simulate";
import { overridesFrom, presetChoice } from "@/modules/simulator/choices";
import { levelLabel, type ReadinessResult } from "@/modules/readiness/evaluate";
import ReliabilityBadge from "@/components/ui/ReliabilityBadge";
import { classifyAccess, classifyCaseStatus, classifyKT } from "@/modules/reliability/classify";
import HistoryTimeline from "@/components/case/HistoryTimeline";
import { AccessTable, KTTable, Stakeholders } from "@/components/case/CaseRecords";
import { ChecklistPanel, GateList, ReadinessTriple } from "@/components/case/ReadinessPanels";
import EvidenceCard from "@/components/evidence/EvidenceCard";
import AddEvidenceForm from "@/components/evidence/AddEvidenceForm";
import { ClaimReview, EvidenceTools } from "@/components/evidence/ReviewControls";
import { Card, EmptyState, EvidenceChip, ProvenanceBadge, SeverityBadge } from "@/components/ui/badges";
import { EmptyState as UIEmptyState } from "@/components/ui/primitives";
import { PreboardingChecklist } from "@/components/preboarding/Checklist";
import { openHrItems } from "@/modules/preboarding/service";
import { loadRequirementMatrix } from "@/modules/requirements/queries";
import { proposedProfileSkills } from "@/modules/requirements/service";
import { EmployeeRequirements } from "@/components/requirements/Matrix";
import { AddProjectSkillsButton } from "@/components/requirements/Controls";

export default async function EmployeeCase({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; preset?: string }> }) {
  const [{ id }, { tab: rawTab, preset }, session, scope] = await Promise.all([params, searchParams, getSession(), getScope()]);
  if (!scope.cases[id]) {
    return <div className="px-5 py-6 md:px-8"><EmptyState title="You can only view your own onboarding case.">Switch demo user to open this case.</EmptyState></div>;
  }
  const state = await loadCaseState(id);
  if (!state) notFound();
  const readiness = evaluateReadiness(state);
  const tabs = CASE_TABS.filter((t) => t.enabled && (!t.roles || t.roles.includes(session.role)));
  const tab: CaseTabId = tabs.find((t) => t.id === rawTab)?.id ?? "overview";
  const open = state.findings.filter((f) => f.status === "OPEN").sort(bySeverity);
  const rerun = recomputeCaseAction.bind(null, id);
  const mapData = buildMapData(state, readiness);

  return (
    <div className="px-5 py-6 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500"><Link href="/employees" className="hover:underline">Employees</Link> / {state.employee.id}</p>
          <h1 className="mt-1 text-2xl font-bold">{state.employee.name}</h1>
          <p className="mt-1 text-sm text-slate-600">{state.employee.projectName ?? <span className="font-semibold text-red-600">Project not recorded</span>} · {state.employee.movement} · started {formatDate(state.employee.startDate)} · tracker updated {formatDate(state.employee.lastUpdate)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Evaluation date <b className="text-slate-800">{formatDate(getEvaluationDate())}</b></span>
          {can(scope, "case.recompute", { employeeId: id }) && <ActionButton action={rerun} label="Re-run analysis" pendingLabel="Recomputing…" icon={<RefreshCw size={15} />} variant="secondary" />}
        </div>
      </div>

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Case sections">
        {tabs.map((t) => (
          <Link key={t.id} href={`/employees/${id}?tab=${t.id}`} aria-current={t.id === tab ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${t.id === tab ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t.label}{t.id === "investigation" && open.length ? <span className="ml-1.5 rounded-full bg-red-100 px-1.5 text-[11px] text-red-700">{open.length}</span> : null}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "overview" && (
          <div className="space-y-5">
            <ReadinessTriple readiness={readiness} reliability={<ReliabilityBadge r={classifyCaseStatus(state)} />} />
            <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
              <div className="space-y-5">
                <Card title="Readiness gates"><GateList gates={readiness.gates} /></Card>
                <Card title="Access"><AccessTable state={state} /></Card>
                <Card title="Knowledge transfer"><KTTable state={state} /></Card>
              </div>
              <div className="space-y-5">
                <Card title="Open findings" actions={<Link href={`/employees/${id}?tab=investigation`} className="text-xs font-bold text-indigo-600">Investigate →</Link>}>
                  {open.length ? <ul className="space-y-2">{open.slice(0, 6).map((f) => <li key={f.id} className="flex items-start justify-between gap-2 text-sm"><span>{f.title}</span><SeverityBadge severity={f.severity} /></li>)}</ul> : <p className="text-sm text-slate-500">No open findings.</p>}
                </Card>
                <Card title="Stakeholders"><Stakeholders state={state} /></Card>
                <Card title="Onboarding checklist (starter pack §6)"><ChecklistPanel state={state} gates={readiness.gates} /></Card>
                <Card title="Technical validation" id="validation">
                  <ValidationHistory state={state} />
                  {can(scope, "validation.record", { employeeId: id })
                    ? <div className="mt-4 border-t border-slate-100 pt-4"><p className="mb-2 text-xs text-slate-500">Decide with the gates and evidence on this page in view. Assessment results and AI output never replace observed execution.</p><ValidationForm employeeId={id} evidence={[...state.evidence, ...state.projectEvidence].filter((e) => e.reviewStatus === "APPROVED").map((e) => ({ id: e.id, title: e.title }))} /></div>
                    : <p className="mt-3 text-xs text-slate-500">Only a Technical Lead can record a validation decision.</p>}
                </Card>
              </div>
            </div>
          </div>
        )}

        {tab === "map" && (
          <div className="space-y-4">
            <DependencyMap data={mapData} employeeId={id} />
            <DependencySuggestions employeeId={id} proposed={mapData.proposed} canDecide={can(scope, "dependency.decide", { employeeId: id })} canRunAI={can(scope, "ai.run", { employeeId: id })} />
          </div>
        )}

        {tab === "simulator" && (() => {
          const toggles = availableToggles(state, readiness);
          const initialChoice = presetChoice(toggles, preset);
          return <Simulator key={preset ?? "none"} employeeId={id} toggles={toggles} initialChoice={initialChoice} initialResult={simulate(state, overridesFrom(toggles, initialChoice, false))} actualLevel={levelLabel(readiness.assessed)} />;
        })()}

        {tab === "investigation" && <InvestigationTab state={state} scope={scope} />}
        {tab === "evidence" && (
          <div className="space-y-4">
            <Card title="Reliability of this case's statuses">
              <p className="mb-3 text-xs text-slate-500">How trustworthy each status is, from source recency, authority, completeness, contradictions and human verification. Reliability is separate from readiness.</p>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2"><span>Reported: <b>{state.employee.trackerStatus}</b></span><ReliabilityBadge r={classifyCaseStatus(state)} /></div>
                {state.access.map((a) => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2"><span>{a.application}: {a.status.replaceAll("_", " ").toLowerCase()}</span><ReliabilityBadge r={classifyAccess(state, a)} compact /></div>)}
                {state.kt.filter((k) => k.stage !== "NOT_STARTED").map((k) => <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2"><span>{k.title}: {k.stage.replaceAll("_", " ").toLowerCase()}</span><ReliabilityBadge r={classifyKT(state, k)} compact /></div>)}
              </div>
            </Card>
            <EvidenceTab employeeId={id} scope={scope} />
          </div>
        )}
        {tab === "history" && <HistoryTab employeeId={id} />}
        {tab === "followups" && <FollowUpsTab employeeId={id} />}
        {tab === "roadmap" && <RoadmapTab state={state} readiness={readiness} scope={scope} />}
        {tab === "requirements" && <RequirementsTab employeeId={id} projectId={state.employee.projectId} scope={scope} />}
        {tab === "preboarding" && <PreboardingTab employeeId={id} name={state.employee.name} scope={scope} />}
      </div>
    </div>
  );
}

function ValidationHistory({ state }: { state: CaseState }) {
  const decided = [...state.validations].filter((v) => v.timestamp).sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  if (!decided.length) return <p className="text-sm text-slate-500">No technical-owner validation recorded. Validated readiness: <b>none</b>.</p>;
  return (
    <ul className="space-y-2" data-testid="validation-history">
      {decided.map((v) => (
        <li key={v.id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><b>{v.state.replaceAll("_", " ").toLowerCase()}{v.validatedLevel ? ` · ${levelLabel(v.validatedLevel)}` : ""}</b><ProvenanceBadge state="actual" /></div>
          <p className="mt-1 text-xs text-slate-500">{v.reviewerName ?? "Unknown"} ({v.reviewerRole}) · {formatDate(v.timestamp)}</p>
          {v.comment && <p className="mt-1 text-sm text-slate-700">{v.comment}</p>}
          <p className="mt-1 text-xs">{v.evidenceIds.map((e) => <EvidenceChip key={e} id={e} />)}</p>
        </li>
      ))}
    </ul>
  );
}

function InvestigationTab({ state, scope }: { state: CaseState; scope: Scope }) {
  const open = state.findings.filter((f) => f.status === "OPEN").sort(bySeverity);
  const proposed = state.findings.filter((f) => f.status === "PROPOSED").sort(bySeverity);
  const closed = state.findings.filter((f) => f.status === "RESOLVED" || f.status === "DISMISSED");
  const decide = (f: CaseState["findings"][number]) => can(scope, "finding.decide", { employeeId: state.employee.id, findingCategory: f.category });
  const caseEvidence = state.evidence.filter((e) => e.sourceType !== "TRACKER").map((e) => ({ id: e.id, title: e.title }));
  const actions = (f: CaseState["findings"][number]) => decide(f) ? <FindingActions findingId={f.id} status={f.status} evidenceIds={f.evidenceIds} caseEvidence={caseEvidence} /> : undefined;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600"><ProvenanceBadge state="actual" /> Rule findings are deterministic checks over stored records. <ProvenanceBadge state="proposed" /> AI findings and AI reviews await a human decision.</p>
        {can(scope, "ai.run", { employeeId: state.employee.id }) && <InvestigateButton employeeId={state.employee.id} />}
      </div>
      {open.length ? open.map((f) => <FindingCard key={f.id} finding={f} state={state} actions={actions(f)} />) : <EmptyState title="No open findings for this case" />}
      {proposed.length > 0 && <><h2 className="pt-2 text-lg font-bold">AI proposals awaiting review</h2>{proposed.map((f) => <FindingCard key={f.id} finding={f} state={state} actions={actions(f)} />)}</>}
      {closed.length > 0 && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-slate-600">Resolved and dismissed ({closed.length})</summary><div className="mt-3 space-y-3">{closed.map((f) => <FindingCard key={f.id} finding={f} state={state} />)}</div></details>}
    </div>
  );
}

async function EvidenceTab({ employeeId, scope }: { employeeId: string; scope: Scope }) {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { projectId: true, name: true } });
  const [cards, project, fields, targets] = await Promise.all([
    listEvidenceCards({ employeeId }),
    employee.projectId ? listEvidenceCards({ projectId: employee.projectId, employeeId: null }) : Promise.resolve([]),
    fieldSuggestions(employeeId),
    replyTargets(),
  ]);
  const canReview = can(scope, "evidence.review", { employeeId });
  const canRunAI = can(scope, "ai.run", { employeeId });
  return (
    <div className="space-y-4">
      {can(scope, "evidence.add", { employeeId }) && <AddEvidenceForm employees={[]} fixedEmployeeId={employeeId} replyTargets={targets} defaultDate={getEvaluationDate()} />}
      {cards.map((e) => (
        <EvidenceCard key={e.id} e={e}
          controls={e.sourceType !== "TRACKER" && (canReview || canRunAI) ? <EvidenceTools evidenceId={e.id} reviewStatus={e.reviewStatus} canRunAI={canRunAI} canReview={canReview} fields={fields} /> : undefined}
          claimControls={canReview ? (claimId) => <ClaimReview claimId={claimId} value={e.claims.find((c) => c.id === claimId)?.value ?? ""} /> : undefined}
        />
      ))}
      {project.length > 0 && <><h2 className="pt-2 font-bold">Project-level evidence</h2>{project.map((e) => <EvidenceCard key={e.id} e={e} />)}</>}
    </div>
  );
}

async function RoadmapTab({ state, readiness, scope }: { state: CaseState; readiness: ReadinessResult; scope: Scope }) {
  const [rows, caseRow] = await Promise.all([
    prisma.roadmapItem.findMany({ where: { employeeId: state.employee.id }, orderBy: { createdAt: "asc" } }),
    prisma.onboardingCase.findUniqueOrThrow({ where: { id: state.caseId }, select: { roadmapBaselineJson: true, roadmapBaselineAt: true, roadmapBaselineBy: true } }),
  ]);
  const backbone = buildBackbone(state, readiness);
  const baseline = parseJson<BaselineEntry[] | null>(caseRow.roadmapBaselineJson, null);
  const diff = baseline ? diffBackbone(baseline, backbone) : [];
  const canPlan = can(scope, "roadmap.baseline", { employeeId: state.employee.id });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-600"><ProvenanceBadge state="actual" /> The backbone is derived from the case state, gates and dependency map, so it adapts when an approved change updates the case. <ProvenanceBadge state="proposed" /> AI adjustments need a Technical Lead (KT, alternatives, skips) or PMO (logistics) decision.</p>
        <div className="flex flex-wrap items-start gap-2">{can(scope, "ai.run", { employeeId: state.employee.id }) && <SuggestRoadmapButton employeeId={state.employee.id} />}{canPlan && <BaselineButton employeeId={state.employee.id} />}</div>
      </div>
      <Card title="Changes since the last approved version">
        {!baseline ? <p className="text-sm text-slate-500">No baseline approved yet. Approve the current plan to track how it adapts.</p>
          : diff.length ? <ul className="space-y-1 text-sm" data-testid="roadmap-diff">{diff.map((d) => <li key={d.key}><b>{d.title}</b>: {d.before.toLowerCase().replaceAll("_", " ")} → {d.after.toLowerCase().replaceAll("_", " ")}</li>)}</ul>
          : <p className="text-sm text-slate-500">No changes since the baseline approved by {caseRow.roadmapBaselineBy} on {formatDate(caseRow.roadmapBaselineAt)}.</p>}
      </Card>
      <RoadmapTimeline backbone={backbone} canDecide={(kind) => can(scope, deciderPermission(kind), { employeeId: state.employee.id })}
        extras={rows.map((r) => ({ id: r.id, type: r.type, kind: r.kind, phase: r.phase, title: r.title, description: r.description, ownerRole: r.ownerRole, completionCriteria: r.completionCriteria, relatesToKey: r.relatesToKey, rationale: r.rationale, evidenceIds: parseJson(r.evidenceIds, [] as string[]), status: r.status, origin: r.origin, decidedBy: r.decidedBy }))} />
    </div>
  );
}

async function RequirementsTab({ employeeId, projectId, scope }: { employeeId: string; projectId: string | null; scope: Scope }) {
  if (!projectId) return <UIEmptyState title="No project recorded, so no onboarding requirements apply yet." />;
  const [m, proposals] = await Promise.all([loadRequirementMatrix(projectId, scope), proposedProfileSkills(employeeId)]);
  if (!m) return <UIEmptyState title="Onboarding requirements aren't available to you." />;
  const canDecide = can(scope, "requirement.decide", { projectId });
  return (
    <div className="space-y-4">
      {proposals.length > 0 && canDecide && can(scope, "validation.record", { employeeId }) && (
        <Card title="Add this project's skills to the profile?" actions={<AddProjectSkillsButton employeeId={employeeId} skills={proposals.map((p) => p.skillName)} />}>
          <p className="text-sm text-muted">Readiness on this project is validated. These skill requirements can be added to the profile as confirmed skills: {proposals.map((p) => p.skillName).join(", ")}.</p>
        </Card>
      )}
      <EmployeeRequirements m={m} employeeId={employeeId} canDecide={canDecide} />
    </div>
  );
}

async function PreboardingTab({ employeeId, name, scope }: { employeeId: string; name: string; scope: Scope }) {
  const [items, hrOpen] = await Promise.all([prisma.preboardingItem.findMany({ where: { employeeId }, orderBy: { sortOrder: "asc" } }), openHrItems(employeeId)]);
  const phase = scope.cases[employeeId]?.phase;
  if (!items.length) return <UIEmptyState title="No pre-boarding checklist for this case.">This person was already past pre-boarding when OnboardIQ started tracking them.</UIEmptyState>;
  const today = getEvaluationDate();
  return (
    <Card title="Pre-boarding checklist" actions={phase !== "PRE_BOARDING" ? <span className="text-xs text-subtle">Finished — kept for reference</span> : undefined}>
      <PreboardingChecklist employeeId={employeeId} name={name} canEdit={can(scope, "preboarding.update", { employeeId })} canHandover={can(scope, "handover.confirm", { employeeId })} hrOpen={hrOpen.length}
        items={items.map((i) => ({ id: i.id, title: i.title, category: i.category, ownerRole: i.ownerRole, status: i.status, blockerReason: i.blockerReason, note: i.note, dueDate: i.dueDate, overdue: Boolean(i.dueDate && i.dueDate < today && !["DONE", "NOT_APPLICABLE"].includes(i.status)), updatedBy: i.updatedBy, updatedAt: i.updatedAt, evidenceId: i.evidenceId }))} />
    </Card>
  );
}

async function FollowUpsTab({ employeeId }: { employeeId: string }) {
  const { groups, communications } = await loadFollowUpQueue();
  const mine = communications.filter((c) => parseJson<string[]>(c.employeeIds, []).includes(employeeId));
  const pending = groups.map((g) => ({ g, items: g.items.filter((i) => i.employeeId === employeeId) })).filter((x) => x.items.length);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Follow-ups are consolidated across cases per stakeholder in the <Link href="/follow-ups" className="font-semibold text-indigo-700">Follow-Up Center</Link>, where drafts are edited, approved and sent (simulated).</p>
      <Card title={`Follow-ups including this employee (${mine.length})`}>
        {mine.length ? <ul className="space-y-2 text-sm">{mine.map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2"><span><b>{c.stakeholderLabel}</b> · {c.subject}</span><span className="text-xs font-bold uppercase text-slate-500">{c.status === "SENT_SIMULATED" ? "sent (simulated)" : c.status.toLowerCase()}</span></li>)}</ul> : <p className="text-sm text-slate-500">None yet.</p>}
      </Card>
      <Card title="Pending items not yet in a draft">
        {pending.length ? pending.map(({ g, items }) => <div key={g.stakeholder.key} className="mb-3"><p className="text-sm font-bold">{g.stakeholder.label}</p><ul className="mt-1 list-disc pl-5 text-sm">{items.map((i) => <li key={i.key}>{i.title} — {i.ask} <span className="text-xs text-slate-500">(open {i.daysOpen} d, priority {i.score})</span></li>)}</ul></div>) : <p className="text-sm text-slate-500">Nothing pending.</p>}
      </Card>
    </div>
  );
}

async function HistoryTab({ employeeId }: { employeeId: string }) {
  const caseRow = await prisma.onboardingCase.findUnique({ where: { employeeId }, select: { id: true } });
  const logs = await prisma.auditLog.findMany({ where: { OR: [{ employeeId }, { entityId: caseRow?.id ?? "" }] }, orderBy: { timestamp: "desc" }, take: 300 });
  return (
    <Card title="Case history">
      <HistoryTimeline entries={logs.map((l) => ({ id: l.id, timestamp: l.timestamp, actor: l.actorLabel ?? "Unknown", action: l.action, entityType: l.entityType, entityId: l.entityId, details: l.details, before: l.before, after: l.after, evidenceIds: parseJson(l.evidenceIds, [] as string[]) }))} />
    </Card>
  );
}
