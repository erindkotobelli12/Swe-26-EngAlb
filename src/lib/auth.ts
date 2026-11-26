import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Demo authentication: an HTTP-only cookie selects one of the seeded demo users. Not production auth.
 * Employee users map to their own case via User.employeeId — never via hard-coded IDs.
 */
export const DEMO_ROLES = ["PMO", "TECH_LEAD", "LINE_MANAGER", "MANAGEMENT", "EMPLOYEE"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export type Session = { userId: string; name: string; role: DemoRole; employeeId: string | null };

export const DEFAULT_USER_ID = "demo-pmo";

export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const userId = jar.get("demo_user")?.value ?? DEFAULT_USER_ID;
  const user = (await prisma.user.findUnique({ where: { id: userId } })) ?? (await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID } }));
  if (!user) return { userId: DEFAULT_USER_ID, name: "PMO Coordinator (demo user)", role: "PMO", employeeId: null };
  const role = (DEMO_ROLES as readonly string[]).includes(user.role) ? (user.role as DemoRole) : "PMO";
  return { userId: user.id, name: user.name, role, employeeId: user.employeeId };
}

export async function listDemoUsers() {
  return prisma.user.findMany({ select: { id: true, name: true, role: true, employeeId: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
}
