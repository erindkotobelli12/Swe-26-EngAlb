import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { can } from "@/modules/permissions";
import { getScope } from "@/server/principal";
import { parseJson } from "@/lib/json";
import { getLLMStatus } from "@/ai/providers";
import { Card, EmptyState } from "@/components/ui/badges";

/** AI transparency log: every agent call with model, prompt version, input IDs, status and output. */
export default async function AIActivityPage() {
  if (!can(await getScope(), "audit.view")) redirect("/");
  const [runs, status] = await Promise.all([prisma.aIRun.findMany({ orderBy: { createdAt: "desc" }, take: 100 }), getLLMStatus()]);
  return (
    <div className="px-5 py-6 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Transparency log</p>
        <h1 className="mt-1 text-2xl font-bold">AI activity</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Every call to the local model is logged with its agent, model, prompt version, the IDs it was given (never full data dumps), the raw validated output and the outcome. Failed calls are shown, never hidden or replaced with scripted output.</p>
      </header>
      <div className="mt-4"><Card title="Local model">
        <p className="text-sm">{status.available ? `Ready: ${status.model} via local Ollama (loopback only — data never leaves this machine).` : status.message}</p>
      </Card></div>
      <div className="mt-4 space-y-3">
        {runs.length ? runs.map((r) => (
          <details key={r.id} id={r.id} className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
              <span><b className="capitalize">{r.agent.replaceAll("_", " ")}</b> · {r.model} · {r.promptVersion}{r.employeeId ? ` · ${r.employeeId}` : ""}</span>
              <span className="flex items-center gap-3 text-xs"><span className={r.status === "OK" ? "font-bold text-emerald-700" : "font-bold text-red-700"}>{r.status}</span><span className="text-slate-500">{(r.durationMs / 1000).toFixed(1)} s · {new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</span></span>
            </summary>
            <p className="mt-2 text-xs text-slate-500">Run {r.id} · input hash {r.inputHash.slice(0, 12)} · input IDs: {parseJson(r.inputRefs, [] as string[]).join(", ") || "none"}</p>
            {r.error && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-800">{r.error}</p>}
            {r.output && <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(JSON.parse(r.output), null, 2)}</pre>}
          </details>
        )) : <EmptyState title="No AI runs yet">Agents run only on explicit user actions such as Investigate, Extract claims or Draft follow-ups.</EmptyState>}
      </div>
    </div>
  );
}
