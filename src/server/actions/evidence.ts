"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addManualClaim, EvidenceInputSchema, extractClaims, ingestEvidence, reviewClaim, reviewEvidence,
  type ClaimReviewResult, type ExtractionResult,
} from "@/modules/evidence/pipeline";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
};

export async function addEvidenceAction(_prev: ActionResult<string> | null, formData: FormData): Promise<ActionResult<string>> {
  return toResult(async () => {
    const input = EvidenceInputSchema.parse({
      id: text(formData, "id"), title: text(formData, "title"), sourceType: text(formData, "sourceType"), senderName: text(formData, "senderName"),
      senderRole: text(formData, "senderRole"), recipientRole: text(formData, "recipientRole"), date: text(formData, "date"), content: text(formData, "content"),
      employeeId: text(formData, "employeeId"), inReplyToId: text(formData, "inReplyToId"), isRequest: formData.get("isRequest") === "on",
      isSimulated: formData.get("isSimulated") === "on",
    });
    const id = await ingestEvidence(input, await getPrincipal());
    revalidatePath("/", "layout");
    return id;
  });
}

export async function reviewEvidenceAction(input: { evidenceId: string; decision: "APPROVED" | "REJECTED"; reason: string }): Promise<ActionResult<null>> {
  return toResult(async () => {
    const parsed = z.object({ evidenceId: z.string().min(1), decision: z.enum(["APPROVED", "REJECTED"]), reason: z.string().max(500) }).parse(input);
    await reviewEvidence(parsed.evidenceId, parsed.decision, parsed.reason, await getPrincipal());
    revalidatePath("/", "layout");
    return null;
  });
}

export async function extractClaimsAction(evidenceId: string): Promise<ActionResult<ExtractionResult>> {
  return toResult(async () => {
    const result = await extractClaims(z.string().min(1).parse(evidenceId), await getPrincipal());
    revalidatePath("/", "layout");
    return result;
  });
}

export async function addManualClaimAction(input: { evidenceId: string; field: string; value: string; excerpt: string }): Promise<ActionResult<null>> {
  return toResult(async () => {
    const parsed = z.object({ evidenceId: z.string().min(1), field: z.string().trim().min(3).max(120), value: z.string().trim().min(1).max(200), excerpt: z.string().trim().min(3).max(400) }).parse(input);
    await addManualClaim(parsed, await getPrincipal());
    revalidatePath("/", "layout");
    return null;
  });
}

export async function reviewClaimAction(input: { claimId: string; decision: "APPROVE" | "REJECT"; editedValue?: string; reason?: string }): Promise<ActionResult<ClaimReviewResult>> {
  return toResult(async () => {
    const parsed = z.object({ claimId: z.string().min(1), decision: z.enum(["APPROVE", "REJECT"]), editedValue: z.string().max(200).optional(), reason: z.string().max(500).optional() }).parse(input);
    const result = await reviewClaim(parsed, await getPrincipal());
    revalidatePath("/", "layout");
    return result;
  });
}
