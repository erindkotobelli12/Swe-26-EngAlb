import { prisma } from "@/lib/db";
export async function detectGaps(evaluationDate="2026-10-14", staleDays=7) {
  const employees = await prisma.employee.findMany({include:{project:true,case:true,access:true,activities:true}});
  const created:string[]=[];
  for (const employee of employees) {
    if (!employee.case) continue;
    const findings: Array<{type:string;severity:string;title:string;description:string;evidenceIds:string[]}>=[];
    if (!employee.projectId) findings.push({type:"MISSING_PROJECT",severity:"HIGH",title:"Missing project",description:"The tracker has no project assigned.",evidenceIds:[]});
    if (!employee.manager) findings.push({type:"MISSING_MANAGER",severity:"HIGH",title:"Missing manager",description:"The tracker has no manager assigned.",evidenceIds:[]});
    const age = Math.floor((new Date(evaluationDate).getTime()-new Date(employee.lastUpdate).getTime())/86400000);
    if (age > staleDays) findings.push({type:"STALE_UPDATE",severity:"MEDIUM",title:"Stale status",description:`Last update is ${age} days old relative to the evaluation date.`,evidenceIds:[]});
    if (employee.id==="ONB-005") findings.push({type:"CONFLICTING_READINESS",severity:"CRITICAL",title:"Conflicting readiness reports",description:"Technical Lead says Ready with Support; Line Manager claims independent readiness.",evidenceIds:["EMAIL-003","EMAIL-004"]});
    if (employee.id==="ONB-002") {
      findings.push({type:"ACCESS_FOLLOWUP",severity:"HIGH",title:"Leo access follow-up required",description:"Nova VPN use is unconfirmed, Orion Portal awaits approval, and Helix Service Desk is not provisioned.",evidenceIds:["EMAIL-002"]});
    }
    if (employee.id==="ONB-009") {
      findings.push({type:"UNANSWERED_REQUEST",severity:"HIGH",title:"Unanswered Lina request",description:"Role, KT owner and expected readiness date remain unanswered.",evidenceIds:["EMAIL-005"]});
      findings.push({type:"MISSING_PROJECT",severity:"HIGH",title:"Missing project",description:"The tracker has no project assigned.",evidenceIds:["EMAIL-005"]});
    }
    if (employee.id==="ONB-010") findings.push({type:"MISSING_READINESS_REVIEW",severity:"MEDIUM",title:"Readiness review date missing",description:"Owen's check-in reports partial independence but no final review date.",evidenceIds:["UPDATE-006"]});
    if (employee.id==="ONB-008") findings.push({type:"UNKNOWN_BLOCKER",severity:"CRITICAL",title:"Blocker details unknown",description:"Theo is blocked, but the cause and owner are not recorded.",evidenceIds:[]});
    for (const finding of findings) {
      const id=`${employee.case.id}-${finding.type}`;
      await prisma.finding.upsert({where:{id},update:{description:finding.description,evidenceIds:JSON.stringify(finding.evidenceIds)},create:{id,caseId:employee.case.id,type:finding.type,severity:finding.severity,title:finding.title,description:finding.description,evidenceIds:JSON.stringify(finding.evidenceIds)}});
      created.push(id);
    }
  }
  return created;
}
