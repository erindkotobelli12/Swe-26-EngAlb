"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateBriefing } from "@/modules/briefing/service";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

export async function generateBriefingAction(role: string, projectId?: string | null): Promise<ActionResult<string>> {
  return toResult(async () => {
    const id = await generateBriefing(z.enum(["PMO", "ADDITIONAL_MANAGER", "LINE_MANAGER", "TECH_LEAD", "HR"]).parse(role), await getPrincipal(), undefined, { projectId: z.string().max(64).nullish().parse(projectId) });
    revalidatePath("/briefing");
    return id;
  });
}
