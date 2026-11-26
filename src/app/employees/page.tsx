import { prisma } from "@/lib/db";
import { detectGaps } from "@/modules/findings/gapEngine";
import EmployeeDirectory from "@/components/EmployeeDirectory";

export default async function EmployeesPage() {
  await detectGaps();
  const employees = await prisma.employee.findMany({
    include: { project: true, case: { include: { findings: { where: { status: "OPEN" } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="px-5 py-6 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Onboarding portfolio</p>
        <h1 className="mt-1 text-2xl font-bold">Employees</h1>
        <p className="mt-2 text-sm text-slate-600">Search cases, review readiness, and open an employee journey.</p>
      </header>
      <EmployeeDirectory
        employees={employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          movement: employee.movement,
          project: employee.project?.name ?? null,
          reportedStatus: employee.trackerStatus,
          lastUpdate: employee.lastUpdate,
          risks: employee.case?.findings.map((finding) => finding.title) ?? [],
        }))}
      />
    </div>
  );
}
