import Link from "next/link";
import { CheckCircle2, Clock3, KeyRound } from "lucide-react";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/clock";
import { ACCESS_STATUS_LABEL, roleLabel } from "@/domain/types";
import { loadCaseState } from "@/modules/case/loadCaseState";
import { evaluateReadiness } from "@/modules/readiness/evaluate";
import { confirmAccessUsableAction } from "@/server/actions/access";
import ActionButton from "@/components/ActionButton";
import { KTTable } from "@/components/case/CaseRecords";
import { GateList, ReadinessTriple } from "@/components/case/ReadinessPanels";
import { Card, EmptyState } from "@/components/ui/badges";

export default async function Workspace() {
  const session = await getSession();
  if (!session.employeeId) {
    return (
      <div className="px-5 py-6 md:px-8">
        <header><p className="text-sm text-slate-500">Personal onboarding journey</p><h1 className="mt-1 text-2xl font-bold">My workspace</h1></header>
        <div className="mt-5"><EmptyState title="My workspace is for employee users">Switch the demo user to an employee (for example Mila Rowan or Leo Marin) to see their own journey.</EmptyState></div>
      </div>
    );
  }
  const state = await loadCaseState(session.employeeId);
  if (!state) return <div className="px-5 py-6 md:px-8"><EmptyState title="No onboarding case is linked to your user." /></div>;
  const readiness = evaluateReadiness(state);
  const toConfirm = state.access.filter((a) => a.required && a.status !== "USABLE");
  const myActions = state.findings.filter((f) => f.status === "OPEN").flatMap((f) => f.recommendedActions.filter((a) => a.ownerRole === "EMPLOYEE").map((a) => ({ ...a, finding: f.title })));
  const nextKt = state.kt.filter((k) => k.status === "CONFIRMED" && k.stage !== "INDEPENDENT_EXECUTION");

  return (
    <div className="px-5 py-6 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Personal onboarding journey · {state.employee.projectName ?? "project not recorded"}</p>
        <h1 className="mt-1 text-2xl font-bold">My workspace</h1>
        <p className="mt-1 text-sm text-slate-600">Hello {state.employee.name}. This page shows only your own case.</p>
      </header>
      <div className="mt-5"><ReadinessTriple readiness={readiness} /></div>
      <section className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="What to do next">
          <ul className="space-y-3 text-sm">
            {myActions.map((a, i) => <li key={i} className="flex gap-2"><Clock3 size={17} className="shrink-0 text-indigo-600" /><span>{a.action}<span className="block text-xs text-slate-500">{a.finding}</span></span></li>)}
            {nextKt.map((k) => <li key={k.id} className="flex gap-2"><Clock3 size={17} className="shrink-0 text-indigo-600" /><span>Continue KT: {k.title}<span className="block text-xs text-slate-500">Owner: {k.owner ?? "not recorded — ask your Line Manager"}</span></span></li>)}
            {!myActions.length && !nextKt.length && <li className="text-slate-500">No actions are assigned to you right now.</li>}
          </ul>
        </Card>
        <Card title={<span className="flex items-center gap-2"><KeyRound size={16} />My access</span>}>
          {state.access.length ? (
            <ul className="space-y-3">
              {state.access.map((a) => (
                <li key={a.id} className="text-sm" data-access={a.application}>
                  <div className="flex items-center justify-between gap-2"><b>{a.application}</b>{a.status === "USABLE" ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} />Usable</span> : <span className="text-xs text-amber-700">{ACCESS_STATUS_LABEL[a.status]}</span>}</div>
                  {a.status !== "USABLE" && <p className="mt-0.5 text-xs text-slate-500">{a.blockerReason ?? "Waiting"}{a.handlerRole ? ` · handled by ${roleLabel(a.handlerRole)}` : ""}</p>}
                  {toConfirm.some((x) => x.id === a.id) && (a.status === "PROVISIONED" || a.status === "APPROVED") && (
                    <div className="mt-2"><ActionButton action={confirmAccessUsableAction.bind(null, a.id)} label={`I logged in to ${a.application} successfully`} pendingLabel="Recording…" variant="secondary" /></div>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">No access requests are recorded for you. If you need tools, tell your Line Manager.</p>}
          <p className="mt-3 text-xs text-slate-400">Never enter passwords or credentials here. Only confirm that you could log in.</p>
        </Card>
        <Card title="Readiness expectations">
          <ul className="space-y-2 text-sm text-slate-600">
            <li><b>Shadowing</b> — you watch an experienced colleague.</li>
            <li><b>Supported execution</b> — you do the work with guidance or review.</li>
            <li><b>Independent execution</b> — you do the agreed work without step-by-step support and know when to escalate.</li>
            <li>Final readiness is based on observed execution plus validation by your Technical Lead — not on the number of sessions attended.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">Last tracker update {formatDate(state.employee.lastUpdate)}.</p>
        </Card>
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="My knowledge transfer"><KTTable state={state} /></Card>
        <Card title="My readiness checklist" actions={<Link href={`/employees/${state.employee.id}`} className="text-xs font-bold text-indigo-600">Full case →</Link>}><GateList gates={readiness.gates} compact /></Card>
      </section>
    </div>
  );
}
