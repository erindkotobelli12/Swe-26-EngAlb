import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request:NextRequest) {
  const body = z.object({role:z.enum(["PMO","EMPLOYEE","TECH_LEAD"])}).safeParse(await request.json());
  if (!body.success) return NextResponse.json({error:"Invalid role"}, {status:400});
  const response = NextResponse.json({role:body.data.role});
  response.cookies.set("demo_role",body.data.role,{httpOnly:true,sameSite:"lax",path:"/"});
  response.cookies.set("demo_user",body.data.role === "EMPLOYEE"?"employee-mila":body.data.role === "TECH_LEAD"?"demo-tl":"demo-pmo",{httpOnly:true,sameSite:"lax",path:"/"});
  return response;
}
