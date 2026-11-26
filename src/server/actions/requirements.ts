"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addProjectSkillsToProfile, createRequirement, retireRequirement, setRequirementStatus, updateRequirement } from "@/modules/requirements/service";
import { claimSkill, decideSkill } from "@/modules/skills/service";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

const done = () => revalidatePath("/", "layout");

export async function createRequirementAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await createRequirement(input, await getPrincipal()); done(); return "Requirement added. Existing skills were checked."; });
}
export async function updateRequirementAction(id: string, input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await updateRequirement(z.string().min(1).parse(id), input, await getPrincipal()); done(); return "Requirement saved."; });
}
export async function retireRequirementAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await retireRequirement(input, await getPrincipal()); done(); return "Requirement retired."; });
}
export async function setRequirementStatusAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await setRequirementStatus(input, await getPrincipal()); done(); return "Requirement updated."; });
}
export async function addProjectSkillsAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { const n = await addProjectSkillsToProfile(input, await getPrincipal()); done(); return n ? `${n} ${n === 1 ? "skill" : "skills"} added to the profile.` : "Nothing new to add."; });
}
export async function claimSkillAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await claimSkill(input, await getPrincipal()); done(); return "Skill added. A Technical Lead will confirm it."; });
}
export async function decideSkillAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await decideSkill(input, await getPrincipal()); done(); return "Skill decision saved. Requirements were re-checked."; });
}
