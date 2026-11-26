"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { acceptProposal, createActionFromFinding, dismissFinding, resolveFinding, ResolveSchema } from "@/modules/detective/decisions";
import { investigateCase, type InvestigationSummary } from "@/modules/detective/investigate";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

export async function investigateCaseAction(employeeId: string): Promise<ActionResult<InvestigationSummary>> {
  return toResult(async () => {
    const summary = await investigateCase(z.string().min(1).parse(employeeId), await getPrincipal());
    revalidatePath("/", "layout");
    return summary;
  });
}

export async function resolveFindingAction(input: z.infer<typeof ResolveSchema>): Promise<ActionResult<null>> {
  return toResult(async () => {
    await resolveFinding(ResolveSchema.parse(input), await getPrincipal());
    revalidatePath("/", "layout");
    return null;
  });
}

export async function dismissFindingAction(input: { findingId: string; reason: string }): Promise<ActionResult<null>> {
  return toResult(async () => {
    await dismissFinding(z.object({ findingId: z.string().min(1), reason: z.string() }).parse(input), await getPrincipal());
    revalidatePath("/", "layout");
    return null;
  });
}

export async function acceptProposalAction(findingId: string): Promise<ActionResult<null>> {
  return toResult(async () => {
    await acceptProposal(z.string().min(1).parse(findingId), await getPrincipal());
    revalidatePath("/", "layout");
    return null;
  });
}

export async function createActionAction(findingId: string): Promise<ActionResult<string>> {
  return toResult(async () => {
    await createActionFromFinding(z.string().min(1).parse(findingId), await getPrincipal());
    revalidatePath("/", "layout");
    return "Follow-up action created.";
  });
}
