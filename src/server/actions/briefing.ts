"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateBriefing } from "@/modules/briefing/service";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

export async function generateBriefingAction(role: string): Promise<ActionResult<string>> {
  return toResult(async () => {
    const id = await generateBriefing(z.enum(["PMO", "TECH_LEAD", "MANAGEMENT", "LINE_MANAGER"]).parse(role), await getPrincipal());
    revalidatePath("/briefing");
    return id;
  });
}
