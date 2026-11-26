"use server";
import { revalidatePath } from "next/cache";
import { recordValidation, ValidationSchema } from "@/modules/validation/recordValidation";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

export async function recordValidationAction(input: unknown): Promise<ActionResult<string>> {
  return toResult(async () => {
    await recordValidation(ValidationSchema.parse(input), await getPrincipal());
    revalidatePath("/", "layout");
    return "Validation decision recorded.";
  });
}
