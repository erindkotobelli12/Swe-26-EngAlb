import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getScope } from "@/server/principal";
import { can } from "@/modules/permissions";

/** Global search over employees, projects and people the current user can see. */
export async function GET(request: NextRequest) {
  const q = z.string().trim().min(1).max(80).safeParse(request.nextUrl.searchParams.get("q") ?? "");
  if (!q.success) return NextResponse.json({ hits: [] });
  const term = q.data.toLowerCase();
  const scope = await getScope();
  const employees = await prisma.employee.findMany({ include: { project: true }, orderBy: { name: "asc" } });
  const hits = employees
    .filter((e) => e.name.toLowerCase().includes(term) && Boolean(scope.cases[e.id]))
    .slice(0, 8)
    .map((e) => ({ type: "employee" as const, id: e.id, title: e.name, subtitle: e.project?.name ?? "No project recorded", href: `/employees/${e.id}` }));
  return NextResponse.json({ hits });
}
