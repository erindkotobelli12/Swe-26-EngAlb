import { label, humanize } from "@/lib/labels";
import { FileText, Reply } from "lucide-react";
import { AUTHORITY_LABEL, evidenceAuthority } from "@/domain/authority";
import { roleLabel } from "@/domain/types";
import { formatDate } from "@/lib/clock";
import { Highlighted } from "@/components/case/FindingCard";
import { OriginBadge, ProvenanceBadge } from "@/components/ui/badges";

export type EvidenceCardData = {
  id: string; title: string; sourceType: string; author: string | null; senderRole: string | null; recipients: { name: string | null; role: string }[];
  timestamp: string; content: string; reviewStatus: string; isRequest: boolean; inReplyToId: string | null; isSimulated: boolean; employeeName: string | null;
  claims: { id: string; field: string; value: string; excerpt: string; reviewStatus: string; origin: string; reviewReason: string | null; aiRunId: string | null }[];
};

const REVIEW_TONE: Record<string, string> = { APPROVED: "text-emerald-700", PENDING_REVIEW: "text-amber-700", PENDING: "text-amber-700", REJECTED: "text-red-700" };

export default function EvidenceCard({ e, controls, claimControls }: { e: EvidenceCardData; controls?: React.ReactNode; claimControls?: (claimId: string) => React.ReactNode }) {
  const sender = e.author ?? (e.senderRole === "TRACKER" ? "Onboarding tracker" : `${roleLabel(e.senderRole)} (name not recorded)`);
  return (
    <article id={e.id} className={`scroll-mt-6 rounded-xl border bg-white p-5 ${e.isSimulated ? "border-violet-300" : "border-line"}`}>
      <div className="flex gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><FileText size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <b>{e.title}</b>
            <code className="font-mono text-[11px] text-subtle">{e.id}</code>
            {e.isSimulated ? <ProvenanceBadge state="simulated" /> : e.reviewStatus === "APPROVED" ? <ProvenanceBadge state="actual" /> : <ProvenanceBadge state="proposed" />}
            {e.isRequest && <span className="rounded bg-orange-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-orange-700">request</span>}
          </div>
          <p className="mt-1 text-xs text-subtle">
            {label("sourceType", e.sourceType)} · {sender}{e.senderRole && e.senderRole !== "TRACKER" ? ` · ${roleLabel(e.senderRole)}` : ""}
            {e.recipients.length ? ` → ${e.recipients.map((r) => r.name ?? roleLabel(r.role)).join(", ")}` : ""} · {formatDate(e.timestamp)}
            {e.employeeName ? ` · ${e.employeeName}` : " · project-level"} · {AUTHORITY_LABEL[evidenceAuthority(e.senderRole)]}
          </p>
          {e.inReplyToId && <p className="mt-1 flex items-center gap-1 text-xs text-subtle"><Reply size={12} />Reply to <a href={`#${e.inReplyToId}`} className="font-semibold text-brand-700">{e.inReplyToId}</a></p>}
          <p className="mt-3 whitespace-pre-line rounded-lg bg-canvas p-3 text-sm leading-6 text-ink" data-testid="verbatim-content"><Highlighted content={e.content} excerpts={e.claims.filter((c) => c.reviewStatus !== "REJECTED").map((c) => c.excerpt)} /></p>
          <p className={`mt-2 text-xs font-semibold ${REVIEW_TONE[e.reviewStatus] ?? "text-subtle"}`}>Source review: {humanize(e.reviewStatus).toLowerCase()} · stored verbatim, never edited</p>
          {controls}
          {e.claims.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase text-subtle">Structured claims</p>
              {e.claims.map((c) => (
                <div key={c.id} className={`rounded-lg border p-3 text-sm ${c.reviewStatus === "PENDING" ? "border-dashed border-amber-300 bg-amber-50/30" : "border-line"}`} data-claim-field={c.field}>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-slate-100 px-1.5 text-xs">{c.field}</code><span>=</span><b>{c.value}</b>
                    <OriginBadge origin={c.origin} />
                    {c.reviewStatus === "PENDING" ? <ProvenanceBadge state="proposed" /> : <span className={`text-[11px] font-semibold uppercase ${REVIEW_TONE[c.reviewStatus]}`}>{c.reviewStatus.toLowerCase()}</span>}
                  </div>
                  <p className="mt-1 text-xs italic text-muted">“{c.excerpt}” <span className="not-italic text-emerald-700">✓ verbatim</span></p>
                  {c.reviewReason && <p className="mt-1 text-xs text-subtle">Review note: {c.reviewReason}</p>}
                  {c.reviewStatus === "PENDING" && claimControls?.(c.id)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
