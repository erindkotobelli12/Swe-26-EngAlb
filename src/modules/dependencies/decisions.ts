import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditTimestamp } from "@/lib/clock";
import { toJson } from "@/lib/json";
import { runAgent, type AIRunInfo } from "@/ai/runAgent";
import { verifyExcerpt } from "@/ai/verify";
import * as prompt from "@/ai/prompts/dependencies";
import { audit, type Actor } from "@/modules/audit";
import { loadCaseState } from "@/modules/case/loadCaseState";
import { recomputeCase } from "@/modules/case/recompute";
import { DecisionError } from "@/modules/detective/decisions";
import { assertCan, type Principal } from "@/modules/permissions";
import { evaluateReadiness } from "@/modules/readiness/evaluate";

const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });

/**
 * Confirming the edge "KT activity → independent execution" is the decision that makes a PROPOSED KT activity part of
 * the agreed readiness scope, so that KT requirement is confirmed too (both audited). Confirming "access → KT" only
 * records that the KT activity needs that access.
 */
export async function confirmDependency(dependencyId: string, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  assertCan(principal, "dependency.decide");
  const dep = await db.dependency.findUnique({ where: { id: dependencyId } });
  if (!dep?.employeeId) throw new DecisionError("Unknown dependency.");
  if (dep.status !== "PROPOSED") throw new DecisionError("Only proposed dependencies can be confirmed.");
  const now = auditTimestamp();
  const actor = actorOf(principal);
  await db.dependency.update({ where: { id: dep.id }, data: { status: "CONFIRMED", confirmedBy: principal.name, confirmedAt: now } });
  await audit({ actor, action: "DEPENDENCY_CONFIRMED", entityType: "Dependency", entityId: dep.id, employeeId: dep.employeeId, before: { status: "PROPOSED" }, after: { status: "CONFIRMED", from: `${dep.fromType}:${dep.fromId}`, to: `${dep.toType}:${dep.toId}`, origin: dep.origin }, details: `Confirmed dependency (${dep.origin.toLowerCase()}): ${dep.rationale}` }, db);
  if (dep.fromType === "kt" && dep.toType === "gate" && dep.toId === "EXECUTION_OBSERVED") {
    const kt = await db.kTActivity.findUnique({ where: { id: dep.fromId } });
    if (kt?.status === "PROPOSED") {
      await db.kTActivity.update({ where: { id: kt.id }, data: { status: "CONFIRMED" } });
      await audit({ actor, action: "KT_REQUIREMENT_CONFIRMED", entityType: "KTActivity", entityId: kt.id, employeeId: dep.employeeId, before: { status: "PROPOSED" }, after: { status: "CONFIRMED" }, details: `KT requirement "${kt.title}" agreed as part of the readiness scope (dependency ${dep.id}).` }, db);
    }
  }
  await recomputeCase(dep.employeeId, "dependency confirmed", actor, db);
}

export async function rejectDependency(dependencyId: string, reason: string, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  assertCan(principal, "dependency.decide");
  if (reason.trim().length < 3) throw new DecisionError("A reason is required to reject a dependency.");
  const dep = await db.dependency.findUnique({ where: { id: dependencyId } });
  if (!dep?.employeeId) throw new DecisionError("Unknown dependency.");
  await db.dependency.update({ where: { id: dep.id }, data: { status: "REJECTED", confirmedBy: principal.name, confirmedAt: auditTimestamp() } });
  await audit({ actor: actorOf(principal), action: "DEPENDENCY_REJECTED", entityType: "Dependency", entityId: dep.id, employeeId: dep.employeeId, before: { status: dep.status }, after: { status: "REJECTED" }, details: `Rejected: ${reason.trim()}` }, db);
  await recomputeCase(dep.employeeId, "dependency rejected", actorOf(principal), db);
}

function createsCycle(edges: { from: string; to: string }[], from: string, to: string): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
  const stack = [to];
  const seen = new Set<string>();
  while (stack.length) {
    const k = stack.pop()!;
    if (k === from) return true;
    if (seen.has(k)) continue;
    seen.add(k);
    stack.push(...(adj.get(k) ?? []));
  }
  return false;
}

export type SuggestionResult = { ok: true; created: number; rejected: string[]; run: AIRunInfo; cached: boolean } | { ok: false; error: string; run: AIRunInfo };

/** Dependency Suggestion Agent: edges between existing access/KT nodes only, each with a verified excerpt. */
export async function suggestDependencies(employeeId: string, principal: Principal, db: PrismaClient = prisma): Promise<SuggestionResult> {
  assertCan(principal, "ai.run");
  const state = await loadCaseState(employeeId, db);
  if (!state) throw new DecisionError("Unknown case.");
  const nodes = [
    ...state.access.map((a) => ({ key: `access:${a.id}`, type: "access", label: a.application })),
    ...state.kt.filter((k) => k.status !== "REJECTED").map((k) => ({ key: `kt:${k.id}`, type: "kt", label: k.title })),
  ];
  const sources = state.evidence.filter((e) => e.sourceType !== "TRACKER" && e.reviewStatus !== "REJECTED").map((e) => ({ id: e.id, senderRole: e.senderRole, content: e.content }));
  const input = { nodes, sources };
  const outcome = await runAgent({ agent: "dependency_suggestion", promptVersion: prompt.PROMPT_VERSION, employeeId, input, inputRefs: [employeeId, ...sources.map((s) => s.id)], system: prompt.SYSTEM, user: prompt.buildUser(input), schema: prompt.DependencySchema, db });
  if (!outcome.ok) return outcome;

  const keys = new Set(nodes.map((n) => n.key));
  const graph = evaluateReadiness(state, { items: [], includeProposed: true }).graph;
  const existing = graph.edges.map((e) => ({ from: e.from, to: e.to }));
  const rejected: string[] = [];
  let created = 0;
  for (const e of outcome.data.edges) {
    const label = `${e.from} → ${e.to}`;
    if (!keys.has(e.from) || !keys.has(e.to) || e.from === e.to) { rejected.push(`${label}: unknown or invalid node`); continue; }
    const source = sources.find((s) => s.id === e.evidenceId);
    if (!source || !verifyExcerpt(e.excerpt, source.content)) { rejected.push(`${label}: excerpt not found verbatim in ${e.evidenceId}`); continue; }
    if (existing.some((x) => x.from === e.from && x.to === e.to)) { rejected.push(`${label}: already exists`); continue; }
    if (createsCycle(existing, e.from, e.to)) { rejected.push(`${label}: would create a cycle`); continue; }
    const [fromType, fromId] = [e.from.split(":")[0], e.from.slice(e.from.indexOf(":") + 1)];
    const [toType, toId] = [e.to.split(":")[0], e.to.slice(e.to.indexOf(":") + 1)];
    const dup = await db.dependency.findFirst({ where: { employeeId, fromType, fromId, toType, toId } });
    if (dup) { rejected.push(`${label}: previously ${dup.status.toLowerCase()}`); continue; }
    await db.dependency.create({ data: { employeeId, caseId: state.caseId, fromType, fromId, toType, toId, kind: "REQUIRES", status: "PROPOSED", origin: "AI", rationale: e.rationale, evidenceIds: toJson([e.evidenceId]), excerpts: toJson([e.excerpt]), aiRunId: outcome.run.id, createdAt: auditTimestamp() } });
    existing.push({ from: e.from, to: e.to });
    created++;
  }
  await audit({ actor: actorOf(principal), action: "AI_DEPENDENCIES_SUGGESTED", entityType: "OnboardingCase", entityId: state.caseId, employeeId, after: { aiRunId: outcome.run.id, created, rejected: rejected.length }, details: `Dependency Suggestion Agent proposed ${created} edge(s); ${rejected.length} rejected by server checks.` }, db);
  return { ok: true, created, rejected, run: outcome.run, cached: outcome.cached };
}
