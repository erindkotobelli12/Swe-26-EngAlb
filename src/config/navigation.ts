import type { NavGroup, NavLink } from "@/components/layout/Sidebar";
import { heldRoles, type Persona, type Scope } from "@/modules/permissions";

/**
 * Navigation per role: short and grouped. A feature appears only once it fully works (incomplete features are
 * hidden, never shown half-built). People holding several roles (e.g. Line Manager and Technical Lead on one
 * project) get their primary role's navigation plus the other role's entries in an extra group.
 */
const L = {
  dashboard: { href: "/dashboard", label: "Overview", icon: "portfolio" },
  employees: { href: "/employees", label: "Employees", icon: "employees" },
  investigations: { href: "/investigations", label: "Investigations", icon: "investigations" },
  followups: { href: "/follow-ups", label: "Follow-ups", icon: "followups" },
  briefing: { href: "/briefing", label: "Briefing", icon: "briefing" },
  insights: { href: "/insights", label: "Insights", icon: "insights" },
  evidence: { href: "/evidence", label: "Evidence", icon: "evidence" },
  knowledge: { href: "/knowledge", label: "Knowledge", icon: "knowledge" },
  myOnboarding: { href: "/workspace", label: "My onboarding", icon: "myOnboarding" },
  assistant: { href: "/assistant", label: "Assistant", icon: "assistant" },
  audit: { href: "/ai-activity", label: "Audit & AI log", icon: "audit" },
} satisfies Record<string, NavLink>;

const NAV: Record<Persona, NavGroup[]> = {
  PMO: [{ items: [L.dashboard, L.employees] }, { label: "Oversight", items: [L.briefing, L.insights] }, { label: "Records", items: [L.audit] }],
  ADDITIONAL_MANAGER: [{ items: [L.dashboard, L.employees] }, { label: "Oversight", items: [L.briefing, L.insights] }],
  LINE_MANAGER: [{ items: [L.dashboard, L.employees] }, { label: "Work", items: [L.followups, L.briefing] }],
  TECH_LEAD: [{ items: [L.dashboard, L.employees] }, { label: "Work", items: [L.investigations, L.evidence, L.followups, L.briefing] }, { label: "Records", items: [L.audit] }],
  HR: [{ items: [L.dashboard, L.employees] }, { label: "Work", items: [L.followups, L.briefing] }],
  EMPLOYEE: [{ items: [L.myOnboarding, L.knowledge, L.assistant] }],
};

const SECONDARY_LABEL: Record<Persona, string> = {
  PMO: "PMO", HR: "HR", ADDITIONAL_MANAGER: "As Additional Manager", LINE_MANAGER: "As Line Manager", TECH_LEAD: "As Technical Lead", EMPLOYEE: "As employee",
};

export function navigationFor(scope: Scope): NavGroup[] {
  const primary = scope.principal.role;
  const groups = NAV[primary].map((g) => ({ ...g, items: [...g.items] }));
  const seen = new Set(groups.flatMap((g) => g.items.map((i) => i.href)));
  for (const role of heldRoles(scope).filter((r) => r !== primary)) {
    const extra = NAV[role].flatMap((g) => g.items).filter((i) => !seen.has(i.href));
    if (!extra.length) continue;
    extra.forEach((i) => seen.add(i.href));
    groups.push({ label: SECONDARY_LABEL[role], items: extra });
  }
  return groups;
}

/** Each role's home page; `/` redirects there. */
export function homeFor(role: Persona): string {
  return role === "EMPLOYEE" ? "/workspace" : "/dashboard";
}
