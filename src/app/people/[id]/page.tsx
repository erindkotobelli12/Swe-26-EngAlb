import Link from "next/link";
import { UserX } from "lucide-react";
import { formatDate } from "@/lib/clock";
import { label, READINESS_LABEL, roleLabel } from "@/lib/labels";
import { loadProfile } from "@/modules/people/profile";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, ButtonLink, Card, DataTable, EmptyState, PersonChip, PhaseStepper, SampleTag, StatusPill } from "@/components/ui/primitives";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await getScope();
  const profile = await loadProfile(id, scope);
  if (!profile) {
    return <EmptyState icon={UserX} title="This profile isn't available." action={<ButtonLink href="/">Go to my home page</ButtonLink>}>It doesn&apos;t exist, or it&apos;s outside the people you work with.</EmptyState>;
  }
  const { person, current, lineManager, employee, assignments } = profile;
  const mine = scope.personId === person.id;
  const currentRows = assignments.filter((a) => a.status === "ACTIVE");
  const pastRows = assignments.filter((a) => a.status !== "ACTIVE");
  const rows = [...currentRows, ...pastRows];

  return (
    <>
      <PageHeader breadcrumbs={[{ label: mine ? "My profile" : "People" }, ...(mine ? [] : [{ label: person.name ?? "Profile" }])]}
        title={<span className="flex items-center gap-3"><Avatar name={person.name} size={40} />{person.name ?? "Name not recorded"}{person.isSample && <SampleTag />}</span>}
        subtitle={current ? `${roleLabel(current.role)} on ${current.projectName}` : roleLabel(person.role)}
        meta={<>
          {lineManager && <span className="text-sm text-muted">Line Manager: <Link href={`/people/${lineManager.id}`} className="font-medium text-ink hover:underline">{lineManager.name}</Link></span>}
          {employee?.phase && <PhaseStepper phase={employee.phase} />}
        </>} />
      <div className="space-y-6">
        <Card title="Projects" subtitle="Current and earlier assignments.">
          <DataTable rows={rows} rowKey={(r) => r.id} caption="Project assignments"
            empty={<p className="text-sm text-subtle">No project assignments yet.</p>}
            columns={[
              { key: "project", header: "Project", cell: (r) => <span className="font-medium text-ink">{r.projectName}{r.projectIsSample && <SampleTag className="ml-1.5" />}</span> },
              { key: "role", header: "Role", cell: (r) => roleLabel(r.role) },
              { key: "dates", header: "Dates", cell: (r) => <span className="tabular text-muted">{r.startDate ? formatDate(r.startDate) : "Unknown"} – {r.status === "ACTIVE" ? "now" : r.endDate ? formatDate(r.endDate) : "Unknown"}</span> },
              { key: "status", header: "Status", cell: (r) => <StatusPill tone={r.status === "ACTIVE" ? "brand" : "slate"}>{label("assignment", r.status)}</StatusPill> },
              { key: "outcome", header: "Outcome", cell: (r) => (r.validated ? `Validated as ${(READINESS_LABEL[r.validated] ?? r.validated).toLowerCase()}` :<span className="text-subtle">{r.status === "COMPLETED" ? "No validation recorded" : "—"}</span>) },
              { key: "sample", header: "", cell: (r) => (r.isSample ? <SampleTag /> : null) },
            ]} />
        </Card>
        {employee && !mine && <p className="text-sm"><Link href={`/employees/${employee.id}`} className="font-medium text-brand-700 hover:underline">Open the onboarding case</Link></p>}
        {lineManager === null && current?.role === "EMPLOYEE" && <PersonChip name={undefined} missingLabel="Line Manager: not assigned" />}
      </div>
    </>
  );
}
