"use server";
import { z } from "zod";
import { runAgent } from "@/ai/runAgent";
import * as prompt from "@/ai/prompts/simulator";
import { loadCaseState } from "@/modules/case/loadCaseState";
import { assertAllowed } from "@/modules/permissions";
import { SimulationOverridesSchema } from "@/modules/simulator/overrides";
import { simulate, type SimulationResult } from "@/modules/simulator/simulate";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

/** Read-only: loads the case, simulates on a clone, returns the diff. Writes nothing. */
export async function runSimulationAction(employeeId: string, overrides: unknown): Promise<ActionResult<SimulationResult>> {
  return toResult(async () => {
    const principal = await getPrincipal();
    const id = z.string().min(1).parse(employeeId);
    await assertAllowed(principal, "simulator.run", { employeeId: id });
    const state = await loadCaseState(id);
    if (!state) throw new Error("Unknown case");
    return simulate(state, SimulationOverridesSchema.parse(overrides));
  });
}

export type Explanation = { ok: true; narrative: string; references: string[]; model: string; aiRunId: string } | { ok: false; error: string; aiRunId: string };

/** The explanation is generated from the server-recomputed deterministic diff only (never from client-supplied text). */
export async function explainSimulationAction(employeeId: string, overrides: unknown): Promise<ActionResult<Explanation>> {
  return toResult(async () => {
    const principal = await getPrincipal();
    const id = z.string().min(1).parse(employeeId);
    await assertAllowed(principal, "simulator.run", { employeeId: id });
    const state = await loadCaseState(id);
    if (!state) throw new Error("Unknown case");
    const diff = simulate(state, SimulationOverridesSchema.parse(overrides));
    const outcome = await runAgent({ agent: "simulator_explanation", promptVersion: prompt.PROMPT_VERSION, employeeId: id, input: diff, inputRefs: [id], system: prompt.SYSTEM, user: prompt.buildUser(diff), schema: prompt.ExplanationSchema });
    if (!outcome.ok) return { ok: false as const, error: outcome.error, aiRunId: outcome.run.id };
    const references = outcome.data.referencedChanges.filter((r) => diff.changes.includes(r));
    return { ok: true as const, narrative: outcome.data.narrative, references, model: outcome.run.model, aiRunId: outcome.run.id };
  });
}
