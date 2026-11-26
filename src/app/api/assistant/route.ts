import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { runAgent } from "@/ai/runAgent";
import { verifyExcerpt } from "@/ai/verify";
import * as prompt from "@/ai/prompts/assistant";
import { READINESS_LABEL } from "@/domain/types";
import { loadCaseState, listCaseEmployeeIds } from "@/modules/case/loadCaseState";
import { evaluateReadiness } from "@/modules/readiness/evaluate";
import { prisma } from "@/lib/db";

const requestSchema = z.object({ question: z.string().trim().min(3).max(2000) });

export async function POST(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Enter a question between 3 and 2000 characters." }, { status: 400 });

  try {
    const session = await getSession();
    // Scope comes from the session: employees only ever see their own case.
    const ids = session.role === "EMPLOYEE" ? (session.employeeId ? [session.employeeId] : []) : await listCaseEmployeeIds();
    const states = (await Promise.all(ids.map((id) => loadCaseState(id)))).filter((s): s is NonNullable<typeof s> => Boolean(s));
    const sources = new Map<string, string>();
    const cases = states.map((s) => {
      const r = evaluateReadiness(s);
      for (const e of [...s.evidence, ...s.projectEvidence]) if (e.reviewStatus !== "REJECTED") sources.set(e.id, e.content);
      return {
        id: s.employee.id, name: s.employee.name, project: s.employee.projectName, reported: r.reported, assessed: READINESS_LABEL[r.assessed],
        validated: r.validated ? READINESS_LABEL[r.validated] : "Not validated",
        openFindings: s.findings.filter((f) => f.status === "OPEN").map((f) => f.title),
        access: s.access.map((a) => ({ application: a.application, status: a.status })),
        kt: s.kt.filter((k) => k.status === "CONFIRMED").map((k) => ({ title: k.title, stage: k.stage, basis: k.stageBasis })),
        sources: [...s.evidence, ...s.projectEvidence].filter((e) => e.reviewStatus !== "REJECTED").map((e) => ({ id: e.id, senderRole: e.senderRole, date: e.timestamp.slice(0, 10), content: e.content })),
      };
    });
    const resources = session.role === "EMPLOYEE" ? [] : await prisma.knowledgeResource.findMany({ select: { id: true, title: true, location: true, copyAllowed: true } });
    const context = JSON.stringify({ cases, knowledgeResources: resources });

    const outcome = await runAgent({
      agent: "assistant", promptVersion: prompt.PROMPT_VERSION, employeeId: session.role === "EMPLOYEE" ? session.employeeId : null,
      input: { question: parsed.data.question, context }, inputRefs: [...sources.keys()], system: prompt.SYSTEM,
      user: prompt.buildUser(parsed.data.question, context), schema: prompt.AssistantSchema, useCache: false,
    });
    if (!outcome.ok) {
      const status = outcome.run.status === "TIMEOUT" ? 504 : outcome.run.status === "UNAVAILABLE" ? 503 : 502;
      return NextResponse.json({ error: outcome.error, aiRunId: outcome.run.id }, { status });
    }
    const unknown = outcome.data.citations.filter((c) => !sources.has(c.evidenceId));
    if (unknown.length) {
      return NextResponse.json({ error: "The AI cited evidence that is not in the database. The answer was discarded; please retry.", aiRunId: outcome.run.id }, { status: 502 });
    }
    const verified = outcome.data.citations.filter((c) => verifyExcerpt(c.excerpt, sources.get(c.evidenceId)!));
    return NextResponse.json({
      answer: outcome.data.answer,
      citations: verified,
      evidenceIds: [...new Set(verified.map((c) => c.evidenceId))],
      droppedCitations: outcome.data.citations.length - verified.length,
      aiRunId: outcome.run.id,
      model: outcome.run.model,
    });
  } catch (error) {
    console.error("Assistant request failed", error);
    return NextResponse.json({ error: "Unable to answer from the database right now." }, { status: 500 });
  }
}
