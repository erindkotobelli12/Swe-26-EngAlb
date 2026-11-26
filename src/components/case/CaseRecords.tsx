import { ACCESS_STATUS_LABEL, KT_STAGE_LABEL, roleLabel, type CaseState, type PersonRef } from "@/domain/types";
import { formatDate } from "@/lib/clock";
import { EvidenceChip, ProvenanceBadge } from "@/components/ui/badges";

function personLine(p: PersonRef | null, fallback: string | null, role: string, project: string | null) {
  if (p?.name) return <span>{p.name}</span>;
  if (p) return <span className="text-slate-600">{roleLabel(role)}{project ? ` — ${project}` : ""}, <i>name not recorded</i></span>;
  if (fallback) return <span>{fallback}</span>;
  return <span className="font-semibold text-red-600">Not recorded</span>;
}

export function Stakeholders({ state }: { state: CaseState }) {
  const project = state.employee.projectName;
  const others = state.people.projectPeople.filter((p) => ![state.people.lineManager?.id, state.people.techLead?.id, state.people.ktOwner?.id].includes(p.id));
  return (
    <dl className="grid gap-2 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-slate-500">Line Manager</dt><dd className="text-right">{personLine(state.people.lineManager, state.people.lineManagerText, "LINE_MANAGER", project)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-slate-500">Technical Lead</dt><dd className="text-right">{personLine(state.people.techLead, null, "TECH_LEAD", project)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-slate-500">KT owner</dt><dd className="text-right">{personLine(state.people.ktOwner, null, "KT_OWNER", project)}</dd></div>
      {others.map((p) => <div key={p.id} className="flex justify-between gap-3 text-xs"><dt className="text-slate-500">{roleLabel(p.role)} (project)</dt><dd className="text-right">{p.name ?? <i>name not recorded</i>}</dd></div>)}
    </dl>
  );
}

export function AccessTable({ state }: { state: CaseState }) {
  if (!state.access.length) return <p className="text-sm text-slate-500">No required applications are recorded for this case. Required access is <b>unknown</b>, not satisfied.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr>{["Application", "Status", "Requested", "Next-step owner", "Next follow-up", "Source"].map((h) => <th key={h} className="whitespace-nowrap py-2 pr-3">{h}</th>)}</tr></thead>
        <tbody>
          {state.access.map((a) => (
            <tr key={a.id} className="border-t border-slate-100 align-top" data-access={a.application} data-status={a.status}>
              <td className="py-2 pr-3 font-semibold">{a.application}<p className="text-xs font-normal text-slate-500">{a.requiredScope}</p></td>
              <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.status === "USABLE" ? "bg-emerald-50 text-emerald-700" : a.status === "PROVISIONED" || a.status === "APPROVED" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>{ACCESS_STATUS_LABEL[a.status]}</span>{a.blockerReason && <p className="mt-1 text-xs text-slate-500">{a.blockerReason}</p>}</td>
              <td className="whitespace-nowrap py-2 pr-3">{a.requestDate ? formatDate(a.requestDate) : <span className="text-slate-400">Unknown</span>}</td>
              <td className="py-2 pr-3">{a.owner ?? <span className="font-semibold text-red-600">Not recorded</span>}{a.handlerRole && <p className="text-xs text-slate-500">Handled by {roleLabel(a.handlerRole)}</p>}</td>
              <td className="whitespace-nowrap py-2 pr-3">{a.nextFollowUp ? formatDate(a.nextFollowUp) : <span className="text-slate-400">Not scheduled</span>}</td>
              <td className="py-2 pr-3">{[a.requestEvidenceId, a.evidenceId, a.usableEvidenceId].filter((x, i, arr): x is string => Boolean(x) && arr.indexOf(x) === i).map((id) => <EvidenceChip key={id} id={id} />)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KTTable({ state }: { state: CaseState }) {
  if (!state.kt.length) return <p className="text-sm text-slate-500">No KT activities recorded. KT scope is <b>unknown</b>.</p>;
  return (
    <ul className="space-y-2">
      {state.kt.map((k) => (
        <li key={k.id} className={`rounded-lg border p-3 ${k.status === "PROPOSED" ? "border-dashed border-amber-300 bg-amber-50/30" : k.status === "REJECTED" ? "border-slate-200 opacity-60" : "border-slate-200"}`} data-kt={k.title}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-sm">{k.title}</b>
            <span className="flex items-center gap-2">
              {k.status === "PROPOSED" ? <ProvenanceBadge state="proposed" /> : k.status === "REJECTED" ? <span className="text-[11px] font-bold uppercase text-slate-500">rejected</span> : <ProvenanceBadge state="actual" />}
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">{k.scopeType === "COMPLEX" ? "complex / exceptions" : "core scope"}</span>
            </span>
          </div>
          <p className="mt-1 text-sm">{KT_STAGE_LABEL[k.stage]}{k.stage !== "NOT_STARTED" && <span className={`ml-2 text-xs font-semibold ${k.stageBasis === "OBSERVED" ? "text-emerald-700" : "text-amber-700"}`}>{k.stageBasis === "OBSERVED" ? "observed by technical owner" : k.stageBasis === "SELF_REPORTED" ? "self-reported, not observed" : k.stageBasis === "ASSESSMENT" ? "assessment only — does not count" : "reported, not observed"}</span>}</p>
          <p className="mt-1 text-xs text-slate-500">Owner: {k.owner ?? "not recorded"}{k.requiredApps.length ? ` · Uses: ${k.requiredApps.join(", ")}` : ""}{k.evidenceId ? " · " : ""}{k.evidenceId && <EvidenceChip id={k.evidenceId} />}</p>
          {k.originNote && <p className="mt-1 text-xs text-amber-800">{k.originNote}</p>}
        </li>
      ))}
    </ul>
  );
}
