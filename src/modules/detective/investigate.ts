import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditTimestamp } from "@/lib/clock";
import { toJson } from "@/lib/json";
import { PERSON_ROLES, type RecommendedAction, type RootCause } from "@/domain/types";
import { runAgent, type AIRunInfo } from "@/ai/runAgent";
import { normalizeForMatch, verifyFacts } from "@/ai/verify";
import * as detective from "@/ai/prompts/detective";
import { audit, type Actor } from "@/modules/audit";
import { loadCaseState } from "@/modules/case/loadCaseState";
import { findingId } from "@/modules/case/recompute";
import { assertAllowed, type Principal } from "@/modules/permissions";
import { severityForAIFinding, type FindingCategory } from "./types";

export type InvestigationSummary =
  | { ok: true; employeeId: string; reviewed: number; confirmed: number; notAnIssue: number; proposed: number; duplicates: number; dropped: string[]; run: AIRunInfo; cached: boolean }
  | { ok: false; employeeId: string; error: string; run: AIRunInfo };

export type AIReview = { verdict: "CONFIRMED" | "NOT_AN_ISSUE" | "UNSURE"; explanation: string; recommendedActions: RecommendedAction[]; aiRunId: string; model: string; at: string };

const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });
const READINESS_HINT = /readiness|ready|independ|complete|closed|kt|scenario|validation|execution/i;

/**
 * Two-stage Detective: deterministic detectors already produced the candidates (stored rule findings).
 * The Detective Agent reviews them and proposes extra findings. The server then:
 *  - keeps only facts whose excerpt is verbatim in a known source (others become labelled assumptions),
 *  - drops new findings with no verifiable fact, dedupes against rule findings,
 *  - computes severity deterministically, filters root-cause evidence IDs and owner roles,
 *  - stores new findings as PROPOSED (never OPEN) and never changes readiness, evidence or rule-finding status.
 */
export async function investigateCase(employeeId: string, principal: Principal, db: PrismaClient = prisma): Promise<InvestigationSummary> {
  await assertAllowed(principal, "ai.run", { employeeId }, db);
  const state = await loadCaseState(employeeId, db);
  if (!state) throw new Error("Unknown case");
  const sources = [...state.evidence, ...state.projectEvidence].filter((e) => e.reviewStatus !== "REJECTED");
  const sourceText = new Map(sources.map((s) => [s.id, s.content]));
  const candidates = state.findings.filter((f) => f.origin === "RULE" && f.status === "OPEN");

  const input: detective.DetectiveInput = {
    evaluationDate: state.evaluationDate,
    caseInfo: {
      name: state.employee.name, project: state.employee.projectName, exactRole: state.employee.role, trackerStatus: state.employee.trackerStatus,
      trackerLastUpdate: state.employee.lastUpdate, startDate: state.employee.startDate, movement: state.employee.movement,
      lineManager: state.people.lineManager?.name ?? state.people.lineManagerText, technicalLead: state.people.techLead ? state.people.techLead.name ?? "known by role only" : null,
      ktOwner: state.people.ktOwner ? state.people.ktOwner.name ?? "known by role only" : null, expectedReadyAt: state.caseInfo.expectedReadyAt,
    },
    access: state.access.map((a) => ({ application: a.application, status: a.status, owner: a.owner })),
    kt: state.kt.filter((k) => k.status !== "REJECTED").map((k) => ({ title: k.title, stage: k.stage, basis: k.stageBasis, scope: k.scopeType })),
    candidates: candidates.map((f) => ({ findingId: f.id, type: f.type, title: f.title, facts: f.facts.map((x) => ({ evidenceId: x.evidenceId, excerpt: x.excerpt })) })),
    sources: sources.map((s) => ({ id: s.id, senderRole: s.senderRole, date: s.timestamp.slice(0, 10), content: s.content })),
  };

  const outcome = await runAgent({
    agent: "detective", promptVersion: detective.PROMPT_VERSION, employeeId, input,
    inputRefs: [employeeId, ...sources.map((s) => s.id), ...candidates.map((c) => c.id)],
    system: detective.SYSTEM, user: detective.buildUser(input), schema: detective.DetectiveSchema, db,
  });
  if (!outcome.ok) {
    await audit({ actor: actorOf(principal), action: "AI_INVESTIGATION_FAILED", entityType: "OnboardingCase", entityId: state.caseId, employeeId, after: { aiRunId: outcome.run.id, status: outcome.run.status }, details: `Detective Agent failed: ${outcome.error}. Deterministic findings are unaffected.` }, db);
    return { ok: false, employeeId, error: outcome.error, run: outcome.run };
  }

  const knownIds = new Set(sourceText.keys());
  const cleanCauses = (rc: { hypothesis: string; supportingEvidenceIds: string[] }[]): RootCause[] =>
    rc.map((r) => ({ hypothesis: r.hypothesis, supportingEvidenceIds: r.supportingEvidenceIds.filter((id) => knownIds.has(id)), isAssumption: true as const }));
  const cleanActions = (ra: { action: string; ownerRole: string; rationale: string }[]): RecommendedAction[] =>
    ra.map((a) => ({ action: a.action, ownerRole: (PERSON_ROLES as readonly string[]).includes(a.ownerRole) ? a.ownerRole : "PMO", ownerPersonId: null, rationale: a.rationale }));
  const dropped: string[] = [];
  const now = auditTimestamp();

  // 1. Reviews of rule candidates: attach the AI view; never change the rule finding's status.
  let confirmed = 0;
  let notAnIssue = 0;
  for (const r of outcome.data.reviews) {
    const target = candidates.find((c) => c.id === r.findingId);
    if (!target) { dropped.push(`Review for unknown finding ${r.findingId}`); continue; }
    if (r.verdict === "CONFIRMED") confirmed++;
    if (r.verdict === "NOT_AN_ISSUE") notAnIssue++;
    const review: AIReview = { verdict: r.verdict, explanation: r.explanation, recommendedActions: cleanActions(r.recommendedActions), aiRunId: outcome.run.id, model: outcome.run.model, at: now };
    await db.finding.update({ where: { id: target.id }, data: { aiAnalysis: toJson(review), aiRunId: outcome.run.id, rootCauses: toJson(cleanCauses(r.rootCauses)) } });
  }

  // 2. New findings: verified facts only, deterministic severity, PROPOSED status.
  const key = (s: string) => normalizeForMatch(s).toLowerCase().replace(/[.;,]+$/, "");
  const ruleExcerpts = candidates.flatMap((c) => c.facts.map((f) => ({ evidenceId: f.evidenceId, text: key(f.excerpt) })));
  const coveredByRules = (f: { evidenceId: string; excerpt: string }) =>
    ruleExcerpts.some((r) => r.evidenceId === f.evidenceId && (r.text.includes(key(f.excerpt)) || key(f.excerpt).includes(r.text)));
  let proposed = 0;
  let duplicates = 0;
  for (const nf of outcome.data.newFindings) {
    const report = verifyFacts(nf.facts, sourceText);
    if (!report.verified.length) { dropped.push(`"${nf.title}": no fact could be verified against a source`); continue; }
    const evidenceIds = [...new Set(report.verified.map((f) => f.evidenceId))].sort();
    const category = nf.category as FindingCategory;
    // A proposal must bring at least one excerpt that no open rule finding already cites.
    const bringsNewEvidence = report.verified.some((f) => !coveredByRules(f));
    if (!bringsNewEvidence) { duplicates++; continue; }
    const fingerprint = `AI:${category}:${createHash("sha1").update(`${evidenceIds.join("+")}|${nf.title.toLowerCase()}`).digest("hex").slice(0, 12)}`;
    const id = findingId(state.caseId, fingerprint);
    if (await db.finding.findUnique({ where: { id } })) { duplicates++; continue; }
    const touchesReadiness = READINESS_HINT.test([nf.title, ...nf.affectedEntities, ...report.verified.map((f) => f.excerpt)].join(" "));
    await db.finding.create({
      data: {
        id, caseId: state.caseId, fingerprint, type: "AI_OBSERVATION", category, origin: "AI", status: "PROPOSED",
        severity: severityForAIFinding(category, touchesReadiness), title: nf.title,
        description: `Proposed by the Detective Agent (${outcome.run.model}). ${report.downgraded.length ? `${report.downgraded.length} statement(s) could not be verified and are shown as assumptions.` : "All cited facts were verified verbatim."}`,
        evidenceIds: toJson(evidenceIds), facts: toJson(report.verified), assumptions: toJson([...nf.assumptions, ...report.downgraded]),
        rootCauses: toJson(cleanCauses(nf.rootCauses)), recommendedActions: toJson(cleanActions(nf.recommendedActions)),
        affectedEntities: toJson(nf.affectedEntities.map((e) => ({ type: "case", id: state.caseId, label: e }))), ownerRole: cleanActions(nf.recommendedActions)[0]?.ownerRole ?? null,
        aiRunId: outcome.run.id, firstDetectedAt: now, lastDetectedAt: now,
      },
    });
    proposed++;
  }

  await audit({
    actor: actorOf(principal), action: "AI_INVESTIGATION_RUN", entityType: "OnboardingCase", entityId: state.caseId, employeeId,
    after: { aiRunId: outcome.run.id, reviewed: outcome.data.reviews.length, confirmed, notAnIssue, proposed, duplicates, dropped: dropped.length },
    evidenceIds: [...knownIds],
    details: `Detective Agent reviewed ${outcome.data.reviews.length} rule finding(s) (${confirmed} confirmed, ${notAnIssue} judged not an issue) and proposed ${proposed} new finding(s); ${dropped.length} statement(s) dropped by server-side verification.`,
  }, db);
  return { ok: true, employeeId, reviewed: outcome.data.reviews.length, confirmed, notAnIssue, proposed, duplicates, dropped, run: outcome.run, cached: outcome.cached };
}
