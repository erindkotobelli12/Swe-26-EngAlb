import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/clock";
import { label, humanize } from "@/lib/labels";
import { can } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { getLLMStatus } from "@/ai/providers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, EmptyState, InternalId, LinkTabs, StatusPill } from "@/components/ui/primitives";

/**
 * Audit & AI log. The audit log records every change with who, when, before and after; the AI log records every agent
 * call (model, prompt version, input IDs, outcome). PMO sees everything; a Technical Lead sees entries for their cases.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const scope = await getScope();
  if (!can(scope, "audit.view")) redirect("/");
  const tab = (await searchParams).tab === "ai" ? "ai" : "audit";
  const ids = Object.keys(scope.cases);
  const where = scope.isPMO ? {} : { employeeId: { in: ids } };
  const [entries, runs, status, names] = await Promise.all([
    prisma.auditLog.findMany({ where: { ...where, action: { not: "STATE_RECOMPUTED" } }, orderBy: { timestamp: "desc" }, take: 150 }),
    tab === "ai" ? prisma.aIRun.findMany({ where: scope.isPMO ? {} : { OR: [{ employeeId: { in: ids } }, { employeeId: null }] }, orderBy: { createdAt: "desc" }, take: 100 }) : Promise.resolve([]),
    tab === "ai" ? getLLMStatus() : Promise.resolve(null),
    prisma.employee.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(names.map((n) => [n.id, n.name]));

  return (
    <>
      <PageHeader title="Audit & AI log" subtitle="Every change with who, when and what it was before and after; every AI call with its model and outcome." breadcrumbs={[{ label: "Audit & AI log" }]} />
      <div className="mb-6"><LinkTabs current={tab} tabs={[{ id: "audit", label: "Changes", href: "/ai-activity" }, { id: "ai", label: "AI calls", href: "/ai-activity?tab=ai" }]} /></div>

      {tab === "audit" && (entries.length ? (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="px-5 py-3 text-sm">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2">
                    <span><span className="font-medium text-ink">{label("audit", e.action)}</span>{e.employeeId && <> · <Link href={`/employees/${e.employeeId}?tab=history`} className="text-brand-700 hover:underline">{nameOf.get(e.employeeId) ?? "Case"}</Link></>}<span className="block text-muted">{e.details}</span></span>
                    <span className="text-xs text-subtle">{e.actorLabel ?? "Unknown"} · {formatDate(e.timestamp)}</span>
                  </summary>
                  <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                    {e.before && <pre className="overflow-auto rounded-md bg-canvas p-2 text-muted">Before: {e.before}</pre>}
                    {e.after && <pre className="overflow-auto rounded-md bg-canvas p-2 text-muted">After: {e.after}</pre>}
                    <p className="text-subtle md:col-span-2"><InternalId>{e.entityType} {e.entityId}</InternalId></p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      ) : <EmptyState title="No changes recorded yet." />)}

      {tab === "ai" && (
        <div className="space-y-3">
          <Card title="Local model"><p className="text-sm text-body">{status?.available ? `Ready: ${status.model} via local Ollama. Data never leaves this machine.` : status?.message}</p></Card>
          {runs.length ? runs.map((r) => (
            <details key={r.id} id={r.id} className="scroll-mt-20 rounded-card border border-line bg-surface p-4 shadow-soft">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-sm">
                <span><span className="font-medium text-ink">{humanize(r.agent)}</span><span className="text-muted"> · {r.model}{r.employeeId ? ` · ${nameOf.get(r.employeeId) ?? "case"}` : ""}</span></span>
                <span className="flex items-center gap-2 text-xs text-subtle"><StatusPill tone={r.status === "OK" || r.status === "SUCCESS" ? "green" : r.status === "CACHED" ? "slate" : "red"} dot={false}>{humanize(r.status)}</StatusPill>{formatDate(r.createdAt)} · {r.durationMs} ms</span>
              </summary>
              <p className="mt-2 text-xs text-subtle">Prompt <InternalId>{r.promptVersion}</InternalId> · run <InternalId>{r.id}</InternalId> · inputs <InternalId>{r.inputRefs}</InternalId></p>
              {r.error && <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-800">{r.error}</p>}
              {r.output && <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(JSON.parse(r.output), null, 2)}</pre>}
            </details>
          )) : <EmptyState title="No AI calls yet.">Agents run only when someone asks, for example Investigate or Draft follow-ups.</EmptyState>}
        </div>
      )}
    </>
  );
}
