import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({ userId: z.string().min(1).max(64) });

/** Demo user switcher. Sets an HTTP-only cookie selecting a seeded demo user (not production authentication). */
export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const body = bodySchema.safeParse(raw);
  if (!body.success) return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user) return NextResponse.json({ error: "Unknown demo user" }, { status: 404 });
  const response = NextResponse.json({ userId: user.id, role: user.role });
  response.cookies.set("demo_user", user.id, { httpOnly: true, sameSite: "lax", path: "/" });
  response.cookies.delete("demo_role");
  return response;
}
