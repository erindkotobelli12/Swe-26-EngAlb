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
  validated: string;
  reliability: string | null;
  topIssue: string | null;
  topSeverity: string | null;
  lastUpdate: string;
};

const SEV: Record<string, string> = { CRITICAL: "text-red-700 font-bold", HIGH: "text-red-600", MEDIUM: "text-amber-700", LOW: "text-slate-500" };

export default function DashboardEmployeeTable({ employees }: { employees: DashboardEmployee[] }) {
  const [query, setQuery] = useState("");
  const filtered = employees.filter((e) => `${e.name} ${e.project} ${e.id}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <h2 className="font-bold">Employee cases</h2>
        <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-400">
          <Search size={15} />
          <input aria-label="Search dashboard employees" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees" className="w-36 outline-none" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Employee", "Project", "Reported", "Assessed", "Validated", "Reliability", "Top issue", "Last update"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3"><Link href={`/employees/${e.id}`} className="font-semibold text-indigo-700">{e.name}</Link><p className="text-xs text-slate-400">{e.id} · {e.movement}</p></td>
                <td className="px-4 py-3">{e.project}</td>
                <td className="whitespace-nowrap px-4 py-3">{e.reported}</td>
                <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{e.assessed}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">{e.validated}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">{e.reliability ?? "—"}</td>
                <td className="min-w-56 px-4 py-3 text-xs">{e.topIssue ? <Link href={`/employees/${e.id}?tab=investigation`} className={`hover:underline ${SEV[e.topSeverity ?? "LOW"]}`}>{e.topIssue}</Link> : <span className="text-slate-400">No open findings</span>}</td>
                <td className="whitespace-nowrap px-4 py-3">{e.lastUpdate}</td>
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
