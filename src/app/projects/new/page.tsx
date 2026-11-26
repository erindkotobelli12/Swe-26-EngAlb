import { redirect } from "next/navigation";
import { can } from "@/modules/permissions";
import { loadAssignablePeople } from "@/modules/projects/queries";
import { getScope } from "@/server/principal";
import { PageHeader } from "@/components/ui/PageHeader";
import ProjectWizard from "@/components/projects/ProjectWizard";

export default async function NewProjectPage() {
  if (!can(await getScope(), "project.manage")) redirect("/projects");
  const options = await loadAssignablePeople();
  return (
    <>
      <PageHeader title="Create project" subtitle="Set up the project, its managers and the people who will join it." breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: "Create project" }]} />
      <ProjectWizard mode="create" initial={{ name: "", code: "", description: "", startDate: "", additionalManagerId: "", lineManagerIds: [] }} options={options} />
    </>
  );
}
