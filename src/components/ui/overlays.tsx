"use client";
import * as RDialog from "@radix-ui/react-dialog";
import * as RDropdown from "@radix-ui/react-dropdown-menu";
import * as RPopover from "@radix-ui/react-popover";
import * as RTooltip from "@radix-ui/react-tooltip";
import { X } from "lucide-react";
import { cn } from "./primitives";

/* ---------- Dialog ---------- */

export function Dialog({ open, onOpenChange, trigger, title, description, children, footer, width = 520 }: {
  open?: boolean; onOpenChange?: (open: boolean) => void; trigger?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode;
  children?: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]" />
        <RDialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-line bg-surface shadow-pop" style={{ maxWidth: width }}>
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <RDialog.Title className="text-base font-semibold text-ink">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-sm text-subtle">{description}</RDialog.Description> : <RDialog.Description className="sr-only">Dialog</RDialog.Description>}
            </div>
            <RDialog.Close className="rounded-md p-1 text-subtle hover:bg-canvas hover:text-ink" aria-label="Close"><X size={16} /></RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ---------- Drawer (side sheet) ---------- */

export function Drawer({ open, onOpenChange, trigger, title, description, children, width = 560 }: {
  open?: boolean; onOpenChange?: (open: boolean) => void; trigger?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; width?: number;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-slate-900/20" />
        <RDialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-pop" style={{ maxWidth: width }}>
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <RDialog.Title className="text-base font-semibold text-ink">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-sm text-subtle">{description}</RDialog.Description> : <RDialog.Description className="sr-only">Details</RDialog.Description>}
            </div>
            <RDialog.Close className="rounded-md p-1 text-subtle hover:bg-canvas hover:text-ink" aria-label="Close"><X size={16} /></RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ---------- Dropdown menu ---------- */

export const DropdownMenu = RDropdown.Root;
export const DropdownTrigger = RDropdown.Trigger;
export const DropdownSub = RDropdown.Sub;

export function DropdownContent({ children, align = "end", className }: { children: React.ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <RDropdown.Portal>
      <RDropdown.Content align={align} sideOffset={6} className={cn("z-50 min-w-[220px] rounded-lg border border-line bg-surface p-1 text-sm shadow-pop", className)}>
        {children}
      </RDropdown.Content>
    </RDropdown.Portal>
  );
}

export function DropdownItem({ children, onSelect, disabled, className }: { children: React.ReactNode; onSelect?: (e: Event) => void; disabled?: boolean; className?: string }) {
  return (
    <RDropdown.Item onSelect={onSelect} disabled={disabled} className={cn("flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-body outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:bg-canvas data-[highlighted]:text-ink", className)}>
      {children}
    </RDropdown.Item>
  );
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <RDropdown.Label className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-subtle">{children}</RDropdown.Label>;
}

export function DropdownSeparator() {
  return <RDropdown.Separator className="my-1 h-px bg-line" />;
}

export function DropdownSubTrigger({ children }: { children: React.ReactNode }) {
  return <RDropdown.SubTrigger className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-body outline-none data-[highlighted]:bg-canvas data-[state=open]:bg-canvas">{children}</RDropdown.SubTrigger>;
}

export function DropdownSubContent({ children }: { children: React.ReactNode }) {
  return (
    <RDropdown.Portal>
      <RDropdown.SubContent sideOffset={4} className="z-50 max-h-[70vh] min-w-[240px] overflow-y-auto rounded-lg border border-line bg-surface p-1 text-sm shadow-pop">{children}</RDropdown.SubContent>
    </RDropdown.Portal>
  );
}

/* ---------- Tooltip ---------- */

export const TooltipProvider = RTooltip.Provider;

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <RTooltip.Root delayDuration={200}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} className="z-50 max-w-xs rounded-md bg-slate-900 px-2.5 py-1.5 text-xs leading-snug text-white shadow-pop">
          {content}
          <RTooltip.Arrow className="fill-slate-900" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/* ---------- Popover ---------- */

export function Popover({ trigger, children, onOpenChange, width = 360 }: { trigger: React.ReactNode; children: React.ReactNode; onOpenChange?: (open: boolean) => void; width?: number }) {
  return (
    <RPopover.Root onOpenChange={onOpenChange}>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content sideOffset={6} collisionPadding={16} className="z-50 rounded-lg border border-line bg-surface p-4 text-sm shadow-pop" style={{ width }}>
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}
