import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/clock";
import { parseJson } from "@/lib/json";
import { can } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { briefingRolesFor, listBriefings } from "@/modules/briefing/service";
import type { BriefingRole, Section } from "@/modules/briefing/select";
import { GenerateBriefingButton, PrintButton } from "@/components/briefing/BriefingControls";
import { EmptyState, OriginBadge, ProvenanceBadge } from "@/components/ui/badges";

const ROLE_NAME: Record<BriefingRole, string> = { PMO: "PMO", ADDITIONAL_MANAGER: "Additional Manager", LINE_MANAGER: "Line Manager", TECH_LEAD: "Technical Lead", HR: "HR" };

export default async function BriefingPage({ searchParams }: { searchParams: Promise<{ role?: string; id?: string }> }) {
  const [session, scope] = await Promise.all([getSession(), getScope()]);
  if (!can(scope, "briefing.generate")) redirect("/");
  const sp = await searchParams;
  const allowed = briefingRolesFor(scope);
  if (!allowed.length) redirect("/");
  const role: BriefingRole = allowed.includes(sp.role as BriefingRole) ? (sp.role as BriefingRole) : allowed.includes(session.role as BriefingRole) ? (session.role as BriefingRole) : allowed[0];
  const history = (await listBriefings(role)).filter((b) => b.generatedBy === session.name);
  const current = (sp.id && history.find((b) => b.id === sp.id)) || history[0] || null;
  const sections = current ? parseJson<Section[]>(current.sectionsJson, []) : [];
  const findingIds = sections.flatMap((s) => s.statements.flatMap((x) => x.refs)).filter((r) => r.startsWith("finding:")).map((r) => r.slice(8));
  const findings = await prisma.finding.findMany({ where: { id: { in: findingIds } }, select: { id: true, case: { select: { employeeId: true } } } });
  const findingCase = new Map(findings.map((f) => [f.id, f.case.employeeId]));
  const hrefOf = (ref: string) => {
    const [type, id] = [ref.slice(0, ref.indexOf(":")), ref.slice(ref.indexOf(":") + 1)];
    if (type === "finding") return findingCase.has(id) ? `/employees/${findingCase.get(id)}?tab=investigation#${id}` : null;
    if (type === "evidence") return `/evidence${id.startsWith("TRACKER-") ? "?show=tracker" : ""}#${id}`;
    if (type === "action") return "/follow-ups";
    return null;
  };

  return (
    <div className="px-5 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Daily management briefing</p>
          <h1 className="mt-1 text-2xl font-bold">Briefing — {ROLE_NAME[role]}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Facts are selected deterministically per role. The AI only writes the narrative, and every statement must reference a finding, evidence or action — statements without valid references are rejected.</p>
        </div>
        <GenerateBriefingButton role={role} />
      </header>
      <nav className="no-print mt-4 flex flex-wrap gap-2 text-sm">
        {allowed.length > 1 && allowed.map((r) => <Link key={r} href={`/briefing?role=${r}`} className={`rounded-full px-3 py-1 font-semibold ${r === role ? "bg-indigo-600 text-white" : "border bg-white text-slate-600"}`}>{ROLE_NAME[r]}</Link>)}
      </nav>

      {current ? (
        <article className="mt-5 rounded-xl border border-slate-200 bg-white p-6" data-testid="briefing">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Evaluation date {formatDate(current.evaluationDate)} · generated {new Date(current.generatedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC by {current.generatedBy}</p>
            <div className="flex items-center gap-2">
              {current.narrativeSource === "AI" ? <OriginBadge origin="AI" /> : <OriginBadge origin="RULE" />}
              <a href={`/api/briefing/${current.id}/markdown`} className="no-print inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-bold"><Download size={13} />Markdown</a>
              <PrintButton />
            </div>
          </div>
          {current.aiError && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">AI narrative unavailable ({current.aiError}). Showing the deterministic statements. Use “Generate briefing” to retry.</p>}
          {current.rejectedCount > 0 && <p className="mt-2 text-xs text-amber-800">{current.rejectedCount} AI statement(s) were rejected for missing or invalid references.</p>}
          {sections.map((s) => (
            <section key={s.key} className="mt-5">
              <h2 className="flex items-center gap-2 font-bold">{s.title}{s.statements.length > 0 && (s.source === "AI" ? <span className="text-[10px] font-semibold uppercase text-violet-600">AI wording</span> : <span className="text-[10px] font-semibold uppercase text-slate-400">rule wording</span>)}</h2>
              {s.statements.length ? (
                <ul className="mt-2 space-y-1.5">
                  {s.statements.map((x, i) => (
                    <li key={i} className="text-sm" data-statement>
                      {x.text}{" "}
                      {x.refs.map((r) => { const href = hrefOf(r); return href ? <Link key={r} href={href} className="ml-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">{r.replace("finding:", "").replace("evidence:", "").replace("action:", "action ")}</Link> : <span key={r} className="ml-1 text-[11px] text-slate-400">{r}</span>; })}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-slate-500">{s.note ?? "Nothing to report."}</p>}
            </section>
          ))}
          <p className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><ProvenanceBadge state="actual" /> Facts from stored records; wording may be AI-written; no AI output changed any record.</p>
        </article>
      ) : <div className="mt-5"><EmptyState title={`No ${ROLE_NAME[role]} briefing yet`}>Generate one to see the referenced summary for this role.</EmptyState></div>}

      {history.length > 1 && (
        <section className="no-print mt-6">
          <h2 className="text-sm font-bold text-slate-600">History</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">{history.map((b) => <li key={b.id}><Link href={`/briefing?role=${role}&id=${b.id}`} className={`rounded-full border px-3 py-1 ${b.id === current?.id ? "border-indigo-400 bg-indigo-50" : "bg-white"}`}>{new Date(b.generatedAt).toLocaleString("en-GB", { timeZone: "UTC" })} · {b.narrativeSource.toLowerCase()}</Link></li>)}</ul>
        </section>
      )}
    </div>
  );
}
