import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { ACCESS, CASES, CLAIMS, EVIDENCE, KT, PROJECTS, ROLE_ONLY_PEOPLE, lineManagerId, trackerContent } from "./seed-data/official";
import {
  DEMO_USERS, SAMPLE_AM_BY_PROJECT, SAMPLE_NOTE, SAMPLE_PAST_ASSIGNMENTS, SAMPLE_PEOPLE, SAMPLE_PROJECTS, SAMPLE_TL_BY_PROJECT, employeePersonId, resolvePerson,
} from "./seed-data/sample";

if (existsSync(".env")) process.loadEnvFile(".env");

const SEED_AT = "2026-10-14T00:00:00.000Z";
const SEEDER = "seed";

/**
 * Idempotent seed: wipes and recreates the official starter-pack dataset (10 cases, 8 evidence items, verbatim),
 * maps it onto the organisation model, adds clearly labelled SAMPLE people/projects for roles the starter pack does
 * not name, then runs the deterministic recompute pipeline for every case.
 * Imports of src/ happen after env loading so the evaluation clock sees DEMO_EVALUATION_DATE.
 */
async function main() {
  const prisma = new PrismaClient();
  const { evidenceAuthority } = await import("../src/domain/authority");
  const { recomputeAll } = await import("../src/modules/case/recompute");
  const { SYSTEM_ACTOR, audit } = await import("../src/modules/audit");
  const { createDefaultChecklist } = await import("../src/modules/preboarding/service");

  try {
    // Children first (foreign keys).
    await prisma.auditLog.deleteMany();
    await prisma.aIRun.deleteMany();
    await prisma.communication.deleteMany();
    await prisma.briefing.deleteMany();
    await prisma.roadmapItem.deleteMany();
    await prisma.dependency.deleteMany();
    await prisma.actionItem.deleteMany();
    await prisma.readinessValidation.deleteMany();
    await prisma.readinessAssessment.deleteMany();
    await prisma.finding.deleteMany();
    await prisma.evidenceClaim.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.accessRequest.deleteMany();
    await prisma.kTActivity.deleteMany();
    await prisma.preboardingItem.deleteMany();
    await prisma.user.deleteMany();
    await prisma.onboardingCase.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.projectAssignment.deleteMany();
    await prisma.knowledgeResource.deleteMany();
    await prisma.person.deleteMany();
    await prisma.project.deleteMany();

    // Projects: official (Nimbus' code NIM-482 is quoted in EMAIL-001) plus two sample projects.
    await prisma.project.createMany({ data: PROJECTS.map((p) => ({ ...p, code: p.id === "NIMBUS" ? "NIM-482" : null, createdById: SEEDER, createdAt: SEED_AT })) });
    await prisma.project.createMany({ data: SAMPLE_PROJECTS.map((p) => ({ ...p, createdById: SEEDER, createdAt: SEED_AT })) });

    // People. Official line managers from the tracker's "Manager" column; role-only stakeholders from the evidence;
    // one person per official employee; then clearly labelled sample people.
    const managerNames = [...new Set(CASES.filter((c) => c.manager).map((c) => c.manager!))];
    await prisma.person.createMany({
      data: [
        ...managerNames.map((name) => {
          const c = CASES.find((x) => x.manager === name)!;
          return { id: lineManagerId(name), name, role: "LINE_MANAGER", projectId: c.project ? c.project.toUpperCase() : null, note: `Tracker "Manager" for ${c.id}` };
        }),
        ...ROLE_ONLY_PEOPLE.map((p) => ({ ...p, name: null })),
        ...CASES.map((c) => ({ id: employeePersonId(c.id), name: c.name, role: "EMPLOYEE", projectId: c.project ? c.project.toUpperCase() : null, note: `Employee in tracker row ${c.id}` })),
        ...SAMPLE_PEOPLE.map((p) => ({ ...p, isSimulated: true, note: SAMPLE_NOTE })),
      ],
    });

    for (const c of CASES) {
      const projectId = c.project ? c.project.toUpperCase() : null;
      await prisma.employee.create({
        data: {
          id: c.id, name: c.name, personId: employeePersonId(c.id), startDate: c.startIso, movement: c.movement, projectId,
          manager: c.manager, lineManagerId: c.manager ? lineManagerId(c.manager) : null, trackerStatus: c.status, lastUpdate: c.lastIso,
          technicalLeadId: c.project === "Orion" ? "P-TL-ORION" : null,
        },
      });
      // Phase: the tracker's "Pre-Onboarding" status maps to PRE_BOARDING; every other official case is ONBOARDING.
      const phase = c.status.toLowerCase().replace(/[^a-z]/g, "") === "preonboarding" ? "PRE_BOARDING" : "ONBOARDING";
      await prisma.onboardingCase.create({ data: { id: `CASE-${c.id}`, employeeId: c.id, phase, phaseChangedAt: SEED_AT, phaseChangedBy: "Starter pack tracker", ktOwnerId: c.project === "Orion" ? "P-TL-ORION" : null } });
      await prisma.evidence.create({
        data: {
          id: `TRACKER-${c.id}`, title: `Onboarding tracker entry · ${c.name}`, sourceType: "TRACKER", author: null, senderRole: "TRACKER",
          authorityLevel: "TRACKER", recipients: "[]", timestamp: c.lastIso, content: trackerContent(c), employeeId: c.id,
          projectId, caseId: `CASE-${c.id}`, sourceRef: "Starter pack §4", reviewStatus: "APPROVED", ingestedAt: "2026-10-14", ingestedBy: SEEDER,
        },
      });
    }

    // Assignments. Starter-pack facts: employee → project and "Manager" → Line Manager on that project.
    // Sample: Additional Managers, Technical Leads (except Orion's role-only one), Lumen/Cirrus and previous projects.
    const assignments: { projectId: string; personId: string; role: string; reportsToPersonId?: string | null; startDate?: string | null; endDate?: string | null; status?: string; movement?: string | null; isSimulated: boolean }[] = [];
    for (const [projectId, am] of Object.entries(SAMPLE_AM_BY_PROJECT)) {
      assignments.push({ projectId, personId: am, role: "ADDITIONAL_MANAGER", status: projectId === "CIRRUS" ? "COMPLETED" : "ACTIVE", endDate: projectId === "CIRRUS" ? "2026-10-03" : null, isSimulated: true });
    }
    for (const name of managerNames) {
      const c = CASES.find((x) => x.manager === name)!;
      if (!c.project) continue; // Nora's and Lina's managers: no project recorded, so no project assignment.
      const projectId = c.project.toUpperCase();
      assignments.push({ projectId, personId: lineManagerId(name), role: "LINE_MANAGER", reportsToPersonId: SAMPLE_AM_BY_PROJECT[projectId] ?? null, isSimulated: false });
    }
    for (const [projectId, tl] of Object.entries(SAMPLE_TL_BY_PROJECT)) assignments.push({ projectId, personId: tl, role: "TECH_LEAD", isSimulated: true });
    assignments.push({ projectId: "ORION", personId: "P-TL-ORION", role: "TECH_LEAD", isSimulated: false });
    // Lumen: Iva Duka is both Line Manager and Technical Lead (supported setup).
    assignments.push({ projectId: "LUMEN", personId: "P-S-IVA", role: "LINE_MANAGER", reportsToPersonId: "P-S-AM-MARCO", startDate: "2025-02-03", isSimulated: true });
    assignments.push({ projectId: "LUMEN", personId: "P-S-IVA", role: "TECH_LEAD", startDate: "2025-02-03", isSimulated: true });
    assignments.push({ projectId: "CIRRUS", personId: "P-S-IVA", role: "LINE_MANAGER", reportsToPersonId: "P-S-AM-ELENA", startDate: "2024-06-03", endDate: "2026-10-03", status: "COMPLETED", isSimulated: true });
    assignments.push({ projectId: "CIRRUS", personId: "P-S-TL-BEN", role: "TECH_LEAD", startDate: "2024-06-03", endDate: "2026-10-03", status: "COMPLETED", isSimulated: true });
    for (const c of CASES) {
      if (!c.project) continue;
      assignments.push({ projectId: c.project.toUpperCase(), personId: employeePersonId(c.id), role: "EMPLOYEE", reportsToPersonId: c.manager ? lineManagerId(c.manager) : null, startDate: c.startIso, movement: c.movement, isSimulated: false });
    }
    for (const p of SAMPLE_PAST_ASSIGNMENTS) {
      assignments.push({ projectId: p.projectId, personId: resolvePerson(p.person), role: "EMPLOYEE", reportsToPersonId: p.reportsTo, startDate: p.startDate, endDate: p.endDate, status: "COMPLETED", movement: "New Hire", isSimulated: true });
    }
    await prisma.projectAssignment.createMany({
      data: assignments.map((a) => ({ ...a, reportsToPersonId: a.reportsToPersonId ?? null, startDate: a.startDate ?? null, endDate: a.endDate ?? null, status: a.status ?? "ACTIVE", movement: a.movement ?? null, assignedById: SEEDER, assignedAt: SEED_AT })),
    });

    await prisma.user.createMany({
      data: DEMO_USERS.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, employeeId: "employeeId" in u ? u.employeeId : null, personId: resolvePerson(u.personId) })),
    });

    for (const e of EVIDENCE) {
      await prisma.evidence.create({
        data: {
          id: e.id, title: e.title, sourceType: e.sourceType, author: e.author, senderRole: e.senderRole, senderPersonId: e.senderPersonId,
          recipients: JSON.stringify(e.recipients), authorityLevel: evidenceAuthority(e.senderRole), timestamp: e.timestamp, content: e.content,
          employeeId: e.employeeId, projectId: e.projectId, caseId: e.employeeId ? `CASE-${e.employeeId}` : null, sourceRef: "Starter pack Appendix A",
          reviewStatus: "APPROVED", isRequest: e.isRequest ?? false, inReplyToId: e.inReplyToId ?? null, ingestedAt: "2026-10-14", ingestedBy: SEEDER,
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

    // Pre-boarding checklists for cases in pre-boarding. Statuses come only from tracker facts; everything else stays To do.
    for (const c of CASES) {
      const caseRow = await prisma.onboardingCase.findUniqueOrThrow({ where: { employeeId: c.id } });
      if (caseRow.phase !== "PRE_BOARDING") continue;
      await createDefaultChecklist(prisma, c.id, SYSTEM_ACTOR);
      await prisma.preboardingItem.update({
        where: { employeeId_templateKey: { employeeId: c.id, templateKey: "start-date" } },
        data: { status: "DONE", evidenceId: `TRACKER-${c.id}`, note: `Start ${c.start} and movement "${c.movement}" are recorded in the tracker.`, updatedBy: "Starter pack tracker" },
      });
      if (c.manager) {
        await prisma.preboardingItem.update({
          where: { employeeId_templateKey: { employeeId: c.id, templateKey: "contacts" } },
          data: { status: "IN_PROGRESS", evidenceId: `TRACKER-${c.id}`, note: `Line Manager named in the tracker (${c.manager}); Technical Lead and KT owner not named.`, updatedBy: "Starter pack tracker" },
        });
      }
    }

    const summaries = await recomputeAll("seed", SYSTEM_ACTOR, prisma);
    await audit({ actor: SYSTEM_ACTOR, action: "SEED_COMPLETE", entityType: "SYSTEM", entityId: "ONBOARDIQ", details: `Seeded ${CASES.length} official cases, ${EVIDENCE.length} verbatim evidence sources and ${CLAIMS.length} transcribed claims; ${assignments.length} project assignments (sample ones labelled); recomputed ${summaries.length} cases.` }, prisma);
    for (const s of summaries) console.log(`${s.employeeId}: ${s.levelAfter} · ${s.findingsOpened.length} findings`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
