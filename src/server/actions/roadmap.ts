"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { approveBaseline, decideRoadmapItem, suggestRoadmap, type SuggestRoadmapResult } from "@/modules/roadmap/service";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

export async function suggestRoadmapAction(employeeId: string): Promise<ActionResult<SuggestRoadmapResult>> {
  return toResult(async () => { const r = await suggestRoadmap(z.string().min(1).parse(employeeId), await getPrincipal()); revalidatePath("/", "layout"); return r; });
}
export async function decideRoadmapItemAction(input: { id: string; decision: "APPROVE" | "REJECT"; reason?: string }): Promise<ActionResult<null>> {
  return toResult(async () => {
    await decideRoadmapItem(z.object({ id: z.string().min(1), decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().max(500).optional() }).parse(input), await getPrincipal());
    revalidatePath("/", "layout");
    return null;
  });
}
export async function approveBaselineAction(employeeId: string): Promise<ActionResult<string>> {
  return toResult(async () => { await approveBaseline(z.string().min(1).parse(employeeId), await getPrincipal()); revalidatePath("/", "layout"); return "Plan approved as baseline."; });
}
