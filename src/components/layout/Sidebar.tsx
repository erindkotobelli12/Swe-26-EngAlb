"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart3, BookOpen, BriefcaseBusiness, ClipboardCheck, ClipboardList, FileText, FolderKanban, GraduationCap, Inbox, LayoutDashboard,
  Library, ListChecks, Search, Send, ShieldAlert, Sparkles, UserRound, Users,
} from "lucide-react";
import { cn } from "@/components/ui/primitives";

export const NAV_ICONS = {
  portfolio: LayoutDashboard, projects: FolderKanban, briefing: FileText, insights: BarChart3, team: Users, escalations: ShieldAlert,
  preboarding: ClipboardList, followups: Send, onboarding: GraduationCap, requirements: ListChecks, investigations: Search, evidence: Inbox,
  myOnboarding: BriefcaseBusiness, profile: UserRound, knowledge: Library, assistant: Sparkles, audit: Activity, employees: Users,
  dashboard: LayoutDashboard, guide: BookOpen, tasks: ClipboardCheck,
} as const;
export type NavIcon = keyof typeof NAV_ICONS;
export type NavLink = { href: string; label: string; icon: NavIcon; match?: string[] };
export type NavGroup = { label?: string; items: NavLink[] };

export default function Sidebar({ groups, homeHref }: { groups: NavGroup[]; homeHref: string }) {
  const pathname = usePathname();
  const isActive = (l: NavLink) => [l.href, ...(l.match ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface md:flex">
      <Link href={homeHref} className="flex h-14 items-center gap-2.5 border-b border-line px-5 text-[15px] font-semibold text-ink">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-[13px] font-bold text-white" aria-hidden>O</span>
        OnboardIQ
      </Link>
      <nav aria-label="Main" className="flex-1 space-y-5 px-3 py-4">
        {groups.map((g, gi) => (
          <div key={g.label ?? gi}>
            {g.label && <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-subtle">{g.label}</p>}
            <ul className="space-y-0.5">
              {g.items.map((l) => {
                const Icon = NAV_ICONS[l.icon];
                const active = isActive(l);
                return (
                  <li key={l.href}>
                    <Link href={l.href} aria-current={active ? "page" : undefined}
                      className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors", active ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:bg-canvas hover:text-ink")}>
                      <Icon size={16} aria-hidden className={active ? "text-brand-600" : "text-slate-400"} />{l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
