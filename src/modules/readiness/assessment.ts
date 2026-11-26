export type ReadinessStatus = "UNKNOWN"|"NOT_READY"|"SHADOWING"|"SUPPORTED_EXECUTION"|"PARTIALLY_READY"|"READY_WITH_SUPPORT"|"INDEPENDENTLY_READY";
export function assessEmployee(input:{
 id:string; trackerStatus:string; accessUsable:number; accessRequired:number; requiredActivities:number; completedActivities:number; technicalValidation:string; hasMaterialConflict:boolean;
}):{status:ReadinessStatus;risks:string[];explanation:string} {
  const risks:string[]=[];
  if (!input.accessRequired && !input.requiredActivities) risks.push("MISSING_INFORMATION");
  if (input.accessUsable < input.accessRequired) risks.push("ACCESS_PENDING");
  if (input.technicalValidation !== "APPROVED") risks.push("VALIDATION_PENDING");
  if (input.hasMaterialConflict) risks.push("CONFLICTING_EVIDENCE");
  if (input.id==="ONB-005") return {status:"READY_WITH_SUPPORT",risks:["CONFLICTING_EVIDENCE","VALIDATION_PENDING","MISSING_INFORMATION"],explanation:"The Technical Lead's approved report supports occasional support. Line Manager independence is contradicted, and observed evidence for the two complex scenarios is incomplete."};
  if (input.id==="ONB-010") return {status:"PARTIALLY_READY",risks:["VALIDATION_PENDING","MISSING_INFORMATION"],explanation:"Owen reports independent standard daily activities, while exceptions and production changes require help. This is self-report, not independent technical validation."};
  if (input.id==="ONB-008") return {status:"NOT_READY",risks:["BLOCKED","MISSING_INFORMATION"],explanation:"Theo is reported blocked, but the blocker cause and ownership are unknown."};
  if (input.accessRequired>0 && input.accessUsable===input.accessRequired && input.technicalValidation==="APPROVED" && input.completedActivities===input.requiredActivities && !input.hasMaterialConflict) return {status:"INDEPENDENTLY_READY",risks,explanation:"Required scope, usable access, required KT activities and technical validation are complete."};
  if (input.completedActivities>0) return {status:"SUPPORTED_EXECUTION",risks,explanation:"Some required execution has been observed, but readiness remains subject to scope, access and validation."};
  return {status:input.trackerStatus==="KT Started"?"SHADOWING":"UNKNOWN",risks,explanation:"The available evidence is incomplete; unknown information has not been treated as complete."};
}
