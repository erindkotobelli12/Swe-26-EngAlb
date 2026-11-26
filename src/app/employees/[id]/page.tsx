import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate, getEvaluationDate } from "@/lib/clock";
import { parseJson } from "@/lib/json";
import { loadCaseState } from "@/modules/case/loadCaseState";
import { bySeverity } from "@/modules/case/portfolio";
import { can } from "@/modules/permissions";
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
import { availableToggles, simulate } from "@/modules/simulator/simulate";
import { overridesFrom, presetChoice } from "@/modules/simulator/choices";
import { levelLabel } from "@/modules/readiness/evaluate";
import ReliabilityBadge from "@/components/ui/ReliabilityBadge";
import { classifyAccess, classifyCaseStatus, classifyKT } from "@/modules/reliability/classify";
import HistoryTimeline from "@/components/case/HistoryTimeline";
import { AccessTable, KTTable, Stakeholders } from "@/components/case/CaseRecords";
import { ChecklistPanel, GateList, ReadinessTriple } from "@/components/case/ReadinessPanels";
import EvidenceCard from "@/components/evidence/EvidenceCard";
import AddEvidenceForm from "@/components/evidence/AddEvidenceForm";
import { ClaimReview, EvidenceTools } from "@/components/evidence/ReviewControls";
import { Card, EmptyState, EvidenceChip, ProvenanceBadge, SeverityBadge } from "@/components/ui/badges";

export default async function EmployeeCase({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; preset?: string }> }) {
  const [{ id }, { tab: rawTab, preset }, session] = await Promise.all([params, searchParams, getSession()]);
  if (!can(session, "case.view", { employeeId: id })) {
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
          {can(session, "case.recompute") && <ActionButton action={rerun} label="Re-run analysis" pendingLabel="Recomputing…" icon={<RefreshCw size={15} />} variant="secondary" />}
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
                  {can(session, "validation.record")
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
            <DependencySuggestions employeeId={id} proposed={mapData.proposed} canDecide={can(session, "dependency.decide")} canRunAI={can(session, "ai.run")} />
          </div>
        )}

        {tab === "simulator" && (() => {
          const toggles = availableToggles(state, readiness);
          const initialChoice = presetChoice(toggles, preset);
          return <Simulator key={preset ?? "none"} employeeId={id} toggles={toggles} initialChoice={initialChoice} initialResult={simulate(state, overridesFrom(toggles, initialChoice, false))} actualLevel={levelLabel(readiness.assessed)} />;
        })()}

        {tab === "investigation" && <InvestigationTab state={state} session={session} />}
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
            <EvidenceTab employeeId={id} session={session} />
          </div>
        )}
        {tab === "history" && <HistoryTab employeeId={id} />}
        {tab === "followups" && <FollowUpsTab employeeId={id} />}
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

function InvestigationTab({ state, session }: { state: CaseState; session: Awaited<ReturnType<typeof getSession>> }) {
  const open = state.findings.filter((f) => f.status === "OPEN").sort(bySeverity);
  const proposed = state.findings.filter((f) => f.status === "PROPOSED").sort(bySeverity);
  const closed = state.findings.filter((f) => f.status === "RESOLVED" || f.status === "DISMISSED");
  const decide = can(session, "finding.decide");
  const caseEvidence = state.evidence.filter((e) => e.sourceType !== "TRACKER").map((e) => ({ id: e.id, title: e.title }));
  const actions = (f: CaseState["findings"][number]) => decide ? <FindingActions findingId={f.id} status={f.status} evidenceIds={f.evidenceIds} caseEvidence={caseEvidence} /> : undefined;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600"><ProvenanceBadge state="actual" /> Rule findings are deterministic checks over stored records. <ProvenanceBadge state="proposed" /> AI findings and AI reviews await a human decision.</p>
        {can(session, "ai.run") && <InvestigateButton employeeId={state.employee.id} />}
      </div>
      {open.length ? open.map((f) => <FindingCard key={f.id} finding={f} state={state} actions={actions(f)} />) : <EmptyState title="No open findings for this case" />}
      {proposed.length > 0 && <><h2 className="pt-2 text-lg font-bold">AI proposals awaiting review</h2>{proposed.map((f) => <FindingCard key={f.id} finding={f} state={state} actions={actions(f)} />)}</>}
      {closed.length > 0 && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-slate-600">Resolved and dismissed ({closed.length})</summary><div className="mt-3 space-y-3">{closed.map((f) => <FindingCard key={f.id} finding={f} state={state} />)}</div></details>}
    </div>
  );
}

async function EvidenceTab({ employeeId, session }: { employeeId: string; session: Awaited<ReturnType<typeof getSession>> }) {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { projectId: true, name: true } });
  const [cards, project, fields, targets] = await Promise.all([
    listEvidenceCards({ employeeId }),
    employee.projectId ? listEvidenceCards({ projectId: employee.projectId, employeeId: null }) : Promise.resolve([]),
    fieldSuggestions(employeeId),
    replyTargets(),
  ]);
  const canReview = can(session, "evidence.review");
  const canRunAI = can(session, "ai.run");
  return (
    <div className="space-y-4">
      {can(session, "evidence.add", { employeeId }) && <AddEvidenceForm employees={[]} fixedEmployeeId={employeeId} replyTargets={targets} defaultDate={getEvaluationDate()} />}
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
