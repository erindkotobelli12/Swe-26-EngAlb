"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, BarChart3, BriefcaseBusiness, ChevronDown, ClipboardCheck, FileText, Inbox, LayoutDashboard, Library, Search, Send, Sparkles, Users,
} from "lucide-react";

const ICONS = { dashboard: LayoutDashboard, employees: Users, investigations: Search, followups: Send, actions: ClipboardCheck, briefing: FileText, insights: BarChart3, evidence: Inbox, knowledge: Library, workspace: BriefcaseBusiness, assistant: Sparkles, ai: Activity } as const;
export type NavLink = { href: string; label: string; icon: keyof typeof ICONS };
type DemoUser = { id: string; name: string; role: string };

const ROLE_NAMES: Record<string, string> = { PMO: "PMO", TECH_LEAD: "Technical Lead", LINE_MANAGER: "Line Manager", MANAGEMENT: "Management", EMPLOYEE: "Employee" };

export default function Sidebar({ links, user, users, evaluationDate }: { links: NavLink[]; user: DemoUser; users: DemoUser[]; evaluationDate: string }) {
  const pathname = usePathname();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  async function switchUser(userId: string) {
    setSwitching(true);
    setError("");
    try {
      const res = await fetch("/api/session/role", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (!res.ok) throw new Error();
      window.location.reload();
    } catch {
      setError("Could not switch user.");
      setSwitching(false);
    }
  }

  return (
    <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 md:flex">
      <Link href="/dashboard" className="flex items-center gap-3 px-2 text-xl font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-white">O</span>OnboardIQ
      </Link>
      <nav className="mt-6 space-y-0.5">
        {links.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>
              <Icon size={17} />{label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3 pt-6">
        <div className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500">Evaluation date <b className="ml-1 text-slate-800">{evaluationDate}</b></div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Demo user</p>
          <div className="relative mt-2">
            <select aria-label="Demo user" value={user.id} disabled={switching} onChange={(e) => switchUser(e.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-semibold">
              {users.map((u) => <option key={u.id} value={u.id}>{u.role === "EMPLOYEE" ? `${u.name} (Employee)` : ROLE_NAMES[u.role] ?? u.role}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-3" />
          </div>
          <p className="mt-1 text-[11px] text-slate-500" data-testid="current-role">Role: {ROLE_NAMES[user.role] ?? user.role}</p>
          {error && <p role="alert" className="mt-1 text-[11px] text-red-600">{error}</p>}
          <p className="mt-2 text-[10px] text-slate-400">Demo mode — not production authentication</p>
        </div>
      </div>
    </aside>
  );
}
