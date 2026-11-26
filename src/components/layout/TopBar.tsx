"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Menu, Search, UserRound } from "lucide-react";
import { Avatar, cn } from "@/components/ui/primitives";
import {
  Dialog, Drawer, DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownSub, DropdownSubContent, DropdownSubTrigger, DropdownTrigger,
} from "@/components/ui/overlays";
import { useToast } from "@/components/ui/Toast";
import { BreadcrumbTrail } from "./breadcrumbs";
import { NAV_ICONS, type NavGroup } from "./Sidebar";

export type AccountOption = { id: string; name: string; roleLabel: string; group: string; isSample: boolean };
export type CurrentUser = { id: string; name: string; roleLabel: string; isSample: boolean; profileHref: string | null };

export default function TopBar({ user, accounts, dataAsOf, groups }: { user: CurrentUser; accounts: AccountOption[]; dataAsOf: string; groups: NavGroup[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-6">
      <Drawer open={mobileOpen} onOpenChange={setMobileOpen} width={300} title="OnboardIQ"
        trigger={<button type="button" className="rounded-md p-1.5 text-muted hover:bg-canvas md:hidden" aria-label="Open navigation"><Menu size={18} /></button>}>
        <nav aria-label="Main (mobile)" className="space-y-4">
          {groups.map((g, i) => (
            <div key={g.label ?? i}>
              {g.label && <p className="pb-1 text-[11px] font-medium uppercase tracking-wide text-subtle">{g.label}</p>}
              {g.items.map((l) => { const Icon = NAV_ICONS[l.icon]; return <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-body hover:bg-canvas"><Icon size={16} className="text-slate-400" />{l.label}</Link>; })}
            </div>
          ))}
        </nav>
      </Drawer>
      <div className="min-w-0 flex-1"><BreadcrumbTrail /></div>
      <GlobalSearch />
      <AccountMenu user={user} accounts={accounts} dataAsOf={dataAsOf} />
    </header>
  );
}

type SearchHit = { type: "employee" | "project" | "person"; id: string; title: string; subtitle: string; href: string };

function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const n = ++seq.current;
    const t = setTimeout(async () => {
      if (!term) { setHits([]); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = res.ok ? ((await res.json()) as { hits: SearchHit[] }) : { hits: [] };
        if (n === seq.current) { setHits(data.hits); setActive(0); }
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(h: SearchHit) {
    setOpen(false);
    setQ("");
    router.push(h.href);
  }

  const groupsOf: { key: SearchHit["type"]; label: string }[] = [{ key: "employee", label: "Employees" }, { key: "project", label: "Projects" }, { key: "person", label: "People" }];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="global-search"
        className="hidden h-9 w-[260px] items-center gap-2 rounded-lg border border-line bg-canvas px-3 text-sm text-subtle hover:border-line-strong sm:flex lg:w-[320px]">
        <Search size={15} aria-hidden /><span className="min-w-0 flex-1 truncate text-left">Search people and projects</span>
        <kbd className="rounded border border-line bg-surface px-1.5 font-mono text-[10px]">Ctrl K</kbd>
      </button>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md p-1.5 text-muted hover:bg-canvas sm:hidden" aria-label="Search"><Search size={18} /></button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }} title="Search" width={560}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-subtle" aria-hidden />
          <input autoFocus aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name, project or person…" className="field pl-9"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter" && hits[active]) go(hits[active]);
            }} />
          {loading && <Loader2 size={14} className="absolute right-3 top-3 animate-spin text-subtle" />}
        </div>
        <div className="mt-3 min-h-[120px]">
          {!q.trim() && <p className="py-6 text-center text-sm text-subtle">Results only include people and projects you can see.</p>}
          {q.trim() && !loading && !hits.length && <p className="py-6 text-center text-sm text-subtle">No matches for “{q.trim()}”.</p>}
          {groupsOf.map((g) => {
            const list = hits.filter((h) => h.type === g.key);
            if (!list.length) return null;
            return (
              <div key={g.key} className="mb-2">
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-subtle">{g.label}</p>
                {list.map((h) => {
                  const idx = hits.indexOf(h);
                  return (
                    <button key={`${h.type}-${h.id}`} type="button" onClick={() => go(h)} onMouseEnter={() => setActive(idx)}
                      className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left", idx === active ? "bg-canvas" : "")}>
                      <Avatar name={h.title} size={26} />
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-ink">{h.title}</span><span className="block truncate text-xs text-subtle">{h.subtitle}</span></span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Dialog>
    </>
  );
}

function AccountMenu({ user, accounts, dataAsOf }: { user: CurrentUser; accounts: AccountOption[]; dataAsOf: string }) {
  const toast = useToast();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const groups = [...new Set(accounts.map((a) => a.group))];

  async function switchTo(userId: string) {
    setSwitching(true);
    try {
      const res = await fetch("/api/session/role", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (!res.ok) throw new Error();
      router.replace("/");
      router.refresh();
      setSwitching(false);
    } catch {
      toast.error("Could not switch demo account.");
      setSwitching(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button type="button" data-testid="account-menu" className="flex h-9 items-center gap-2 rounded-lg px-1.5 text-sm hover:bg-canvas sm:px-2">
          {switching ? <Loader2 size={16} className="animate-spin" /> : <Avatar name={user.name} size={26} />}
          <span className="hidden text-left leading-tight lg:block">
            <span className="block max-w-[180px] truncate font-medium text-ink">{user.name}</span>
            <span className="block text-xs text-subtle" data-testid="current-role">{user.roleLabel}</span>
          </span>
          <span className="hidden rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200 sm:inline">Demo</span>
          <ChevronDown size={14} className="text-subtle" aria-hidden />
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-[260px]">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="text-xs text-subtle">{user.roleLabel}{user.isSample ? " · sample person" : ""}</p>
        </div>
        <DropdownSeparator />
        {user.profileHref && <DropdownItem onSelect={() => router.push(user.profileHref!)}><UserRound size={15} className="text-subtle" />My profile</DropdownItem>}
        <DropdownSub>
          <DropdownSubTrigger><span>Switch demo account</span><ChevronDown size={14} className="-rotate-90 text-subtle" /></DropdownSubTrigger>
          <DropdownSubContent>
            {groups.map((g) => (
              <div key={g}>
                <DropdownLabel>{g}</DropdownLabel>
                {accounts.filter((a) => a.group === g).map((a) => (
                  <DropdownItem key={a.id} disabled={a.id === user.id || switching} onSelect={() => switchTo(a.id)}>
                    <Avatar name={a.name} size={22} />
                    <span className="min-w-0 flex-1 truncate" data-testid={`switch-${a.id}`}>{a.name}</span>
                  </DropdownItem>
                ))}
              </div>
            ))}
          </DropdownSubContent>
        </DropdownSub>
        <DropdownSeparator />
        <p className="px-2.5 py-1.5 text-xs text-subtle">Data as of {dataAsOf}</p>
        <p className="px-2.5 pb-1.5 text-[11px] text-subtle">Demo mode: accounts switch without a password.</p>
      </DropdownContent>
    </DropdownMenu>
  );
}
