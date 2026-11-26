import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { initials } from "@/lib/labels";

/** Joins class names, skipping falsy values. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" = "md"): string {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-sm" }[size];
  const variants = {
    primary: "bg-brand-600 text-white shadow-soft hover:bg-brand-700",
    secondary: "border border-line-strong bg-surface text-body shadow-soft hover:bg-canvas",
    ghost: "text-muted hover:bg-canvas hover:text-ink",
    danger: "border border-red-200 bg-surface text-red-700 hover:bg-red-50",
  }[variant];
  return cn(base, sizes, variants);
}

export function ButtonLink({ href, children, variant = "secondary", size = "md", className }: { href: string; children: React.ReactNode; variant?: ButtonVariant; size?: "sm" | "md"; className?: string }) {
  return <Link href={href} className={cn(buttonClass(variant, size), className)}>{children}</Link>;
}

/* ---------- Surfaces ---------- */

export function Card({ title, subtitle, actions, children, className, id, padded = true }: { title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; id?: string; padded?: boolean }) {
  return (
    <section id={id} className={cn("rounded-card border border-line bg-surface shadow-soft", className)}>
      {(title || actions) && (
        <div className={cn("flex flex-wrap items-start justify-between gap-2", padded ? "px-5 pt-4" : "px-5 py-4 border-b border-line")}>
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-subtle">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? cn("px-5 pb-5", title || actions ? "pt-3" : "pt-5") : ""}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "neutral", href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone | "neutral"; href?: string }) {
  const accent = tone === "neutral" ? "text-ink" : TONE_TEXT[tone];
  const body = (
    <div className={cn("h-full rounded-card border border-line bg-surface p-4 shadow-soft", href && "transition-colors hover:border-brand-200")}>
      <p className="text-xs font-medium text-subtle">{label}</p>
      <p className={cn("tabular mt-1 text-2xl font-semibold", accent)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }: { icon?: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-canvas text-subtle"><Icon size={18} aria-hidden /></span>
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-subtle">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} aria-hidden />;
}

export function SectionHeading({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-ink">{children}</h2>{actions}</div>;
}

export function Meta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs text-subtle", className)}>{children}</p>;
}

/** Internal IDs are shown only in detail views, small and monospaced. */
export function InternalId({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[11px] text-subtle">{children}</code>;
}

/* ---------- Status ---------- */

export type Tone = "green" | "amber" | "red" | "slate" | "violet" | "brand";
const TONE_PILL: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
};
const TONE_DOT: Record<Tone, string> = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", slate: "bg-slate-400", violet: "bg-violet-500", brand: "bg-brand-500" };
const TONE_TEXT: Record<Tone, string> = { green: "text-emerald-700", amber: "text-amber-700", red: "text-red-700", slate: "text-slate-600", violet: "text-violet-700", brand: "text-brand-700" };

export function StatusPill({ tone, children, dot = true, title }: { tone: Tone; children: React.ReactNode; dot?: boolean; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONE_PILL[tone])}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export const toneFor = {
  health: (h: string): Tone => (h === "ON_TRACK" ? "green" : h === "AT_RISK" ? "amber" : h === "CRITICAL" ? "red" : "slate"),
  phase: (p: string): Tone => (p === "READY" ? "green" : p === "CLOSED" ? "slate" : "brand"),
  readiness: (l: string): Tone => (l === "INDEPENDENTLY_READY" ? "green" : l === "BLOCKED" ? "red" : l === "UNKNOWN" || l === "NOT_VALIDATED" ? "slate" : ["READY_WITH_SUPPORT", "PARTIALLY_READY"].includes(l) ? "amber" : "slate"),
  severity: (s: string): Tone => (s === "CRITICAL" || s === "HIGH" ? "red" : s === "MEDIUM" ? "amber" : "slate"),
  item: (s: string): Tone => (s === "DONE" ? "green" : s === "BLOCKED" ? "red" : s === "IN_PROGRESS" ? "amber" : "slate"),
  requirement: (s: string): Tone => (s === "DONE" || s === "SATISFIED_BY_EXISTING_SKILL" ? "green" : s === "IN_PROGRESS" || s === "POSSIBLY_COVERED" ? "amber" : s === "WAIVED" ? "slate" : "slate"),
  access: (s: string): Tone => (s === "USABLE" ? "green" : s === "REJECTED" ? "red" : s === "NOT_REQUESTED" ? "slate" : "amber"),
  reliability: (c: string): Tone => (c === "VERIFIED" || c === "WELL_SUPPORTED" ? "green" : c === "CONFLICTING" ? "red" : c === "OUTDATED" || c === "UNVERIFIED" ? "amber" : "slate"),
  improvement: (s: string): Tone => (s === "DONE" ? "green" : s === "DROPPED" ? "slate" : s === "IN_PROGRESS" ? "amber" : "brand"),
  skill: (s: string): Tone => (s === "CONFIRMED" ? "green" : s === "REJECTED" ? "red" : "amber"),
};

/* ---------- People ---------- */

const AVATAR_COLORS = ["bg-sky-100 text-sky-800", "bg-indigo-100 text-indigo-800", "bg-teal-100 text-teal-800", "bg-rose-100 text-rose-800", "bg-amber-100 text-amber-900", "bg-lime-100 text-lime-800"];
export function Avatar({ name, size = 28, muted }: { name: string | null | undefined; size?: number; muted?: boolean }) {
  const hash = [...(name ?? "?")].reduce((n, c) => n + c.charCodeAt(0), 0);
  const color = !name || muted ? "bg-slate-100 text-slate-500" : AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <span aria-hidden className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-white", color)} style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}>
      {initials(name)}
    </span>
  );
}

/** Avatar + name. Unknown people stay visibly "Not assigned"; sample people get a small tag. */
export function PersonChip({ name, role, href, isSample, missingLabel = "Not assigned", size = 24 }: { name: string | null | undefined; role?: string; href?: string; isSample?: boolean; missingLabel?: string; size?: number }) {
  if (name === undefined) {
    return <span className="inline-flex items-center gap-2 text-sm text-subtle"><span className="inline-grid place-items-center rounded-full border border-dashed border-line-strong text-[10px]" style={{ width: size, height: size }} aria-hidden>–</span><span className="italic">{missingLabel}</span></span>;
  }
  const text = name ?? "Name not recorded";
  const inner = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} size={size} muted={!name} />
      <span className="min-w-0">
        <span className={cn("block truncate text-sm", name ? "font-medium text-ink" : "italic text-subtle")}>{text}{isSample && <SampleTag className="ml-1.5" />}</span>
        {role && <span className="block truncate text-xs text-subtle">{role}</span>}
      </span>
    </span>
  );
  return href ? <Link href={href} className="min-w-0 hover:underline">{inner}</Link> : inner;
}

export function SampleTag({ className }: { className?: string }) {
  return <span title="Sample data created for the demo. Not from the starter pack." className={cn("inline-flex items-center rounded px-1.5 py-px align-middle text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200 bg-violet-50", className)}>Sample data</span>;
}

export function SimulatedPill({ className }: { className?: string }) {
  return <span title="Hypothetical or synthetic data — not actual employee state" data-provenance="simulated" className={cn("inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200", className)}>Simulated</span>;
}

/* ---------- Phase stepper ---------- */

const STEPS = [
  { id: "PRE_BOARDING", label: "Pre-boarding" },
  { id: "ONBOARDING", label: "Onboarding" },
  { id: "READY", label: "Ready" },
] as const;

export function PhaseStepper({ phase, compact }: { phase: string; compact?: boolean }) {
  const current = phase === "CLOSED" ? 3 : STEPS.findIndex((s) => s.id === phase);
  return (
    <ol className={cn("flex items-center", compact ? "gap-1" : "gap-2")} aria-label={`Phase: ${phase === "CLOSED" ? "Closed" : STEPS[current]?.label ?? "Unknown"}`}>
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex items-center gap-1" aria-current={active ? "step" : undefined}>
            <span className={cn("grid shrink-0 place-items-center rounded-full text-[10px] font-semibold", compact ? "h-4 w-4" : "h-5 w-5",
              done ? "bg-emerald-500 text-white" : active ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500")}>{done ? "✓" : i + 1}</span>
            {!compact && <span className={cn("text-xs", active ? "font-semibold text-ink" : "text-subtle")}>{s.label}</span>}
            {compact && active && <span className="text-xs font-medium text-ink">{s.label}</span>}
            {i < STEPS.length - 1 && <span className={cn("h-px", compact ? "w-3" : "w-6", done ? "bg-emerald-400" : "bg-slate-200")} aria-hidden />}
          </li>
        );
      })}
      {phase === "CLOSED" && <li className="ml-1 text-xs text-subtle">Closed</li>}
    </ol>
  );
}

/* ---------- Tabs (URL driven) ---------- */

export function LinkTabs({ tabs, current, label = "Sections" }: { tabs: { id: string; label: string; href: string; count?: number }[]; current: string; label?: string }) {
  return (
    <nav aria-label={label} className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={t.id === current ? "page" : undefined}
          className={cn("whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", t.id === current ? "border-brand-600 text-brand-700" : "border-transparent text-subtle hover:text-ink")}>
          {t.label}
          {t.count ? <span className="tabular ml-1.5 rounded-full bg-slate-100 px-1.5 py-px text-[11px] text-slate-600">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Tables ---------- */

export type Column<T> = { key: string; header: React.ReactNode; cell: (row: T) => React.ReactNode; className?: string; headerClassName?: string };

export function DataTable<T>({ rows, columns, rowKey, empty, caption, maxHeight }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; empty?: React.ReactNode; caption?: string; maxHeight?: number }) {
  if (!rows.length && empty) return <>{empty}</>;
  return (
    <div className="overflow-auto rounded-card border border-line bg-surface shadow-soft" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr>
            {columns.map((c) => <th key={c.key} scope="col" className={cn("border-b border-line px-4 py-2.5 text-left text-xs font-medium text-subtle", c.headerClassName)}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-line last:border-0 hover:bg-slate-50/60">
              {columns.map((c) => <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Small horizontal stacked bar (e.g. employees per phase). */
export function StackedBar({ segments, total, height = 8 }: { segments: { value: number; tone: Tone; label: string }[]; total?: number; height?: number }) {
  const sum = total ?? segments.reduce((n, s) => n + s.value, 0);
  if (!sum) return <div className="w-full rounded-full bg-slate-100" style={{ height }} aria-label="No employees yet" />;
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-slate-100" style={{ height }} role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
      {segments.filter((s) => s.value > 0).map((s) => <span key={s.label} title={`${s.label}: ${s.value}`} className={TONE_DOT[s.tone]} style={{ width: `${(s.value / sum) * 100}%` }} />)}
    </div>
  );
}
