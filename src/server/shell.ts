import { getSession, listDemoUsers } from "@/lib/auth";
import { roleLabel } from "@/lib/labels";
import { navigationFor } from "@/config/navigation";
import { heldRoles } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import type { AccountOption, CurrentUser } from "@/components/layout/TopBar";
import type { NavGroup } from "@/components/layout/Sidebar";

const GROUP_ORDER = ["PMO", "ADDITIONAL_MANAGER", "LINE_MANAGER", "TECH_LEAD", "HR", "EMPLOYEE"];

/** Everything the app shell (sidebar, top bar, account menu) needs for the current demo account. */
export async function loadShell(): Promise<{ user: CurrentUser; accounts: AccountOption[]; nav: NavGroup[] }> {
  const [session, users, scope] = await Promise.all([getSession(), listDemoUsers(), getScope()]);
  const held = heldRoles(scope).filter((r) => r !== "EMPLOYEE" || session.role === "EMPLOYEE");
  const roleText = held.length > 1 ? held.map(roleLabel).join(" · ") : roleLabel(session.role);
  return {
    user: { id: session.userId, name: session.name, roleLabel: roleText, isSample: session.isSample, profileHref: session.personId ? `/people/${session.personId}` : null },
    accounts: [...users]
      .sort((a, b) => GROUP_ORDER.indexOf(a.role) - GROUP_ORDER.indexOf(b.role) || a.name.localeCompare(b.name))
      .map((u) => ({ id: u.id, name: u.name, roleLabel: roleLabel(u.role), group: u.role === "EMPLOYEE" ? "Employees" : `${roleLabel(u.role)}s`.replace("HRs", "HR").replace("PMOs", "PMO"), isSample: u.person?.isSimulated ?? false })),
    nav: navigationFor(scope),
  };
}
