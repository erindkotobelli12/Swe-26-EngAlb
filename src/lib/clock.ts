/**
 * The single evaluation clock. Every age, overdue and stale calculation uses this module,
 * so the demo can be pinned to the starter-pack evaluation date (14 Oct 2026) via DEMO_EVALUATION_DATE.
 * Audit timestamps use the real wall clock (`auditTimestamp`) because they record when an action actually happened.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function getEvaluationDate(): string {
  const configured = process.env.DEMO_EVALUATION_DATE?.trim();
  if (configured && ISO_DATE.test(configured) && !Number.isNaN(Date.parse(`${configured}T00:00:00Z`))) return configured;
  return new Date().toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both ISO dates or timestamps). Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / DAY_MS);
}

/** Age in days of a date relative to the evaluation date. */
export function ageInDays(date: string, evaluationDate: string = getEvaluationDate()): number {
  return daysBetween(date, evaluationDate);
}

export function addDays(date: string, days: number): string {
  const base = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

export function auditTimestamp(): string {
  return new Date().toISOString();
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "Unknown";
  const parsed = Date.parse(date.length === 10 ? `${date}T00:00:00Z` : date);
  if (Number.isNaN(parsed)) return date;
  return new Date(parsed).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
