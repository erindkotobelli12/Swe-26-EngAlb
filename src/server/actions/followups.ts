"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  approve, closeCommunication, createDrafts, EditSchema, personaliseDraft, recordResponse, ResponseSchema, saveEdit, sendSimulated, type PersonaliseResult,
} from "@/modules/followups/service";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

const id = z.string().min(1);
const done = () => revalidatePath("/", "layout");

export async function createDraftsAction(keys: string[] | "ALL"): Promise<ActionResult<string>> {
  return toResult(async () => {
    const n = await createDrafts(keys === "ALL" ? "ALL" : z.array(z.string().min(1)).parse(keys), await getPrincipal());
    done();
    return `${n} draft(s) created.`;
  });
}
export async function personaliseDraftAction(commId: string): Promise<ActionResult<PersonaliseResult>> {
  return toResult(async () => { const r = await personaliseDraft(id.parse(commId), await getPrincipal()); done(); return r; });
}
export async function saveEditAction(input: { id: string; subject: string; body: string }): Promise<ActionResult<null>> {
  return toResult(async () => { await saveEdit(EditSchema.parse(input), await getPrincipal()); done(); return null; });
}
export async function approveAction(commId: string): Promise<ActionResult<null>> {
  return toResult(async () => { await approve(id.parse(commId), await getPrincipal()); done(); return null; });
}
export async function sendSimulatedAction(commId: string): Promise<ActionResult<null>> {
  return toResult(async () => { await sendSimulated(id.parse(commId), await getPrincipal()); done(); return null; });
}
export async function recordResponseAction(input: { id: string; employeeId: string; content: string; senderName?: string }): Promise<ActionResult<string>> {
  return toResult(async () => { const ev = await recordResponse(ResponseSchema.parse(input), await getPrincipal()); done(); return ev; });
}
export async function closeAction(commId: string): Promise<ActionResult<null>> {
  return toResult(async () => { await closeCommunication(id.parse(commId), await getPrincipal()); done(); return null; });
}
