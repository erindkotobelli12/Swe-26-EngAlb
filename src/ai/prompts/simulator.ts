import { z } from "zod/v4";

export const PROMPT_VERSION = "simulator-explanation@2026-11-26.1";

export const ExplanationSchema = z.object({
  narrative: z.string().min(10).max(1200),
  referencedChanges: z.array(z.string().max(200)).max(12),
});
export type ExplanationOutput = z.infer<typeof ExplanationSchema>;

export const SYSTEM = "You are OnboardIQ's Simulator Explanation Agent. You explain a deterministic what-if result in plain language for a PMO coordinator. The result is hypothetical: it is NOT the employee's actual readiness.";

export function buildUser(diff: unknown): string {
  return [
    "Explain in 3–5 sentences what the simulated changes would do and what would still be required. Use only the facts in the RESULT; do not add steps, owners, dates or estimates.",
    "Start with 'In this simulation'. Mention that the actual record is unchanged.",
    'referencedChanges must list the entries from RESULT.changes that your narrative mentions, copied exactly.',
    'Return JSON: {"narrative":"…","referencedChanges":["…"]}',
    "",
    "RESULT:",
    JSON.stringify(diff),
  ].join("\n");
}
