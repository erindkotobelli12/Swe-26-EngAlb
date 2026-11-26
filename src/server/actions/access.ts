"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { confirmOwnAccessUsable } from "@/modules/access/confirmUsable";
import { getPrincipal, toResult, type ActionResult } from "@/server/principal";

export async function confirmAccessUsableAction(accessId: string): Promise<ActionResult<null>> {
  return toResult(async () => {
    await confirmOwnAccessUsable(z.string().min(1).parse(accessId), await getPrincipal());
    revalidatePath("/", "layout");
    return null;
  });
}
