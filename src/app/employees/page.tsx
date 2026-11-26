import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getScope } from "@/server/principal";
import { visibleEmployeeIds } from "@/modules/permissions";
import { formatDate } from "@/lib/clock";
import { loadPortfolio } from "@/modules/case/portfolio";
import { levelLabel } from "@/modules/readiness/evaluate";
import EmployeeDirectory from "@/components/EmployeeDirectory";

export default async function EmployeesPage() {
  const session = await getSession();
  if (session.role === "EMPLOYEE") redirect("/workspace");
  const portfolio = await loadPortfolio(undefined, visibleEmployeeIds(await getScope()));
  return (
    <div className="">
      <PageHeader title="People" subtitle="Everyone you work with. Compare reported and assessed readiness and open a case." breadcrumbs={[{ label: "People" }]} />
      <EmployeeDirectory
        employees={portfolio
          .sort((a, b) => a.state.employee.name.localeCompare(b.state.employee.name))
          .map((c) => ({
            id: c.state.employee.id,
            name: c.state.employee.name,
            movement: c.state.employee.movement,
            project: c.state.employee.projectName,
            reportedStatus: c.readiness.reported,
            assessed: levelLabel(c.readiness.assessed),
            lastUpdate: formatDate(c.state.employee.lastUpdate),
            risks: c.open.map((f) => f.title),
          }))}
      />
    </div>
  );
}
