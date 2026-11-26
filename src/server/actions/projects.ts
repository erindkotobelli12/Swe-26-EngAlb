"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { chooseTechLead, createProject, endAssignment, updateProject } from "@/modules/projects/service";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

const done = () => revalidatePath("/", "layout");

export async function createProjectAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { const id = await createProject(input, await getPrincipal()); done(); return id; });
}

export async function updateProjectAction(projectId: string, input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { const id = z.string().min(1).parse(projectId); await updateProject(id, input, await getPrincipal()); done(); return id; });
}

export async function chooseTechLeadAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await chooseTechLead(input, await getPrincipal()); done(); return "Technical Lead saved."; });
}

export async function endAssignmentAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => { await endAssignment(input, await getPrincipal()); done(); return "Assignment ended."; });
}
