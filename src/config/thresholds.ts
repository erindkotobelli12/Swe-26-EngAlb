/**
 * Business thresholds in one place. These are assumptions awaiting Business Owner confirmation
 * (see docs/ASSUMPTIONS.md). Each can be overridden by an environment variable of the same name.
 */
function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const thresholds = {
  /** A tracker status or evidence older than this is stale. */
  STALE_AFTER_DAYS: intFromEnv("STALE_AFTER_DAYS", 7),
  /** Stale findings become HIGH severity beyond this multiple of STALE_AFTER_DAYS. */
  STALE_HIGH_MULTIPLIER: 3,
  /** A request with no reply after this many days needs a follow-up. */
  FOLLOW_UP_AFTER_DAYS: intFromEnv("FOLLOW_UP_AFTER_DAYS", 3),
  /** First reminder after this many days without reply. */
  REMINDER_AFTER_DAYS: intFromEnv("REMINDER_AFTER_DAYS", 3),
  /** Recommend escalation to the line/technical manager after this many days without reply. */
  ESCALATE_AFTER_DAYS: intFromEnv("ESCALATE_AFTER_DAYS", 7),
  /** Minimum sample size before historical metrics are shown. */
  MIN_SAMPLE_SIZE: intFromEnv("MIN_SAMPLE_SIZE", 5),
} as const;
