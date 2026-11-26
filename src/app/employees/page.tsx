import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/clock";
import { loadPortfolio } from "@/modules/case/portfolio";
import { levelLabel } from "@/modules/readiness/evaluate";
import EmployeeDirectory from "@/components/EmployeeDirectory";

export default async function EmployeesPage() {
  const session = await getSession();
  if (session.role === "EMPLOYEE") redirect("/workspace");
  const portfolio = await loadPortfolio();
  return (
    <div className="px-5 py-6 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Onboarding portfolio</p>
        <h1 className="mt-1 text-2xl font-bold">Employees</h1>
        <p className="mt-2 text-sm text-slate-600">Search cases, compare reported and assessed readiness, and open an employee case.</p>
      </header>
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
