"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { READINESS_LABEL, type ReadinessLevel } from "@/domain/types";
import { recomputeAll, recomputeCase } from "@/modules/case/recompute";
import { assertAllowed } from "@/modules/permissions";
import { actorOf, getPrincipal, toResult, type ActionResult } from "@/server/principal";

/** Returns a human-readable summary for the UI. */
export async function recomputeCaseAction(employeeId: string): Promise<ActionResult<string>> {
  return toResult(async () => {
    const principal = await getPrincipal();
    const id = z.string().min(1).parse(employeeId);
    await assertAllowed(principal, "case.recompute", { employeeId: id });
    const s = await recomputeCase(id, "manual re-run of analysis", actorOf(principal));
    revalidatePath("/", "layout");
    if (!s) return "Case not found.";
    return `Assessed: ${READINESS_LABEL[s.levelAfter as ReadinessLevel] ?? s.levelAfter}; ${s.findingsOpened.length} finding(s) opened, ${s.findingsClosed.length} cleared.`;
  });
}

export async function recomputeAllAction(): Promise<ActionResult<string>> {
  return toResult(async () => {
    const principal = await getPrincipal();
    await assertAllowed(principal, "case.recompute");
    const all = await recomputeAll("manual re-run of analysis (all cases)", actorOf(principal));
    revalidatePath("/", "layout");
    return `Recomputed ${all.length} cases.`;
  });
}
