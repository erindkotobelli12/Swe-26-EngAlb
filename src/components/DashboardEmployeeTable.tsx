"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";

export type DashboardEmployee = {
  id: string;
  name: string;
  movement: string;
  project: string;
  reported: string;
  assessed: string;
  risk: string;
  lastUpdate: string;
};

export default function DashboardEmployeeTable({ employees }: { employees: DashboardEmployee[] }) {
  const [query, setQuery] = useState("");
  const filtered = employees.filter((employee) =>
    `${employee.name} ${employee.project} ${employee.id}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <h2 className="font-bold">Employee cases</h2>
        <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-400">
          <Search size={15} />
          <input aria-label="Search dashboard employees" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees" className="w-36 outline-none" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Employee", "Movement", "Project", "Reported", "Assessed", "Risk", "Last update", "Next action"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((employee) => (
              <tr key={employee.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3"><Link href={`/employees/${employee.id}`} className="font-semibold text-indigo-700">{employee.name}</Link></td>
                <td className="px-4 py-3">{employee.movement}</td>
                <td className="px-4 py-3">{employee.project}</td>
                <td className="px-4 py-3">{employee.reported}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{employee.assessed}</span></td>
                <td className="px-4 py-3 text-xs">{employee.risk}</td>
                <td className="whitespace-nowrap px-4 py-3">{employee.lastUpdate}</td>
                <td className="px-4 py-3"><Link href={`/employees/${employee.id}`} className="text-indigo-600">Review</Link></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No employees match your search.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Showing {filtered.length} of {employees.length} employees</p>
    </div>
  );
}
