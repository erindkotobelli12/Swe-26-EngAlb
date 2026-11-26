import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CheckCircle2, Clock3, TriangleAlert } from "lucide-react";
export default async function Workspace(){
  const session=await getSession();
  const employee=await prisma.employee.findUnique({where:{id:session.role==="EMPLOYEE"?"ONB-001":"ONB-001"},include:{access:true,activities:true,project:true}});
  return <div className="px-5 py-6 md:px-8"><header><p className="text-sm text-slate-500">Personal onboarding journey</p><h1 className="mt-1 text-2xl font-bold">My workspace</h1></header><section className="mt-5 grid gap-5 lg:grid-cols-3"><article className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">What to do next</h2><div className="mt-4 flex gap-3 text-sm"><Clock3 className="text-indigo-600" size={18}/><span>Complete onboarding activities assigned to you.</span></div></article><article className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Access waiting</h2><div className="mt-4 space-y-2">{employee?.access.length?employee.access.map(a=><p key={a.id} className="text-sm">{a.application} — {a.status}</p>):<p className="text-sm text-slate-500">No access requests recorded for this demo employee.</p>}</div></article><article className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Readiness expectations</h2><p className="mt-4 text-sm text-slate-600">Independent readiness requires confirmed scope, usable access, required KT completion and Technical Lead validation.</p></article></section></div>
}
