import { getSession, listDemoUsers } from "@/lib/auth";
import { roleLabel } from "@/lib/labels";
import { navigationFor } from "@/config/navigation";
import type { AccountOption, CurrentUser } from "@/components/layout/TopBar";
import type { NavGroup } from "@/components/layout/Sidebar";

/** Everything the app shell (sidebar, top bar, account menu) needs for the current demo user. */
export async function loadShell(): Promise<{ user: CurrentUser; accounts: AccountOption[]; nav: NavGroup[] }> {
  const [session, users] = await Promise.all([getSession(), listDemoUsers()]);
  return {
    user: { id: session.userId, name: session.name, roleLabel: roleLabel(session.role), isSample: false, profileHref: null },
    accounts: users.map((u) => ({ id: u.id, name: u.name, roleLabel: roleLabel(u.role), group: roleLabel(u.role), isSample: false })),
    nav: navigationFor(session.role),
  };
}
