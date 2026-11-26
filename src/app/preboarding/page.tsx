import { redirect } from "next/navigation";
import { thresholds } from "@/config/thresholds";
import { loadPreboarding } from "@/modules/preboarding/queries";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/primitives";
import { PreboardingBoard } from "@/components/preboarding/Board";

/** HR: everyone in pre-boarding. Line Managers: their own employees in pre-boarding. */
export default async function PreboardingPage() {
  const scope = await getScope();
  if (!scope.isHR && !Object.values(scope.cases).some((c) => c.relations.includes("LM"))) redirect("/");
  const rows = await loadPreboarding(scope);
  const upcoming = rows.filter((r) => r.daysToStart >= 0 && r.daysToStart <= thresholds.UPCOMING_START_DAYS).length;
  return (
    <>
      <PageHeader title="Pre-boarding" subtitle={scope.isHR ? "Everyone who hasn't started onboarding yet." : "Your employees who haven't started onboarding yet."} breadcrumbs={[{ label: "Pre-boarding" }]} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="In pre-boarding" value={rows.length} />
        <StatCard label={`Starting in the next ${thresholds.UPCOMING_START_DAYS} days`} value={upcoming} tone={upcoming ? "amber" : "neutral"} />
        <StatCard label="People with blocked items" value={rows.filter((r) => r.blocked.length).length} tone={rows.some((r) => r.blocked.length) ? "red" : "neutral"} />
        <StatCard label="Missing contacts" value={rows.filter((r) => r.missingContacts.length).length} tone={rows.some((r) => r.missingContacts.length) ? "amber" : "neutral"} />
      </div>
      <PreboardingBoard rows={rows} openFirst={rows.length === 1} />
    </>
  );
}
