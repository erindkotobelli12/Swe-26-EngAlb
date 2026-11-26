import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { toMarkdown } from "@/modules/briefing/service";

/** Markdown export of a stored briefing (statements with their refs). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!can(await getScope(), "briefing.generate")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { id } = await params;
  const b = await prisma.briefing.findUnique({ where: { id } });
  if (!b || b.generatedBy !== session.name) return NextResponse.json({ error: "Unknown briefing" }, { status: 404 });
  return new NextResponse(toMarkdown(b), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="briefing-${b.role.toLowerCase()}-${b.generatedAt.slice(0, 10)}.md"` },
  });
}
