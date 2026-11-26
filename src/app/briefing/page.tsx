import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/clock";
import { roleLabel } from "@/lib/labels";
import { can } from "@/modules/permissions";
import { briefingRolesFor, listBriefings } from "@/modules/briefing/service";
import type { BriefingRole } from "@/modules/briefing/select";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn, EmptyState, LinkTabs } from "@/components/ui/primitives";
import { GenerateBriefingButton } from "@/components/briefing/BriefingControls";
import { BriefingView } from "@/components/briefing/BriefingPanel";

const SUBTITLE: Record<BriefingRole, string> = {
  PMO: "Portfolio level: risk, readiness distribution, urgent problems and escalations.",
  ADDITIONAL_MANAGER: "Your projects: risk, people who need intervention and escalations.",
  LINE_MANAGER: "Your team: practical blockers and overdue follow-ups.",
  TECH_LEAD: "Your projects: sign-offs, knowledge-transfer gaps and conflicts.",
  HR: "Pre-boarding: open items and start dates at risk.",
};

export default async function BriefingPage({ searchParams }: { searchParams: Promise<{ role?: string; id?: string }> }) {
  const [session, scope] = await Promise.all([getSession(), getScope()]);
  if (!can(scope, "briefing.generate")) redirect("/");
  const sp = await searchParams;
  const allowed = briefingRolesFor(scope);
  if (!allowed.length) redirect("/");
  const role: BriefingRole = allowed.includes(sp.role as BriefingRole) ? (sp.role as BriefingRole) : allowed.includes(session.role as BriefingRole) ? (session.role as BriefingRole) : allowed[0];
  const history = await listBriefings(role, session.userId);
  const current = (sp.id && history.find((b) => b.id === sp.id)) || history[0] || null;

  return (
    <>
      <PageHeader title="Briefing" subtitle={SUBTITLE[role]} breadcrumbs={[{ label: "Briefing" }, ...(allowed.length > 1 ? [{ label: roleLabel(role) }] : [])]}
        actions={current ? <GenerateBriefingButton role={role} label="Generate a new briefing" variant="secondary" /> : undefined} />
      {allowed.length > 1 && <div className="mb-6"><LinkTabs current={role} label="Briefing for" tabs={allowed.map((r) => ({ id: r, label: `As ${roleLabel(r)}`, href: `/briefing?role=${r}` }))} /></div>}
      {current ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
          <BriefingView briefing={current} />
          {history.length > 1 && (
            <nav aria-label="Earlier briefings" className="no-print">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subtle">Earlier briefings</p>
              <ul className="space-y-1">
                {history.map((b) => (
                  <li key={b.id}><Link href={`/briefing?role=${role}&id=${b.id}`} className={cn("block rounded-lg px-3 py-2 text-sm", b.id === current.id ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:bg-canvas")}>{formatDate(b.generatedAt)} · {new Date(b.generatedAt).toISOString().slice(11, 16)} UTC</Link></li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      ) : (
        <EmptyState icon={FileText} title={`No briefing yet as ${roleLabel(role)}.`} action={<GenerateBriefingButton role={role} />}>
          It lists what needs your attention, each statement with its source. Facts come from rules; the AI may only reword them.
        </EmptyState>
      )}
    </>
  );
}
