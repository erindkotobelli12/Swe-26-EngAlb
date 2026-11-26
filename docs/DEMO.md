# Demo script (5–7 minutes)

**Setup** (before the audience joins):

```bash
npm run db:seed
npm run dev
```

Have Ollama running with the configured model. Open http://localhost:3000 as **PMO Coordinator**. The whole journey is also an automated Playwright test: `tests/e2e/journey.spec.ts`.

## 0. The problem (20 s)

Onboarding status lives in a tracker, emails and chats. Trackers say "On Track" or "closed" while access is unusable and nobody has observed the work. OnboardIQ turns that evidence into a defensible readiness decision and the next action.

## 1. Dashboard — PMO (40 s)

- Every number is computed by rules from stored records ("Actual" badge; nothing on this page is AI).
- KPIs: 10 official cases, cases needing intervention, **access items not usable**, open conflicts, unanswered requests, stale cases.
- Top issues: **Leo Marin — 3 access items not usable**. Evaluation date pinned to **14 Oct 2026**.

## 2. Leo → Investigation (60 s)

- Rule findings with **verbatim excerpts** from EMAIL-001 and EMAIL-002:
  - "Orion Portal is still awaiting application-owner approval."
  - "Helix Service Desk has not yet been provisioned."
  - Nova VPN active, but successful use unconfirmed.
  - The owner of Helix provisioning is not recorded.
- **Confirmed facts** vs **assumptions and hypotheses** are visually separate.
- Click **Investigate with AI**. The Detective Agent (local model) confirms or questions each finding, adds root-cause hypotheses (e.g. approval queue, unclear provisioning ownership) and recommends owner roles. Point at the AI run link: model, prompt version, time. Nothing changed state: it is a proposal.

## 3. Dependency map (60 s)

- Proposed (dashed) template edges: **Helix → Practical ticket-handling KT → Independent execution**. Proposed edges do not propagate yet.
- Switch to **Technical Lead** and confirm both edges (then, on the Roadmap tab, **Approve current plan as baseline**). The KT node, *Independent execution* and *Technical validation* turn **Blocked**. Helix is the **root blocker**.
- Click Helix to see its downstream impact, evidence and owner. Show "Simulate resolving this".

## 4. Simulator (50 s)

- Opens with **Helix → Usable** preselected. Add **Orion Portal → Approved**.
- Simulated level: **Blocked → Pre-onboarding**. KT unblocked; Helix no longer a root blocker.
- The remaining minimal prerequisite set appears in recommended order. Orion is still listed: **approved ≠ usable**.
- The purple **SIMULATION** banner is always on. Return to Overview: the actual record is unchanged (still Blocked, Helix still Requested).
- Optional: **Explain this simulation** (AI narrative from the deterministic diff only).

## 5. Follow-Up Center — PMO (50 s)

- One consolidated draft to **Access Support** (Helix, Orion, Nova) and a separate approval request to the **Orion Portal application owner**.
- Lina's EMAIL-005 is shown as unanswered for 6 days, routed to the **Technical Manager**.
- Priority breakdown and escalation recommendation (never automatic).
- Create the draft → edit → **Approve** → **Send (simulated)**. The SIMULATED OUTBOX label appears: nothing left the machine.

## 6. Record the response (60 s)

- Record: "Helix Service Desk has now been provisioned. Leo logged in successfully this morning."
- In Leo's Evidence tab the response is stored verbatim, pending review. Click **Extract claims (AI)**, or add the claim manually with the verbatim excerpt "Leo logged in successfully".
- **Approve** the claim. The 9-step **evidence pipeline** appears: state update Helix → USABLE; *Practical ticket-handling KT* unblocked; assessed level Blocked → Pre-onboarding; findings cleared.
- Map: Helix is green.
- **Roadmap**: "changes since the last approved version" shows *Helix → done* and *ticket-handling KT blocked → to do*. Optionally click **Suggest adjustments (AI)** for alternatives while waiting, which the TL approves.
- **History** shows every step with before/after values.

## 7. Eva — the conflict (45 s)

- Investigation: the side-by-side viewer shows the Technical Lead's "Ready with Support … two complex scenarios still need to be covered" against the Line Manager's "everything looks complete … working independently … onboarding closed". Reliability badge: **Conflicting**.
- As **Technical Lead**, record **Needs more evidence** with EMAIL-003 linked: "the two complex scenarios have not been observed". Validated stays **Not validated**.
- AI never sets final readiness. Only this TL form can, and AI code has no import path to it.

## 8. Briefing (40 s)

- Generate as **Technical Lead**: outstanding validations (Eva, Owen), KT gaps.
- Generate as **PMO**: urgent problems, intervention, escalations, priorities.
- Every statement has clickable reference chips; unreferenced AI statements are rejected. Export to **Markdown** or print to PDF.

## Closing (20 s)

- **Simulated:** email/Teams outbox, responses, the service-desk template, the simulator.
- **Limitations:** local 7–8B model speed and judgement (hence proposals only); sparse starter data shows as Unknown by design.
- **Next improvement:** roadmap and KT assessments on the same gate engine; real ITSM/Teams integrations behind the same approval gate.

---

## Slide outline

1. **Problem**: tracker status ≠ evidence. Access "provisioned" ≠ usable. "Closed" ≠ ready.
2. **Decision supported**: "Is this person ready for the agreed scope? If not, what blocks it, who acts, in which order?"
3. **Architecture**: evidence → claims → state → rules → AI proposals → human approval → audit. Local loopback LLM.
4. **Agents**: Detective, Dependency Suggestion, Extraction, Follow-Up Drafting, Roadmap, Briefing, Simulator Explanation, Bottleneck Insight, Assistant. Responsibilities and guards (docs/AGENTS.md).
5. **Purposeful AI**: semantics and drafting only. Rules decide. Every claim is a verbatim excerpt. Failures are visible.
6. **Live demo**: Leo (access blocker) → Eva (conflict) → Lina (follow-up).
7. **What is simulated / limitations / next improvement** (docs/LIMITATIONS.md).
8. **Questions for the Business Owner** (docs/ASSUMPTIONS.md).
