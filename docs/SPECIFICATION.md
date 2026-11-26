# OnboardIQ working specification

OnboardIQ is an evidence-based decision-support platform for employee onboarding and knowledge transfer. It answers one business question per employee:

> **Is this person ready for the agreed scope — and if not, what exactly blocks it, who must act, and in what order?**

It turns fragmented evidence (tracker rows, emails, check-ins) into traceable findings, readiness gates and owned next actions. AI proposes; people decide.

## Organisation model (Business Owner's rules)

Hierarchy, top to bottom: **PMO → Additional Manager → Line Manager → Employee**. The **Technical Lead** sits beside the Line Manager, not in the reporting line; the Technical Lead may be the same person as the Line Manager.

| Role | Responsibility | Home page |
|---|---|---|
| **PMO** | Creates projects; assigns people; chooses each project's Additional Manager and Line Manager(s). Reads briefings about how projects are going and drives **improvements**. No day-to-day onboarding decisions. | Portfolio |
| **Additional Manager** | Chooses the project's Technical Lead (may be a Line Manager). Oversees the Line Managers below them and their teams. Receives escalations. Owns improvements assigned to them. | My projects |
| **Line Manager** | Follows their own employees and the phase each one is in. Updates pre-boarding items for their employees and confirms the hand-over to onboarding. Decides non-technical findings about their own employees. | My team |
| **Technical Lead** | Handles onboarding: defines the project's onboarding requirements, follows people in onboarding, confirms skills, decides findings and dependencies, and records technical validation (the only way to READY). | Onboarding |
| **HR** | Handles pre-boarding for everyone in pre-boarding. | Pre-boarding |
| **Employee** | Checks their own status; claims skills on their own profile; confirms their own access works. | My onboarding |

Roles are **per-project assignments** (`ProjectAssignment`: Additional Manager, Line Manager, Technical Lead, Employee), plus the organisation roles PMO and HR on the account. One person can hold several roles on one project (Iva Duka on Lumen; Jon Vale on the project created in the demo). Assignments are never deleted: ending one records a status (completed / removed), an end date and a reason. Everyone has a profile with skills and current and earlier projects.

Demo accounts are switched from the account menu in the top bar (HTTP-only cookie). This is not production authentication.

## Phases

`OnboardingCase.phase` is **Pre-boarding → Onboarding → Ready** (plus **Closed** when the employee leaves the project). It is separate from the readiness level and from reliability.

1. The PMO assigns a person to a project: a case opens in **Pre-boarding** with the default checklist (HR admin, welcome, equipment, contacts, required applications, access requests).
2. HR completes the HR-owned items; the Line Manager may update items for their own employees.
3. The **Line Manager confirms the hand-over** (only possible once HR's items are done or not applicable). The case moves to **Onboarding** and the Technical Lead takes over.
4. **Ready** is reached only when the project's Technical Lead records an approved validation of independent readiness.

Every phase change is audited with who, when and why. AI never changes phase.

## Projects, health and improvements

Project health is a deterministic function (`src/modules/projects/health.ts`, thresholds in `src/config/thresholds.ts`) with visible reasons and no percentages: **Critical** when open critical findings ≥ 1; **At risk** when any of high findings, access not working, overdue follow-ups, stale cases, pending sign-offs (≥ 2) reaches its threshold or the Additional Manager / Line Manager / Technical Lead is not assigned; **Not started** with no active employees; otherwise **On track**.

Improvements are created and approved by the PMO (an insight or an AI recommendation can only pre-fill the form) and owned — usually by an Additional Manager — who moves them to in progress and done with an outcome.

## Skills and onboarding requirements

The project's Technical Lead defines **onboarding requirements** (skill, knowledge transfer, access, document; linked skill and level; completion criteria; mandatory). Knowledge-transfer requirements create the employee's KT activities and access requirements create access requests — no second tracking system.

**Automatic check-off (deterministic):** when an employee has a **confirmed** skill at the required level or higher, the requirement is ticked off ("Already has this skill", linked to the skill record). A matching **claimed** skill only shows "Possibly covered" until a Technical Lead confirms it. The rule runs when requirements change, when someone is assigned and when a skill is decided. The Technical Lead can undo a check-off with a reason. Every check-off and undo is audited. A skill check-off counts toward the KT gates (citing the skill record) but **never** satisfies technical validation; the roadmap skips training only through check-offs. After a validated readiness the project's skill requirements can be added to the profile as confirmed skills in one click.

## Business rules

1. Access states are distinct: requested, approval pending, approved, provisioned and **usable**. Only usable (successful use confirmed) completes access. Credentials are never stored.
2. A delayed account records the system, request date, the owner of the next step, and the next follow-up. If none is recorded, that is a finding, never a guess.
3. KT stages: shadowing → supported execution → independent execution. Only stages observed by a technical owner count as execution evidence.
4. Ready with Support and Partially Ready follow the starter-pack definitions (see ASSUMPTIONS for the core/complex scope rule).
5. Final readiness is based on observed execution plus technical-owner validation, never on sessions attended, assessments or declarations.
6. Missing information stays Unknown. Unknown is never treated as satisfied.
7. Conflicts stay open until a human resolves them with a typed decision. Evidence is never deleted or edited.
8. AI output never writes readiness, validation, evidence, phase, skills, requirements, assignments or improvements. It only creates proposals that a human approves.
9. Actual, proposed and simulated information stay distinguishable. Anything not from the starter pack is labelled sample data.

## Readiness gates

| Gate | Satisfied when |
|---|---|
| `SCOPE_CONFIRMED` | project **and** exact role recorded |
| `OWNERS_ASSIGNED` | Line Manager, Technical Lead and KT owner identified by name |
| `ACCESS_IDENTIFIED` | required applications recorded |
| `ACCESS_USABLE` | every required access item is USABLE |
| `KT_AGREED` | at least one KT activity agreed (CONFIRMED) or a mandatory skill requirement defined |
| `EXECUTION_OBSERVED` | every agreed KT activity is at independent execution, **observed**, or covered by a confirmed skill (skill record cited); every mandatory skill requirement is covered or done |
| `NO_MATERIAL_CONFLICT` | no OPEN conflict finding (AI-proposed conflicts count only after acceptance) |
| `READINESS_DATE_RECORDED` | expected readiness or readiness-review date recorded |
| `TECH_VALIDATION_APPROVED` | latest decided validation is APPROVED at Independently Ready, by a human Technical Lead, with linked evidence |
| `BLOCKERS_OWNED` | every open HIGH/CRITICAL finding has an owner role, and every unusable access item has an owner |

Readiness is always shown three ways:

- **Reported**: the tracker status.
- **Assessed**: computed from gates and observed stages.
- **Validated**: a human Technical Lead decision.

Reliability (how trustworthy the reported status is) is shown separately.

## Permissions: role + relationship + phase

One module, `src/modules/permissions.ts`, used by every server action, route and page. `resolveScope(principal)` loads which projects, cases and people the user can see and in which role; `can(scope, permission, context)` is a pure function over that scope.

| Capability | Who |
|---|---|
| Create or edit a project; assign the Additional Manager and Line Managers; assign people; end assignments | PMO |
| Choose the Technical Lead (may be a Line Manager) | The project's Additional Manager |
| View cases | PMO: all (read-only for decisions). Additional Manager: cases on their projects. Line Manager: their reports. Technical Lead: people past pre-boarding on their projects. HR: everyone in pre-boarding. Employee: themselves only. |
| Update pre-boarding items | HR (any pre-boarding case); the employee's Line Manager |
| Confirm the hand-over to onboarding | The employee's Line Manager, once HR's items are done |
| Define requirements; change requirement status; undo a check-off | The project's Technical Lead |
| Confirm or reject skills | A Technical Lead of a project the person is on |
| Review evidence and claims; decide findings and dependencies | The **phase owner**: HR in pre-boarding, the Technical Lead afterwards. The Line Manager may also decide non-technical findings (access, ownership, missing information, out-of-date status) about their own employees. KT/technical claims always need the Technical Lead. |
| Approve technical roadmap items | The case's Technical Lead. Logistics and ownership items: phase owner or Line Manager. |
| Edit, approve and send (simulated) follow-ups; record responses | The phase owner or the employee's Line Manager, for **every** employee the follow-up covers. Never the PMO. |
| Escalations | Recommended up the hierarchy: Line Manager → Additional Manager → PMO. Never sent automatically. |
| Record technical validation (the only way to READY) | The project's Technical Lead only |
| Briefings | Everyone except employees, one variant per role they hold (PMO, Additional Manager, Line Manager, Technical Lead, HR), limited to their scope; optionally one project |
| Insights | PMO (portfolio); Additional Manager (their cases) |
| Create and approve improvements | PMO. The owner updates progress. |
| Claim a skill; confirm own access works | Employee, for themselves only |
| Audit & AI log | PMO (all); Technical Lead (their cases) |

AI is never an actor: a test checks that no AI module imports validation, phase, project, pre-boarding, skill, requirement, improvement or communication-sending code.

## Decision support delivered (per case)

| Where | What it delivers |
|---|---|
| **Overview** | reported / assessed / validated readiness; reliability; gates; §6 checklist; access, KT and stakeholders; technical validation |
| **Investigation** | rule findings and AI proposals with verbatim facts vs assumptions; side-by-side conflicts; resolve, dismiss or follow-up |
| **Dependency map** | root blocker, downstream impact, critical path, proposed vs confirmed edges |
| **Simulator** | what must be resolved, in which order, and what changes if it is |
| **Follow-ups** | who must act, consolidated per stakeholder, with escalation recommendations |
| **History** | full audit trail |
