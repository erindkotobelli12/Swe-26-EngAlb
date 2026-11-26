/**
 * SIMULATED historical dataset. These ten cases (formerly numbered 011-020 in an earlier data file) are NOT part of
 * the official starter pack; the durations and delay causes below are synthetic. Used only on /insights behind the explicit
 * "Include simulated history" toggle, always under a SIMULATED DATA banner, never mixed with actual data.
 */
export type SimulatedCase = {
  id: string; employee: string; project: string | null; movement: string; start: string;
  daysToUsableAccess: number | null; daysToReadiness: number | null; delayCause: string;
};

export const SIMULATED_HISTORY: SimulatedCase[] = [
  { id: "SIM-011", employee: "Ava Silva", project: "Sierra", movement: "New Hire", start: "2026-10-15", daysToUsableAccess: 4, daysToReadiness: null, delayCause: "Access approval" },
  { id: "SIM-012", employee: "Ben Cole", project: "Comet", movement: "Reallocation", start: "2026-10-08", daysToUsableAccess: 9, daysToReadiness: 31, delayCause: "Access approval" },
  { id: "SIM-013", employee: "Chloe Dean", project: "Juniper", movement: "New Hire", start: "2026-09-18", daysToUsableAccess: 6, daysToReadiness: 27, delayCause: "Missing manager" },
  { id: "SIM-014", employee: "Daniel Fox", project: null, movement: "Reallocation", start: "2026-10-10", daysToUsableAccess: 12, daysToReadiness: null, delayCause: "Scope not confirmed" },
  { id: "SIM-015", employee: "Emma Holt", project: "Cobalt", movement: "New Hire", start: "2026-09-25", daysToUsableAccess: 5, daysToReadiness: 35, delayCause: "KT owner unavailable" },
  { id: "SIM-016", employee: "Finn Ross", project: "Quartz", movement: "Reallocation", start: "2026-10-11", daysToUsableAccess: 3, daysToReadiness: 22, delayCause: "Access approval" },
  { id: "SIM-017", employee: "Grace Bell", project: null, movement: "New Hire", start: "2026-09-20", daysToUsableAccess: 14, daysToReadiness: null, delayCause: "Scope not confirmed" },
  { id: "SIM-018", employee: "Henry King", project: "Maple", movement: "New Hire", start: "2026-10-16", daysToUsableAccess: null, daysToReadiness: null, delayCause: "Pre-onboarding" },
  { id: "SIM-019", employee: "Isla Gray", project: "Lotus", movement: "Reallocation", start: "2026-09-27", daysToUsableAccess: 8, daysToReadiness: 40, delayCause: "Missing manager" },
  { id: "SIM-020", employee: "Jack Wells", project: "Meridian", movement: "New Hire", start: "2026-10-09", daysToUsableAccess: 7, daysToReadiness: 29, delayCause: "KT owner unavailable" },
];
