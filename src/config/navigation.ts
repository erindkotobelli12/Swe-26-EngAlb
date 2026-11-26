import type { NavLink } from "@/components/Sidebar";
import type { DemoRole } from "@/lib/auth";

/**
 * Global navigation. A feature appears here only once it is fully working (definition of done:
 * incomplete features are hidden, not shown half-built). `roles` limits who sees the entry.
 */
type Entry = NavLink & { roles?: DemoRole[] };

const ENTRIES: Entry[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ["PMO", "TECH_LEAD", "LINE_MANAGER", "MANAGEMENT"] },
  { href: "/employees", label: "Employees", icon: "employees", roles: ["PMO", "TECH_LEAD", "LINE_MANAGER", "MANAGEMENT"] },
  { href: "/investigations", label: "Investigations", icon: "investigations", roles: ["PMO", "TECH_LEAD", "MANAGEMENT"] },
  { href: "/follow-ups", label: "Follow-Up Center", icon: "followups", roles: ["PMO", "TECH_LEAD", "LINE_MANAGER"] },
  { href: "/briefing", label: "Briefing", icon: "briefing", roles: ["PMO", "TECH_LEAD", "LINE_MANAGER", "MANAGEMENT"] },
  { href: "/evidence", label: "Evidence inbox", icon: "evidence", roles: ["PMO", "TECH_LEAD", "LINE_MANAGER"] },
  { href: "/knowledge", label: "Knowledge", icon: "knowledge" },
  { href: "/workspace", label: "My workspace", icon: "workspace", roles: ["EMPLOYEE"] },
  { href: "/assistant", label: "AI assistant", icon: "assistant" },
  { href: "/ai-activity", label: "AI activity", icon: "ai", roles: ["PMO", "TECH_LEAD", "MANAGEMENT"] },
];

export function navigationFor(role: DemoRole): NavLink[] {
  return ENTRIES.filter((e) => !e.roles || e.roles.includes(role)).map(({ href, label, icon }) => ({ href, label, icon }));
}
