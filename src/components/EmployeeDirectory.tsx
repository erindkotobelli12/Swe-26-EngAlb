"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

type EmployeeRow = {
  id: string;
  name: string;
  movement: string;
  project: string | null;
  reportedStatus: string;
  assessed: string;
  lastUpdate: string;
  risks: string[];
};

export default function EmployeeDirectory({ employees }: { employees: EmployeeRow[] }) {
  const [query, setQuery] = useState("");
  const [movement, setMovement] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const statuses = useMemo(
    () => [...new Set(employees.map((employee) => employee.reportedStatus))].sort(),
    [employees],
  );
  const filtered = employees.filter((employee) => {
    const searchText = `${employee.name} ${employee.id} ${employee.project ?? ""}`.toLowerCase();
    return (
      searchText.includes(query.toLowerCase()) &&
      (movement === "ALL" || employee.movement === movement) &&
      (status === "ALL" || employee.reportedStatus === status)
    );
  });

  return (
    <>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface shadow-soft p-4">
          <p className="text-sm text-subtle">Total employees</p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-semibold"><Users size={20} className="text-brand-700" />{employees.length}</p>
        </div>
        <div className="rounded-card border border-line bg-surface shadow-soft p-4">
          <p className="text-sm text-subtle">Cases with open findings</p>
          <p className="mt-2 text-2xl font-semibold">{employees.filter((employee) => employee.risks.length > 0).length}</p>
        </div>
        <div className="rounded-card border border-line bg-surface shadow-soft p-4">
          <p className="text-sm text-subtle">Project not recorded</p>
          <p className="mt-2 text-2xl font-semibold">{employees.filter((employee) => !employee.project).length}</p>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-card border border-line bg-surface shadow-soft">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center">
          <label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-subtle">
            <Search size={16} />
            <input
              aria-label="Search employees"
              placeholder="Search name, ID, or project"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full outline-none"
            />
          </label>
          <select aria-label="Filter by movement" value={movement} onChange={(event) => setMovement(event.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm">
            <option value="ALL">All movement types</option>
            <option value="New Hire">New Hire</option>
            <option value="Reallocation">Reallocation</option>
          </select>
          <select aria-label="Filter by reported status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm">
            <option value="ALL">All reported statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-xs uppercase text-subtle">
              <tr>{["Employee", "Movement", "Project", "Reported status", "Assessed", "Open findings", "Last update", ""].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((employee) => (
                <tr key={employee.id} className="border-t border-line hover:bg-canvas">
                  <td className="whitespace-nowrap px-4 py-3"><Link href={`/employees/${employee.id}`} className="font-semibold text-brand-700 hover:underline">{employee.name}</Link><p className="text-xs text-subtle">{employee.id}</p></td>
                  <td className="whitespace-nowrap px-4 py-3">{employee.movement}</td>
                  <td className="whitespace-nowrap px-4 py-3">{employee.project ?? <span className="text-amber-700">Unknown</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3">{employee.reportedStatus}</td>
                  <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{employee.assessed}</span></td>
                  <td className="px-4 py-3">{employee.risks.length ? <span className="text-amber-700">{employee.risks.length} · {employee.risks[0]}</span> : <span className="text-subtle">None</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3">{employee.lastUpdate}</td>
                  <td className="whitespace-nowrap px-4 py-3"><Link href={`/employees/${employee.id}`} className="font-medium text-brand-700 hover:underline">Open case →</Link></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8}className="px-4 py-12 text-center text-subtle">No employees match those filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-xs text-subtle">Showing {filtered.length} of {employees.length} employees</p>
      </section>
    </>
  );
}
