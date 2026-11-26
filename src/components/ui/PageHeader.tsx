import { SetBreadcrumbs, type Crumb } from "@/components/layout/breadcrumbs";

/** Page title (24px semibold), optional subtitle and actions. Also feeds the top-bar breadcrumbs. */
export function PageHeader({ title, subtitle, actions, breadcrumbs, meta }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; breadcrumbs?: Crumb[]; meta?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      {breadcrumbs && <SetBreadcrumbs items={breadcrumbs} />}
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
