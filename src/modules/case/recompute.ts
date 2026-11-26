import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditTimestamp } from "@/lib/clock";
import { KT_TEMPLATES, TEMPLATE_NOTE } from "@/config/templates";
import { parseJson, toJson } from "@/lib/json";
import type { CaseState, Gate } from "@/domain/types";
import { audit, type Actor } from "@/modules/audit";
import { runDetectors } from "@/modules/detective/detectors";
import { evaluateReadiness } from "@/modules/readiness/evaluate";
import { latestValidation } from "@/modules/readiness/gates";
import { loadCaseState, listCaseEmployeeIds } from "./loadCaseState";

export const findingId = (caseId: string, fingerprint: string) =>
  `FND-${createHash("sha1").update(`${caseId}|${fingerprint}`).digest("hex").slice(0, 10)}`;

export type RecomputeSummary = {
  employeeId: string;
  trigger: string;
  levelBefore: string;
  levelAfter: string;
  gatesChanged: { id: string; before: string; after: string }[];
  findingsOpened: string[];
  findingsClosed: string[];
  dependenciesProposed: number;
};

/**
 * Template edges: KT activities that declare the applications they use get a PROPOSED access → KT edge,
 * and PROPOSED KT activities get a PROPOSED edge to the execution gate. Existing rows (including rejected
 * ones) are never overwritten, so human decisions are preserved.
 */
async function ensureTemplateKT(state: CaseState, db: PrismaClient): Promise<number> {
  let created = 0;
  for (const t of KT_TEMPLATES) {
    const access = state.access.find((a) => a.required && a.application.toLowerCase() === t.application.toLowerCase());
    if (!access || state.kt.some((k) => k.title.toLowerCase() === t.title.toLowerCase())) continue;
    await db.kTActivity.create({
      data: {
        id: `KT-${state.employee.id}-${t.id}`, employeeId: state.employee.id, title: t.title, description: t.description, scope: t.description,
        scopeType: t.scopeType, stage: "NOT_STARTED", stageBasis: "UNKNOWN", requiredApps: toJson([t.application]),
        status: "PROPOSED", origin: "TEMPLATE", originNote: TEMPLATE_NOTE, requiredForReady: true,
      },
    });
    created++;
  }
  return created;
}

async function ensureTemplateDependencies(state: CaseState, db: PrismaClient): Promise<number> {
  const wanted: { fromType: string; fromId: string; toType: string; toId: string; rationale: string }[] = [];
  for (const k of state.kt.filter((x) => x.status !== "REJECTED")) {
    for (const app of k.requiredApps) {
      const access = state.access.find((a) => a.application.toLowerCase() === app.toLowerCase());
      if (access) wanted.push({ fromType: "access", fromId: access.id, toType: "kt", toId: k.id, rationale: `Template: "${k.title}" is performed in ${access.application}, so it needs usable access first.` });
    }
    if (k.status === "PROPOSED") wanted.push({ fromType: "kt", fromId: k.id, toType: "gate", toId: "EXECUTION_OBSERVED", rationale: `Template: "${k.title}" must reach observed independent execution.` });
  }
  let created = 0;
  for (const w of wanted) {
    const exists = state.dependencies.some((d) => d.fromType === w.fromType && d.fromId === w.fromId && d.toType === w.toType && d.toId === w.toId);
    if (exists) continue;
    await db.dependency.create({ data: { ...w, employeeId: state.employee.id, caseId: state.caseId, kind: "REQUIRES", status: "PROPOSED", origin: "TEMPLATE", createdAt: auditTimestamp() } });
    created++;
  }
  return created;
}

export async function recomputeCase(employeeId: string, trigger: string, actor: Actor, db: PrismaClient = prisma): Promise<RecomputeSummary | null> {
  let state = await loadCaseState(employeeId, db);
  if (!state) return null;
  const caseRow = await db.onboardingCase.findUnique({ where: { id: state.caseId } });
  const previousGates = parseJson<Gate[]>(caseRow?.gatesJson, []);
  const levelBefore = caseRow?.assessedStatus ?? "UNKNOWN";

  // 1. Template proposals (KT activities, then dependency edges)
  if (await ensureTemplateKT(state, db)) state = (await loadCaseState(employeeId, db))!;
  const dependenciesProposed = await ensureTemplateDependencies(state, db);
  if (dependenciesProposed) state = (await loadCaseState(employeeId, db))!;

  // 2. Deterministic detectors → findings (idempotent by fingerprint)
  const now = auditTimestamp();
  const candidates = runDetectors(state);
  const existing = new Map(state.findings.filter((f) => f.origin === "RULE" && f.fingerprint).map((f) => [f.fingerprint!, f]));
  const opened: string[] = [];
  const closed: string[] = [];
  for (const c of candidates) {
    const prior = existing.get(c.fingerprint);
    const data = {
      type: c.type, category: c.category, severity: c.severity, title: c.title, description: c.description,
      evidenceIds: toJson(c.evidenceIds), facts: toJson(c.facts), assumptions: toJson(c.assumptions),
      affectedEntities: toJson(c.affectedEntities), recommendedActions: toJson(c.recommendedActions), ownerRole: c.ownerRole, lastDetectedAt: now,
    };
    if (!prior) {
      const id = findingId(state.caseId, c.fingerprint);
      await db.finding.create({ data: { id, caseId: state.caseId, fingerprint: c.fingerprint, origin: "RULE", status: "OPEN", firstDetectedAt: now, ...data } });
      opened.push(c.title);
    } else if (prior.status === "OPEN") {
      await db.finding.update({ where: { id: prior.id }, data });
    } else if (prior.status === "RESOLVED" && prior.resolutionType === "CONDITION_CLEARED") {
      await db.finding.update({ where: { id: prior.id }, data: { ...data, status: "OPEN", resolvedAt: null, resolvedBy: null, resolutionType: null, resolution: null } });
      opened.push(`${c.title} (re-detected)`);
    }
    // Human-resolved or dismissed findings are left as decided.
  }
  const detected = new Set(candidates.map((c) => c.fingerprint));
  for (const [fp, f] of existing) {
    if (detected.has(fp) || f.status !== "OPEN" || f.category === "CONFLICT") continue; // conflicts are never auto-resolved
    await db.finding.update({ where: { id: f.id }, data: { status: "RESOLVED", resolvedAt: now, resolvedBy: "system", resolutionType: "CONDITION_CLEARED", resolution: `Condition no longer detected after: ${trigger}.` } });
    closed.push(f.title);
  }

  // 3. Readiness gates and assessed level (pure), persisted as a snapshot
  state = (await loadCaseState(employeeId, db))!;
  const result = evaluateReadiness(state);
  const gatesChanged = result.gates
    .map((g) => ({ id: g.id, before: previousGates.find((p) => p.id === g.id)?.status ?? "NONE", after: g.status }))
    .filter((g) => g.before !== g.after);
  const validation = latestValidation(state.validations);
  const openTypes = [...new Set(state.findings.filter((f) => f.status === "OPEN").map((f) => f.type))];
  await db.onboardingCase.update({
    where: { id: state.caseId },
    data: {
      assessedStatus: result.assessed,
      assessmentReason: result.assessedReasons.join(" "),
      assessmentAt: state.evaluationDate,
      gatesJson: toJson(result.gates),
      riskFlags: toJson(openTypes),
      validatedStatus: validation?.state === "APPROVED" && validation.validatedLevel ? validation.validatedLevel : "NOT_VALIDATED",
      lastRecomputedAt: now,
    },
  });
  if (levelBefore !== result.assessed || gatesChanged.length) {
    await db.readinessAssessment.create({
      data: {
        employeeId, status: result.assessed, explanation: result.assessedReasons.join(" "), gatesJson: toJson(result.gates), trigger,
        evidenceIds: toJson([...new Set(result.gates.flatMap((g) => g.evidenceIds))]), timestamp: now,
      },
    });
  }

  const summary: RecomputeSummary = { employeeId, trigger, levelBefore, levelAfter: result.assessed, gatesChanged, findingsOpened: opened, findingsClosed: closed, dependenciesProposed };
  await audit({
    actor, action: "STATE_RECOMPUTED", entityType: "OnboardingCase", entityId: state.caseId, employeeId,
    before: { level: levelBefore }, after: { level: result.assessed },
    details: `Recomputed after ${trigger}: level ${levelBefore} → ${result.assessed}; ${gatesChanged.length} gate change(s); ${opened.length} finding(s) opened; ${closed.length} cleared; ${dependenciesProposed} template dependency proposal(s).`,
  }, db);
  return summary;
}

export async function recomputeAll(trigger: string, actor: Actor, db: PrismaClient = prisma): Promise<RecomputeSummary[]> {
  const ids = await listCaseEmployeeIds(db, true);
  const out: RecomputeSummary[] = [];
  for (const id of ids) {
    const s = await recomputeCase(id, trigger, actor, db);
    if (s) out.push(s);
  }
  return out;
}
