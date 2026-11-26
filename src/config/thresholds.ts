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

  /* Project health (src/modules/projects/health.ts). Counts, never percentages. */
  /** Open CRITICAL findings at or above this make a project Critical. */
  HEALTH_CRITICAL_FINDINGS: intFromEnv("HEALTH_CRITICAL_FINDINGS", 1),
  /** Open HIGH findings at or above this make a project At risk. */
  HEALTH_AT_RISK_HIGH_FINDINGS: intFromEnv("HEALTH_AT_RISK_HIGH_FINDINGS", 1),
  /** Required access items not usable at or above this make a project At risk. */
  HEALTH_AT_RISK_ACCESS_NOT_USABLE: intFromEnv("HEALTH_AT_RISK_ACCESS_NOT_USABLE", 1),
  /** Overdue follow-ups (escalation threshold passed, or overdue actions) at or above this make a project At risk. */
  HEALTH_AT_RISK_OVERDUE: intFromEnv("HEALTH_AT_RISK_OVERDUE", 1),
  /** Stale cases at or above this make a project At risk. */
  HEALTH_AT_RISK_STALE: intFromEnv("HEALTH_AT_RISK_STALE", 1),
  /** Cases waiting for technical validation at or above this make a project At risk. */
  HEALTH_AT_RISK_PENDING_VALIDATIONS: intFromEnv("HEALTH_AT_RISK_PENDING_VALIDATIONS", 2),
  /** Pre-boarding start dates within this many days are "coming up". */
  UPCOMING_START_DAYS: intFromEnv("UPCOMING_START_DAYS", 14),
} as const;
