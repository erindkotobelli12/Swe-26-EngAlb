"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Inbox, ClipboardCheck, Library, BriefcaseBusiness, Sparkles, ChevronDown } from "lucide-react";

const links = [
  ["/dashboard","Dashboard",LayoutDashboard],
  ["/employees","Employees",Users],
  ["/evidence","Evidence inbox",Inbox],
  ["/actions","Action center",ClipboardCheck],
  ["/knowledge","Knowledge",Library],
  ["/workspace","My workspace",BriefcaseBusiness],
  ["/assistant","AI assistant",Sparkles],
] as const;

export default function Sidebar({role}:{role:string}) {
  const pathname = usePathname();
  async function switchRole(value:string) {
    await fetch("/api/session/role", {method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({role:value})});
    window.location.reload();
  }
  return <aside className="hidden md:flex h-screen sticky top-0 flex-col border-r border-slate-200 bg-white px-4 py-5">
    <Link href="/dashboard" className="flex items-center gap-3 px-2 text-xl font-bold">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-white">O</span>OnboardIQ
    </Link>
    <nav className="mt-8 space-y-1">
      {links.map(([href,label,Icon]) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${pathname.startsWith(href)?"bg-indigo-50 text-indigo-700":"text-slate-600 hover:bg-slate-50"}`}>
        <Icon size={18}/>{label}
      </Link>)}
    </nav>
    <div className="mt-auto rounded-xl border border-slate-200 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Demo role switcher</p>
      <div className="relative mt-2">
        <select aria-label="Demo role" value={role} onChange={e=>switchRole(e.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
          <option value="PMO">PMO Coordinator</option>
          <option value="EMPLOYEE">Employee</option>
          <option value="TECH_LEAD">Technical Lead</option>
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-3"/>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">Demo mode — not production authentication</p>
    </div>
  </aside>;
}
