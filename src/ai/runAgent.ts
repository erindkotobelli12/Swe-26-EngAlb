import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { auditTimestamp } from "@/lib/clock";
import { AIConfigurationError, AIResponseError, getAIProvider, modelForAgent } from "./providers";

export type AIRunStatus = "OK" | "INVALID_OUTPUT" | "UNAVAILABLE" | "TIMEOUT";
export type AIRunInfo = { id: string; agent: string; model: string; promptVersion: string; status: AIRunStatus; createdAt: string; durationMs: number };

export type AgentOutcome<T> =
  | { ok: true; data: T; run: AIRunInfo; cached: boolean }
  | { ok: false; error: string; run: AIRunInfo };

/**
 * Runs one agent call and records it in the AIRun transparency log (model, prompt version, input hash,
 * input IDs only, output, status, duration). Identical inputs reuse the cached successful output.
 */
export async function runAgent<T>(opts: {
  agent: string;
  promptVersion: string;
  employeeId?: string | null;
  input: unknown;
  inputRefs: string[];
  system: string;
  user: string;
  schema: z.ZodType<T>;
  useCache?: boolean;
  timeoutMs?: number;
  db?: PrismaClient;
}): Promise<AgentOutcome<T>> {
  const db = opts.db ?? prisma;
  const model = modelForAgent(opts.agent);
  const inputHash = createHash("sha256").update(JSON.stringify([opts.agent, opts.promptVersion, model, opts.input])).digest("hex");

  if (opts.useCache !== false) {
    const cached = await db.aIRun.findFirst({ where: { agent: opts.agent, inputHash, status: "OK" }, orderBy: { createdAt: "desc" } });
    if (cached?.output) {
      const parsed = opts.schema.safeParse(JSON.parse(cached.output));
      if (parsed.success) {
        return { ok: true, data: parsed.data, cached: true, run: { id: cached.id, agent: cached.agent, model: cached.model, promptVersion: cached.promptVersion, status: "OK", createdAt: cached.createdAt, durationMs: cached.durationMs } };
      }
    }
  }

  const started = Date.now();
  let status: AIRunStatus = "OK";
  let error: string | null = null;
  let data: T | null = null;
  try {
    data = await getAIProvider().complete({ agent: opts.agent, system: opts.system, user: opts.user, schema: opts.schema, timeoutMs: opts.timeoutMs });
  } catch (e) {
    if (e instanceof AIConfigurationError) { status = "UNAVAILABLE"; error = e.message; }
    else if (e instanceof AIResponseError) { status = e.kind; error = e.message; }
    else { status = "UNAVAILABLE"; error = "Unexpected error while calling the local model."; }
  }
  const createdAt = auditTimestamp();
  const durationMs = Date.now() - started;
  const row = await db.aIRun.create({
    data: {
      agent: opts.agent, promptVersion: opts.promptVersion, model, inputHash, inputRefs: JSON.stringify(opts.inputRefs), employeeId: opts.employeeId ?? null,
      output: data === null ? null : JSON.stringify(data), status, error, durationMs, createdAt,
    },
  });
  const run: AIRunInfo = { id: row.id, agent: opts.agent, model, promptVersion: opts.promptVersion, status, createdAt, durationMs };
  if (data === null) return { ok: false, error: error ?? "The local model failed.", run };
  return { ok: true, data, cached: false, run };
}
