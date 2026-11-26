import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { ACCESS, CASES, CLAIMS, EVIDENCE, KT, PROJECTS, ROLE_ONLY_PEOPLE, lineManagerId, trackerContent } from "./seed-data/official";

if (existsSync(".env")) process.loadEnvFile(".env");

/**
 * Idempotent seed: wipes and recreates the official starter-pack dataset, then runs the deterministic
 * recompute pipeline for every case (findings, template proposals, readiness snapshots).
 * Imports of src/ happen after env loading so the evaluation clock sees DEMO_EVALUATION_DATE.
 */
async function main() {
  const prisma = new PrismaClient();
  const { evidenceAuthority } = await import("../src/domain/authority");
  const { recomputeAll } = await import("../src/modules/case/recompute");
  const { SYSTEM_ACTOR, audit } = await import("../src/modules/audit");

  try {
    // Children first (foreign keys).
    await prisma.auditLog.deleteMany();
    await prisma.aIRun.deleteMany();
    await prisma.dependency.deleteMany();
    await prisma.actionItem.deleteMany();
    await prisma.readinessValidation.deleteMany();
    await prisma.readinessAssessment.deleteMany();
    await prisma.finding.deleteMany();
    await prisma.evidenceClaim.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.accessRequest.deleteMany();
    await prisma.kTActivity.deleteMany();
    await prisma.user.deleteMany();
    await prisma.onboardingCase.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.knowledgeResource.deleteMany();
    await prisma.person.deleteMany();
    await prisma.project.deleteMany();

    await prisma.project.createMany({ data: PROJECTS });

    // People: named line managers from the tracker; everyone else is role-only.
    const managers = CASES.filter((c) => c.manager).map((c) => ({ id: lineManagerId(c.manager!), name: c.manager!, role: "LINE_MANAGER", projectId: c.project ? c.project.toUpperCase() : null, note: `Tracker "Manager" for ${c.id}` }));
    await prisma.person.createMany({ data: [...managers, ...ROLE_ONLY_PEOPLE.map((p) => ({ ...p, name: null }))] });

    for (const c of CASES) {
      await prisma.employee.create({
        data: {
          id: c.id, name: c.name, startDate: c.startIso, movement: c.movement, projectId: c.project ? c.project.toUpperCase() : null,
          manager: c.manager, lineManagerId: c.manager ? lineManagerId(c.manager) : null, trackerStatus: c.status, lastUpdate: c.lastIso,
          technicalLeadId: c.project === "Orion" ? "P-TL-ORION" : null,
        },
      });
      await prisma.onboardingCase.create({ data: { id: `CASE-${c.id}`, employeeId: c.id, ktOwnerId: c.project === "Orion" ? "P-TL-ORION" : null } });
      await prisma.evidence.create({
        data: {
          id: `TRACKER-${c.id}`, title: `Onboarding tracker entry · ${c.id}`, sourceType: "TRACKER", author: null, senderRole: "TRACKER",
          authorityLevel: "TRACKER", recipients: "[]", timestamp: c.lastIso, content: trackerContent(c), employeeId: c.id,
          projectId: c.project ? c.project.toUpperCase() : null, caseId: `CASE-${c.id}`, sourceRef: "Starter pack §4", reviewStatus: "APPROVED", ingestedAt: "2026-10-14", ingestedBy: "seed",
        },
      });
    }

    await prisma.user.createMany({
      data: [
        { id: "demo-pmo", name: "PMO Coordinator (demo user)", email: "pmo@onboardiq.demo", role: "PMO", personId: "P-PMO" },
        { id: "demo-tl", name: "Technical Lead (demo user)", email: "tl@onboardiq.demo", role: "TECH_LEAD" },
        { id: "demo-lm", name: "Line Manager (demo user)", email: "lm@onboardiq.demo", role: "LINE_MANAGER" },
        { id: "demo-mgmt", name: "Management (demo user)", email: "management@onboardiq.demo", role: "MANAGEMENT" },
        { id: "employee-mila", name: "Mila Rowan", email: "mila@onboardiq.demo", role: "EMPLOYEE", employeeId: "ONB-001" },
        { id: "employee-leo", name: "Leo Marin", email: "leo@onboardiq.demo", role: "EMPLOYEE", employeeId: "ONB-002" },
      ],
    });

    for (const e of EVIDENCE) {
      await prisma.evidence.create({
        data: {
          id: e.id, title: e.title, sourceType: e.sourceType, author: e.author, senderRole: e.senderRole, senderPersonId: e.senderPersonId,
          recipients: JSON.stringify(e.recipients), authorityLevel: evidenceAuthority(e.senderRole), timestamp: e.timestamp, content: e.content,
          employeeId: e.employeeId, projectId: e.projectId, caseId: e.employeeId ? `CASE-${e.employeeId}` : null, sourceRef: "Starter pack Appendix A",
          reviewStatus: "APPROVED", isRequest: e.isRequest ?? false, inReplyToId: e.inReplyToId ?? null, ingestedAt: "2026-10-14", ingestedBy: "seed",
        },
      });
    }
    for (const cl of CLAIMS) {
      const source = EVIDENCE.find((e) => e.id === cl.evidenceId)!;
      if (!source.content.includes(cl.excerpt)) throw new Error(`Seed excerpt is not verbatim: ${cl.evidenceId} "${cl.excerpt}"`);
      await prisma.evidenceClaim.create({
        data: { evidenceId: cl.evidenceId, entity: cl.entity, field: cl.field, extractedValue: cl.value, excerpt: cl.excerpt, excerptVerified: true, effectiveDate: cl.effectiveDate, origin: "SEED", reviewStatus: "APPROVED", reviewerId: null, reviewedAt: "2026-10-14", reviewReason: "Transcribed from the starter pack at seed time" },
      });
    }

    for (const a of ACCESS) await prisma.accessRequest.create({ data: { ...a } });
    for (const k of KT) await prisma.kTActivity.create({ data: { ...k, status: "CONFIRMED", origin: "EVIDENCE", requiredForReady: true, validation: "PENDING" } });

    await prisma.knowledgeResource.create({
      data: {
        id: "RES-ATLAS", title: "Atlas training guide and runbook (reference only)", projectId: "ATLAS", owner: "KT Owner — Atlas (name not recorded)",
        description: "Project-owned documents. Only the folder reference is stored; the documents must not be copied outside that location.",
        location: "/Team/Operations/Onboarding", applicableRoles: "[]", copyAllowed: false, sourceEvidenceId: "EMAIL-008",
      },
    });

    const summaries = await recomputeAll("seed", SYSTEM_ACTOR, prisma);
    await audit({ actor: SYSTEM_ACTOR, action: "SEED_COMPLETE", entityType: "SYSTEM", entityId: "ONBOARDIQ", details: `Seeded ${CASES.length} official cases, ${EVIDENCE.length} verbatim evidence sources and ${CLAIMS.length} transcribed claims; recomputed ${summaries.length} cases.` }, prisma);
    for (const s of summaries) console.log(`${s.employeeId}: ${s.levelAfter} · ${s.findingsOpened.length} findings`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
