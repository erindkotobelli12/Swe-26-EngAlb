import { prisma } from "@/lib/db";
import { Library, MapPin } from "lucide-react";
export default async function KnowledgePage(){
  const resources=await prisma.knowledgeResource.findMany({include:{project:true}});
  return <div className="px-5 py-6 md:px-8"><header><p className="text-sm text-slate-500">Searchable index</p><h1 className="mt-1 text-2xl font-bold">Knowledge repository</h1></header><div className="mt-5 grid gap-3 md:grid-cols-2">{resources.map(r=><article key={r.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex gap-3"><Library className="text-indigo-600"/><div><h2 className="font-bold">{r.title}</h2><p className="mt-1 text-xs text-slate-500">{r.project?.name ?? "Cross-project"} · Owner: {r.owner}</p><p className="mt-3 text-sm text-slate-600">{r.description}</p><p className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-500"><MapPin size={13}/>{r.location}</p></div></div></article>)}</div></div>
}
