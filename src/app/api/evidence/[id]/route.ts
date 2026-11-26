import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/clock";
import { label, roleLabel } from "@/lib/labels";
import { getPrincipal } from "@/server/principal";
import { canSeeEvidence } from "@/server/evidenceAccess";

/** Verbatim evidence preview for SourceChip popovers. Permission-checked: only evidence the user may see. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = z.string().min(1).max(120).safeParse((await params).id);
  if (!parsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const e = await prisma.evidence.findUnique({ where: { id: parsed.data } });
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeEvidence(await getPrincipal(), { employeeId: e.employeeId, projectId: e.projectId }))) return NextResponse.json({ error: "Not available" }, { status: 403 });
  return NextResponse.json({
    id: e.id, title: e.title, sourceType: label("sourceType", e.sourceType), sender: e.author ?? roleLabel(e.senderRole), date: formatDate(e.timestamp), content: e.content, isSimulated: e.isSimulated,
  });
}
