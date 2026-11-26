import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { PERSONAS, type Persona } from "@/modules/permissions";

/**
 * Demo authentication: an HTTP-only cookie selects one of the seeded demo accounts. Not production auth.
 * Employee accounts map to their own case via User.employeeId and to their profile via User.personId.
 */
export const DEMO_ROLES = PERSONAS;
export type DemoRole = Persona;

export type Session = { userId: string; name: string; role: DemoRole; employeeId: string | null; personId: string | null; isSample: boolean };

export const DEFAULT_USER_ID = "demo-pmo";

export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const userId = jar.get("demo_user")?.value ?? DEFAULT_USER_ID;
  const include = { person: { select: { isSimulated: true } } } as const;
  const user = (await prisma.user.findUnique({ where: { id: userId }, include })) ?? (await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID }, include }));
  if (!user) return { userId: DEFAULT_USER_ID, name: "PMO", role: "PMO", employeeId: null, personId: null, isSample: false };
  const role = (DEMO_ROLES as readonly string[]).includes(user.role) ? (user.role as DemoRole) : "EMPLOYEE";
  return { userId: user.id, name: user.name, role, employeeId: user.employeeId, personId: user.personId, isSample: user.person?.isSimulated ?? false };
}

export async function listDemoUsers() {
  return prisma.user.findMany({ select: { id: true, name: true, role: true, employeeId: true, personId: true, person: { select: { isSimulated: true } } }, orderBy: [{ name: "asc" }] });
}
