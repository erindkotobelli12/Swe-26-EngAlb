import { describe,it,expect } from "vitest";
import { assessEmployee } from "../../src/modules/readiness/assessment";

describe("readiness business rules",()=>{
 it("does not mark provisioned or approved access usable",()=>{
  const r=assessEmployee({id:"ONB-002",trackerStatus:"Access Pending",accessUsable:0,accessRequired:3,requiredActivities:0,completedActivities:0,technicalValidation:"PENDING",hasMaterialConflict:false});
  expect(r.status).not.toBe("INDEPENDENTLY_READY");
 });
 it("Eva remains Ready with Support despite a conflict",()=>{
  const r=assessEmployee({id:"ONB-005",trackerStatus:"Ready with Support",accessUsable:1,accessRequired:1,requiredActivities:2,completedActivities:1,technicalValidation:"PENDING",hasMaterialConflict:true});
  expect(r.status).toBe("READY_WITH_SUPPORT");
  expect(r.risks).toContain("CONFLICTING_EVIDENCE");
 });
 it("Owen is not independent based on self report",()=>{
  const r=assessEmployee({id:"ONB-010",trackerStatus:"Partially Ready",accessUsable:1,accessRequired:1,requiredActivities:1,completedActivities:1,technicalValidation:"PENDING",hasMaterialConflict:false});
  expect(r.status).toBe("PARTIALLY_READY");
 });
 it("missing technical validation prevents independent readiness",()=>{
  const r=assessEmployee({id:"TEST",trackerStatus:"KT Started",accessUsable:1,accessRequired:1,requiredActivities:1,completedActivities:1,technicalValidation:"PENDING",hasMaterialConflict:false});
  expect(r.status).not.toBe("INDEPENDENTLY_READY");
 });
});
