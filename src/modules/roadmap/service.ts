import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditTimestamp } from "@/lib/clock";
import { parseJson, toJson } from "@/lib/json";
import { runAgent, type AIRunInfo } from "@/ai/runAgent";
import * as prompt from "@/ai/prompts/roadmap";
import { audit, type Actor } from "@/modules/audit";
import { loadCaseState } from "@/modules/case/loadCaseState";
import { recomputeCase } from "@/modules/case/recompute";
import { DecisionError } from "@/modules/detective/decisions";
import { assertAllowed, type Principal } from "@/modules/permissions";
import { evaluateReadiness } from "@/modules/readiness/evaluate";
import { buildBackbone, type BaselineEntry } from "./backbone";

const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });

/** KT and alternative-activity items are technical (Technical Lead); logistics and ownership items belong to the phase owner or the Line Manager. */
export const deciderPermission = (kind: string) => (kind === "LOGISTICS" || kind === "OWNERSHIP" ? "roadmap.decideLogistics" : "roadmap.decideTechnical") as "roadmap.decideLogistics" | "roadmap.decideTechnical";

export type SuggestRoadmapResult = { ok: true; created: number; rejected: string[]; run: AIRunInfo } | { ok: false; error: string; run: AIRunInfo };

export async function suggestRoadmap(employeeId: string, principal: Principal, db: PrismaClient = prisma): Promise<SuggestRoadmapResult> {
  await assertAllowed(principal, "ai.run", { employeeId }, db);
  const state = await loadCaseState(employeeId, db);
  if (!state) throw new DecisionError("Unknown case.");
  const items = buildBackbone(state, evaluateReadiness(state));
  const sources = state.evidence.filter((e) => e.sourceType !== "TRACKER" && e.reviewStatus !== "REJECTED").map((e) => ({ id: e.id, content: e.content }));
  const input = { movement: state.employee.movement, project: state.employee.projectName, items: items.map(({ key, title, status, waitsFor }) => ({ key, title, status, waitsFor })), blockers: state.findings.filter((f) => f.status === "OPEN").map((f) => f.title), sources };
  const outcome = await runAgent({ agent: "roadmap", promptVersion: prompt.PROMPT_VERSION, employeeId, input, inputRefs: [employeeId, ...sources.map((s) => s.id)], system: prompt.SYSTEM, user: prompt.buildUser(input), schema: prompt.RoadmapSchema, db });
  if (!outcome.ok) return outcome;
  const keys = new Set(items.map((i) => i.key));
  const known = new Set(sources.map((s) => s.id));
  const rejected: string[] = [];
  let created = 0;
  for (const p of outcome.data.proposals) {
    if (p.relatesToKey && !keys.has(p.relatesToKey)) { rejected.push(`${p.title}: unknown backbone item`); continue; }
    if (p.evidenceIds.some((id) => !known.has(id))) { rejected.push(`${p.title}: cites an unknown source`); continue; }
    if (p.type === "SKIP" && (!p.relatesToKey?.startsWith("kt:") || !p.evidenceIds.length)) { rejected.push(`${p.title}: a skip needs a KT item and supporting evidence`); continue; }
    if (p.type === "ADD" && items.some((i) => i.title.toLowerCase() === p.title.toLowerCase() || (p.relatesToKey === i.key && i.key.startsWith("kt:")))) { rejected.push(`${p.title}: already in the plan`); continue; }
    const related = items.find((i) => i.key === p.relatesToKey);
    if (p.type === "ALTERNATIVE" && (!related || related.status === "DONE")) { rejected.push(`${p.title}: alternatives are only proposed while a pending or blocked item is waited for`); continue; }
    if (await db.roadmapItem.findFirst({ where: { employeeId, title: p.title, status: { not: "REJECTED" } } })) { rejected.push(`${p.title}: duplicate`); continue; }
    await db.roadmapItem.create({ data: { employeeId, type: p.type, kind: p.kind, phase: p.phase, title: p.title, description: p.description, ownerRole: p.ownerRole, completionCriteria: p.completionCriteria, relatesToKey: p.relatesToKey, rationale: p.rationale, evidenceIds: toJson(p.evidenceIds), status: "PROPOSED", origin: "AI", aiRunId: outcome.run.id, createdAt: auditTimestamp() } });
    created++;
  }
  await audit({ actor: actorOf(principal), action: "AI_ROADMAP_SUGGESTED", entityType: "OnboardingCase", entityId: state.caseId, employeeId, after: { aiRunId: outcome.run.id, created, rejected: rejected.length }, details: `Roadmap Agent proposed ${created} adjustment(s); ${rejected.length} rejected by server checks.` }, db);
  return { ok: true, created, rejected, run: outcome.run };
}

/**
 * Approval makes a proposal official. An approved ADD of kind KT becomes an agreed KT requirement (feeds gates and the map);
 * an approved SKIP of a proposed KT activity rejects that requirement; alternatives are plan items only.
 */
export async function decideRoadmapItem(input: { id: string; decision: "APPROVE" | "REJECT"; reason?: string }, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  const item = await db.roadmapItem.findUnique({ where: { id: input.id } });
  if (!item) throw new DecisionError("Unknown roadmap item.");
  await assertAllowed(principal, deciderPermission(item.kind), { employeeId: item.employeeId }, db);
  if (item.status !== "PROPOSED") throw new DecisionError("Already decided.");
  if (input.decision === "REJECT" && (input.reason ?? "").trim().length < 3) throw new DecisionError("A reason is required to reject.");
  const now = auditTimestamp();
  const actor = actorOf(principal);
  await db.roadmapItem.update({ where: { id: item.id }, data: { status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED", decidedBy: principal.name, decidedAt: now, decisionReason: input.reason?.trim() || null } });
  let effect = "plan item only";
  if (input.decision === "APPROVE" && item.type === "ADD" && item.kind === "KT") {
    await db.kTActivity.create({ data: { employeeId: item.employeeId, title: item.title, description: item.description, scope: item.completionCriteria, status: "CONFIRMED", origin: "HUMAN", originNote: `Approved roadmap proposal ${item.id}`, requiredForReady: true } });
    effect = "new agreed KT requirement";
  }
  if (input.decision === "APPROVE" && item.type === "SKIP" && item.relatesToKey?.startsWith("kt:")) {
    const kt = await db.kTActivity.findUnique({ where: { id: item.relatesToKey.slice(3) } });
    if (kt) { await db.kTActivity.update({ where: { id: kt.id }, data: { status: "REJECTED", originNote: `Skipped: roadmap decision ${item.id}` } }); effect = `KT requirement "${kt.title}" skipped`; }
  }
  await audit({ actor, action: input.decision === "APPROVE" ? "ROADMAP_ITEM_APPROVED" : "ROADMAP_ITEM_REJECTED", entityType: "RoadmapItem", entityId: item.id, employeeId: item.employeeId, before: { status: "PROPOSED" }, after: { status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED", effect }, evidenceIds: parseJson(item.evidenceIds, []), details: `${item.type.toLowerCase()} "${item.title}" — ${input.decision === "APPROVE" ? effect : input.reason}` }, db);
  if (effect !== "plan item only") await recomputeCase(item.employeeId, "roadmap decision", actor, db);
}

/** Stores the current backbone as the approved baseline; later state changes are shown as a diff against it. */
export async function approveBaseline(employeeId: string, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  await assertAllowed(principal, "roadmap.baseline", { employeeId }, db);
  const state = await loadCaseState(employeeId, db);
  if (!state) throw new DecisionError("Unknown case.");
  const baseline: BaselineEntry[] = buildBackbone(state, evaluateReadiness(state)).map(({ key, title, status }) => ({ key, title, status }));
  await db.onboardingCase.update({ where: { id: state.caseId }, data: { roadmapBaselineJson: toJson(baseline), roadmapBaselineAt: auditTimestamp(), roadmapBaselineBy: principal.name } });
  await audit({ actor: actorOf(principal), action: "ROADMAP_BASELINE_APPROVED", entityType: "OnboardingCase", entityId: state.caseId, employeeId, after: { items: baseline.length }, details: "Current roadmap approved as baseline; later changes are shown as a diff." }, db);
}
