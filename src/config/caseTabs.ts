import type { DemoRole } from "@/lib/auth";

/**
 * Tabs of the case hub (`/employees/[id]?tab=`). A tab is enabled only once its feature fully works;
 * disabled tabs are hidden (never shown half-built).
 */
export type CaseTabId = "overview" | "investigation" | "map" | "simulator" | "roadmap" | "evidence" | "assessments" | "followups" | "history";

export const CASE_TABS: { id: CaseTabId; label: string; enabled: boolean; roles?: DemoRole[] }[] = [
  { id: "overview", label: "Overview", enabled: true },
  { id: "investigation", label: "Investigation", enabled: true },
  { id: "map", label: "Dependency map", enabled: false },
  { id: "simulator", label: "Simulator", enabled: false },
  { id: "roadmap", label: "Roadmap", enabled: false },
  { id: "evidence", label: "Evidence & reliability", enabled: true },
  { id: "assessments", label: "Assessments", enabled: false },
  { id: "followups", label: "Follow-ups", enabled: false },
  { id: "history", label: "History", enabled: true },
];
