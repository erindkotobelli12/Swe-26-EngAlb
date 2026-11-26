import { redirect } from "next/navigation";
import { Mail, MessageSquare } from "lucide-react";
import { thresholds } from "@/config/thresholds";
import { getSession } from "@/lib/auth";
import { parseJson } from "@/lib/json";
import { can } from "@/modules/permissions";
import { loadFollowUpQueue } from "@/modules/followups/service";
import type { FollowUpItem } from "@/modules/followups/candidates";
import { CommunicationCard, CreateDraftButton, ItemList } from "@/components/followups/FollowUpCards";
import { EmptyState, ProvenanceBadge } from "@/components/ui/badges";

export default async function FollowUpCenter() {
  const session = await getSession();
  if (session.role === "EMPLOYEE") redirect("/workspace");
  const { groups, communications, employees } = await loadFollowUpQueue();
  const canAct = can(session, "communication.approve");
  const toCard = (c: (typeof communications)[number]) => ({
    ...c, items: parseJson<FollowUpItem[]>(c.itemsJson, []),
    employees: parseJson<string[]>(c.employeeIds, []).map((id) => ({ id, name: employees.get(id) ?? id })),
  });
  const active = communications.filter((c) => c.status !== "CLOSED");
  const closed = communications.filter((c) => c.status === "CLOSED");

  return (
    <div className="px-5 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Consolidated follow-ups and escalation</p>
          <h1 className="mt-1 text-2xl font-bold">Follow-Up Center</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Pending items are grouped into one message per stakeholder. Drafts start as deterministic templates; the AI can personalise them; the PMO edits and approves; “Send” only places them in a <b>simulated outbox</b>. Reminder after {thresholds.REMINDER_AFTER_DAYS} days, escalation <i>recommended</i> after {thresholds.ESCALATE_AFTER_DAYS} days — never automatic.</p>
        </div>
        {canAct && groups.length > 0 && <CreateDraftButton keys="ALL" label={`Create drafts for all (${groups.length})`} />}
      </header>

      <h2 className="mt-6 text-lg font-bold">Active follow-ups <span className="text-sm font-normal text-slate-500">({active.length})</span></h2>
      <div className="mt-3 space-y-4">{active.length ? active.map((c) => <CommunicationCard key={`${c.id}-${c.status}-${c.draftOrigin}-${c.subject}`} c={toCard(c)} canAct={canAct} />) : <EmptyState title="No drafts yet">Create drafts from the queue below.</EmptyState>}</div>

      <h2 className="mt-8 text-lg font-bold">Queue — not yet drafted <span className="text-sm font-normal text-slate-500">({groups.length} stakeholder(s), {groups.reduce((n, g) => n + g.items.length, 0)} item(s))</span></h2>
      <p className="mt-1 flex items-center gap-2 text-xs text-slate-500"><ProvenanceBadge state="actual" /> Detected deterministically from open findings, access requests and action items.</p>
      <div className="mt-3 space-y-4">
        {groups.length ? groups.map((g) => (
          <section key={g.stakeholder.key} className="rounded-xl border border-slate-200 bg-white p-5" data-group={g.stakeholder.label}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-bold">{g.stakeholder.channel === "TEAMS" ? <MessageSquare size={15} /> : <Mail size={15} />}{g.stakeholder.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{g.items.length} item(s) · priority {g.score} · {g.stakeholder.channel === "TEAMS" ? "Teams (named person)" : "Email (role mailbox)"}</p>
              </div>
              {canAct && <CreateDraftButton keys={[g.stakeholder.key]} label="Create draft" />}
            </div>
            {g.escalationRecommendation && <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-900">{g.escalationRecommendation}</p>}
            <ItemList items={g.items} />
          </section>
        )) : <EmptyState title="Nothing to follow up">Every open item is covered by an active follow-up.</EmptyState>}
      </div>

      {closed.length > 0 && <details className="mt-8 rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-slate-600">Closed ({closed.length})</summary><div className="mt-3 space-y-3">{closed.map((c) => <CommunicationCard key={c.id} c={toCard(c)} canAct={false} />)}</div></details>}
    </div>
  );
}
