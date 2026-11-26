import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import { Mail, MessageSquare } from "lucide-react";
import { thresholds } from "@/config/thresholds";
import { getSession } from "@/lib/auth";
import { parseJson } from "@/lib/json";
import { can } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { loadFollowUpQueue } from "@/modules/followups/service";
import type { FollowUpItem } from "@/modules/followups/candidates";
import { CommunicationCard, CreateDraftButton, ItemList } from "@/components/followups/FollowUpCards";
import { EmptyState, ProvenanceBadge } from "@/components/ui/badges";

export default async function FollowUpCenter() {
  const session = await getSession();
  if (session.role === "EMPLOYEE") redirect("/workspace");
  const scope = await getScope();
  const { groups, communications, employees } = await loadFollowUpQueue(undefined, scope);
  const canAct = can(scope, "communication.approve");
  const canActOn = (ids: string[]) => can(scope, "communication.approve", { employeeIds: ids });
  const actionable = groups.filter((g) => g.items.some((i) => can(scope, "communication.approve", { employeeId: i.employeeId })));
  const toCard = (c: (typeof communications)[number]) => ({
    ...c, items: parseJson<FollowUpItem[]>(c.itemsJson, []),
    employees: parseJson<string[]>(c.employeeIds, []).map((id) => ({ id, name: employees.get(id) ?? id })),
  });
  const active = communications.filter((c) => c.status !== "CLOSED");
  const closed = communications.filter((c) => c.status === "CLOSED");

  return (
    <div className="">
      <PageHeader title="Follow-ups" subtitle={<>One message per person, covering everything open with them. Drafts are approved by the phase owner or the Line Manager; sending is simulated. Reminder after {thresholds.REMINDER_AFTER_DAYS} days; escalation is recommended after {thresholds.ESCALATE_AFTER_DAYS} days (Line Manager → Additional Manager → PMO), never automatic.</>} breadcrumbs={[{ label: "Follow-ups" }]}
        actions={canAct && actionable.length > 0 ? <CreateDraftButton keys="ALL" label={`Create drafts for all (${actionable.length})`} /> : undefined} />

      <h2 className="mt-6 text-lg font-semibold">Active follow-ups <span className="text-sm font-normal text-subtle">({active.length})</span></h2>
      <div className="mt-3 space-y-4">{active.length ? active.map((c) => <CommunicationCard key={`${c.id}-${c.status}-${c.draftOrigin}-${c.subject}`} c={toCard(c)} canAct={canActOn(parseJson<string[]>(c.employeeIds, []))} />) : <EmptyState title="No drafts yet">Create drafts from the queue below.</EmptyState>}</div>

      <h2 className="mt-8 text-lg font-semibold">Queue — not yet drafted <span className="text-sm font-normal text-subtle">({groups.length} stakeholder(s), {groups.reduce((n, g) => n + g.items.length, 0)} item(s))</span></h2>
      <p className="mt-1 flex items-center gap-2 text-xs text-subtle"><ProvenanceBadge state="actual" /> Detected deterministically from open findings, access requests and action items.</p>
      <div className="mt-3 space-y-4">
        {groups.length ? groups.map((g) => (
          <section key={g.stakeholder.key} className="rounded-card border border-line bg-surface shadow-soft p-5" data-group={g.stakeholder.label}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold">{g.stakeholder.channel === "TEAMS" ? <MessageSquare size={15} /> : <Mail size={15} />}{g.stakeholder.label}</p>
                <p className="mt-0.5 text-xs text-subtle">{g.items.length} {g.items.length === 1 ? "item" : "items"} · {g.stakeholder.channel === "TEAMS" ? "Teams message" : "Email to the role mailbox"}</p>
              </div>
              {actionable.includes(g) && <CreateDraftButton keys={[g.stakeholder.key]} label="Create draft" />}
            </div>
            {g.escalationRecommendation && <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-900">{g.escalationRecommendation}</p>}
            <ItemList items={g.items} />
          </section>
        )) : <EmptyState title="Nothing to follow up">Every open item is covered by an active follow-up.</EmptyState>}
      </div>

      {closed.length > 0 && <details className="mt-8 rounded-card border border-line bg-surface shadow-soft p-4"><summary className="cursor-pointer text-sm font-semibold text-muted">Closed ({closed.length})</summary><div className="mt-3 space-y-3">{closed.map((c) => <CommunicationCard key={c.id} c={toCard(c)} canAct={false} />)}</div></details>}
    </div>
  );
}
