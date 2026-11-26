"use client";
import { useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { chooseTechLeadAction, endAssignmentAction } from "@/server/actions/projects";
import { useServerAction } from "@/components/ui/actions";
import { Dialog } from "@/components/ui/overlays";
import { Avatar, buttonClass, cn, SampleTag } from "@/components/ui/primitives";

type Candidate = { id: string; name: string; isSample: boolean; isLineManager: boolean };

/** The Additional Manager chooses the project's Technical Lead. A Line Manager may also be the Technical Lead. */
export function ChooseTechLead({ projectId, candidates, currentId }: { projectId: string; candidates: Candidate[]; currentId: string | null }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const { pending, run } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Choose the Technical Lead" description="The Technical Lead handles onboarding: they define what people need and validate technical readiness."
      trigger={<button type="button" data-testid="choose-tech-lead" className={buttonClass(currentId ? "secondary" : "primary")}><UserCheck size={15} />{currentId ? "Change Technical Lead" : "Choose Technical Lead"}</button>}
      footer={<>
        <button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" data-testid="save-tech-lead" disabled={!choice || pending} className={buttonClass("primary")}
          onClick={() => run(() => chooseTechLeadAction({ projectId, personId: choice, reason: reason || undefined }), { onDone: () => setOpen(false) })}>
          {pending && <Loader2 size={15} className="animate-spin" />}Save
        </button>
      </>}>
      <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Tip: a Line Manager on this project can also be its Technical Lead.</p>
      <fieldset className="space-y-2">
        <legend className="sr-only">People</legend>
        {candidates.map((c) => (
          <label key={c.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5", choice === c.id ? "border-brand-500 bg-brand-50" : "border-line hover:bg-canvas")}>
            <input type="radio" name="tl" value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} className="accent-brand-600" disabled={c.id === currentId} />
            <Avatar name={c.name} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{c.name}{c.isSample && <SampleTag className="ml-1.5" />}</span>
              <span className="block text-xs text-subtle">{c.isLineManager ? "Line Manager on this project" : "Technical Lead"}{c.id === currentId ? " · current Technical Lead" : ""}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="label mt-4" htmlFor="tl-reason">Note (optional)</label>
      <input id="tl-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this person?" />
    </Dialog>
  );
}

/** PMO ends an assignment (never deletes it): the person left the project or is removed from it. Requires a reason. */
export function EndAssignmentButton({ assignmentId, name }: { assignmentId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<"COMPLETED" | "REMOVED">("COMPLETED");
  const [reason, setReason] = useState("");
  const { pending, run } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={setOpen} title={`End ${name}'s assignment`} description="The assignment is kept in the history with an end date and your reason. An employee's onboarding case is closed."
      trigger={<button type="button" className={buttonClass("ghost", "sm")}>End assignment</button>}
      footer={<>
        <button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" disabled={reason.trim().length < 3 || pending} className={buttonClass("danger")}
          onClick={() => run(() => endAssignmentAction({ assignmentId, outcome, reason }), { onDone: () => { setOpen(false); setReason(""); } })}>
          {pending && <Loader2 size={15} className="animate-spin" />}End assignment
        </button>
      </>}>
      <fieldset className="space-y-2">
        <legend className="label">What happened?</legend>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={outcome === "COMPLETED"} onChange={() => setOutcome("COMPLETED")} className="accent-brand-600" />Left the project (completed)</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={outcome === "REMOVED"} onChange={() => setOutcome("REMOVED")} className="accent-brand-600" />Removed from the project</label>
      </fieldset>
      <label className="label mt-4" htmlFor="end-reason">Reason</label>
      <textarea id="end-reason" className="field min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Saved in the audit log" />
    </Dialog>
  );
}
