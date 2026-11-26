# OnboardIQ: Roles, Projects, Skills and a Clean UI

The Business Owner (our hackathon judge) gave us feedback on **how the organisation actually works**. Restructure OnboardIQ around that, and make the application look like a finished product rather than a developer tool.

You're working in the existing OnboardIQ repository on the `main` branch, latest commit "demo2.0". It is a Next.js 16 App Router app with React 19, strict TypeScript, Prisma 6 + SQLite, Tailwind 4, Zod, React Flow, Recharts, Vitest, Playwright and a local Ollama LLM. It already contains:
- the Detective;
- the dependency map;
- the simulator;
- reliability;
- the Follow-Up Center;
- the roadmap;
- the briefing;
- insights;
- the evidence pipeline;
- the readiness gates;
- the permission matrix (`src/modules/permissions.ts`).

**Keep all of that working.** This task changes *who does what*, adds the project, phase and skills structure, and redesigns the UI. Don't rebuild features that already exist.

---

## 0. How to work

1. **Read first:**
   - `CLAUDE.md`, `AGENTS.md` and `docs/*`;
   - `prisma/schema.prisma` and `prisma/seed.ts` (and `prisma/seed-data/`);
   - `src/lib/auth.ts`, `src/server/principal.ts`, `src/modules/permissions.ts`;
   - `src/config/navigation.ts`, `src/config/caseTabs.ts`;
   - `src/modules/case/*`, `src/modules/readiness/*`, `src/modules/roadmap/*`;
   - `src/components/**`.

   `AGENTS.md` says this Next.js version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before you write routing, server actions or caching code.
2. **Follow the conventions in `CLAUDE.md`:**
   - business logic goes in server modules;
   - validate every input with Zod;
   - use Prisma parameterised queries;
   - AI never writes readiness or evidence state;
   - source evidence is preserved.
3. **Make every schema change a new Prisma migration.** Don't edit existing migrations. The seed must stay idempotent.
4. Work on a new branch, `feature/roles-projects-ui`. **Commit at each checkpoint** in section 9. At every checkpoint:
   - `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` must all pass;
   - reseed with `npm run db:seed`;
   - click through the demo journey in section 8.
5. **When a role change breaks a test, update the test on purpose** to match the new rules. Never delete or weaken a test just to make it pass.
6. Don't push or open a PR unless I ask.
7. **When you finish, report:**
   - what changed;
   - what is simulated or sample data;
   - the assumptions you made (section 7);
   - anything you cut.

---

## 1. The organisation model (Business Owner's rules, so implement them exactly)

**Hierarchy, top to bottom:** PMO → Additional Manager → Line Manager → Employee.
The **Technical Lead** sits beside the Line Manager, not in the reporting line. The Technical Lead can be **the same person as the Line Manager** or a different person.

| Role | Responsibility | Main view |
|---|---|---|
| **PMO** | Creates projects. Assigns the people who will work on each project. Chooses each project's **Additional Manager** and **Line Manager(s)**. Otherwise the PMO does *not* run day-to-day onboarding: they read briefings about how projects are going and drive **improvements**. | Portfolio of projects and their health, briefings, insights and improvements |
| **Additional Manager** | Chooses the **Technical Lead** for a project (this can be the Line Manager). Oversees the Line Managers below them and those managers' employees. Receives escalations. | Their projects, their Line Managers and those managers' teams |
| **Line Manager** | Follows their own employees and the phase each one is in. **Can update the pre-boarding state** of their employees. | My team grouped by phase, pre-boarding updates, follow-ups |
| **Technical Lead** | **Handles onboarding.** Defines what employees need for onboarding on the project (the onboarding requirements). Follows how people in onboarding are doing. Validates technical readiness. | People in onboarding, onboarding requirements, investigations, validations |
| **HR** | **Handles pre-boarding.** Follows every employee who is in pre-boarding. | Pre-boarding pipeline and checklist |
| **Employee** | Checks their own status on the project. | My onboarding, plus My profile |

**Everyone has a profile tab** showing their skills and the projects they have worked on.

**Skill check-off rule.** When the Technical Lead defines an onboarding requirement that an employee already has as a skill, that requirement is automatically ticked off for that employee.

---

## 2. Data model changes

Make these changes through migrations. Reuse the existing models (`Person`, `User`, `Employee`, `Project`, `OnboardingCase`, `KTActivity`, `AccessRequest`, `RoadmapItem`, `Evidence`, `AuditLog`). Don't create parallel copies of them.

### 2.1 People, accounts and assignments
- **Roles become per-project assignments, not one global role.** One person can be both Line Manager and Technical Lead on the same project.
- Add a **`ProjectAssignment`** model with these fields:
  - `projectId` and `personId`;
  - `role`: `ADDITIONAL_MANAGER | LINE_MANAGER | TECH_LEAD | EMPLOYEE`;
  - `reportsToPersonId?` for the reporting line: Employee → Line Manager → Additional Manager;
  - `assignedById` and `assignedAt`;
  - `startDate?` and `endDate?`;
  - `status`: `ACTIVE | COMPLETED | REMOVED`.

  Rules for this model:
  - Assignments are never hard-deleted. Removing someone sets an end date and keeps an audit entry.
  - An employee's past projects are their `COMPLETED` assignments.
- **Organisation-level roles** live on `User`/`Person`: `PMO` and `HR`. They aren't tied to a project.
- **The `MANAGEMENT` role is replaced by `ADDITIONAL_MANAGER`.** Migrate existing references and any MANAGEMENT-specific briefing or dashboard content. Leftover management-level views (readiness distribution, risk) go to the PMO and the Additional Manager.
- Link **`Employee` to `Person`** so that every employee is a person with a profile. Keep `Employee` as the onboarding-case anchor, and avoid duplicating fields between the two.

### 2.2 Phases
- Add `OnboardingCase.phase`: `PRE_BOARDING | ONBOARDING | READY | CLOSED`.
  - Phase is **separate from** the readiness level and the reliability category, which already exist.
  - `READY` requires the existing human Technical Lead validation. AI can never change phase.
- Add **`PreboardingItem`** with these fields:
  - `employeeId`, `title`;
  - `category`: `HR_ADMIN | EQUIPMENT | ACCESS_REQUEST | WELCOME | CONTACTS`;
  - `ownerRole`: `HR` or `LINE_MANAGER`;
  - `status`: `TODO | IN_PROGRESS | DONE | BLOCKED | NOT_APPLICABLE`;
  - `blockerReason?`, `dueDate?`, `updatedBy`, `updatedAt`, `evidenceId?`.

  Seed a default checklist template. Map it to the starter-pack checklist items that belong before day one:
  - start date and movement type confirmed;
  - Line Manager, Technical Lead and KT owner identified;
  - required applications identified;
  - access requests submitted.

  **Never store credentials.**
- **Moving from pre-boarding to onboarding:**
  1. HR completes the HR-owned items.
  2. The Line Manager confirms the handover.
  3. The case moves to `ONBOARDING`, and the Technical Lead takes over.

  Every phase change is written to the audit log with who, when and why.

### 2.3 Skills and onboarding requirements
- **`Skill`**: `id`, `name`, `category` (`APPLICATION | TECHNICAL | DOMAIN | PROCESS`), `description`.
- **`EmployeeSkill`**: `personId`, `skillId`, `level` (`BASIC | INTERMEDIATE | ADVANCED`), `source`, `status`, `projectId?`, `evidenceId?`, `confirmedById?`, `confirmedAt?`.
  - `source` is one of `SELF_DECLARED | TL_CONFIRMED | PREVIOUS_PROJECT | ASSESSMENT`.
  - `status` is one of `CLAIMED | CONFIRMED | REJECTED`.
  - **Only `CONFIRMED` skills count for check-off.** An employee can add a skill to their own profile, but it stays `CLAIMED` until a Technical Lead confirms it.
- **`OnboardingRequirement`** is defined per project by its Technical Lead. Fields:
  - `projectId`, `title`, `description`;
  - `type`: `SKILL | KT_ACTIVITY | ACCESS | DOCUMENT`;
  - `skillId?` and `requiredLevel?`;
  - `completionCriteria`;
  - `mandatory`;
  - `createdById` and `status` (`ACTIVE | RETIRED`).
- **`EmployeeRequirementStatus`**: `employeeId`, `requirementId`, `status`, `satisfiedBySkillId?`, `decidedById?`, `decidedAt?`, `note?`.
  - `status` is one of `TODO | IN_PROGRESS | DONE | SATISFIED_BY_EXISTING_SKILL | WAIVED`.

**Automatic check-off is a deterministic rule.** It runs whenever:
- a requirement is created or edited;
- an employee is assigned to the project;
- a skill is confirmed.

How it works:
- If the employee has a `CONFIRMED` skill at **≥ the required level**, set the status to `SATISFIED_BY_EXISTING_SKILL`. Show it with a clear tick and "Already has this skill", and link to the skill record.
- If the employee has only a matching `CLAIMED` skill, show "Possibly covered: Technical Lead to confirm". Do **not** tick it off.
- The Technical Lead can undo a check-off with a reason. Every check-off and undo is audited.

**Fitting this into what already exists:**
- `KT_ACTIVITY` requirements create or link the employee's `KTActivity` rows, and `ACCESS` requirements create or link `AccessRequest` rows. Add a `requirementId` field to each. Don't build a second tracking system.
- A requirement satisfied by an existing skill counts toward the KT gates in `src/modules/readiness/gates.ts`, citing the skill record as its evidence. It **never** satisfies the technical-validation gate.
- The roadmap's "skip redundant training" logic must use these check-offs instead of its own guess.
- **Profiles grow over time.** When a Technical Lead validates an employee as ready on a project:
  - propose adding that project's `SKILL` requirements to the employee's profile as `CONFIRMED` (source `PREVIOUS_PROJECT`). The Technical Lead confirms the proposal in one click.
  - mark the assignment `COMPLETED` when the employee leaves the project.

### 2.4 Project health and improvements
- **Project health is a deterministic function** with visible reasons and no percentages. It returns `ON_TRACK | AT_RISK | CRITICAL | NOT_STARTED`, and it is computed from:
  - employees per phase;
  - open critical or high findings;
  - access items that aren't usable;
  - overdue follow-ups;
  - stale cases;
  - pending technical validations;
  - roles that haven't been assigned yet (no Additional Manager, Line Manager or Technical Lead).
- Put the thresholds in `src/config/thresholds.ts`.
- **`Improvement`** model, so the PMO can act on insights:
  - `projectId?` (null means it applies across the organisation);
  - `title`, `description`;
  - `source`: `INSIGHT | BRIEFING | MANUAL`;
  - `refs`: the finding, insight or case IDs it is based on;
  - `ownerPersonId`, usually the Additional Manager;
  - `status`: `PROPOSED | APPROVED | IN_PROGRESS | DONE | DROPPED`;
  - `createdById`, `dueDate?`, `outcomeNote?`.

  The AI insight recommendations that already exist can be turned into an improvement with one click. **Only a human creates or approves an improvement.**

### 2.5 Seed data. Don't fabricate facts.
- **Keep the 10 official starter-pack cases and the 8 evidence items exactly as they are.** Map them onto the new model:
  - The case table's "Manager" column becomes the **Line Manager**.
  - Official cases with status "Pre-Onboarding" (Noah) go to the `PRE_BOARDING` phase. All other official cases go to `ONBOARDING`.
  - Projects come from the official data.
- **Nobody in the starter pack is named as an Additional Manager, HR person or Technical Lead.** Create clearly labelled sample people for these roles. They must be marked `isSimulated`, and the UI shows a small "Sample data" tag on them.
  - Where a Technical Lead exists only as a role (Orion's, for example), keep it role-only, or add a labelled sample person.
  - **Never** present a sample person as starter-pack data.
- **Skills and previous projects are sample data too.** Give 3–4 reallocated employees labelled sample histories with `COMPLETED` assignments and confirmed skills, so the check-off feature can be demonstrated.
  - **Don't change Leo's Helix access-blocker story** while doing this. Pick skills that don't resolve that blocker.
- **Seed one project where the Line Manager is also the Technical Lead**, to show that the setup is supported.
- **Demo accounts:** at least one PMO, one Additional Manager, two Line Managers (including Sara Neri, Leo's manager), one Technical Lead, one HR, and the employees Leo and Mila.

---

## 3. Permissions: from global roles to scoped relationships

Rewrite `src/modules/permissions.ts` so that permissions depend on **role plus relationship plus phase**. Keep it one central, tested module that every server action and route calls.

Add a scope resolver, `resolveScope(principal)`, that returns:
- the projects, employees and cases this person can see;
- which roles they hold on each of those projects.

| Capability | Who |
|---|---|
| Create or edit a project; assign the Additional Manager and Line Managers; assign people to the project | PMO |
| Choose the Technical Lead (may be the Line Manager) | The project's Additional Manager |
| View cases | PMO: all, read-only, aggregated first. Additional Manager: cases in their projects. Line Manager: their reports. Technical Lead: employees in onboarding on their projects. HR: everyone in pre-boarding. Employee: themselves only. |
| Update pre-boarding items | HR: any pre-boarding case. Line Manager: their own employees. |
| Confirm the hand-over from pre-boarding to onboarding | The employee's Line Manager, once the HR items are complete |
| Define onboarding requirements; confirm or reject skills; undo a check-off | The project's Technical Lead |
| Review evidence and claims; decide findings and dependencies; approve technical roadmap items | The **owner of the case's current phase**: HR in pre-boarding, the Technical Lead in onboarding. The Line Manager can also decide non-technical findings about their own employees. |
| Approve, edit and simulated-send follow-ups; record responses | The phase owner, plus the employee's Line Manager. Escalations go up the hierarchy: Line Manager → Additional Manager → PMO. |
| Record technical validation (the only way to reach READY) | The project's Technical Lead only |
| Briefings and insights | PMO: portfolio level. Additional Manager: their projects. Line Manager and Technical Lead: their scope. |
| Create, approve and track improvements | PMO creates and approves. The Additional Manager owns and updates the ones assigned to them. |
| Claim a skill on their own profile; confirm their own access works | Employee (themselves only) |

- **Remove the PMO from day-to-day approvals.** Today the PMO approves communications, reviews evidence and decides findings and dependencies. Those decisions move to the owners in the table above.
- **AI is never an actor.** Keep the existing guard that AI modules can't import validation, phase or approval actions.
- **Tests** must cover, at minimum:
  - one person acting as both Line Manager and Technical Lead;
  - a Line Manager who can't see another manager's employee;
  - HR who can't edit an onboarding-phase case;
  - an Additional Manager who sees only their own projects' managers and teams;
  - an employee who sees only themselves;
  - the PMO who can't approve a follow-up or record a validation;
  - the hand-over, which requires the HR items to be complete.

---

## 4. New and restructured screens

### 4.1 Projects tab (PMO)
- **`/projects`** lists every project as a card or row showing:
  - the health status and the one-line reason for it;
  - the number of employees per phase (a small stacked bar);
  - the Additional Manager, Line Managers and Technical Lead (avatars), with clear "Not assigned" gaps;
  - open blockers and overdue follow-ups.

  The page has filters and search. **Create project** is the main button.
- **Create or edit a project** is a step-by-step dialog or page:
  1. Basic details: name, code, description, start date.
  2. Choose the Additional Manager.
  3. Choose the Line Manager(s).
  4. Assign employees, each with a Line Manager (the person they report to). Mark each assignment as a new hire or a reallocation; this is derived from whether the person has earlier assignments, and can be overridden.

  Saving creates `ProjectAssignment` rows. For each employee it also creates an onboarding case in `PRE_BOARDING` with the default pre-boarding checklist. Everything is audited.
- **`/projects/[id]`** has these tabs:
  - **Overview:** health and its reasons, phase funnel, key risks, recent changes.
  - **Team:** a hierarchy tree (Additional Manager → Line Managers → employees, with the Technical Lead shown beside them). It's an indented tree or org chart, not React Flow.
  - **Onboarding requirements:** the Technical Lead edits this tab; everyone else can only view it.
  - **Pre-boarding:** HR and Line Managers edit this tab.
  - **Improvements.**
  - **Briefing:** the existing briefing, limited to this project.

  The Additional Manager sees a **Choose Technical Lead** action here. It lists the project's people, Line Managers included, and shows a hint that the Line Manager can also be the Technical Lead.

### 4.2 A home page for each role (`/` sends each person to theirs)
- **PMO: "Portfolio".**
  - Health of each project.
  - The latest portfolio briefing, linked to its sources.
  - Top cross-project bottlenecks from Insights, each with a **Create improvement** button.
  - Improvements in progress.

  No case-level to-do lists. The PMO stays at the level of oversight and improvement.
- **Additional Manager: "My projects".**
  - Their projects.
  - Each Line Manager with team size, number of people blocked, and overdue items.
  - Escalations waiting for them.
  - Projects that still need a Technical Lead.
- **Line Manager: "My team".**
  - Employees grouped by phase (Pre-boarding / Onboarding / Ready), each with a phase stepper, the current blocker and the next step.
  - Pre-boarding items they can update directly.
  - Follow-ups for their team.
- **Technical Lead: "Onboarding".**
  - People in onboarding with their readiness level, reliability, and requirement progress (how many done or checked off out of the total).
  - Validations waiting for them.
  - Findings that need a decision.
  - Skills waiting for confirmation.
- **HR: "Pre-boarding".**
  - A board or table of everyone in pre-boarding with checklist progress, blocked items, start dates coming up in the next 14 days, and missing contacts.
- **Employee: "My onboarding".**
  - My project and role.
  - A phase stepper showing where I am now.
  - What I need to do next.
  - What I'm waiting on, and from whom.
  - My contacts: Line Manager, Technical Lead, HR.
  - My requirements, with the ones already covered by my skills ticked.
  - My access, with a **Confirm it works** button.

### 4.3 Profile tab for everyone: `/people/[id]` and "My profile"
- **Header:** name, current project and role, Line Manager.
- **Skills:**
  - grouped by category;
  - each with its level, its source, and whether it is confirmed or claimed;
  - **Add skill** for the person themselves (it starts as claimed);
  - **Confirm / Reject** for a Technical Lead in scope.
- **Projects:** current and past assignments with role, dates, and the outcome (validated readiness level where one exists).
- Respect the permission scope from section 3. A profile someone isn't allowed to see returns a clean "not available" page.

### 4.4 Onboarding requirements (Technical Lead)
- A simple editor for each project: add, edit or retire a requirement, with type, linked skill and level, completion criteria and mandatory flag.
- **A matrix view:** requirements down the side, project employees across the top. Each cell shows one of: to do, in progress, done, **already has skill** (tick plus tooltip linking to the skill record), possibly covered, or waived.
- The roadmap and the readiness gates update through the existing `recomputeCase`.

### 4.5 Existing features: keep them, but rescope them
- The case hub `/employees/[id]` and its tabs stay.
  - Add a **Requirements** tab (the employee's column of the matrix) and a **Pre-boarding** tab.
  - Show tabs and actions according to the new permissions.
- The Investigations, Follow-Up Center, Evidence inbox, Briefing and Insights pages stay, scoped to what the user can see.
- Follow-up escalations go up the hierarchy (Line Manager → Additional Manager → PMO).
- The briefing variants become PMO, Additional Manager, Line Manager, Technical Lead and HR. The HR variant covers the pre-boarding pipeline and start dates at risk.
- **Navigation per role.** Keep it short and grouped:
  - **PMO:** Portfolio, Projects, Briefing, Insights & improvements.
  - **Additional Manager:** My projects, Team, Escalations, Briefing.
  - **Line Manager:** My team, Pre-boarding, Follow-ups, Briefing.
  - **Technical Lead:** Onboarding, Requirements, Investigations, Evidence, Follow-ups, Briefing.
  - **HR:** Pre-boarding, Follow-ups, Briefing.
  - **Employee:** My onboarding, My profile, Knowledge, Assistant.
  - Move "AI activity" and the audit log into a low-key **Audit & AI log** entry for PMO and Technical Lead.

---

## 5. Make it look like a product, not a dev tool

Pick one calm, professional, enterprise-grade visual direction and apply it consistently to **every** page, old and new. **Transparency stays.** Traceability, provenance and AI labels remain, but they move into the background through progressive disclosure, instead of filling the screen.

**Foundation**
- **Font:** Inter through `next/font`.
- **Type scale:**
  - page title: 24px semibold;
  - section heading: 16px semibold;
  - body: 14px;
  - meta text: 12px;
  - tabular numbers for KPIs.
- **Colour:**
  - neutral page background (about `#F7F8FA`), white surfaces, slate text;
  - **one** brand accent, used sparingly;
  - status colours used only for status: green = ready or on track, amber = at risk, red = blocked or critical, slate = unknown, violet = simulated.
- **Shared design tokens** in `globals.css` (CSS variables plus the Tailwind theme). Radius 12px, 1px borders, very soft shadows, an 8px spacing grid, content max-width around 1280px.
- **Shared components** in `src/components/ui/`:
  - `PageHeader` (title, subtitle, actions);
  - `Card`, `StatCard`, `StatusPill`, `PhaseStepper`, `Avatar` (initials), `DataTable`;
  - `Tabs`, `Drawer` or side sheet, `Dialog`, `DropdownMenu`, `Tooltip`;
  - `Toast`, `Skeleton`, `EmptyState`;
  - `SourceChip`, which opens the evidence excerpt in a popover or drawer.

  Small copy-in primitives in the shadcn/ui style on Radix are fine. Don't add a heavy UI framework. **Replace all one-off styling with these components.**

**Layout**
- A clean sidebar with the navigation for each role, grouped, with the logo at the top. Remove the large "Demo user" box from the sidebar.
- A **top bar** containing:
  - breadcrumbs;
  - global search (employees, projects, people), with Ctrl/⌘+K as a nice extra;
  - an account menu: "Sara Neri · Line Manager ▾". The menu holds **Switch demo account**, with accounts grouped by role. A small "Demo" tag is the only sign that demo mode is on. Keep demo mode explained in the README.
- The evaluation date moves out of every page header. Show it once, quietly, in the account menu or the footer, as "Data as of 14 Oct 2026".

**Remove the developer look**
- No raw enum values on screen. `READY_WITH_SUPPORT` becomes "Ready with support", and gate names become plain sentences ("Waiting for technical sign-off"). Put all labels in one `src/lib/labels.ts`.
- Internal IDs (`ONB-005`, `CASE-…`, `EMAIL-003`, cuid values) appear only in detail drawers, in small monospace text. Show people's names and evidence titles instead.
- No JSON, no long lists of badges, and no "Re-run analysis" buttons in the main view. Recomputation already happens after changes; keep a manual "Refresh analysis" in an overflow menu for PMO and Technical Lead.
- Provenance:
  - **AI suggestion:** a small chip with a tooltip (model, time, "needs your approval").
  - **Facts vs assumptions:** a two-section layout inside the detail drawer.
  - **Simulated:** a violet pill plus a slim banner on the simulator only. Replace the loud stripes everywhere else. Sample people and data get a small "Sample data" tag.
- Every list has an **empty state** (icon, one plain sentence, main action). Every action has a **loading state** and a **toast** when it finishes. **Consequential actions** (validation, phase change, check-off undo, removing someone from a project) ask for confirmation in a dialog that requires a reason.
- Tables have comfortable row height, avatars, sticky headers and sensible column widths.
- Write all text in plain language and sentence case.
- Accessibility:
  - visible focus rings;
  - WCAG AA contrast;
  - labelled form fields;
  - works well from 1280px wide down to tablet width.

**Visual QA:** after the redesign, run the app and look at every route as every role. Use Playwright screenshots if helpful. Fix overflow, misalignment, inconsistent spacing and leftover developer-style text.

---

## 6. Don't break these principles (from the previous phase)
- AI proposes, humans decide.
  - Only a Technical Lead's validation can make someone READY.
  - AI never changes phase, skills, requirements, assignments or improvements.
- Every AI statement stays traceable to verbatim evidence, and the AI never gives confidence percentages.
- Actual, proposed and simulated information stays distinguishable. The styling is calmer, but the distinction remains.
- Missing information stays "Unknown" or "Not assigned". Never invent names, dates or skills. Anything that isn't from the starter pack is labelled sample data.
- Every change is audited with before and after values, including assignments, phase changes, check-offs and improvements.

---

## 7. Assumptions to record in `docs/ASSUMPTIONS.md`

Record these and confirm them with the Business Owner:
1. "Manager" in the starter-pack case table means the **Line Manager**.
2. Pre-boarding ends when HR's items are complete **and** the Line Manager confirms the hand-over.
3. The Line Manager can update pre-boarding items for their own employees, alongside HR.
4. An automatic skill check-off needs a **confirmed** skill at the required level or higher. Self-declared skills need a Technical Lead to confirm them.
5. A skill check-off counts toward the KT gates, but **never** replaces technical validation.
6. The PMO's view is project-level and read-only for cases. Day-to-day decisions belong to the phase owner.
7. Escalations go Line Manager → Additional Manager → PMO.
8. The former "Management" role is now the Additional Manager. The PMO covers portfolio-level reporting.

---

## 8. Demo journey (also write it as a Playwright end-to-end test)
1. **PMO**:
   - On the Portfolio page, Nimbus is "At risk", with its reasons shown.
   - Create a new project: choose its Additional Manager and Line Manager, then assign two employees. They appear in pre-boarding.
2. **Additional Manager**:
   - Choose the Line Manager as the new project's Technical Lead.
   - Look at the Line Managers and their teams.
3. **HR**:
   - On the Pre-boarding page, update checklist items for the new employees.
4. **Line Manager**:
   - Update a pre-boarding item.
   - Confirm the hand-over, so the employee moves to onboarding.
   - On My team, the employees are grouped by phase.
5. **Technical Lead**:
   - Define three onboarding requirements. A reallocated employee with a matching confirmed skill gets one ticked off automatically.
   - Confirm a skill that an employee claimed, and see the matrix update.
   - Open Leo's case: the Detective, dependency map and simulator all still work.
6. **Employee (Leo)**:
   - On My onboarding, see the phase, what's next, what he's waiting on and his contacts.
   - On My profile, see his skills and past projects.
7. **PMO**:
   - Generate the portfolio briefing.
   - Turn an insight into an improvement owned by the Additional Manager.

Update `docs/DEMO.md` to follow this journey. Keep the Eva conflict and Leo access stories as the evidence examples.

---

## 9. Order of work and checkpoints
1. **UI foundation:** design tokens, shared components, new layout (sidebar, top bar, account menu), `labels.ts`. → *checkpoint*
2. **Organisation model:** migrations for assignments, phases and the role change, the scoped permissions module with its tests, and the seed mapping. → *checkpoint*
3. **Projects:** list, creation flow, project detail page, Team tree, Technical Lead selection, project health. → *checkpoint*
4. **Phases:** pre-boarding checklist, HR and Line Manager screens, hand-over. → *checkpoint*
5. **Skills and requirements:** profiles, requirements editor, matrix, automatic check-off, links to KT, roadmap and gates. → *checkpoint*
6. **Role home pages,** the PMO's briefing and improvements, and rescoped navigation and briefings. → *checkpoint*
7. **Restyle every existing page** with the new components, then visual QA. → *checkpoint*
8. **Docs:**
   - update `SPECIFICATION.md` (roles, hierarchy, the permission table, phases);
   - update `AGENTS.md` (which roles approve each agent's output now);
   - update `ARCHITECTURE.md` (data model);
   - update `ASSUMPTIONS.md`, `DEMO.md`, `LIMITATIONS.md` and the README.

   Then run the end-to-end journey and make the final commit.

If time runs short, finish steps 1–6 properly, then restyle the pages used in the demo journey first. Hide anything unfinished. Don't ship it half-built.
