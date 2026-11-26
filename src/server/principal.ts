import { cache } from "react";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth";
import { PermissionError, resolveScope, type Principal, type Scope } from "@/modules/permissions";
import type { Actor } from "@/modules/audit";

export async function getPrincipal(): Promise<Principal> {
  const s = await getSession();
  return { userId: s.userId, role: s.role, employeeId: s.employeeId, name: s.name, personId: s.personId };
}

/** The current user's permission scope, resolved once per request. */
export const getScope = cache(async (): Promise<Scope> => resolveScope(await getPrincipal()));

export const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const KNOWN_ERRORS = new Set(["PermissionError", "PipelineError", "DecisionError"]);

/** Converts expected errors into user-visible messages; unexpected ones are logged and reported generically. */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof PermissionError || (error instanceof Error && KNOWN_ERRORS.has(error.name))) return { ok: false, error: error.message };
    if (error instanceof ZodError) return { ok: false, error: error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") };
    console.error("Server action failed", error);
    return { ok: false, error: "The action failed unexpectedly. Nothing was changed if this message appears before saving." };
  }
}
