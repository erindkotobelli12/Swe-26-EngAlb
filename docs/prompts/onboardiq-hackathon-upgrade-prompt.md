# OnboardIQ — Hackathon Upgrade Prompt

You are working in the existing **OnboardIQ** repository (Next.js 16 App Router, React 19, strict TypeScript, Prisma 6 + SQLite, Tailwind 4, Zod, Recharts, Vitest, Playwright, local Ollama LLM). Turn it into a cohesive, evidence-based **AI onboarding decision-support platform**. It must meet the Engineering Albania *Employee Onboarding & Knowledge Transfer* hackathon requirements and add the ten advanced features listed below.

Read this whole prompt before changing anything. Then inspect the code. Reuse the current architecture, database, services, AI provider and UI components. Don't rebuild what already works, and don't add libraries or layers you don't need.

---

## 0. How to work

1. **Read before writing.** Read `CLAUDE.md`, `AGENTS.md` and everything under `docs/`, `prisma/`, `src/`, `tests/`. `AGENTS.md` says this Next.js version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing route handlers, server actions, `params`, caching or revalidation code.
2. **Follow the repo conventions in `CLAUDE.md`:**
   - Business logic goes in server modules, not React components.
   - Use Zod on every input.
   - Use Prisma parameterised queries.
   - AI output never writes readiness or evidence state directly.
   - Source evidence is preserved.
   - Approvals and corrections are stored separately.
3. **Use migrations.** Every schema change is a `prisma migrate dev --name <descriptive>` migration. Never edit the existing `init` migration.
4. **Work in checkpoints.** After Phase A, after P0, after P1 and after P2:
   - Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.
   - Reseed with `npm run db:seed`.
   - Click through the demo journey (section 7).
   - Commit with a descriptive message.

   Never leave the app in a non-building state between checkpoints.
5. **Cut breadth, not depth.** If time runs short, stop at the last clean checkpoint. A feature that isn't fully working is hidden from navigation. Don't show it half-built. Three excellent, connected features beat ten shallow ones.
6. **Don't push, open PRs or add reviewers unless I ask.** Work on a branch named `feature/decision-support`.
7. **At the end, report back** with:
   - what was implemented, per feature;
   - what is simulated;
   - what was cut and why;
   - the open questions for the Business Owner.

---

## 1. What the hackathon judges reward

Use this weighting when you make trade-offs:

| Weight | Criterion | What it means for this work |
|---|---|---|
| **40%** | Usable, production-ready solution: a credible end-to-end experience that supports a real onboarding decision | Every visible button works. Empty, loading and error states are real. One journey runs flawlessly from problem → evidence → decision → next action. No hard-coded per-employee logic. |
| **25%** | Quality of the agent specifications: clear responsibilities, inputs, outputs, rules, interactions | `docs/AGENTS.md` must describe agents that actually exist in the code, with their exact inputs, outputs, prompts, guards, limitations and human checks. |
| **15%** | Use of LLMs: purposeful and responsible | Use the LLM only where semantic understanding adds value. Every AI claim traces to verbatim evidence. AI proposes and humans decide. Failures are visible, never faked. |
| **15%** | Technical approach and architecture | One coherent pipeline: evidence → claims → state → rules → findings → actions. No duplicated logic between pages. |
| **5%** | Presentation | A demo script that shows one employee case, the evidence behind the decision, what is simulated, the limitations and the next improvement. |

The mandatory deliverables are:
- a working prototype showing one journey with at least one blocker, missing-information or conflicting-information case;
- the business decision it supports and the next action;
- agent specifications;
- an explanation of purposeful AI use;
- a Git repo with setup instructions and the working specification;
- a demo.

Domain rules from the starter pack. These are business rules, so implement them deterministically:
- **Access:** *requested*, *approved*, *provisioned* and *usable* are different states. An account is not complete until the user has successfully used it. A delayed account records the missing system, request date, owner and next follow-up. **Never store passwords or credentials anywhere.**
- **KT stages:**
  - **Shadowing:** the employee watches an experienced colleague.
  - **Supported execution:** the employee does the work with guidance or review.
  - **Independent execution:** the employee does the agreed work without step-by-step support and knows when to escalate.
- **Readiness levels:**
  - **Ready with Support:** operational for the agreed scope, with occasional support for exceptions or complex cases.
  - **Partially Ready:** autonomous for only part of the scope.
- **Final readiness** is based on observed execution plus technical-owner validation, not on the number of sessions attended.
- **The basic onboarding checklist** (starter pack §6) is the canonical list of prerequisites. Model each item explicitly:
  - start date and movement confirmed;
  - project and exact role confirmed;
  - Line Manager, Technical Lead and KT owner identified;
  - required applications identified;
  - access requests tracked;
  - KT topics agreed;
  - shadowing, supported and independent execution evidence captured;
  - expected readiness date recorded;
  - final status validated by the technical owner;
  - reusable KT documents or folder location recorded;
  - blockers owned and followed to closure.
- **Boundaries:** fictional data only, mocked integrations only, no real production systems.

---

## 2. Current-state audit: fix these first (Phase A, before any new feature)

I inspected the repo. These problems would undermine every new feature and the 40% "production-ready" score. Fix them first.

### 2.1 Hard-coded per-employee logic (critical)
- `src/modules/findings/gapEngine.ts` creates findings with `if (employee.id === "ONB-005")`, `"ONB-002"`, `"ONB-009"`, `"ONB-010"`, `"ONB-008"`.
- `src/modules/readiness/assessment.ts` returns hard-coded statuses for `ONB-005`, `ONB-010` and `ONB-008`.
- `src/app/dashboard/page.tsx` passes `accessRequired: e.id==="ONB-002"?3:0` and `hasMaterialConflict: e.id==="ONB-005"`. Its "Priority actions" and "AI evidence summary" panels are static text.
- `src/app/employees/[id]/page.tsx` renders the Conflict Center only when `id==="ONB-005"`, with hard-coded quotes.
- `src/app/workspace/page.tsx`, `src/lib/auth.ts` and `src/app/api/assistant/route.ts` hard-code `ONB-001` as the employee.

Replace all of these with generic, data-driven rules, so that a new employee or new evidence produces correct results without code changes. **Acceptance:** `grep -rn "ONB-0" src` returns nothing outside seed and test files.

### 2.2 Agents documented but not implemented
`docs/AGENTS.md` describes an Evidence Extraction Agent and an Action Recommendation Agent. `extractEvidence()` and `recommendActions()` exist in `src/ai/providers/index.ts`, but nothing calls them. Wire them into the evidence pipeline (section 4.4), or remove them from the docs. The spec must match the code.

### 2.3 Seed evidence is paraphrased, not verbatim
The seeded `Evidence.content` values are summaries. For example, EMAIL-004 is stored as "Eva appears independent…" while the source says "From the local side everything looks complete and Eva is working independently…". Exact-excerpt traceability is impossible without the original text.
- Replace every seeded evidence body with the **verbatim** starter-pack text (Appendix A).
- Fix the metadata:
  - EMAIL-001 is from **Project Manager → Access Support**, not "Leo Marin".
  - EMAIL-008 must keep the constraint that the documents are project-owned and must not be copied. Store only the folder reference.
  - Store sender, recipients, sender role and date as separate fields.

### 2.4 Data errors in the seed
- `ACC-LEO-HELIX` has status `NOT_REQUESTED`. Email 1 shows it **was requested** on 07 Oct, and Email 2 says it is "not yet provisioned". Correct it to `REQUESTED`, with request date 2026-10-07.
- `ACC-LEO-NOVA` should be `PROVISIONED` ("active"), with usability unconfirmed. Keep that distinction visible.
- `KT-EVA-1` has `validation: "APPROVED"`. The Technical Lead's weekly update classifies Eva as Ready with Support, but no formal technical-owner validation record exists.
  - Treat the update as authoritative evidence for the *assessed* level.
  - Do **not** mark it as validated.
  - Record this as a question for the Business Owner.
- `data/cases.json` contains ONB-011…ONB-020, which are **not** in the official starter pack. Either delete them, or move them into a clearly labelled simulated dataset (`isSimulated = true`, shown with a "Simulated" badge everywhere) and use them only where section 5 (P2-9) allows.
- `rules.py` duplicates the TypeScript rules. Port anything useful and delete it.
- Add `~$*` to `.gitignore`. An Office lock file `docs/~$boardIQ-How-It-Works.docx` is in the repo.

### 2.5 Side effects during page render
`dashboard/page.tsx` calls `detectGaps()`, which writes to the database, on every render. Move all recomputation into one explicit service, `recomputeCase(employeeId)` (section 4.3). Run it after approved mutations and from an explicit "Re-run analysis" action. Pages only read.

### 2.6 One clock
Recency and threshold logic uses `"2026-10-14"` literals, `new Date()`, or both. Create `src/lib/clock.ts`, which reads `DEMO_EVALUATION_DATE`. All age, overdue and stale calculations use it. Show it in the UI as "Evaluation date".

---

## 3. Non-negotiable rules (apply to every feature)

1. **Three information states, always visible.** Every value shown in the UI is one of:
   - **Actual:** approved and stored.
   - **Proposed:** AI- or rule-generated, awaiting a human.
   - **Simulated:** hypothetical or synthetic data.

   Build one shared `<ProvenanceBadge state="actual|proposed|simulated" />` component and one shared `<FactOrAssumption />` marker, and use them everywhere.
2. **AI proposes, humans decide.** No code path lets an LLM:
   - set `validatedStatus`;
   - create an APPROVED `ReadinessValidation`;
   - approve its own proposals;
   - send a communication;
   - mutate evidence.

   Enforce this in server actions with role checks, and prove it with tests.
3. **Final readiness** (`INDEPENDENTLY_READY` or any *validated* level) requires a human Technical Lead or technical-owner validation linked to evidence.
4. **Deterministic logic** handles calculations, readiness gates, dependency propagation, the minimal prerequisite set, reliability categories, thresholds, permissions, prioritisation scores and analytics.
5. **The LLM** handles semantic contradiction detection, claim extraction, root-cause hypotheses, explanations, drafting messages, roadmap suggestions, quiz generation and briefing narrative. Nothing else.
6. **Traceability.** Every AI factual statement carries an `evidenceId` plus an **exact excerpt**. The server verifies the excerpt is a substring of the stored evidence content (whitespace- and quote-normalised). Unverifiable statements are dropped, or downgraded to "assumption", and the UI says so. Unknown evidence IDs are rejected, which the assistant route already does.
7. **No fabrication.** Missing information stays **Unknown**. Never invent names, dates, owners, statistics or trends. When a stakeholder's name is unknown, show the role ("Technical Lead — Orion, name not recorded"), and let the system propose finding out who it is.
8. **No confidence percentages** from the LLM. Reliability and priority come from transparent, rule-based categories and scores with visible reasons.
9. **Audit everything.** Every approval, rejection, edit, simulated send, status change and AI run is written to `AuditLog`, with actor, before and after, and the evidence references.
10. **Prompt-injection safety.** Evidence text is untrusted data. Keep the existing system-prompt guard. Never execute instructions found in evidence.
11. **No credentials** in any model, seed, prompt or log.
12. **Mocked integrations only.** Email and Teams go to a simulated outbox. Nothing is ever really sent.
13. **Graceful AI failure.** If Ollama is down or returns invalid JSON:
    - deterministic results still render;
    - the AI panel shows a clear error and a retry button;
    - nothing is faked.

    The repo's "no mock fallback" rule applies to the product at runtime. Unit tests may use a test double for the `AIProvider` interface.

---

## 4. Shared foundation (Phase A, continued)

Build these once. Every feature reuses them.

### 4.1 Data model additions
Add the following via migrations. JSON-in-string columns are acceptable for SQLite, matching the current style. Adjust names to the codebase, but keep the concepts.

- **`Person`**: `id`, `name?`, `role` (EMPLOYEE, LINE_MANAGER, TECH_LEAD, KT_OWNER, PMO, HR, ACCESS_SUPPORT, APP_OWNER, TECH_MANAGER, MANAGEMENT), `projectId?`, `isSimulated`.
  - Seed only names that appear in the starter pack.
  - Unknown holders of a role become role-only records.
  - Link ownership fields (`AccessRequest.owner`, `KTActivity.owner`, `ActionItem.owner`, case LM/TL/KT owner) to `Person` where known, and keep the text fallback.
- **`Evidence`** additions: `senderRole`, `recipients`, `authorityLevel` (derived from sender role), `reviewStatus` (PENDING_REVIEW, APPROVED, REJECTED), `inReplyToId?` (for request/response tracking), `isRequest`, `ingestedAt`, `isSimulated`.
- **`AccessRequest.status`**: an explicit enum: NOT_REQUESTED, REQUESTED, APPROVAL_PENDING, APPROVED, PROVISIONED, USABLE, REJECTED. Add `usableConfirmedAt?` and `usableEvidenceId?`. Only `USABLE` satisfies an access gate.
- **`Dependency`**: `id`, `employeeId?` (null = project template), `fromType` + `fromId`, `toType` + `toId`, `kind` (REQUIRES, ENABLES, BLOCKS), `status` (PROPOSED, CONFIRMED, REJECTED), `origin` (RULE, AI, TEMPLATE, HUMAN), `rationale`, `evidenceIds`, `confirmedBy?`, `confirmedAt?`.
- **`Finding`** additions: `origin` (RULE, AI), `category`, `facts` (JSON `[{statement, evidenceId, excerpt}]`), `assumptions` (JSON `[{statement, basis}]`), `rootCauses` (JSON), `recommendedActions` (JSON), `affectedEntities` (JSON), `aiRunId?`, `resolvedBy?`, `resolutionEvidenceId?`, `firstDetectedAt`.
- **`AIRun`**: `id`, `agent`, `promptVersion`, `model`, `inputHash`, `inputRefs` (JSON of IDs only, not full PII dumps), `output` (JSON), `status` (OK, INVALID_OUTPUT, UNAVAILABLE, TIMEOUT), `error?`, `durationMs`, `createdAt`. This is the AI transparency log. Show it in an "AI activity" panel.
- **Feature tables** are introduced with each feature:
  - `RoadmapItem`
  - `Competency`
  - `EmployeeCompetency`
  - `TrainingMaterial` (or extend `KnowledgeResource`)
  - `Assessment`
  - `Communication` (follow-ups)
  - `Briefing`
  - `SimulationScenario` (optional saved simulations, always `SIMULATED`)

### 4.2 Readiness gate engine (rewrite `assessment.ts`, pure function, no IDs)
Model readiness as named **gates** derived from the §6 checklist. Each gate evaluates to SATISFIED, UNSATISFIED or UNKNOWN, and carries reasons and evidence IDs:

`SCOPE_CONFIRMED` (project and exact role) · `OWNERS_ASSIGNED` (LM, TL, KT owner) · `ACCESS_IDENTIFIED` · `ACCESS_USABLE` (all required access USABLE) · `KT_AGREED` · `EXECUTION_OBSERVED` (per required KT activity: shadowing → supported → independent) · `NO_MATERIAL_CONFLICT` · `READINESS_DATE_RECORDED` · `TECH_VALIDATION_APPROVED` · `BLOCKERS_OWNED`

**Assessed level** is a deterministic function of the gates and the observed KT stages:
UNKNOWN, PRE_ONBOARDING, BLOCKED, SHADOWING, SUPPORTED_EXECUTION, PARTIALLY_READY, READY_WITH_SUPPORT, or INDEPENDENTLY_READY. `INDEPENDENTLY_READY` requires every gate, including `TECH_VALIDATION_APPROVED`.

Keep three readiness values separate everywhere:
- **Reported:** the tracker status.
- **Assessed:** computed by the system.
- **Validated:** by a human technical owner.

Signature: `evaluateReadiness(state: CaseState, overrides?: SimulationOverrides): ReadinessResult`. The simulator reuses exactly this function.

### 4.3 Case state and recompute service
- `loadCaseState(employeeId)` builds one typed `CaseState` from Prisma: employee, project, people, access, KT, evidence plus approved claims, findings, dependencies, validations, roadmap, assessments and communications.
- `recomputeCase(employeeId, trigger)` runs the deterministic pipeline:
  1. rule detectors;
  2. dependency propagation;
  3. readiness gates;
  4. reliability;
  5. follow-up candidates;
  6. roadmap adaptation proposals;
  7. an `AuditLog` "STATE_RECOMPUTED" entry with a diff summary.

  AI agents are triggered separately and asynchronously, by explicit user action or after evidence approval. Their results are cached by `inputHash`, so pages never block on the LLM.

### 4.4 Evidence ingestion pipeline (the backbone of the Digital Twin)
This upgrades the existing `addEvidence` action:

1. The user adds evidence. It is stored verbatim, immutable, with `reviewStatus = PENDING_REVIEW`.
   - Use the real sender, role and date fields.
   - Use the evaluation clock, not a literal `"2026-10-14"`.
   - Optionally mark it as a reply to an earlier request.
2. The **Extraction Agent** (existing `extractEvidence`) proposes structured claims, each with an exact excerpt. The server verifies each excerpt. The claims are stored as `EvidenceClaim` with `reviewStatus = PENDING`.
3. A human reviews claims in the Evidence inbox (approve, edit or reject, with a reason).
   - Approving a claim applies it through a **whitelisted field mapper**. For example, `access.<app>.status`, `kt.<activity>.stage`, `case.ktOwner` and `case.expectedReadyAt` can be set. Readiness validation **cannot** be set this way.
4. On approval, `recomputeCase()` runs. If the new evidence answers an open request (via `inReplyToId`, or a proposed match the user confirms), the linked `Communication` is marked RESPONDED and the related blockers are reassessed.
5. Every step is audited with before and after values.

### 4.5 AI layer conventions
- Keep `src/ai/providers/index.ts` and its loopback-only Ollama design. That design is a strong privacy argument, so mention it in the docs and the demo.
- Move prompts into `src/ai/prompts/<agent>.ts`, each with a `PROMPT_VERSION` constant. Log the version in `AIRun`.
- Use Ollama **structured outputs**: pass a JSON Schema in `format`, generated from the Zod schema, if the installed Ollama version supports it. Otherwise keep `format: "json"`. Always validate with Zod afterwards.
- Allow a per-agent model override via environment variables, e.g. `AI_MODEL_DETECTIVE`. Document that `llama3.2` (3B) is the minimum, and that a 7–8B instruct model gives noticeably better contradiction reasoning when the hardware allows.
- Keep prompts small. Send only the relevant case's records and IDs, not the whole database.

### 4.6 UI shell
- Make the **employee case page (`/employees/[id]`) the hub** from Phase A onward. Use tabs (URL-addressable, e.g. `?tab=`):
  - Overview
  - Investigation
  - Dependency map
  - Simulator
  - Roadmap
  - Evidence & reliability
  - Assessments
  - Follow-ups
  - History

  P2's Digital Twin then becomes the unified Overview plus History. It is not a separate duplicate page.
- Global pages:
  - Dashboard, now data-driven;
  - Investigations (cross-case findings queue);
  - Follow-Up Center;
  - Briefing;
  - Insights (bottlenecks);
  - Evidence inbox;
  - Knowledge;
  - My workspace;
  - Assistant.
- Reuse the existing Tailwind card, table and sidebar styles and `lucide-react` icons.
- Every async panel needs loading, error-with-retry and empty states.
- Role switcher: add `LINE_MANAGER` and `MANAGEMENT` only if they get a meaningful, distinct view (at minimum Briefing and Dashboard). Map demo employee users through `User.employeeId`, never hard-coded. Seed at least Mila and Leo as employee demo users.

---

## 5. Features

Build them in this order.

### P0-1: AI Onboarding Detective
A proactive investigation system. The user doesn't need to chat. It runs:
- per case, when a case's state changes or when "Investigate" is clicked;
- in batch, from "Investigate all open cases".

**Two-stage design:**
1. **Deterministic detectors** (`src/modules/detective/detectors/*.ts`, generic, rule-based) produce candidate issues:
   - missing project, role, LM, TL, KT owner or readiness date;
   - stale reports (older than `STALE_AFTER_DAYS`, default 7);
   - unanswered requests (older than `FOLLOW_UP_AFTER_DAYS`, default 3, with no reply);
   - access not USABLE;
   - multiple sources making different claims about the same entity and field;
   - tracker status inconsistent with evidence-derived state;
   - "complete" or "closed" language without `EXECUTION_OBSERVED` or `TECH_VALIDATION_APPROVED`;
   - a blocked status with no recorded cause or owner;
   - a status like "KT Started" with no KT owner.
2. The **Detective Agent** (LLM) gets each case's candidates plus the relevant verbatim evidence and tracker fields. It:
   - confirms or rejects semantic contradictions, since rules can't tell that "working independently" conflicts with "can handle standard requests with occasional support";
   - finds contradictions the rules missed, but only with cited excerpts;
   - proposes root-cause hypotheses;
   - recommends corrective actions and the responsible stakeholder **role**.

   Output schema per finding: `{category, severity, title, facts[{statement, evidenceId, excerpt}], assumptions[{statement, basis}], rootCauses[{hypothesis, supportingEvidenceIds, isAssumption: true}], recommendedActions[{action, ownerRole, ownerPersonId?, rationale}], affectedEntities[]}`.
   - Severity is computed deterministically from category and readiness impact. It is not set by the LLM.

**Investigation UI** (the case Investigation tab plus a global queue):
- a list of findings with category, severity and origin badge (Rule or AI);
- a **side-by-side conflict viewer** showing two or more sources, each with sender, role, authority, date and highlighted verbatim excerpt;
- visually separate "Confirmed facts" and "AI assumptions";
- the AI explanation, plus an AIRun link showing model, prompt version and time;
- actions:
  - **Resolve**: requires choosing a resolution type (*confirmed source A*, *new evidence attached*, *not an issue*, *needs follow-up*) and a note, and records `resolvedBy`;
  - **Dismiss**: requires a reason;
  - **Create action / follow-up**: hands off to P1-7.
- Resolutions never delete evidence. Conflicts are never silently resolved.

**Acceptance, at minimum, on the official data.** Verify each of these against the evidence; don't force them.

| Case | What should be detected |
|---|---|
| Eva (ONB-005) | Contradiction between EMAIL-003 (Technical Lead: Ready with Support, two complex scenarios outstanding) and EMAIL-004 (Line Manager: everything complete, onboarding closed). Also "appears complete but readiness not demonstrated". |
| Leo (ONB-002) | Orion Portal awaiting app-owner approval, Helix Service Desk requested 07 Oct but not provisioned, Nova VPN active but use unconfirmed. Unclear ownership of Helix provisioning. |
| Lina (ONB-009) | Request unanswered for 6 days, with no project, role or KT owner. "KT Started" with no KT owner. |
| Owen (ONB-010) | Self-reported "all tools available" and partial independence, unverified. No readiness review date. |
| Iris (ONB-007) | Stale for 24 days. "On Track" while access was "expected next week" and never confirmed. |
| Nora (ONB-003) | "On Track" with no project and a stale update. |
| Aron (ONB-004) | Missing manager. |
| Theo (ONB-008) | Blocked with no recorded cause or owner. |
| Mila (ONB-001), Noah (ONB-006) | Insufficient evidence, reported as such and not invented. |

### P0-2: Interactive Onboarding Dependency Map
- Use **React Flow** (`@xyflow/react`) with `dagre` (or `elkjs`) for automatic left-to-right layout.
- **Node types:** access requirement, KT activity, operational responsibility, competency, blocker (finding), readiness gate, and a final **Readiness** node.
- **Edges:** from `Dependency` rows.
  - CONFIRMED edges are solid.
  - PROPOSED edges are dashed, with a "Proposed" label.
  - Only CONFIRMED edges affect calculations.
- **Edge sources:**
  - **Rule or template edges:** generic project-role templates, e.g. *each required access → the KT activities that need it*; *KT activity → independent execution → tech validation → Readiness*. They are seeded as TEMPLATE origin and confirmed by a TL or PMO for the case.
  - **AI-suggested edges:** a Dependency Suggestion Agent reads the case's evidence and proposes edges with rationale and excerpts. Each one shows in a "Suggested dependencies" panel with Confirm and Reject.
- **Propagation (deterministic):** a node is BLOCKED if it is unsatisfied and has an unsatisfied confirmed upstream node.
  - Colour nodes Satisfied, In progress, Blocked or Unknown.
  - Clicking a blocked node highlights its **downstream impact path**.
  - Show the **critical path**: the unsatisfied confirmed ancestors of Readiness.
- **Node click** opens a side panel with details, status, owner, evidence (with excerpts), reliability badge, and related findings and actions.
- **Auto-update:** the graph reads from `CaseState` and refreshes after `recomputeCase`, with no manual sync.
- **Acceptance (the example from the brief):** For Leo, confirming the edges `Helix Service Desk access → Practical ticket-handling KT → Independent execution → Technical validation → Readiness` shows the Helix access node as the root blocker, with three downstream nodes blocked. Before confirmation, these edges are shown as proposed and don't propagate.

### P0-3: What-If Readiness Simulator
- The simulator is in the case Simulator tab, and it is also reachable from a node in the map ("Simulate resolving this").
- **Toggles,** generated from the case's actual unsatisfied items, never a fixed list:
  - mark an access item USABLE;
  - mark a KT activity at a given stage;
  - assign a missing owner;
  - resolve a contradiction (choose which source wins);
  - record independent execution;
  - record technical validation;
  - set a readiness date.
- **Computation** is entirely deterministic: `evaluateReadiness(state, overrides)` plus graph propagation on a cloned state. **It never writes to employee records.** Add a test that asserts row counts and `updatedAt` values are unchanged after a simulation.
- **Output:**
  - current vs simulated level, side by side;
  - gates flipped;
  - blockers that disappear;
  - activities that become unblocked;
  - remaining prerequisites;
  - **recommended order**, a topological order of the unsatisfied confirmed ancestors of Readiness, with ties broken by downstream impact count;
  - the **minimal prerequisite set**: the unsatisfied confirmed ancestors of the Readiness node.

    The graph is AND-only in this version, so that set is exactly what must be resolved. State this assumption in the UI and the docs. If you later add OR-alternatives, compute a minimal set via search.
- **"Include proposed dependencies"** is an optional toggle. It is off by default, and results are clearly marked when it's on.
- **AI explanation:** a short narrative of the simulated result, generated from the deterministic diff only, with references to the toggled items. If the LLM is down, show the diff without the narrative.
- A loud, persistent **"SIMULATION — not actual employee readiness"** banner, with a distinct visual style (e.g. striped or purple). Optionally save a scenario as `SimulationScenario`. Saved scenarios are always labelled Simulated.

**P0 checkpoint:** run the full demo journey (section 7) end-to-end, then commit.

### P1-6: Evidence Reliability and Status Trustworthiness
- Implement a deterministic classifier, `src/modules/reliability/`, per **employee status** and per **individual claim or status item** (access item, KT stage).
- **Inputs:** recency (evaluation clock), source authority (role → authority level per field, e.g. the TL is authoritative for technical readiness, Access Support for provisioning, the employee for successful use and self-reported progress, the LM for local logistics), completeness, unresolved contradictions, human verification (approved claims and validations), and practical execution evidence.
- **Categories** with a documented precedence. Propose one, document it and test it, for example:
  - **Conflicting:** an unresolved material contradiction.
  - **Outdated:** the newest supporting evidence is older than the threshold.
  - **Insufficient evidence:** no source supports the status, or required fields are missing.
  - **Unverified:** supported only by self-report or unreviewed AI-extracted claims.
  - **Well-supported:** an authoritative, recent, consistent source, but no human verification or no execution evidence.
  - **Verified:** human-verified by the authoritative role, plus practical execution evidence where the status implies it.
- Every classification returns **reasons[]** and **sourceIds[]**. The UI shows a badge, an expandable "Why?" listing each rule that fired, and links to the sources.
- Keep reliability visually and structurally separate from readiness. Example card: "Reported: Ready with Support · Reliability: Conflicting".
- **Expected results:**
  - Eva: Conflicting.
  - Iris: Outdated.
  - Owen: Unverified (self-report).
  - Nora: Insufficient evidence.
  - Leo's access status: Well-supported (Access Support email, recent).

  Encode these as tests. If your rules disagree with one of them, explain why in `ASSUMPTIONS.md` rather than special-casing.

### P1-7: Intelligent Follow-Up and Escalation Agent and Follow-Up Center
- **Deterministic detection:**
  - unanswered requests (`isRequest` evidence or `Communication` with no reply after N days);
  - overdue `ActionItem`s;
  - findings with no owner.
- **Stakeholder resolution:** map each item to the responsible role or person via `Person` and ownership fields. If no one is recorded, the follow-up goes to the PMO with "identify owner".
- **Priority score** (deterministic, shown with its breakdown): readiness impact (number of downstream nodes blocked) + severity + days overdue + escalation level.
- **Escalation:** thresholds are configurable in one config module, e.g. first reminder after 3 days, escalation to the line or technical manager after 7.
  - Escalation is a *recommendation* shown with the threshold that triggered it.
  - Never escalate automatically.
- **Consolidation:** group pending items per stakeholder into **one** draft per stakeholder and channel.
- **Drafting:** the LLM writes a personalised email or Teams message from the grouped items. It cites only the case facts, names no unknown people, and makes no promises.
- **Follow-Up Center** (`/follow-ups`):
  - a queue grouped by stakeholder;
  - edit the draft inline;
  - approve (PMO role) → "Send (simulated)" puts it in a **simulated outbox**, clearly labelled, and nothing leaves the machine;
  - track status: DRAFT → APPROVED → SENT_SIMULATED → RESPONDED → CLOSED;
  - "Record response" attaches new evidence through the pipeline in 4.4, which reassesses the related blockers.
- **Acceptance:**
  - Lina's EMAIL-005 shows as unanswered for 6 days, assigned to the Technical Manager.
  - Leo's three access items consolidate into one message to Access Support, with a separate app-owner approval request for Orion.

### P1-4: AI-Generated Adaptive Onboarding Roadmap
- **Inputs:** project, role and responsibilities, movement type, validated competencies (`EmployeeCompetency` with source TL_VALIDATED or OBSERVED), required apps, KT requirements, current stages, dependencies and blockers.
- **Generation:**
  - Deterministic project-role templates provide the backbone.
  - The **Roadmap Agent** proposes personalisation:
    - order;
    - extra activities;
    - **skips** for redundant training when a competency is already validated, which matters for reallocations;
    - **alternative activities while blocked**, e.g. Leo can do documentation reading or shadowing while Helix is pending.
  - Each suggestion carries a rationale and evidence references.
- **Approval:** AI items are `PROPOSED` until the appropriate owner approves them (TL for KT and technical items, PMO for logistics). Only approved items become official requirements and feed the gates and the dependency map.
- **Adaptation:** after an approved change of evidence or progress, `recomputeCase` creates roadmap adaptation *proposals* and shows a diff ("since last approved version"). Nothing changes silently.
- **UI:** an interactive horizontal timeline in Tailwind, with no heavy library. It has milestones (week or phase), tasks, dependency markers, owner, completion criteria and status. Proposed items are dashed and have Approve/Reject. Clicking an item opens its detail and evidence.

### P1-5: AI Knowledge Transfer Assessment
- **Materials:** generate questions **only** from `TrainingMaterial` rows with `status = APPROVED` or `status = SIMULATED`.
  - The real Atlas documents must not be copied into the system (EMAIL-008). Only their folder reference is stored, so no questions can be generated from them.
  - Seed 1–2 clearly labelled **simulated** training materials (e.g. a fictional Orion service-desk runbook excerpt) for the demo.
  - A UI where a TL can paste or approve a material.
- **Assessment Agent:**
  - generates multiple-choice, scenario-based and practical problem-solving items tagged by competency;
  - grades free-text answers against a rubric the agent produced and the TL can view;
  - gives personalised feedback, identifies gaps and recommends materials;
  - generates a targeted follow-up assessment from previous mistakes.
  - Multiple-choice scoring is deterministic.
- **Progress:** a per-competency history chart (Recharts).
- **TL summary:** demonstrated knowledge vs gaps, with links to answers.
- A banner on every result, plus a hard rule in the gate engine: *"Assessment results support, but never replace, observed independent execution or technical-owner validation."* Assessments can never satisfy `EXECUTION_OBSERVED` or `TECH_VALIDATION_APPROVED`.

**P1 checkpoint:** run the tests, the build and the demo journey, then commit.

### P2-8: AI Daily Management Briefing
- **Deterministic data selection** per role. AI only writes the narrative.
  - **PMO:** cross-project blockers, ownership gaps, overdue follow-ups.
  - **Technical Lead:** pending technical validations, KT gaps, assessment results.
  - **Management:** risk overview and readiness distribution.
  - **Line Manager:** local practical blockers.
- **Sections:** most urgent problems; employees needing intervention; new contradictions; newly resolved blockers; employees approaching readiness (one or two gates left); overdue actions; outstanding validations; recommended priorities; **changes since the previous briefing** (diff against the stored previous `Briefing`).
- **Every statement** is stored as `{text, refs: [findingId | evidenceId | actionId]}`. The server rejects statements without valid refs. The UI renders refs as clickable chips.
- Generate, view history, and **export** as Markdown and print-friendly HTML (browser print to PDF is fine).

### P2-9: Organizational Bottleneck Intelligence (`/insights`)
- **Deterministic aggregations** over all cases:
  - applications that most often appear in non-USABLE access;
  - approval bottlenecks by owner role;
  - projects with recurring findings;
  - frequently missing responsibilities;
  - repeated knowledge gaps from assessments;
  - delayed KT activities;
  - recurring unanswered requests;
  - dependencies affecting several employees;
  - training materials that could be reused across projects.
- **Charts** in Recharts. A table of affected employees links to the cases.
- **AI** writes root-cause *hypotheses* and process-improvement recommendations, each citing the aggregated figures and case IDs, and labelled as hypotheses.
- **Historical metrics** (time to access, time to readiness, blocker resolution time, duration by project, top delay causes) are computed only where start and end timestamps exist.
  - Show **"Insufficient data (n = X)"** below a minimum sample size, e.g. n < 5.
  - Never imply a trend from the 10 official cases.
- **A simulated historical dataset** is optional (ONB-011…020 can go here). It is shown only behind an explicit "Include simulated history" toggle, with a "SIMULATED DATA" banner on every chart that uses it. It is never mixed silently with actual data.

### P2-10: Employee Onboarding Digital Twin
Don't build a new silo. Combine what already exists into the case page:
- **Overview:** a single view connecting employee info, project responsibilities, access, KT, competencies, evidence, stakeholders, dependencies, blockers, actions, readiness (reported, assessed and validated), reliability and technical validations. Reuse the React Flow map in a "full twin" mode that includes people and evidence nodes, and the gate list.
- **Pipeline visualisation:** when evidence is approved, show the 9 steps (extract → affected entities → contradictions → state update → dependencies → readiness → roadmap → new actions → audit) as a live step list with each step's result. This is the evidence pipeline from 4.4. It is not reimplemented.
- **History:** a chronological audit timeline with before and after values, filterable by entity. "View state as of <date>" is optional.
- **Integrated:** the dependency map, the simulator ("simulate from here") and the reliability badges are embedded, not duplicated.

---

## 6. Technical validation (the only path to final readiness)
- **Only** the `TECH_LEAD` role (and a technical owner, if added) can record a `ReadinessValidation`: APPROVED, REJECTED or NEEDS_MORE_EVIDENCE, with mandatory evidence links and a comment.
- The UI shows the gates and the reliability classification next to the validation form, so the human decides with full context.
- Changing `validatedStatus` is audited. AI services have no import path to this action. Add a test that fails if an AI module imports it, or check this with a simple lint rule or script.

---

## 7. Demo journey (build and test it as a Playwright e2e test)

**Primary journey: Leo Marin (ONB-002), the access blocker.** **Secondary: Eva Stone (ONB-005), the conflict.** Lina West (ONB-009) covers the follow-up.

1. **Dashboard** (PMO): data-driven KPIs and the top findings. "Leo: 3 access items not usable."
2. **Leo → Investigation:** the Detective shows the access findings, with verbatim excerpts from EMAIL-001 and EMAIL-002, facts vs assumptions, a root-cause hypothesis (app-owner approval pending; Helix not provisioned) and the recommended owner.
3. **Dependency map:** confirm the AI-suggested Helix → ticket-handling KT → independent execution → validation → readiness edges. Watch the downstream nodes turn blocked.
4. **Simulator:** toggle "Helix USABLE" and "Orion approved" → simulated level changes, blockers removed, remaining prerequisites, and the minimal set and order. The SIMULATION banner is visible. Show that the actual record is unchanged.
5. **Follow-Up Center:** one consolidated draft to Access Support and one to the app owner. Edit, approve, then "Send (simulated)".
6. **Record a response** (new simulated evidence: "Helix provisioned, Leo logged in successfully"). Approve the extracted claims → the pipeline runs → Helix becomes USABLE → the map, readiness, roadmap and briefing update. The audit trail shows every step.
7. **Eva:** a side-by-side conflict with reliability "Conflicting". The TL records NEEDS_MORE_EVIDENCE (the two complex scenarios), which shows that AI never sets final readiness.
8. **Briefing** (switch role to TL vs PMO): different content, with every statement referenced. Export it.

Also write `docs/DEMO.md` as a 5–7 minute script that follows these steps, plus a "what is simulated / limitations / next improvement" slide outline.

---

## 8. Documentation (25% of the score, so treat it as a deliverable)

- **`docs/AGENTS.md`**: one section per agent **that exists in code**:
  - Detective
  - Dependency Suggestion
  - Extraction
  - Action Recommendation / Follow-Up Drafting
  - Roadmap
  - Assessment
  - Briefing
  - Bottleneck Insight
  - Simulator Explanation
  - Assistant

  For each one, write:
  - **Responsibility**
  - **Trigger**
  - **Inputs** (exact entities and fields)
  - **Output schema** (link the Zod schema)
  - **Prompt** (file and version)
  - **Deterministic guards** before and after the LLM
  - **Limitations and failure modes**
  - **Human validation required**
  - **Interactions** with other agents and modules

  Also document the deterministic engines (gates, detectors, propagation, reliability, prioritisation, analytics) as components, with their rules. Add a Mermaid interaction diagram.
- **`docs/ARCHITECTURE.md`**: update it with the pipeline (evidence → claims → state → rules → AI → proposals → human approval → audit), the data model diagram, the three information states and the AI privacy design (local loopback LLM).
- **`docs/AI_USAGE.md`** (or a section in AGENTS.md):
  - where the LLM adds value and why;
  - where we deliberately use rules instead;
  - how excerpt verification and ID validation work;
  - what happens when the model fails.
- **`docs/ASSUMPTIONS.md`**:
  - every threshold and rule choice;
  - the reliability precedence;
  - the AND-only dependency assumption;
  - **"Questions for the Business Owner"**, at minimum:
    - Does the TL weekly classification count as technical validation?
    - What are the stale and follow-up thresholds?
    - What is the escalation chain?
    - Who may close onboarding?
    - What applications are required per project?
    - Can a Line Manager declare closure?
- **`docs/SPECIFICATION.md`**: update the roles, rules, gates and permissions matrix (role × action).
- **`docs/LIMITATIONS.md`**: what is simulated (email/Teams outbox, app-owner approvals, training materials, optional history), the model-size limits and the known gaps.
- **`README.md`**: setup from a clean clone on Windows (PowerShell, which the team uses) and macOS/Linux, including the Ollama model pull, env vars, migrate, seed, run and tests, plus a feature tour.

---

## 9. Tests (Vitest unit plus Playwright e2e)
At minimum:
- Readiness gates:
  - provisioned or approved access ≠ usable;
  - no `INDEPENDENTLY_READY` without TL validation;
  - an unresolved conflict blocks independent readiness;
  - assessment results cannot satisfy the execution or validation gates;
  - unknown ≠ satisfied.
- Readiness for the official cases: the generic rules produce sensible levels for all 10 cases, with **no ID-specific branches**.
- Dependency engine: propagation, downstream impact, minimal prerequisite set, topological order, and proposed edges ignored unless opted in.
- The simulator doesn't mutate the DB.
- Reliability categories for Eva, Iris, Owen, Nora and Leo (section 5, P1-6).
- Detectors: stale, unanswered (6 days for Lina), missing owner, and closure without execution evidence. They use the clock module.
- Excerpt verifier: accepts verbatim excerpts, rejects paraphrases, rejects unknown evidence IDs.
- Permissions:
  - AI modules can't approve readiness;
  - only TL can validate;
  - only PMO can approve communications;
  - an employee can confirm only their own access usability.
- Follow-ups: consolidation per stakeholder, escalation thresholds, and priority score ordering.
- Briefing: statements without valid refs are rejected.
- Analytics: returns "insufficient data" below the minimum n, and simulated data is excluded unless toggled.
- AI provider: invalid JSON, schema mismatch, timeout and unavailable all map to user-visible errors. Use a test double for the `AIProvider` interface.
- E2E: the section 7 journey. Keep the existing live-LLM test, but tag it so it can be skipped when Ollama isn't running.

---

## 10. Definition of done
- [ ] Phase A fixes complete: no hard-coded employee IDs in `src/`, verbatim evidence, corrected seed data, one clock, no writes during render.
- [ ] P0 features fully working and connected through the case hub. The demo journey passes end-to-end.
- [ ] P1 and P2 features either fully working or hidden from navigation, with the reason stated in LIMITATIONS.md.
- [ ] Actual, Proposed and Simulated are visually distinct everywhere. No LLM confidence percentages.
- [ ] Every AI output is logged in `AIRun`, references verified evidence, and has a visible human approve or reject path where it has consequences.
- [ ] All schema changes are migrations. The seed is idempotent. `npm run typecheck && npm run lint && npm test && npm run build` passes.
- [ ] The docs in section 8 are complete and match the code.
- [ ] Final report (section 0, step 7).

---

## Appendix A: Verbatim starter-pack evidence (use exactly this text in the seed)

**EMAIL-001 · Access request: Leo Marin** · Project Manager → Access Support · 07 Oct 2026
> Please create Leo's Nova VPN, Orion Portal and Helix Service Desk accounts before his project start. Project code: NIM-482.

**EMAIL-002 · Delayed account: Leo Marin** · Access Support → Project Manager · 14 Oct 2026
> Nova VPN is active. Orion Portal is still awaiting application-owner approval. Helix Service Desk has not yet been provisioned.

**EMAIL-003 · Weekly KT update: Eva Stone** · Technical Lead · 13 Oct 2026
> Eva completed the first training topics and can handle standard requests with occasional support. Two complex scenarios still need to be covered. The Technical Lead classifies her as Ready with Support.

**EMAIL-004 · Conflicting progress update: Eva Stone** · Line Manager · 13 Oct 2026
> From the local side everything looks complete and Eva is working independently. The Line Manager considers onboarding closed.

**EMAIL-005 · Unanswered request: Lina West** · PMO Coordinator → Technical Manager · 08 Oct 2026
> Request to confirm Lina's exact project role, assigned KT owner and expected readiness date. No response recorded as of 14 Oct 2026.

**UPDATE-006 · Employee check-in: Owen Hart** · 14 Oct 2026
> I can complete the daily standard activities alone, but I still need help for exceptions and production changes. All tools are available. I have not yet received a date for the final readiness review.

**UPDATE-007 · Stale tracker note: Iris Moon** · Last tracker update: 20 Sep 2026 · Status: On Track
> Shadowing started; access expected next week. No later tracker update exists.

**EMAIL-008 · Documentation location: Project Atlas** · KT Owner · 11 Oct 2026
> Training guide and runbook are available in /Team/Operations/Onboarding. The documents are project-owned and should not be copied outside that location. Keep only the folder reference in a central onboarding index.

**Official cases (starter pack §4).** Only these 10 are actual data. Evaluation date: 14 Oct 2026.

| Case | Employee | Start | Movement | Project | Manager | Status | Last update |
|---|---|---|---|---|---|---|---|
| ONB-001 | Mila Rowan | 05-Oct-26 | New Hire | Aurora | Jon Vale | Shadowing | 13-Oct |
| ONB-002 | Leo Marin | 07-Oct-26 | Reallocation | Nimbus | Sara Neri | Access Pending | 14-Oct |
| ONB-003 | Nora Venn | 28-Sep-26 | New Hire | — | Tomas Reed | On Track | 30-Sep |
| ONB-004 | Aron Bell | 01-Oct-26 | Reallocation | Helios | — | KT Started | 11-Oct |
| ONB-005 | Eva Stone | 21-Sep-26 | New Hire | Orion | Luca Gray | Ready with Support | 13-Oct |
| ONB-006 | Noah Lane | 12-Oct-26 | New Hire | Atlas | Maya Ford | Pre-Onboarding | 12-Oct |
| ONB-007 | Iris Moon | 15-Sep-26 | Reallocation | Nova | Rita Cole | On Track | 20-Sep |
| ONB-008 | Theo Park | 03-Oct-26 | New Hire | Pulse | Mark Hale | Blocked | 14-Oct |
| ONB-009 | Lina West | 06-Oct-26 | Reallocation | — | Nina Cross | KT Started | 09-Oct |
| ONB-010 | Owen Hart | 29-Sep-26 | New Hire | Vega | Alex North | Partially Ready | 14-Oct |

Note: Leo's project is **Nimbus**, but Email 1 requests **Nova** VPN and **Orion** Portal, which share names with other projects (Nova, Orion). Don't assume these are cross-project links. Treat them as application names, and list "Are Nova VPN / Orion Portal related to the Nova / Orion projects?" as a Business Owner question.
