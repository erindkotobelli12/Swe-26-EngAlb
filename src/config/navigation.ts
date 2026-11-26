import type { NavGroup, NavLink } from "@/components/layout/Sidebar";
import type { DemoRole } from "@/lib/auth";

/**
 * Global navigation per role: short and grouped. A feature appears only once it fully works
 * (incomplete features are hidden, never shown half-built).
 */
const L = {
  dashboard: { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  employees: { href: "/employees", label: "Employees", icon: "employees" },
  investigations: { href: "/investigations", label: "Investigations", icon: "investigations" },
  followups: { href: "/follow-ups", label: "Follow-ups", icon: "followups" },
  briefing: { href: "/briefing", label: "Briefing", icon: "briefing" },
  insights: { href: "/insights", label: "Insights", icon: "insights" },
  evidence: { href: "/evidence", label: "Evidence", icon: "evidence" },
  knowledge: { href: "/knowledge", label: "Knowledge", icon: "knowledge" },
  workspace: { href: "/workspace", label: "My onboarding", icon: "myOnboarding" },
  assistant: { href: "/assistant", label: "Assistant", icon: "assistant" },
  audit: { href: "/ai-activity", label: "Audit & AI log", icon: "audit" },
} satisfies Record<string, NavLink>;

const NAV: Record<DemoRole, NavGroup[]> = {
  PMO: [{ items: [L.dashboard, L.employees] }, { label: "Oversight", items: [L.briefing, L.insights, L.followups] }, { label: "Records", items: [L.investigations, L.evidence, L.audit] }],
  TECH_LEAD: [{ items: [L.dashboard, L.employees] }, { label: "Work", items: [L.investigations, L.evidence, L.followups, L.briefing] }, { label: "Records", items: [L.knowledge, L.audit] }],
  LINE_MANAGER: [{ items: [L.dashboard, L.employees] }, { label: "Work", items: [L.followups, L.evidence, L.briefing] }],
  MANAGEMENT: [{ items: [L.dashboard, L.employees] }, { label: "Oversight", items: [L.briefing, L.insights, L.investigations] }],
  EMPLOYEE: [{ items: [L.workspace, L.knowledge, L.assistant] }],
};

export function navigationFor(role: DemoRole): NavGroup[] {
  return NAV[role];
}
