import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { assessEmployee } from "@/modules/readiness/assessment";
import { ShieldCheck, AlertTriangle, CheckCircle2, Circle, ClipboardCheck } from "lucide-react";
import Link from "next/link";

export default async function EmployeeDetail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const employee=await prisma.employee.findUnique({where:{id},include:{project:true,case:{include:{findings:true,validations:true}},access:true,activities:true,evidence:true}});
  if(!employee) notFound();
  const assessment=assessEmployee({id,trackerStatus:employee.trackerStatus,accessUsable:employee.access.filter(a=>a.status==="USABLE").length,accessRequired:employee.access.length,requiredActivities:employee.activities.filter(a=>a.requiredForReady).length,completedActivities:employee.activities.filter(a=>a.stage==="INDEPENDENT_EXECUTION").length,technicalValidation:employee.activities.some(a=>a.validation==="APPROVED")?"APPROVED":"PENDING",hasMaterialConflict:employee.case?.findings.some(f=>f.type==="CONFLICTING_READINESS")??false});
  const isEva=id==="ONB-005";
  return <div className="px-5 py-6 md:px-8">
    <div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Employee case · {id}</p><h1 className="mt-1 text-2xl font-bold">{employee.name}</h1></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700">{assessment.status.replaceAll("_"," ")}</span></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Explain my readiness</h2><p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{assessment.explanation}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2"><div><p className="text-xs font-bold uppercase text-slate-400">Reported status</p><p className="mt-1 font-semibold">{employee.trackerStatus}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Project</p><p className="mt-1 font-semibold">{employee.project?.name ?? "Unknown"}</p></div></div>
        <h3 className="mt-6 font-bold">Readiness evidence</h3><div className="mt-3 space-y-2">{employee.evidence.map(e=><div key={e.id} className="flex gap-3 rounded-lg border border-slate-100 p-3"><ClipboardCheck size={17} className="mt-0.5 text-indigo-600"/><div><b className="text-sm">{e.title}</b><p className="mt-1 text-xs text-slate-500">{e.id} · {e.timestamp} · {e.author}</p></div></div>)}</div>
      </section>
      <aside className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Risk flags</h2><div className="mt-3 space-y-2">{assessment.risks.map(r=><div key={r} className="flex items-center gap-2 text-sm font-medium text-amber-700"><AlertTriangle size={16}/>{r.replaceAll("_"," ")}</div>)}</div></section>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Access</h2><div className="mt-3 space-y-3">{employee.access.length?employee.access.map(a=><div key={a.id} className="text-sm"><div className="flex justify-between"><b>{a.application}</b><span className={a.status==="USABLE"?"text-green-600":"text-amber-600"}>{a.status}</span></div>{a.blockerReason&&<p className="mt-1 text-xs text-slate-500">{a.blockerReason}</p>}</div>):<p className="text-sm text-slate-500">No access requests recorded.</p>}</div></section>
      </aside>
    </div>
    {isEva&&<section className="mt-5 rounded-xl border-2 border-indigo-100 bg-white p-5">    <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-indigo-600">Readiness Conflict Center</p><h2 className="mt-1 text-xl font-bold">Eva readiness reports</h2></div><Link href="/evidence" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Attach evidence</Link></div><div className="mt-4 grid gap-4 md:grid-cols-2">
      <article className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">EMAIL-003 · Technical Lead · 13 Oct 2026</p><p className="mt-3 text-lg font-bold text-amber-700">Ready with Support</p><blockquote className="mt-3 border-l-4 border-amber-300 pl-3 text-sm">“Eva handles standard requests with occasional support; two complex scenarios remain.”</blockquote></article>
      <article className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">EMAIL-004 · Line Manager · 13 Oct 2026</p><p className="mt-3 text-lg font-bold text-slate-700">Independent claim</p><blockquote className="mt-3 border-l-4 border-slate-300 pl-3 text-sm">“Eva appears independent and the manager considers onboarding closed.”</blockquote></article>
    </div><p className="mt-4 text-sm text-slate-600"><b>Contradiction:</b> one role expects support for complex work while the manager asserts closure. The conflict remains unresolved until technical evidence is reviewed.</p></section>}
  </div>;
}
