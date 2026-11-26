# OnboardIQ working specification

OnboardIQ is an evidence-based decision-support platform for employee onboarding and knowledge transfer. It answers one business question per employee:

> **Is this person ready for the agreed scope — and if not, what exactly blocks it, who must act, and in what order?**

It turns fragmented evidence (tracker rows, emails, check-ins) into traceable findings, readiness gates and owned next actions. AI proposes; people decide.

## Roles (demo users)

| Role | Main views | Typical decisions |
|---|---|---|
| PMO Coordinator | Dashboard, Investigations, Follow-Up Center, Briefing, Evidence inbox | Review evidence and claims; accept/resolve findings; confirm dependencies; approve and send (simulated) follow-ups |
| Technical Lead | Same, plus validation | Approve KT/technical claims; confirm dependencies; record readiness validation (the **only** path to a validated level) |
| Line Manager | Dashboard, Follow-Ups (read), Briefing (local blockers), Evidence | Add evidence |
| Management | Dashboard, Investigations (read), Briefing (risk and distribution), AI activity | Read-only |
| Employee (Mila, Leo) | My workspace, own case, Assistant (own case only) | Confirm successful use of their own access; add evidence about themselves |

Demo users are selected with the sidebar switcher (HTTP-only cookie). This is not production authentication. Employee users map to their own case through `User.employeeId`.

## Business rules

1. Access states are distinct: requested, approval pending, approved, provisioned and **usable**. Only usable (successful use confirmed) completes access. Credentials are never stored.
2. A delayed account records the system, request date, the owner of the next step, and the next follow-up. If none is recorded, that is a finding, never a guess.
3. KT stages: shadowing → supported execution → independent execution. Only stages observed by a technical owner count as execution evidence.
4. Ready with Support and Partially Ready follow the starter-pack definitions (see ASSUMPTIONS for the core/complex scope rule).
5. Final readiness is based on observed execution plus technical-owner validation, never on sessions attended, assessments or declarations.
6. Missing information stays Unknown. Unknown is never treated as satisfied.
7. Conflicts stay open until a human resolves them with a typed decision. Evidence is never deleted or edited.
8. AI output never writes readiness, validation or evidence state. It only creates proposals that a human approves.

## Readiness gates

| Gate | Satisfied when |
|---|---|
| `SCOPE_CONFIRMED` | project **and** exact role recorded |
| `OWNERS_ASSIGNED` | Line Manager, Technical Lead and KT owner identified by name |
| `ACCESS_IDENTIFIED` | required applications recorded |
| `ACCESS_USABLE` | every required access item is USABLE |
| `KT_AGREED` | at least one KT activity agreed (CONFIRMED) |
| `EXECUTION_OBSERVED` | every agreed KT activity is at independent execution, **observed** |
| `NO_MATERIAL_CONFLICT` | no OPEN conflict finding (AI-proposed conflicts count only after acceptance) |
| `READINESS_DATE_RECORDED` | expected readiness or readiness-review date recorded |
| `TECH_VALIDATION_APPROVED` | latest decided validation is APPROVED at Independently Ready, by a human Technical Lead, with linked evidence |
| `BLOCKERS_OWNED` | every open HIGH/CRITICAL finding has an owner role, and every unusable access item has an owner |

Readiness is always shown three ways:

- **Reported**: the tracker status.
- **Assessed**: computed from gates and observed stages.
- **Validated**: a human Technical Lead decision.

Reliability (how trustworthy the reported status is) is shown separately.

## Permissions matrix (role × action)

Enforced server-side in every action (`src/modules/permissions.ts`). "own" means only for the user's own case.

| Action | PMO | Tech Lead | Line Mgr | Mgmt | Employee |
|---|:-:|:-:|:-:|:-:|:-:|
| View a case | ✓ | ✓ | ✓ | ✓ | own |
| Re-run deterministic analysis | ✓ | ✓ | | | |
| Add evidence | ✓ | ✓ | ✓ | | own |
| Review evidence and claims | ✓ | ✓ | | | |
| Approve KT / technical claims | | ✓ | | | |
| Confirm own access usability | | | | | own |
| Resolve / dismiss / accept findings | ✓ | ✓ | | | |
| Confirm / reject dependencies | ✓ | ✓ | | | |
| **Record readiness validation** | | **✓** | | | |
| Edit / approve / send (simulated) follow-ups | ✓ | | | | |
| Record a follow-up response | ✓ | | | | |
| Run AI agents (investigate, suggest, extract, draft) | ✓ | ✓ | | | |
| Run what-if simulations | ✓ | ✓ | ✓ | ✓ | own |
| Generate a briefing | ✓ | ✓ | ✓ | ✓ | |
| View case history | ✓ | ✓ | | ✓ | own |

## Decision support delivered (per case)

| Where | What it delivers |
|---|---|
| **Overview** | reported / assessed / validated readiness; reliability; gates; §6 checklist; access, KT and stakeholders; technical validation |
| **Investigation** | rule findings and AI proposals with verbatim facts vs assumptions; side-by-side conflicts; resolve, dismiss or follow-up |
| **Dependency map** | root blocker, downstream impact, critical path, proposed vs confirmed edges |
| **Simulator** | what must be resolved, in which order, and what changes if it is |
| **Follow-ups** | who must act, consolidated per stakeholder, with escalation recommendations |
| **History** | full audit trail |
