# Limitations and what is simulated

## Simulated, by design

| Item | How it is simulated | How it is labelled |
|---|---|---|
| Email and Teams sending | **Send (simulated)** only places the approved message in a simulated outbox and stores it as simulated request evidence on each case. Nothing leaves the machine. | "Sent (simulated)", striped purple "SIMULATED OUTBOX" banner, Simulated badge |
| Stakeholder responses | Typed or pasted into **Record response**. Stored verbatim as simulated evidence, then reviewed like any other evidence. | Simulated badge on the evidence |
| Application-owner approvals, provisioning | No real IAM/ITSM integration. Statuses change only through approved evidence claims or the employee's own usability confirmation. | — |
| Project-role onboarding template | `src/config/templates.ts` proposes "Practical ticket-handling KT" for any case requiring Helix Service Desk. This is demo configuration, not starter-pack data, and creates only PROPOSED items. | Proposed badge and note on the KT activity |
| What-if results | The simulator works on a copy of the case and never writes. | Persistent "SIMULATION — not actual employee readiness" banner |
| Demo users and roles | Cookie-based switcher with role-only labels; not authentication. | Sidebar note |

All employee data is the fictional starter-pack dataset. The former extra cases ONB-011…020 were removed from the actual dataset because they are not in the starter pack.

## Not built (cut to keep depth), hidden from navigation

The brief listed ten advanced features. The following were **not** built. They are hidden (their case tabs are disabled in `src/config/caseTabs.ts`), never shown half-built:

- **P1-4 Adaptive onboarding roadmap** (Roadmap Agent, timeline, roadmap approvals).
- **P1-5 KT assessments** (training materials, Assessment Agent, grading, progress chart). The gate engine already guarantees that assessment results can never satisfy execution or validation (`stageBasis = ASSESSMENT` is ignored; tested).
- **P2-9 Organizational bottleneck insights** (`/insights`). Historical metrics would also need start/end timestamps the starter pack does not contain. With 10 cases, any trend would be misleading.
- **P2-10 "full twin" map mode** (people and evidence nodes) and "view state as of date". The case hub's Overview + History + embedded map / simulator / reliability already form the integrated view, and the evidence pipeline's 9 steps are shown live after each claim approval.

Reason: three P0 features plus reliability, follow-ups and the briefing were completed end to end, connected through the case hub and covered by the e2e journey. That was preferred over shallow versions of every feature.

## Model and data limits

- A local 7–8B model (tested with `qwen2.5:7b` and `granite4.2:8b`; `llama3.2` 3B is the minimum) runs on CPU in this demo:
  - first call ≈ 100 s (model load);
  - later calls 15–40 s per case.
  - "Investigate all open cases" runs sequentially with progress.
- Small models sometimes misjudge (e.g. calling a valid rule candidate "not an issue") or use non-whitelisted claim fields. This is why AI verdicts are suggestions and every value passes deterministic verification.
- Excerpt verification checks that a quote exists. It cannot prove the quote *supports* the statement; a human reviewer does that.
- The follow-up drafting guard detects names from the database outside the allowed set. It cannot detect invented names that are not in the database, or soft promises. PMO approval is the control.
- Required applications and KT topics are known only where evidence states them (Leo, Iris, Eva, Owen). Other cases correctly show Unknown.
- Briefing "changes since previous" compares snapshots per role, so the first briefing has no diff.
- The demo Technical Lead can validate any case. In production, validation would be scoped to the cases a technical owner is responsible for.
- SQLite and JSON-in-string columns suit a prototype. Production would use PostgreSQL JSON columns and real authentication (SSO) with per-project authorisation.

## Next improvements

1. Roadmap and KT assessments on top of the existing gate and permission model.
2. Bottleneck insights once enough historical cases with timestamps exist (minimum sample size gate already configured).
3. Real integrations: ITSM for access status, Teams/Outlook for sending, with the same approval gate.
4. Per-project template management by PMO and Technical Leads (replacing the simulated template).
