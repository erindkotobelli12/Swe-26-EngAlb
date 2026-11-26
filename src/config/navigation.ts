import type { NavGroup, NavLink } from "@/components/layout/Sidebar";
import { heldRoles, type Persona, type Scope } from "@/modules/permissions";

/**
 * Navigation per role: short and grouped. A feature appears only once it fully works (incomplete features are
 * hidden, never shown half-built). People holding several roles (e.g. Line Manager and Technical Lead on one
 * project) get their primary role's navigation plus the other role's entries in an extra group.
 */
const L = {
  portfolio: { href: "/portfolio", label: "Portfolio", icon: "portfolio" },
  projects: { href: "/projects", label: "Projects", icon: "projects" },
  briefing: { href: "/briefing", label: "Briefing", icon: "briefing" },
  insights: { href: "/insights", label: "Insights & improvements", icon: "insights" },
  myProjects: { href: "/my-projects", label: "My projects", icon: "projects", match: ["/projects"] },
  team: { href: "/team", label: "Team", icon: "team" },
  escalations: { href: "/escalations", label: "Escalations", icon: "escalations" },
  myTeam: { href: "/my-team", label: "My team", icon: "team" },
  preboarding: { href: "/preboarding", label: "Pre-boarding", icon: "preboarding" },
  followups: { href: "/follow-ups", label: "Follow-ups", icon: "followups" },
  onboarding: { href: "/onboarding", label: "Onboarding", icon: "onboarding", match: ["/employees"] },
  requirements: { href: "/requirements", label: "Requirements", icon: "requirements" },
  investigations: { href: "/investigations", label: "Investigations", icon: "investigations" },
  evidence: { href: "/evidence", label: "Evidence", icon: "evidence" },
  myOnboarding: { href: "/my-onboarding", label: "My onboarding", icon: "myOnboarding" },
  profile: { href: "/profile", label: "My profile", icon: "profile", match: ["/people"] },
  knowledge: { href: "/knowledge", label: "Knowledge", icon: "knowledge" },
  assistant: { href: "/assistant", label: "Assistant", icon: "assistant" },
  audit: { href: "/ai-activity", label: "Audit & AI log", icon: "audit" },
} satisfies Record<string, NavLink>;

const NAV: Record<Persona, NavGroup[]> = {
  PMO: [{ items: [L.portfolio, L.projects, L.briefing, L.insights] }, { label: "Records", items: [L.audit] }],
  ADDITIONAL_MANAGER: [{ items: [L.myProjects, L.team, L.escalations, L.briefing] }],
  LINE_MANAGER: [{ items: [L.myTeam, L.preboarding, L.followups, L.briefing] }],
  TECH_LEAD: [{ items: [L.onboarding, L.requirements, L.investigations, L.evidence, L.followups, L.briefing] }, { label: "Records", items: [L.audit] }],
  HR: [{ items: [L.preboarding, L.followups, L.briefing] }],
  EMPLOYEE: [{ items: [L.myOnboarding, L.profile, L.knowledge, L.assistant] }],
};

const SECONDARY_LABEL: Record<Persona, string> = {
  PMO: "PMO", HR: "HR", ADDITIONAL_MANAGER: "As Additional Manager", LINE_MANAGER: "As Line Manager", TECH_LEAD: "As Technical Lead", EMPLOYEE: "As employee",
};

export function navigationFor(scope: Scope): NavGroup[] {
  const primary = scope.principal.role;
  const groups = NAV[primary].map((g) => ({ ...g, items: [...g.items] }));
  const seen = new Set(groups.flatMap((g) => g.items.map((i) => i.href)));
  for (const role of heldRoles(scope).filter((r) => r !== primary && r !== "EMPLOYEE")) {
    const extra = NAV[role].flatMap((g) => g.items).filter((i) => !seen.has(i.href));
    if (!extra.length) continue;
    extra.forEach((i) => seen.add(i.href));
    groups.push({ label: SECONDARY_LABEL[role], items: extra });
  }
  return groups;
}

const HOME: Record<Persona, string> = {
  PMO: "/portfolio", ADDITIONAL_MANAGER: "/my-projects", LINE_MANAGER: "/my-team", TECH_LEAD: "/onboarding", HR: "/preboarding", EMPLOYEE: "/my-onboarding",
};

/** Each role's home page; `/` redirects there. */
export function homeFor(role: Persona): string {
  return HOME[role];
}
