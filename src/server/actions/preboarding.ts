"use server";
import { revalidatePath } from "next/cache";
import { confirmHandover, updatePreboardingItem } from "@/modules/preboarding/service";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

const done = () => revalidatePath("/", "layout");

export async function updatePreboardingItemAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await updatePreboardingItem(input, await getPrincipal()); done(); return "Checklist item updated."; });
}

export async function confirmHandoverAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await confirmHandover(input, await getPrincipal()); done(); return "Hand-over confirmed. The case is now in onboarding."; });
}
