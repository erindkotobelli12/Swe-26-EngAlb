import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { can } from "@/modules/permissions";
import { loadAssignablePeople } from "@/modules/projects/queries";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import ProjectWizard from "@/components/projects/ProjectWizard";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!can(await getScope(), "project.manage")) redirect(`/projects/${id}`);
  const [project, options] = await Promise.all([
    prisma.project.findUnique({ where: { id }, include: { assignments: { where: { status: "ACTIVE", role: { in: ["ADDITIONAL_MANAGER", "LINE_MANAGER"] } } } } }),
    loadAssignablePeople(),
  ]);
  if (!project) notFound();
  const am = project.assignments.find((a) => a.role === "ADDITIONAL_MANAGER")?.personId ?? "";
  return (
    <>
      <PageHeader title={`Edit ${project.name}`} subtitle="Change the details and managers, or add more people. Existing employees are managed on the Team tab."
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: project.name, href: `/projects/${id}` }, { label: "Edit" }]} />
      <ProjectWizard mode="edit" projectId={id} options={options}
        initial={{ name: project.name, code: project.code ?? "", description: project.description ?? "", startDate: project.startDate ?? "", additionalManagerId: am, lineManagerIds: project.assignments.filter((a) => a.role === "LINE_MANAGER").map((a) => a.personId) }} />
    </>
  );
}
