# Assumptions, rule choices and open questions

## Clock and thresholds (`src/config/thresholds.ts`, overridable by environment variable)

| Setting | Value | Use |
|---|---|---|
| `DEMO_EVALUATION_DATE` | 2026-10-14 | The single evaluation clock (`src/lib/clock.ts`). Every age, overdue and stale calculation uses it. Shown as "Evaluation date". Audit timestamps use real time. |
| `STALE_AFTER_DAYS` | 7 | Status or evidence older than this is stale/outdated. Stale findings become HIGH beyond 3× (21 days). |
| `FOLLOW_UP_AFTER_DAYS` | 3 | An unanswered request becomes a finding. |
| `REMINDER_AFTER_DAYS` | 3 | Reminder level 1 in the Follow-Up Center. |
| `ESCALATE_AFTER_DAYS` | 7 | Escalation **recommended** (never automatic). |
| `MIN_SAMPLE_SIZE` | 5 | Reserved for historical metrics (see LIMITATIONS). |

## Rule choices

- **Access**: only `USABLE` satisfies an access gate. `PROVISIONED` ("active") means use is unconfirmed. Only the employee (authoritative for successful use) can confirm their own usability, or an approved claim from evidence can.
- **Readiness levels**:
  - Ready with Support = every **core** KT activity independently executed, with **complex/exception** scope still supported, or all done but not validated.
  - Partially Ready = part of the core scope is independent.
  - `INDEPENDENTLY_READY` requires all ten gates, including an APPROVED validation at that level by a human Technical Lead with linked evidence.
- **Execution evidence**:
  - Only stages with basis OBSERVED (technical owner / KT owner) satisfy `EXECUTION_OBSERVED`.
  - Self-reported and tracker-reported stages are shown, but do not count.
  - Assessment results never move a stage or satisfy a gate.
- **Conservative negatives**: a tracker status of "Blocked" is accepted even without evidence (the system never assesses higher than any source allows). Positive tracker statuses are not trusted without evidence.
- **Unknown ≠ satisfied**: missing data yields UNKNOWN or UNSATISFIED gates. A person known only by role (e.g. "Technical Lead — Orion") makes `OWNERS_ASSIGNED` UNKNOWN, not satisfied.
- **Conflicts**:
  - Progression fields (access status, KT stage) conflict only on the same date. A later value is an update.
  - Other fields conflict within the stale window (7 days).
  - Conflicts are never auto-resolved; other rule findings auto-clear (audited, "condition cleared") when the condition disappears.
- **Requests never support a status.** A request (including a sent follow-up) asks for information. It is excluded when deciding whether a status is supported or stale.
- **Severity** comes from a fixed table per finding type (`TYPE_META`). AI findings use a per-category table, raised to CRITICAL when a contradiction touches readiness.
- **Reliability precedence**: Conflicting → Insufficient evidence → Outdated → Unverified → Verified → Well-supported. Insufficient precedes Outdated because the age of a status nothing supports is moot. Reasons and source IDs are always returned.
- **Source authority** (`src/domain/authority.ts`):

  | Topic | Authoritative source |
  |---|---|
  | Technical readiness | Technical Lead, KT owner, Technical Manager |
  | Provisioning | Access Support, Application owner |
  | Successful use | Employee |
  | Local logistics | Line Manager, PMO, HR |
  | Ownership | Technical Manager, PMO, Line Manager, Project Manager |

  An employee statement is otherwise a self-report.
- **Dependency graph is AND-only**: a node needs every confirmed upstream node. The unsatisfied confirmed ancestors of Readiness are therefore exactly the minimal prerequisite set. OR-alternatives would need a search; they are not modelled.
- **Only confirmed edges propagate**. Proposed edges can be included in the simulator with an explicit toggle, and results are then labelled.
- **Follow-up routing**:
  - access → the team handling the request, plus the approver for pending approvals;
  - technical findings → the case's Technical Lead;
  - logistics/status findings → the Line Manager;
  - unanswered requests → the original recipient;
  - unresolvable → PMO ("identify owner").
- **Channels**: named people get a Teams message; role mailboxes get email.
- **Priority score** = downstream impact × 5 + severity points (40/25/10/5) + days beyond the follow-up threshold × 2 + escalation level × 10.

## Organisation model (to confirm with the Business Owner)

1. "Manager" in the starter-pack case table means the **Line Manager**.
2. Pre-boarding ends when HR's items are complete **and** the Line Manager confirms the hand-over.
3. The Line Manager can update pre-boarding items for their own employees, alongside HR.
4. An automatic skill check-off needs a **confirmed** skill at the required level or higher. Self-declared skills need a Technical Lead to confirm them.
5. A skill check-off counts toward the KT gates, but **never** replaces technical validation.
6. The PMO's view is project-level and read-only for cases. Day-to-day decisions belong to the phase owner (HR in pre-boarding, the Technical Lead in onboarding); the Line Manager may decide non-technical findings about their own employees.
7. Escalations go Line Manager → Additional Manager → PMO.
8. The former "Management" role is now the Additional Manager. The PMO covers portfolio-level reporting.

Further choices made while building it:

- **Sample people and data.** The starter pack names no Additional Manager, HR person or Technical Lead (Orion's exists only as a role). Sample people (Petra Lind – PMO, Marco Ruiz and Elena Sato – Additional Managers, Ben Okafor – Technical Lead, Iva Duka – Line Manager and Technical Lead, Hana Ilic – HR, Rina Kola and Dren Leka – available for assignment), two sample projects (Lumen, Cirrus), skills and earlier-project histories are created in `prisma/seed-data/sample.ts`, marked `isSimulated` and tagged "Sample data" in the UI.
- **Sample data never changes starter-pack facts.** Sample Technical Lead assignments on official projects are not copied onto the official cases, so the readiness gates (e.g. "Technical Lead not recorded" for Leo) stay exactly as derived from the pack. A Technical Lead chosen in the app (a real action) is copied onto the cases of that project.
- **Phase of the official cases.** Noah ("Pre-Onboarding") starts in pre-boarding; the other nine in onboarding. Noah's checklist marks only what the tracker shows (start date and movement; Line Manager named) and leaves the rest To do.
- **Default pre-boarding checklist.** Four items come from the starter-pack §6 checklist; contract/paperwork, welcome message and equipment are common practice. Due dates are targets relative to the start date.
- **Requirement types.** Skill and document requirements are tracked as requirement status; knowledge-transfer requirements create KT activities and access requirements create access requests. A mandatory skill requirement counts toward the KT gates.
- **Movement** of a new assignment (new hire / reallocation) is derived from whether the person has an earlier completed assignment and can be overridden in the wizard.
- **Technical Lead candidates** are the project's Line Managers and people whose role is Technical Lead.
- **Project health thresholds**: critical at 1 open critical finding; at risk at 1 high finding, 1 access item not working, 1 overdue follow-up, 1 stale case, 2 pending sign-offs, or a missing Additional Manager / Line Manager / Technical Lead (all in `src/config/thresholds.ts`, overridable by environment variable).
- **One onboarding case per person.** A person whose case is closed is reopened in pre-boarding when reassigned.

## Interpretations of the starter-pack data

- The tracker "Manager" column is treated as the **Line Manager**.
- EMAIL-004's Line Manager is not assumed to be Luca Gray; the sender is stored by role only.
- Eva: "can handle standard requests with occasional support" is mapped to **independent execution of the standard (core) scope**, because occasional support is not step-by-step support. "Two complex scenarios still need to be covered" is **complex scope, not started**. This reproduces the Technical Lead's own classification (Ready with Support).
- Eva: the Technical Lead who sends the weekly KT update is treated as her KT owner (role-only person).
- **EMAIL-003 is not treated as technical validation.** It is authoritative evidence for the *assessed* level only. `KT-EVA-*.validation` is PENDING.
- Owen: "daily standard activities" (core, independent), "production changes" (core, supported) and "exceptions" (complex, supported), all **self-reported**. Treating production changes as core scope reproduces the tracker's "Partially Ready".
- Iris: "access expected next week" is recorded as an access request (status REQUESTED, system not named, request date unknown). "Shadowing started" is a reported (not observed) shadowing stage.
- Leo: EMAIL-001 is from the Project Manager to Access Support (07 Oct). Helix is therefore REQUESTED, not NOT_REQUESTED. Nova is PROVISIONED (active, use unconfirmed). The Helix provisioning owner is unknown.
- Nova VPN and Orion Portal are treated as **application names**, not links to the Nova and Orion projects.
- Atlas documents (EMAIL-008) are project-owned. Only the folder reference is stored, and no content is copied.
- ONB-011…ONB-020 from the old `data/cases.json` are not in the official starter pack. They were removed from the actual dataset.
- The "service desk onboarding" template (proposes "Practical ticket-handling KT" for anyone needing Helix Service Desk) is **simulated demo configuration**. It only creates PROPOSED items.

## Questions for the Business Owner

1. Does the Technical Lead's weekly classification (e.g. EMAIL-003 "Ready with Support") count as technical validation, or must a formal validation record exist?
2. What are the correct stale and follow-up thresholds (we assume 7 and 3 days)?
3. Are the escalation timings right (we assume a reminder after 3 days and an escalation recommendation, up the hierarchy, after 7)?
4. Who may close onboarding? Can a Line Manager declare closure (EMAIL-004) without technical validation?
5. Which applications are required per project and role? (Only Leo's and Iris's are known.)
6. Are Nova VPN and Orion Portal related to the Nova and Orion projects?
7. Who owns Helix Service Desk provisioning?
8. Is "can handle standard requests with occasional support" independent execution of the standard scope?
9. Are "production changes" part of Owen's core scope or an exception?
10. Who is Lina's Technical Manager and KT owner, and what are her project and exact role?
11. May the Atlas KT owner's runbook be summarised for assessments, or only referenced?
