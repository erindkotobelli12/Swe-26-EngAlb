import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.actionItem.deleteMany();
  await prisma.readinessValidation.deleteMany();
  await prisma.readinessAssessment.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.evidenceClaim.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.accessRequest.deleteMany();
  await prisma.kTActivity.deleteMany();
  await prisma.onboardingCase.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.project.deleteMany();
  await prisma.knowledgeResource.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  const projects = ["Aurora","Nimbus","Helios","Orion","Atlas","Nova","Pulse","Vega"].map(name => ({id:name.toUpperCase(), name}));
  await prisma.project.createMany({data: projects});

  const cases = [
    ["ONB-001","Mila Rowan","2026-10-05","New Hire","AURORA","Jon Vale","Shadowing","2026-10-13"],
    ["ONB-002","Leo Marin","2026-10-07","Reallocation","NIMBUS","Sara Neri","Access Pending","2026-10-14"],
    ["ONB-003","Nora Venn","2026-09-28","New Hire",null,"Tomas Reed","On Track","2026-09-30"],
    ["ONB-004","Aron Bell","2026-10-01","Reallocation","HELIOS",null,"KT Started","2026-10-11"],
    ["ONB-005","Eva Stone","2026-09-21","New Hire","ORION","Luca Gray","Ready with Support","2026-10-13"],
    ["ONB-006","Noah Lane","2026-10-12","New Hire","ATLAS","Maya Ford","Pre-Onboarding","2026-10-12"],
    ["ONB-007","Iris Moon","2026-09-15","Reallocation","NOVA","Rita Cole","On Track","2026-09-20"],
    ["ONB-008","Theo Park","2026-10-03","New Hire","PULSE","Mark Hale","Blocked","2026-10-14"],
    ["ONB-009","Lina West","2026-10-06","Reallocation",null,"Nina Cross","KT Started","2026-10-09"],
    ["ONB-010","Owen Hart","2026-09-29","New Hire","VEGA","Alex North","Partially Ready","2026-10-14"],
  ] as const;

  for (const [id,name,start,movement,projectId,manager,status,lastUpdate] of cases) {
    await prisma.employee.create({data:{id,name,startDate:start,movement,projectId,manager,trackerStatus:status,lastUpdate}});
    await prisma.onboardingCase.create({data:{id:`CASE-${id}`,employeeId:id,assessedStatus:"UNKNOWN",validatedStatus:"UNKNOWN",riskFlags:"[]",assessmentAt:"2026-10-14"}});
  }

  await prisma.user.createMany({ data: [
    { id:"demo-pmo", name:"Jordan PMO", email:"jordan@onboardiq.demo", role:"PMO" },
    { id:"demo-tl", name:"Sam Technical Lead", email:"sam@onboardiq.demo", role:"TECH_LEAD" },
    { id:"employee-mila", name:"Mila Rowan", email:"mila@onboardiq.demo", role:"EMPLOYEE", employeeId:"ONB-001" },
  ] });

  await prisma.accessRequest.createMany({data:[
    {id:"ACC-LEO-NOVA",employeeId:"ONB-002",application:"Nova VPN",requiredScope:"VPN access for project work",status:"PROVISIONED",blockerReason:"Successful use has not been confirmed",evidenceId:"EMAIL-002",lastUpdate:"2026-10-14",nextFollowUp:"2026-10-15"},
    {id:"ACC-LEO-ORION",employeeId:"ONB-002",application:"Orion Portal",requiredScope:"Application portal access",status:"APPROVAL_PENDING",owner:"Application owner",blockerReason:"Awaiting application-owner approval",evidenceId:"EMAIL-002",lastUpdate:"2026-10-14",nextFollowUp:"2026-10-15"},
    {id:"ACC-LEO-HELIX",employeeId:"ONB-002",application:"Helix Service Desk",requiredScope:"Service desk operations",status:"NOT_REQUESTED",blockerReason:"Not provisioned",evidenceId:"EMAIL-002",lastUpdate:"2026-10-14",nextFollowUp:"2026-10-15"},
  ]});

  await prisma.kTActivity.createMany({data:[
    {id:"KT-EVA-1",employeeId:"ONB-005",title:"Standard requests",description:"Handle standard service requests",scope:"Standard request scenarios",owner:"Technical Lead",stage:"SUPPORTED_EXECUTION",validation:"APPROVED",requiredForReady:true,evidenceId:"EMAIL-003"},
    {id:"KT-EVA-2",employeeId:"ONB-005",title:"Complex scenarios",description:"Complete two complex scenarios",scope:"Complex service scenarios",stage:"NOT_STARTED",validation:"PENDING",requiredForReady:true,evidenceId:"EMAIL-003"},
  ]});

  const evidence = [
    ["EMAIL-001","EMAIL","Leo Marin","2026-10-07","Leo's VPN, portal and service desk access request. Project code NIM-482.","ONB-002","NIMBUS","Leo access request","Leo VPN/portal/service desk request"],
    ["EMAIL-002","EMAIL","Access Support","2026-10-14","Nova VPN active; Orion Portal awaiting application-owner approval; Helix Service Desk not provisioned.","ONB-002","NIMBUS","October 14 access support response","Access support response"],
    ["EMAIL-003","EMAIL","Technical Lead","2026-10-13","Eva handles standard requests with occasional support; two complex scenarios remain. Ready with Support.","ONB-005","ORION","Technical Lead report","Technical Lead report"],
    ["EMAIL-004","EMAIL","Line Manager","2026-10-13","Eva appears independent and the manager considers onboarding closed.","ONB-005","ORION","Line Manager report","Line Manager report"],
    ["EMAIL-005","EMAIL","PMO","2026-10-08","PMO request to Technical Manager regarding Lina's role, KT owner and readiness date. No response recorded by October 14.","ONB-009",null,"PMO request for Lina","PMO-Lina request"],
    ["UPDATE-006","EMPLOYEE_UPDATE","Owen Hart","2026-10-14","Standard daily activities can be performed independently. Exceptions and production changes require help. All tools reported available. Final readiness review date missing.","ONB-010","VEGA","Owen employee check-in","Owen check-in"],
    ["UPDATE-007","EMPLOYEE_UPDATE","Iris Moon","2026-09-20","Shadowing started; access expected the following week. No later update available.","ONB-007","NOVA","Iris tracker note","Iris tracker note"],
    ["EMAIL-008","EMAIL","Atlas Operations","2026-10-11","Training guide and runbook are available at /Team/Operations/Onboarding.","ONB-006","ATLAS","Atlas documentation message","Atlas documentation location"],
  ] as const;
  for (const [id,sourceType,author,timestamp,content,employeeId,projectId,title,sourceRef] of evidence) {
    await prisma.evidence.create({data:{id,sourceType,author,timestamp,content,employeeId,projectId,title,sourceRef,caseId:`CASE-${employeeId}`}});
  }

  await prisma.evidenceClaim.createMany({data:[
    {evidenceId:"EMAIL-003",entity:"ONB-005",field:"assessedStatus",extractedValue:"READY_WITH_SUPPORT",excerpt:"Ready with Support.",effectiveDate:"2026-10-13",reviewStatus:"APPROVED"},
    {evidenceId:"EMAIL-004",entity:"ONB-005",field:"assessedStatus",extractedValue:"INDEPENDENTLY_READY",excerpt:"Eva appears independent and the manager considers onboarding closed.",effectiveDate:"2026-10-13",reviewStatus:"APPROVED"},
  ]});

  await prisma.knowledgeResource.create({data:{id:"RES-ATLAS",title:"Atlas training guide and runbook",projectId:"ATLAS",owner:"Atlas Operations",description:"Training guide and runbook for Atlas operations.",location:"/Team/Operations/Onboarding",applicableRoles:"[\"EMPLOYEE\",\"TECH_LEAD\"]"}});
  await prisma.actionItem.createMany({data:[
    {id:"ACT-EVA-CONFLICT",caseId:"CASE-ONB-005",employeeId:"ONB-005",title:"Review Eva's readiness conflict",description:"Have the Technical Lead evaluate the two complex scenarios and record whether independent execution is observed.",ownerRole:"Technical Lead",priority:"CRITICAL",dueDate:"2026-10-15",status:"OPEN",evidenceIds:"[\"EMAIL-003\",\"EMAIL-004\"]",draft:"Please review Eva's conflicting readiness reports and validate the two complex scenarios."},
    {id:"ACT-LEO-ACCESS",caseId:"CASE-ONB-002",employeeId:"ONB-002",title:"Resolve Leo's access blockers",description:"Confirm Nova VPN use, obtain Orion Portal approval, and provision Helix Service Desk access.",ownerRole:"Application owner / IT Support",priority:"HIGH",dueDate:"2026-10-15",status:"OPEN",evidenceIds:"[\"EMAIL-001\",\"EMAIL-002\"]",draft:"Please confirm the Nova VPN successful-use check and update the Orion and Helix access states."},
    {id:"ACT-LINA-REQUEST",caseId:"CASE-ONB-009",employeeId:"ONB-009",title:"Follow up on Lina's unanswered request",description:"Clarify Lina's role, KT owner and expected readiness date with the Technical Manager.",ownerRole:"Technical Manager",priority:"HIGH",dueDate:"2026-10-15",status:"OPEN",evidenceIds:"[\"EMAIL-005\"]",draft:"Please provide Lina's role, KT owner and expected readiness date."},
  ]});
  await prisma.auditLog.create({data:{action:"SEED_COMPLETE",entityType:"SYSTEM",entityId:"ONBOARDIQ",details:"Official starter records and eight evidence sources seeded",timestamp:"2026-10-14"}});
}

main().finally(() => prisma.$disconnect());
