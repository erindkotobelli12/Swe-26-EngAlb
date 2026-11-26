"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function addEvidence(formData:FormData) {
  const parsed=z.object({id:z.string().min(1),title:z.string().min(1),sourceType:z.string().min(1),content:z.string().min(10),employeeId:z.string().optional()}).safeParse({
    id:formData.get("id"),title:formData.get("title"),sourceType:formData.get("sourceType"),content:formData.get("content"),employeeId:formData.get("employeeId")||undefined,
  });
  if(!parsed.success) throw new Error("Invalid evidence");
  await prisma.evidence.create({data:{id:parsed.data.id,title:parsed.data.title,sourceType:parsed.data.sourceType,content:parsed.data.content,employeeId:parsed.data.employeeId,timestamp:"2026-10-14",author:"Demo user",caseId:parsed.data.employeeId?`CASE-${parsed.data.employeeId}`:null}});
  await prisma.auditLog.create({data:{action:"EVIDENCE_ADDED",entityType:"Evidence",entityId:parsed.data.id,details:"Evidence submitted by demo user for human review",timestamp:"2026-10-14"}});
  revalidatePath("/evidence");
}
