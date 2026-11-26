import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { AIConfigurationError, AIResponseError, getAIProvider } from "@/ai/providers";

const requestSchema = z.object({ question: z.string().trim().min(3).max(2000) });

export async function POST(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a question between 3 and 2000 characters." }, { status: 400 });
  }

  try {
    const session = await getSession();
    const employeeFilter = session.role === "EMPLOYEE" ? { id: "ONB-001" } : {};
    const employees = await prisma.employee.findMany({
      where: employeeFilter,
      include: {
        project: true,
        case: { include: { findings: { where: { status: "OPEN" } } } },
        access: true,
        activities: true,
        evidence: true,
      },
      orderBy: { name: "asc" },
    });
    const resources = await prisma.knowledgeResource.findMany({ include: { project: true } });
    const context = JSON.stringify({
      employees: employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        project: employee.project?.name ?? null,
        reportedStatus: employee.trackerStatus,
        assessedStatus: employee.case?.assessedStatus ?? "UNKNOWN",
        riskFlags: employee.case?.riskFlags ?? "[]",
        findings: employee.case?.findings.map(({ id, type, title, description, evidenceIds }) => ({ id, type, title, description, evidenceIds })) ?? [],
        access: employee.access.map(({ application, status, blockerReason, evidenceId }) => ({ application, status, blockerReason, evidenceId })),
        activities: employee.activities.map(({ title, stage, validation, requiredForReady }) => ({ title, stage, validation, requiredForReady })),
        evidence: employee.evidence.map(({ id, title, timestamp, author, content }) => ({ id, title, timestamp, author, content })),
      })),
      knowledgeResources: resources.map(({ id, title, description, location, owner, project }) => ({ id, title, description, location, owner, project: project?.name ?? null })),
    });
    const knownEvidenceIds = new Set(employees.flatMap((employee) => employee.evidence.map((item) => item.id)));
    const answer = await getAIProvider().answerQuestion(parsed.data.question, context);
    const unknownEvidenceIds = answer.evidenceIds.filter((id) => !knownEvidenceIds.has(id));
    if (unknownEvidenceIds.length) {
      return NextResponse.json({ error: "The AI returned evidence references that are not in the database. Please retry." }, { status: 502 });
    }
    return NextResponse.json({ answer: answer.answer, evidenceIds: answer.evidenceIds });
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return NextResponse.json({ error: error.message, code: "AI_NOT_CONFIGURED" }, { status: 503 });
    }
    if (error instanceof AIResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Assistant request failed", error);
    return NextResponse.json({ error: "Unable to answer from the database right now." }, { status: 500 });
  }
}
