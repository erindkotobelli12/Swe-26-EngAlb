"use client";
import { Loader2, MoreHorizontal, RefreshCw } from "lucide-react";
import { recomputeCaseAction } from "@/server/actions/case";
import { useServerAction } from "@/components/ui/actions";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui/overlays";
import { buttonClass } from "@/components/ui/primitives";

/** Overflow menu on the case hub. Analysis refreshes automatically after changes; this is the manual fallback. */
export function CaseMenu({ employeeId, internalId }: { employeeId: string; internalId: string }) {
  const { pending, run } = useServerAction();
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button type="button" aria-label="More actions" className={buttonClass("secondary")}>{pending ? <Loader2 size={15} className="animate-spin" /> : <MoreHorizontal size={16} />}</button>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem onSelect={() => run(() => recomputeCaseAction(employeeId))}><RefreshCw size={14} className="text-subtle" />Refresh analysis</DropdownItem>
        <p className="px-2.5 pb-1.5 pt-1 text-[11px] text-subtle">Case <code className="font-mono">{internalId}</code></p>
      </DropdownContent>
    </DropdownMenu>
  );
}
