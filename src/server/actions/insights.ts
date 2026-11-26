"use server";
import { generateHypotheses, type HypothesesResult } from "@/modules/insights/service";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

export async function generateHypothesesAction(): Promise<ActionResult<HypothesesResult>> {
  return toResult(async () => generateHypotheses(await getPrincipal()));
}
