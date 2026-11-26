import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditTimestamp, getEvaluationDate } from "@/lib/clock";
import { evidenceAuthority } from "@/domain/authority";
import { PERSON_ROLES, READINESS_LABEL, type ReadinessLevel } from "@/domain/types";
import { runAgent, type AIRunInfo } from "@/ai/runAgent";
import { verifyExcerpt } from "@/ai/verify";
import * as extractionPrompt from "@/ai/prompts/extraction";
import { audit, type Actor } from "@/modules/audit";
import { loadCaseState } from "@/modules/case/loadCaseState";
import { recomputeCase, type RecomputeSummary } from "@/modules/case/recompute";
import { evaluateReadiness } from "@/modules/readiness/evaluate";
import { assertCan, type Principal } from "@/modules/permissions";
import { canonicalClaim } from "@/domain/claimFields";
import { applyClaim, normalizeValue, parseField, requiresTechnicalReviewer } from "./fieldMapper";

export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineError";
  }
}

const actorOf = (p: Principal): Actor => ({ userId: p.userId, label: p.name, role: p.role });

export const EvidenceInputSchema = z.object({
  id: z.string().trim().regex(/^[A-Za-z0-9-]{3,40}$/, "Use 3–40 letters, digits or dashes").optional(),
  title: z.string().trim().min(3).max(160),
  sourceType: z.enum(["EMAIL", "TEAMS_MESSAGE", "EMPLOYEE_UPDATE", "MEETING_NOTE", "TRACKER_NOTE"]),
  senderName: z.string().trim().max(120).optional(),
  senderRole: z.enum(PERSON_ROLES),
  recipientRole: z.enum(PERSON_ROLES).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  content: z.string().trim().min(10).max(5000),
  employeeId: z.string().trim().min(1),
  inReplyToId: z.string().trim().optional(),
  isRequest: z.boolean().default(false),
  isSimulated: z.boolean().default(false),
});
export type EvidenceInput = z.infer<typeof EvidenceInputSchema>;

/** Step 1: store verbatim and immutable, pending human review. */
export async function ingestEvidence(input: EvidenceInput, principal: Principal, db: PrismaClient = prisma): Promise<string> {
  assertCan(principal, "evidence.add", { employeeId: input.employeeId });
  const employee = await db.employee.findUnique({ where: { id: input.employeeId }, include: { case: true } });
  if (!employee?.case) throw new PipelineError("Unknown employee case.");
  if (input.inReplyToId) {
    const original = await db.evidence.findUnique({ where: { id: input.inReplyToId } });
    if (!original || original.employeeId !== input.employeeId) throw new PipelineError("The evidence this replies to does not belong to this case.");
  }
  const id = input.id ?? `EV-${Date.now().toString(36).toUpperCase()}`;
  if (await db.evidence.findUnique({ where: { id } })) throw new PipelineError(`Evidence ${id} already exists. Evidence is immutable; use a new ID.`);
  const now = auditTimestamp();
  await db.evidence.create({
    data: {
      id, title: input.title, sourceType: input.sourceType, author: input.senderName || null, senderRole: input.senderRole,
      recipients: JSON.stringify(input.recipientRole ? [{ name: null, role: input.recipientRole }] : []), authorityLevel: evidenceAuthority(input.senderRole),
      timestamp: input.date ?? getEvaluationDate(), content: input.content, employeeId: input.employeeId, projectId: employee.projectId,
      caseId: employee.case.id, reviewStatus: "PENDING_REVIEW", inReplyToId: input.inReplyToId ?? null, isRequest: input.isRequest,
      ingestedAt: now, ingestedBy: principal.userId, isSimulated: input.isSimulated, sourceRef: input.isSimulated ? "Simulated response (demo)" : "Added in OnboardIQ",
    },
  });
  await audit({ actor: actorOf(principal), action: "EVIDENCE_INGESTED", entityType: "Evidence", entityId: id, employeeId: input.employeeId, after: { title: input.title, senderRole: input.senderRole, inReplyToId: input.inReplyToId ?? null }, evidenceIds: [id], details: `Evidence stored verbatim and pending review${input.isSimulated ? " (simulated)" : ""}.` }, db);
  return id;
}

/** Accept or reject the source itself. Content never changes. */
export async function reviewEvidence(evidenceId: string, decision: "APPROVED" | "REJECTED", reason: string, principal: Principal, db: PrismaClient = prisma): Promise<RecomputeSummary | null> {
  assertCan(principal, "evidence.review");
  const ev = await db.evidence.findUnique({ where: { id: evidenceId } });
  if (!ev) throw new PipelineError("Unknown evidence.");
  if (decision === "REJECTED" && reason.trim().length < 3) throw new PipelineError("A reason is required to reject evidence.");
  await db.evidence.update({ where: { id: evidenceId }, data: { reviewStatus: decision } });
  await audit({ actor: actorOf(principal), action: decision === "APPROVED" ? "EVIDENCE_APPROVED" : "EVIDENCE_REJECTED", entityType: "Evidence", entityId: evidenceId, employeeId: ev.employeeId, before: { reviewStatus: ev.reviewStatus }, after: { reviewStatus: decision }, evidenceIds: [evidenceId], details: reason || "Source accepted as authentic." }, db);
  return ev.employeeId ? recomputeCase(ev.employeeId, `evidence ${evidenceId} ${decision.toLowerCase()}`, actorOf(principal), db) : null;
}

export type ExtractionResult = { ok: true; created: number; dropped: { field: string; reason: string }[]; run: AIRunInfo; cached: boolean } | { ok: false; error: string; run: AIRunInfo };

/** Step 2: the Extraction Agent proposes claims; the server verifies every excerpt before storing. */
export async function extractClaims(evidenceId: string, principal: Principal, db: PrismaClient = prisma): Promise<ExtractionResult> {
  assertCan(principal, "ai.run");
  const ev = await db.evidence.findUnique({ where: { id: evidenceId } });
  if (!ev?.employeeId) throw new PipelineError("Extraction needs evidence linked to an employee case.");
  const state = await loadCaseState(ev.employeeId, db);
  if (!state) throw new PipelineError("Unknown case.");
  const input = {
    employeeName: state.employee.name,
    knownApplications: state.access.map((a) => a.application),
    knownActivities: state.kt.map((k) => k.title),
    source: { id: ev.id, senderRole: ev.senderRole, date: ev.timestamp, content: ev.content },
  };
  const outcome = await runAgent({
    agent: "extraction", promptVersion: extractionPrompt.PROMPT_VERSION, employeeId: ev.employeeId, input, inputRefs: [ev.id, ev.employeeId],
    system: extractionPrompt.SYSTEM, user: extractionPrompt.buildUser(input), schema: extractionPrompt.ExtractionSchema, db,
  });
  if (!outcome.ok) return outcome;
  const dropped: { field: string; reason: string }[] = [];
  let created = 0;
  for (const raw of outcome.data.claims) {
    const c = { ...raw, ...canonicalClaim(raw.field, raw.value) };
    if (!verifyExcerpt(c.excerpt, ev.content)) { dropped.push({ field: c.field, reason: "Excerpt not found verbatim in the source" }); continue; }
    const parsed = parseField(c.field);
    const value = parsed.kind === "INFO" ? c.value.trim() : normalizeValue(parsed, c.value);
    if (value === null) { dropped.push({ field: c.field, reason: `Value "${c.value}" is not valid for this field` }); continue; }
    const duplicate = await db.evidenceClaim.findFirst({ where: { evidenceId: ev.id, field: c.field, extractedValue: value } });
    if (duplicate) { dropped.push({ field: c.field, reason: "Duplicate of an existing claim" }); continue; }
    await db.evidenceClaim.create({
      data: { evidenceId: ev.id, entity: ev.employeeId, field: c.field.trim(), extractedValue: value, excerpt: c.excerpt.trim(), excerptVerified: true, effectiveDate: c.effectiveDate && /^\d{4}-\d{2}-\d{2}$/.test(c.effectiveDate) ? c.effectiveDate : ev.timestamp.slice(0, 10), origin: "AI", aiRunId: outcome.run.id, reviewStatus: "PENDING" },
    });
    created++;
  }
  await audit({ actor: actorOf(principal), action: "AI_EXTRACTION_RUN", entityType: "Evidence", entityId: ev.id, employeeId: ev.employeeId, after: { created, dropped: dropped.length, aiRunId: outcome.run.id }, evidenceIds: [ev.id], details: `Extraction Agent proposed ${created} verified claim(s); ${dropped.length} dropped by server-side checks.` }, db);
  return { ok: true, created, dropped, run: outcome.run, cached: outcome.cached };
}

/** Human-authored claim (works when the LLM is down). The excerpt must still be verbatim. */
export async function addManualClaim(input: { evidenceId: string; field: string; value: string; excerpt: string }, principal: Principal, db: PrismaClient = prisma): Promise<void> {
  assertCan(principal, "evidence.review");
  const ev = await db.evidence.findUnique({ where: { id: input.evidenceId } });
  if (!ev?.employeeId) throw new PipelineError("Unknown evidence.");
  if (!verifyExcerpt(input.excerpt, ev.content)) throw new PipelineError("The excerpt must be copied verbatim from the source.");
  const parsed = parseField(input.field);
  const value = parsed.kind === "INFO" ? input.value.trim() : normalizeValue(parsed, input.value);
  if (!value) throw new PipelineError("That value is not valid for this field.");
  const claim = await db.evidenceClaim.create({ data: { evidenceId: ev.id, entity: ev.employeeId, field: input.field.trim(), extractedValue: value, excerpt: input.excerpt.trim(), excerptVerified: true, effectiveDate: ev.timestamp.slice(0, 10), origin: "HUMAN", reviewStatus: "PENDING" } });
  await audit({ actor: actorOf(principal), action: "CLAIM_PROPOSED", entityType: "EvidenceClaim", entityId: claim.id, employeeId: ev.employeeId, after: { field: input.field, value }, evidenceIds: [ev.id], details: "Claim added manually; pending review." }, db);
}

export type PipelineStep = { step: string; status: "done" | "changed" | "none" | "skipped"; detail: string };
export type ClaimReviewResult = { steps: PipelineStep[]; recompute: RecomputeSummary | null };

/**
 * Steps 3–5: a human approves (optionally edited) or rejects a claim. Approval applies it through the
 * whitelisted mapper, recomputes the case and reports each pipeline step with its result.
 */
export async function reviewClaim(
  input: { claimId: string; decision: "APPROVE" | "REJECT"; editedValue?: string; reason?: string },
  principal: Principal,
  db: PrismaClient = prisma,
): Promise<ClaimReviewResult> {
  assertCan(principal, "evidence.review");
  const claim = await db.evidenceClaim.findUnique({ where: { id: input.claimId }, include: { evidence: true } });
  if (!claim?.evidence.employeeId) throw new PipelineError("Unknown claim.");
  if (claim.reviewStatus !== "PENDING") throw new PipelineError("This claim has already been reviewed.");
  const employeeId = claim.evidence.employeeId;
  const parsed = parseField(claim.field);
  if (requiresTechnicalReviewer(parsed)) assertCan(principal, "claim.reviewTechnical");
  const actor = actorOf(principal);
  const now = auditTimestamp();

  if (input.decision === "REJECT") {
    if (!input.reason || input.reason.trim().length < 3) throw new PipelineError("A reason is required to reject a claim.");
    await db.evidenceClaim.update({ where: { id: claim.id }, data: { reviewStatus: "REJECTED", reviewReason: input.reason.trim(), reviewerId: principal.userId, reviewedAt: now } });
    await audit({ actor, action: "CLAIM_REJECTED", entityType: "EvidenceClaim", entityId: claim.id, employeeId, before: { reviewStatus: "PENDING" }, after: { reviewStatus: "REJECTED" }, evidenceIds: [claim.evidenceId], details: `Rejected: ${input.reason.trim()}` }, db);
    return { steps: [{ step: "Review", status: "done", detail: `Claim rejected: ${input.reason.trim()}` }], recompute: null };
  }

  const value = input.editedValue !== undefined && input.editedValue.trim() !== claim.extractedValue
    ? (parsed.kind === "INFO" ? input.editedValue.trim() : normalizeValue(parsed, input.editedValue))
    : claim.extractedValue;
  if (!value) throw new PipelineError("The edited value is not valid for this field.");

  const before = await loadCaseState(employeeId, db);
  const beforeEval = before ? evaluateReadiness(before) : null;
  const change = await applyClaim(db, { employeeId, caseId: `${claim.evidence.caseId ?? `CASE-${employeeId}`}`, field: claim.field, value, evidenceId: claim.evidenceId, evidenceDate: claim.evidence.timestamp.slice(0, 10), senderRole: claim.evidence.senderRole });
  await db.evidenceClaim.update({
    where: { id: claim.id },
    data: { reviewStatus: "APPROVED", editedValue: value !== claim.extractedValue ? value : null, reviewReason: input.reason?.trim() || null, reviewerId: principal.userId, reviewedAt: now, appliedChange: change ? JSON.stringify(change) : null },
  });
  if (claim.evidence.reviewStatus === "PENDING_REVIEW") await db.evidence.update({ where: { id: claim.evidenceId }, data: { reviewStatus: "APPROVED" } });
  await audit({
    actor, action: value !== claim.extractedValue ? "CLAIM_EDITED_AND_APPROVED" : "CLAIM_APPROVED", entityType: "EvidenceClaim", entityId: claim.id, employeeId,
    before: { value: claim.extractedValue, state: change?.before ?? null }, after: { value, state: change?.after ?? null }, evidenceIds: [claim.evidenceId],
    details: change ? `Applied to ${change.entityType} ${change.label} via the whitelisted field mapper.` : "Informational claim recorded; no case state changed.",
  }, db);

  const recompute = await recomputeCase(employeeId, `claim approved (${claim.field})`, actor, db);
  const after = await loadCaseState(employeeId, db);
  const afterEval = after ? evaluateReadiness(after) : null;
  const unblocked = beforeEval && afterEval
    ? beforeEval.graph.nodes.filter((n) => n.display === "BLOCKED" && afterEval.graph.nodes.find((m) => m.key === n.key)?.display !== "BLOCKED").map((n) => n.label)
    : [];
  const newlyBlocked = beforeEval && afterEval
    ? afterEval.graph.nodes.filter((n) => n.display === "BLOCKED" && beforeEval.graph.nodes.find((m) => m.key === n.key)?.display !== "BLOCKED").map((n) => n.label)
    : [];
  const conflictsOpened = (recompute?.findingsOpened ?? []).filter((t) => /conflict/i.test(t));
  const label = (l: string | undefined) => (l && l in READINESS_LABEL ? READINESS_LABEL[l as ReadinessLevel] : l ?? "Unknown");

  const steps: PipelineStep[] = [
    { step: "1. Extract", status: "done", detail: `${claim.origin === "AI" ? "AI-proposed" : claim.origin === "HUMAN" ? "Human-entered" : "Seeded"} claim "${claim.field} = ${value}" from ${claim.evidenceId}; excerpt verified verbatim.` },
    { step: "2. Affected entities", status: change ? "changed" : "none", detail: change ? `${change.entityType}: ${change.label}` : "Informational claim — no entity state changes." },
    { step: "3. Contradictions", status: conflictsOpened.length ? "changed" : "none", detail: conflictsOpened.length ? conflictsOpened.join("; ") : "No new conflicting statements detected." },
    { step: "4. State update", status: change ? "changed" : "none", detail: change ? `${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}` : "No state change." },
    { step: "5. Dependencies", status: unblocked.length || newlyBlocked.length ? "changed" : "none", detail: [unblocked.length ? `Unblocked: ${unblocked.join(", ")}` : "", newlyBlocked.length ? `Newly blocked: ${newlyBlocked.join(", ")}` : ""].filter(Boolean).join(" · ") || "No dependency status changed." },
    { step: "6. Readiness", status: recompute && recompute.levelBefore !== recompute.levelAfter ? "changed" : recompute?.gatesChanged.length ? "changed" : "none", detail: recompute ? `Assessed ${label(recompute.levelBefore)} → ${label(recompute.levelAfter)}; ${recompute.gatesChanged.map((g) => `${g.id} ${g.before}→${g.after}`).join(", ") || "no gate changes"}.` : "Not recomputed." },
    { step: "7. Roadmap", status: "skipped", detail: "Roadmap adaptation proposals are generated by the Roadmap feature (see Roadmap tab)." },
    { step: "8. New actions", status: recompute && (recompute.findingsOpened.length || recompute.findingsClosed.length) ? "changed" : "none", detail: recompute ? `${recompute.findingsOpened.length} finding(s) opened${recompute.findingsOpened.length ? ` (${recompute.findingsOpened.join("; ")})` : ""}; ${recompute.findingsClosed.length} cleared${recompute.findingsClosed.length ? ` (${recompute.findingsClosed.join("; ")})` : ""}.` : "None." },
    { step: "9. Audit", status: "done", detail: "Claim approval, state change and recompute written to the audit log with before/after values." },
  ];
  await audit({ actor, action: "PIPELINE_RUN", entityType: "EvidenceClaim", entityId: claim.id, employeeId, after: steps, evidenceIds: [claim.evidenceId], details: `Evidence pipeline ran for claim ${claim.field}.` }, db);
  return { steps, recompute };
}
