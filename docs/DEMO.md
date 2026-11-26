# Demo script (8–10 minutes)

**Setup** (before the audience joins):

```bash
npm run db:seed
npm run dev
```

Have Ollama running with the configured model (optional: without it, briefings and AI suggestions fall back to the rule-based statements and say so). Open http://localhost:3000. Switch accounts from the account menu in the top right (**Switch demo account**, grouped by role). People and projects that are not in the starter pack carry a small **Sample data** tag.

The journey is automated: `tests/e2e/roles-journey.spec.ts` (role and project steps) and `tests/e2e/stories-evidence.spec.ts` (the Leo and Eva evidence stories). Run them with `npm run test:e2e -- --grep-invert @llm`.

| Account | Role | Lands on |
|---|---|---|
| Petra Lind | PMO | Portfolio |
| Marco Ruiz | Additional Manager (Aurora, Nimbus, Orion, Vega, Lumen) | My projects |
| Jon Vale | Line Manager (Aurora) — becomes Technical Lead of the new project | My team |
| Sara Neri | Line Manager (Nimbus — Leo's manager) | My team |
| Iva Duka | Line Manager and Technical Lead (Lumen) | My team |
| Ben Okafor | Technical Lead (Nimbus, Aurora) | Onboarding |
| Hana Ilic | HR | Pre-boarding |
| Leo Marin, Mila Rowan | Employees | My onboarding |

## 0. The problem (20 s)

Onboarding status lives in trackers and emails that disagree. OnboardIQ shows who is responsible for what, in which phase each person is, and what blocks them — with a source for every statement. AI proposes; people decide.

## 1. PMO — Portfolio and a new project (90 s)

- **Portfolio**: Nimbus is **At risk** with its reason in plain words ("2 high-severity findings open"); Orion and Pulse are **Critical**. No case-level to-dos for the PMO.
- **Create project**: name "Borealis" → Additional Manager **Marco Ruiz** → Line Manager **Jon Vale** → add **Rina Kola** (marked *reallocation*: she has an earlier project) and **Dren Leka** (*new hire*). Save.
- The Team tab shows the tree. Both people are in **Pre-boarding** with the default checklist. Every assignment is in the audit log.

## 2. Additional Manager — choose the Technical Lead (40 s)

- **My projects** lists "Projects that need a Technical Lead". Choose **Jon Vale**: the hint says a Line Manager can also be the Technical Lead. The tree now shows "Line Manager and Technical Lead".
- **Team** shows each Line Manager with their people; **Escalations** shows follow-ups that reached this level.

## 3. HR — pre-boarding (40 s)

- **Pre-boarding**: everyone not yet started, with progress, blocked items, start dates within 14 days and missing contacts (Noah: no Technical Lead).
- Open Rina and mark HR's three items done (start date and movement, paperwork, welcome).

## 4. Line Manager — hand-over (40 s)

- As **Jon Vale**, **My team** groups people by phase with their blocker and next step.
- Mark "Laptop and equipment ready" done, then **Confirm hand-over** (asks for a note). Rina moves to **Onboarding**; the Technical Lead takes over. The phase change is audited.

## 5. Technical Lead — requirements, skills, and Leo's case (120 s)

- As **Ben Okafor**, **Requirements → Nimbus**: add *Incident triage* (skill, intermediate), *SQL reporting* (skill, basic) and *Read the Nimbus service runbook* (document).
- The matrix ticks off *Incident triage* for Leo automatically: **Already has this skill** — a confirmed skill from his earlier project (sample history). *SQL reporting* is only **Possibly covered**: Leo claimed it himself.
- **Onboarding → Skills waiting for confirmation**: confirm Leo's SQL reporting. The matrix updates. Skill check-offs count toward the knowledge-transfer gates but never replace technical sign-off.
- Open **Leo**: Findings (Helix not provisioned, owner unknown — verbatim sources in *Facts and sources*), **Map** (Helix is the root blocker), **Simulator** (what if Helix works and Orion is approved — only the simulated level changes).

## 6. Employee — Leo (40 s)

- **My onboarding**: phase stepper, what to do next (confirm Nova VPN works), what he is waiting on and from whom (Helix → Access support), contacts (Sara Neri, Ben Okafor, HR), requirements with ticks, access with **Confirm it works**.
- **My profile**: skills by category (confirmed / claimed, source) and earlier projects (Lumen, sample).

## 7. PMO — briefing and improvement (50 s)

- **Portfolio → Generate briefing**: portfolio risk, readiness distribution, urgent problems; every statement has a source chip.
- **Top bottlenecks → Create improvement**: the form is pre-filled from the figure; choose **Marco Ruiz** as owner and save. Only a person creates or approves an improvement; Marco moves it forward from *My projects*.

## The evidence stories (if time allows, 2 min)

- **Leo — access** (as Ben): confirm the proposed Helix dependencies on the map, draft one consolidated follow-up to Access support, approve and send (simulated), record the reply, add the claim "Helix usable" with its verbatim excerpt and approve it — the pipeline steps show the case, map and roadmap updating.
- **Eva — conflict** (as Petra): Findings shows the Technical Lead's "Ready with Support" and the Line Manager's "working independently" side by side. Only Orion's Technical Lead could validate; the PMO cannot.

## Closing (20 s)

Roles follow the organisation; every decision belongs to a person with a reason in the audit log; AI suggestions stay suggestions; sample data is always labelled.
