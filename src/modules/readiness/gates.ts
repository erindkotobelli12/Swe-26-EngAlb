import {
  ACCESS_STATUS_LABEL, GATE_LABEL, KT_STAGE_LABEL, READINESS_LABEL,
  type CaseState, type Gate, type GateId, type GateStatus, type PersonRef, type ValidationItem,
} from "@/domain/types";

/**
 * Readiness gates derived from the starter-pack §6 onboarding checklist. Pure function of CaseState.
 * Each gate is SATISFIED, UNSATISFIED or UNKNOWN; unknown is never treated as satisfied.
 */

const gate = (id: GateId, status: GateStatus, reasons: string[], evidenceIds: string[] = []): Gate => ({
  id, label: GATE_LABEL[id], status, reasons, evidenceIds: [...new Set(evidenceIds)],
});

function personText(p: PersonRef | null, fallback: string | null, label: string): { known: "named" | "role-only" | "missing"; text: string } {
  if (p?.name) return { known: "named", text: `${label}: ${p.name}` };
  if (p) return { known: "role-only", text: `${label}: known by role only (name not recorded)` };
  if (fallback) return { known: "named", text: `${label}: ${fallback}` };
  return { known: "missing", text: `${label}: not recorded` };
}

export function latestValidation(validations: ValidationItem[]): ValidationItem | null {
  const decided = validations.filter((v) => v.state !== "PENDING" && v.timestamp);
  decided.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  return decided[0] ?? null;
}

/** A validation only counts when a human Technical Lead approved independent readiness and linked evidence. */
export function isFinalValidation(v: ValidationItem | null): boolean {
  return Boolean(v && v.state === "APPROVED" && v.validatedLevel === "INDEPENDENTLY_READY" && v.reviewerRole === "TECH_LEAD" && v.evidenceIds.length > 0);
}

export function computeGates(state: CaseState): Gate[] {
  const e = state.employee;
  const trackerEvidence = state.evidence.filter((x) => x.sourceType === "TRACKER").map((x) => x.id);
  const gates: Gate[] = [];

  // SCOPE_CONFIRMED — project and exact role
  if (!e.projectId) gates.push(gate("SCOPE_CONFIRMED", "UNSATISFIED", ["Project not recorded in the tracker."], trackerEvidence));
  else if (!e.role) gates.push(gate("SCOPE_CONFIRMED", "UNKNOWN", [`Project recorded (${e.projectName ?? e.projectId}); exact role not recorded.`], trackerEvidence));
  else gates.push(gate("SCOPE_CONFIRMED", "SATISFIED", [`Project ${e.projectName ?? e.projectId}, role ${e.role}.`], trackerEvidence));

  // OWNERS_ASSIGNED — Line Manager, Technical Lead, KT owner
  const ktOwnerFromActivities = state.kt.find((k) => k.status === "CONFIRMED" && k.owner)?.owner ?? null;
  const owners = [
    personText(state.people.lineManager, state.people.lineManagerText, "Line Manager"),
    personText(state.people.techLead, null, "Technical Lead"),
    personText(state.people.ktOwner, ktOwnerFromActivities, "KT owner"),
  ];
  const ownerStatus: GateStatus = owners.some((o) => o.known === "missing") ? "UNSATISFIED" : owners.some((o) => o.known === "role-only") ? "UNKNOWN" : "SATISFIED";
  gates.push(gate("OWNERS_ASSIGNED", ownerStatus, owners.map((o) => o.text), trackerEvidence));

  // ACCESS_IDENTIFIED / ACCESS_USABLE — only USABLE satisfies access
  const required = state.access.filter((a) => a.required);
  if (!required.length) {
    gates.push(gate("ACCESS_IDENTIFIED", "UNKNOWN", ["No required applications recorded for this case."]));
    gates.push(gate("ACCESS_USABLE", "UNKNOWN", ["No required access recorded, so usability cannot be assessed."]));
  } else {
    const ev = required.flatMap((a) => [a.evidenceId, a.requestEvidenceId, a.usableEvidenceId].filter((x): x is string => Boolean(x)));
    gates.push(gate("ACCESS_IDENTIFIED", "SATISFIED", [`Required: ${required.map((a) => a.application).join(", ")}.`], ev));
    const notUsable = required.filter((a) => a.status !== "USABLE");
    gates.push(notUsable.length
      ? gate("ACCESS_USABLE", "UNSATISFIED", notUsable.map((a) => `${a.application}: ${ACCESS_STATUS_LABEL[a.status]} — only confirmed successful use counts.`), ev)
      : gate("ACCESS_USABLE", "SATISFIED", required.map((a) => `${a.application}: successful use confirmed${a.usableConfirmedAt ? ` ${a.usableConfirmedAt}` : ""}.`), ev));
  }

  // KT_AGREED / EXECUTION_OBSERVED — assessments never satisfy execution
  const agreed = state.kt.filter((k) => k.status === "CONFIRMED" && k.required);
  const proposedKt = state.kt.filter((k) => k.status === "PROPOSED");
  const ktEvidence = agreed.map((k) => k.evidenceId).filter((x): x is string => Boolean(x));
  if (!agreed.length) {
    gates.push(gate("KT_AGREED", "UNKNOWN", [proposedKt.length ? `${proposedKt.length} KT activity(ies) proposed, none agreed yet.` : "No KT topics recorded."]));
    gates.push(gate("EXECUTION_OBSERVED", "UNKNOWN", ["No agreed KT activities, so execution cannot be assessed."]));
  } else {
    gates.push(gate("KT_AGREED", "SATISFIED", [`${agreed.length} KT activity(ies) agreed: ${agreed.map((k) => k.title).join(", ")}.`], ktEvidence));
    const reasons: string[] = [];
    let ok = true;
    for (const k of agreed) {
      if (k.stage === "INDEPENDENT_EXECUTION" && k.stageBasis === "OBSERVED") { reasons.push(`${k.title}: independent execution observed.`); continue; }
      ok = false;
      if (k.stage === "INDEPENDENT_EXECUTION" && k.stageBasis === "SELF_REPORTED") reasons.push(`${k.title}: independent execution self-reported, not observed.`);
      else if (k.stageBasis === "ASSESSMENT") reasons.push(`${k.title}: assessment results never replace observed execution.`);
      else reasons.push(`${k.title}: ${KT_STAGE_LABEL[k.stage]}.`);
    }
    gates.push(gate("EXECUTION_OBSERVED", ok ? "SATISFIED" : "UNSATISFIED", reasons, ktEvidence));
  }

  // NO_MATERIAL_CONFLICT — only human-accepted (OPEN) conflict findings count; AI proposals are flagged
  const openConflicts = state.findings.filter((f) => f.category === "CONFLICT" && f.status === "OPEN");
  const proposedConflicts = state.findings.filter((f) => f.category === "CONFLICT" && f.status === "PROPOSED");
  if (openConflicts.length) {
    gates.push(gate("NO_MATERIAL_CONFLICT", "UNSATISFIED", openConflicts.map((f) => `Unresolved: ${f.title}.`), openConflicts.flatMap((f) => f.evidenceIds)));
  } else {
    gates.push(gate("NO_MATERIAL_CONFLICT", "SATISFIED", [
      "No unresolved material conflict recorded.",
      ...(proposedConflicts.length ? [`${proposedConflicts.length} AI-proposed conflict(s) await human review and do not count until accepted.`] : []),
    ]));
  }

  // READINESS_DATE_RECORDED
  const date = state.caseInfo.expectedReadyAt ?? state.caseInfo.readinessReviewAt;
  gates.push(date
    ? gate("READINESS_DATE_RECORDED", "SATISFIED", [`Expected readiness/review date: ${date}.`])
    : gate("READINESS_DATE_RECORDED", "UNSATISFIED", ["No expected readiness or readiness review date recorded."]));

  // TECH_VALIDATION_APPROVED — human Technical Lead, linked evidence, independent level
  const v = latestValidation(state.validations);
  if (isFinalValidation(v)) gates.push(gate("TECH_VALIDATION_APPROVED", "SATISFIED", [`Validated by ${v!.reviewerName ?? "Technical Lead"} on ${v!.timestamp?.slice(0, 10)}.`], v!.evidenceIds));
  else if (!v) gates.push(gate("TECH_VALIDATION_APPROVED", "UNSATISFIED", ["No technical-owner validation recorded."]));
  else if (v.state === "APPROVED") gates.push(gate("TECH_VALIDATION_APPROVED", "UNSATISFIED", [`Validated as ${READINESS_LABEL[v.validatedLevel ?? "UNKNOWN"]}; independent readiness not validated.`], v.evidenceIds));
  else gates.push(gate("TECH_VALIDATION_APPROVED", "UNSATISFIED", [`Latest technical decision: ${v.state.replaceAll("_", " ").toLowerCase()}${v.comment ? ` — ${v.comment}` : ""}.`], v.evidenceIds));

  // BLOCKERS_OWNED
  const unownedFindings = state.findings.filter((f) => f.status === "OPEN" && ["HIGH", "CRITICAL"].includes(f.severity) && !f.ownerRole);
  const unownedAccess = state.access.filter((a) => a.required && a.status !== "USABLE" && !a.owner);
  const blockerReasons = [
    ...unownedFindings.map((f) => `No owner: ${f.title}.`),
    ...unownedAccess.map((a) => `${a.application}: owner of the next step not recorded.`),
  ];
  gates.push(blockerReasons.length
    ? gate("BLOCKERS_OWNED", "UNSATISFIED", blockerReasons, unownedFindings.flatMap((f) => f.evidenceIds))
    : gate("BLOCKERS_OWNED", "SATISFIED", ["Every open blocker has a recorded owner."]));

  return gates;
}
