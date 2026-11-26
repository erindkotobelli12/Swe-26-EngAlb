import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAgent, type AIRunInfo } from "@/ai/runAgent";
import * as prompt from "@/ai/prompts/insights";
import { loadPortfolio } from "@/modules/case/portfolio";
import { assertAllowed, type Principal } from "@/modules/permissions";
import { aggregate, type Bar, type Insights } from "./aggregate";

/** Aggregations over all official cases, or only `onlyIds` (a user's scope). */
export async function loadInsights(db: PrismaClient = prisma, onlyIds?: string[]): Promise<Insights> {
  const [portfolio, resources, projects] = await Promise.all([loadPortfolio(db, onlyIds),db.knowledgeResource.findMany({ include: { project: true } }), db.project.findMany()]);
  return aggregate(portfolio, resources.map((r) => ({ id: r.id, title: r.title, projectId: r.projectId, projectName: r.project?.name ?? null, location: r.location, copyAllowed: r.copyAllowed })), projects.map((p) => p.name));
}

/** Figures the AI may cite, each with a stable key. */
export function figuresOf(i: Insights): (Bar & { key: string })[] {
  const tag = (prefix: string, bars: Bar[]) => bars.map((b) => ({ ...b, key: `${prefix}:${b.key}` }));
  return [
    ...tag("apps-not-usable", i.appsNotUsable), ...tag("handling", i.handlingBottlenecks), ...tag("findings-by-project", i.findingsByProject),
    ...tag("findings-by-category", i.findingsByCategory), ...tag("missing", i.missingResponsibilities), ...tag("unanswered", i.unansweredByRecipient),
  ];
}

export type Hypothesis = { hypothesis: string; recommendation: string; figureKeys: string[]; caseIds: string[] };
export type HypothesesResult = { ok: true; hypotheses: Hypothesis[]; rejected: number; run: AIRunInfo } | { ok: false; error: string; run: AIRunInfo };

/** Bottleneck Insight Agent. Every hypothesis must cite real figure keys and only the case IDs those figures count. */
export async function generateHypotheses(principal: Principal, db: PrismaClient = prisma): Promise<HypothesesResult> {
  await assertAllowed(principal, "insights.view", {}, db);
  await assertAllowed(principal, "ai.run", {}, db);
  const figures = figuresOf(await loadInsights(db)).map(({ key, label, value, caseIds }) => ({ key, label, value, caseIds }));
  const outcome = await runAgent({ agent: "bottleneck_insights", promptVersion: prompt.PROMPT_VERSION, input: figures, inputRefs: [...new Set(figures.flatMap((f) => f.caseIds))], system: prompt.SYSTEM, user: prompt.buildUser(figures), schema: prompt.InsightSchema, db });
  if (!outcome.ok) return outcome;
  const byKey = new Map(figures.map((f) => [f.key, f]));
  let rejected = 0;
  const hypotheses = outcome.data.hypotheses.filter((h) => {
    const cited = h.figureKeys.map((k) => byKey.get(k));
    const allowedCases = new Set(cited.flatMap((f) => f?.caseIds ?? []));
    const ok = cited.every(Boolean) && h.caseIds.every((c) => allowedCases.has(c));
    if (!ok) rejected++;
    return ok;
  });
  return { ok: true, hypotheses, rejected, run: outcome.run };
}
