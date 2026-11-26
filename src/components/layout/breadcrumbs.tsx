"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };
type Ctx = { crumbs: { path: string; items: Crumb[] } | null; set: (v: { path: string; items: Crumb[] }) => void };
const BreadcrumbContext = createContext<Ctx>({ crumbs: null, set: () => {} });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, set] = useState<Ctx["crumbs"]>(null);
  return <BreadcrumbContext.Provider value={{ crumbs, set }}>{children}</BreadcrumbContext.Provider>;
}

/** Rendered by PageHeader: registers the page's breadcrumbs with the top bar. */
export function SetBreadcrumbs({ items }: { items: Crumb[] }) {
  const { set } = useContext(BreadcrumbContext);
  const path = usePathname();
  const key = JSON.stringify(items);
  useEffect(() => { set({ path, items: JSON.parse(key) as Crumb[] }); }, [key, path, set]);
  return null;
}

export function BreadcrumbTrail() {
  const { crumbs } = useContext(BreadcrumbContext);
  const path = usePathname();
  const items = crumbs && crumbs.path === path ? crumbs.items : [];
  if (!items.length) return <span />;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm text-subtle">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="shrink-0 text-slate-300" aria-hidden />}
            {c.href && i < items.length - 1
              ? <Link href={c.href} className="truncate hover:text-ink">{c.label}</Link>
              : <span className={i === items.length - 1 ? "truncate font-medium text-ink" : "truncate"} aria-current={i === items.length - 1 ? "page" : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
