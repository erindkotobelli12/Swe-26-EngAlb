import { cookies } from "next/headers";

export type DemoRole = "PMO"|"EMPLOYEE"|"TECH_LEAD";
export async function getSession() {
  const jar = await cookies();
  return {
    role: (jar.get("demo_role")?.value as DemoRole) ?? "PMO",
    userId: jar.get("demo_user")?.value ?? "demo-pmo",
  };
}

export function canViewCase(role:DemoRole, userId:string, employeeId:string) {
  if (role === "PMO") return true;
  if (role === "EMPLOYEE") return userId === "employee-mila" ? employeeId === "ONB-001" : false;
  if (role === "TECH_LEAD") return true;
  return false;
}
