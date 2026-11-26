import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { thresholds } from "@/config/thresholds";
import { escalationsFor } from "@/modules/home/queries";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, EmptyState, StatusPill } from "@/components/ui/primitives";

/** Escalations that reached the Additional Manager: Line Manager follow-ups open past the escalation threshold. */
export default async function EscalationsPage() {
  const scope = await getScope();
  if (!Object.values(scope.projectRoles).some((r) => r.includes("ADDITIONAL_MANAGER"))) redirect("/");
  const groups = await escalationsFor(scope);
  return (
    <>
      <PageHeader title="Escalations" subtitle={`Follow-ups to your Line Managers that have been open for ${thresholds.ESCALATE_AFTER_DAYS} days or more. Next level up: the PMO.`} breadcrumbs={[{ label: "Escalations" }]} />
      {groups.length ? (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.key} title={g.stakeholder} subtitle={g.recommendation ?? undefined}>
              <ul className="divide-y divide-line">
                {g.items.map((i) => (
                  <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0"><Link href={`/employees/${i.employeeId}`} className="text-sm font-medium text-ink hover:underline">{i.employee}</Link><span className="block text-xs text-subtle">{i.title} — {i.ask}</span></span>
                    <StatusPill tone="amber"><span className="tabular">{i.daysOpen}</span> days open</StatusPill>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={ShieldCheck} title="Nothing has been escalated to you.">Line Managers&apos; follow-ups are within the agreed time.</EmptyState>}
    </>
  );
}
