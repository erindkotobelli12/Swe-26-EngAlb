import Link from "next/link";
import { prisma } from "@/lib/db";
import { detectGaps } from "@/modules/findings/gapEngine";
import { assessEmployee } from "@/modules/readiness/assessment";
import { AlertTriangle, Users, ShieldAlert, GitCompareArrows } from "lucide-react";
import DashboardEmployeeTable from "@/components/DashboardEmployeeTable";

export default async function Dashboard(){
  await detectGaps();
  const [employees,findings] = await Promise.all([
    prisma.employee.findMany({include:{project:true,case:true,activities:true}}),
    prisma.finding.findMany({where:{status:"OPEN"}}),
  ]);
  const intervention = findings.filter(f=>["CRITICAL","HIGH"].includes(f.severity)).length;
  const access = findings.filter(f=>f.type.includes("ACCESS")).length;
  const stale = findings.filter(f=>f.type==="STALE_UPDATE").length;
  const conflicts = findings.filter(f=>f.type==="CONFLICTING_READINESS").length;
  const cards=[
    ["Total cases",employees.length,Users,"text-indigo-600"],
    ["Need intervention",intervention,AlertTriangle,"text-amber-600"],
    ["Access blockers",access,ShieldAlert,"text-red-600"],
    ["Missing or conflicting",findings.filter(f=>f.type.includes("MISSING")||f.type.includes("CONFLICT")).length,GitCompareArrows,"text-violet-600"],
  ] as const;
  return <div className="px-5 py-6 md:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-medium text-slate-500">PMO overview</p><h1 className="mt-1 text-2xl font-bold">Onboarding command center</h1></div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Evaluation date <b className="ml-2 text-slate-800">14 Oct 2026</b></div>
    </header>
    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,Icon,color])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><Icon size={18} className={color}/></div><p className="mt-3 text-3xl font-bold">{value}</p>
    </div>)}</section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="xl:col-span-1">
        <DashboardEmployeeTable employees={employees.map(e=>{
            const fs=findings.filter(f=>f.caseId===e.case?.id);
            const risk=fs.length?fs.map(f=>f.severity==="CRITICAL"?"Critical":f.severity==="HIGH"?"High":"Warning").slice(0,2).join(", "):"Clear";
            const a=assessEmployee({id:e.id,trackerStatus:e.trackerStatus,accessUsable:0,accessRequired:e.id==="ONB-002"?3:0,requiredActivities:0,completedActivities:0,technicalValidation:"PENDING",hasMaterialConflict:e.id==="ONB-005"});
            return {id:e.id,name:e.name,movement:e.movement,project:e.project?.name??"Unknown",reported:e.trackerStatus,assessed:a.status.replaceAll("_"," "),risk,lastUpdate:e.lastUpdate};
          })} />
      </div>
      <aside className="space-y-5"><div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-bold">Priority actions</h2><div className="mt-3 space-y-3"><Link href="/actions" className="block rounded-lg border-l-4 border-red-500 bg-red-50 p-3"><b className="text-sm">Resolve Eva readiness conflict</b><p className="mt-1 text-xs text-slate-500">Technical Lead review · {conflicts} finding</p></Link><Link href="/actions" className="block rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3"><b className="text-sm">Resolve Leo access blockers</b><p className="mt-1 text-xs text-slate-500">Access owner · 3 requests</p></Link></div></div><div className="rounded-xl border border-slate-200 bg-indigo-950 p-4 text-white"><p className="text-xs font-bold uppercase text-indigo-200">AI evidence summary</p><p className="mt-3 text-sm leading-6">Eva has a material readiness conflict. Leo has active, pending and unprovisioned access accounts. Lina is awaiting a PMO follow-up.</p><Link href="/assistant" className="mt-3 inline-block text-xs font-bold text-indigo-200">Open assistant →</Link></div></aside>
    </section>
  </div>;
}
