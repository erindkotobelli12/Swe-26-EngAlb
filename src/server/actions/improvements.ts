"use server";
import { revalidatePath } from "next/cache";
import { createImprovement, updateImprovement } from "@/modules/improvements/service";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

export async function createImprovementAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await createImprovement(input, await getPrincipal()); revalidatePath("/", "layout"); return "Improvement created."; });
}
export async function updateImprovementAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await updateImprovement(input, await getPrincipal()); revalidatePath("/", "layout"); return "Improvement updated."; });
}
