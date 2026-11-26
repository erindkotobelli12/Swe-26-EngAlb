"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { confirmDependency, rejectDependency, suggestDependencies, type SuggestionResult } from "@/modules/dependencies/decisions";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

export async function confirmDependencyAction(dependencyId: string): Promise<ActionResult<null>> {
  return toResult(async () => {
    await confirmDependency(z.string().min(1).parse(dependencyId), await getPrincipal());
    revalidatePath("/", "layout");
    return null;
  });
}

export async function rejectDependencyAction(input: { dependencyId: string; reason: string }): Promise<ActionResult<null>> {
  return toResult(async () => {
    const p = z.object({ dependencyId: z.string().min(1), reason: z.string().max(500) }).parse(input);
    await rejectDependency(p.dependencyId, p.reason, await getPrincipal());
    revalidatePath("/", "layout");
    return null;
  });
}

export async function suggestDependenciesAction(employeeId: string): Promise<ActionResult<SuggestionResult>> {
  return toResult(async () => {
    const r = await suggestDependencies(z.string().min(1).parse(employeeId), await getPrincipal());
    revalidatePath("/", "layout");
    return r;
  });
}
