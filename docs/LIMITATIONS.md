# Limitations and what is simulated

## Simulated, by design

| Item | How it is simulated | How it is labelled |
|---|---|---|
| Email and Teams sending | **Send (simulated)** only places the approved message in a simulated outbox and stores it as simulated request evidence on each case. Nothing leaves the machine. | "Sent (simulated)", "SIMULATED OUTBOX" note, Simulated badge |
| Stakeholder responses | Typed or pasted into **Record response**. Stored verbatim as simulated evidence, then reviewed like any other evidence. | Simulated badge on the evidence |
| Application-owner approvals, provisioning | No real IAM/ITSM integration. Statuses change only through approved evidence claims or the employee's own usability confirmation. | — |
| Project-role onboarding template | `src/config/templates.ts` proposes "Practical ticket-handling KT" for any case requiring Helix Service Desk. This is demo configuration, not starter-pack data, and creates only PROPOSED items. | Proposed badge and note on the KT activity |
| What-if results | The simulator works on a copy of the case and never writes. | Slim violet "Simulation — not actual employee readiness" banner on the simulator |
| Historical onboarding data | Ten synthetic past cases (`SIM-011`…`SIM-020`, formerly in `data/cases.json`) with synthetic durations and delay causes. Shown on `/insights` only behind "Include simulated history", in separate charts, never mixed with actual figures. | "SIMULATED DATA" banner on every chart that uses it |
| Demo accounts | Cookie-based account switcher in the top bar; not authentication. | "Demo" tag in the account menu |
| Sample people, projects, skills and histories | Created for roles and data the starter pack does not contain (see ASSUMPTIONS). | "Sample data" tag |

All employee data is the fictional starter-pack dataset. The former extra cases ONB-011…020 are not in the starter pack. They were removed from the actual dataset and survive only as the labelled simulated history above.

Historical metrics on actual data show "Insufficient data (n = 0–1)". The starter pack has no completed onboardings with start and end timestamps, and no trend is implied from ten cases.

## Not built (cut to keep depth), hidden from navigation

The brief listed ten advanced features. The following were **not** built. They are hidden (their case tabs are disabled in `src/config/caseTabs.ts`), never shown half-built:

- **P1-5 KT assessments** (training materials, Assessment Agent, grading, progress chart). The gate engine already guarantees that assessment results can never satisfy execution or validation (`stageBasis = ASSESSMENT` is ignored; tested).
- **P2-10 "full twin" map mode** (people and evidence nodes) and "view state as of date". The case hub's Overview + History + embedded map / simulator / reliability already form the integrated view, and the evidence pipeline's 9 steps are shown live after each claim approval.

Roadmap simplification: phases are relative ("Week 1", "Weeks 2–3", "Week 4"), not calendar dates, because no agreed readiness dates exist. Training is skipped only when a requirement is ticked off by a confirmed skill; AI skip proposals are rejected.

Reason: three P0 features plus reliability, follow-ups, the roadmap, the briefing and bottleneck insights were completed end to end, connected through the case hub and covered by the e2e journey. That was preferred over shallow versions of every feature.

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
- Permissions are scoped by role, relationship and phase, but the scope is resolved per request from the database: fine for a prototype, would need caching at scale.
- Orion's Technical Lead exists only as a role, so no account can validate Eva in the demo; the Technical Lead of Nimbus (sample) can validate Leo.
- Only the PMO can end assignments; there is no self-service transfer between projects.
- Improvements are tracked but not linked back to measured outcomes yet.
- Project health uses fixed count thresholds; they need calibration with the Business Owner.
- Visual QA was done at 1280px and the layout adapts down to tablet width; phones are usable but not optimised.
- SQLite and JSON-in-string columns suit a prototype. Production would use PostgreSQL JSON columns and real authentication (SSO) with per-project authorisation.

## Next improvements

1. KT assessments (generated only from approved or simulated training materials) on top of the existing gate and permission model, feeding skill confirmation (source ASSESSMENT).
2. Historical bottleneck metrics on real data once enough completed cases with timestamps exist (the minimum-sample gate is already in place).
3. Real integrations: ITSM for access status, Teams/Outlook for sending, with the same approval gate.
4. Per-project template management by PMO and Technical Leads (replacing the simulated template).
