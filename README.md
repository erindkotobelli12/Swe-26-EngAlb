# OnboardIQ

OnboardIQ is an evidence-based AI decision-support platform for employee onboarding and knowledge transfer. It was built for the Engineering Albania *Employee Onboarding & Knowledge Transfer* hackathon.

For each employee it answers: **ready for the agreed scope? If not, what blocks it, who must act, and in what order?** Every answer traces to verbatim evidence. AI proposes and people decide.

- **Stack:** Next.js 16 (App Router, server actions), React 19, strict TypeScript, Prisma 6 + SQLite, Tailwind 4, Zod, React Flow, Vitest, Playwright, and a **local** Ollama model.
- **Data:** fictional starter-pack data only. Integrations are mocked.

## Setup

### Prerequisites

- Node.js 20+ (tested with 24) and npm.
- [Ollama](https://ollama.com) running locally. Pull one model; `llama3.2` (3B) is the minimum, and a 7–8B instruct model reasons noticeably better:

  ```bash
  ollama pull qwen2.5:7b        # recommended
  # or: ollama pull llama3.2
  ```

### Windows (PowerShell)

```powershell
git clone <repo-url>; cd <repo>
npm install
Copy-Item .env.example .env       # then set AI_MODEL to the model you pulled
npx prisma migrate deploy
npm run db:seed
npm run dev                        # http://localhost:3000
```

### macOS / Linux

```bash
git clone <repo-url> && cd <repo>
npm install
cp .env.example .env               # then set AI_MODEL to the model you pulled
npx prisma migrate deploy
npm run db:seed
npm run dev                        # http://localhost:3000
```

`npm run db:seed` is idempotent: it resets the demo data to the official starter pack and runs the deterministic analysis for every case.

### Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite database (in `prisma/`) |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Must be a loopback URL; anything else is refused so employee data stays local |
| `AI_MODEL` | `llama3.2:latest` | Default model for all agents |
| `AI_MODEL_<AGENT>` | — | Per-agent override: `DETECTIVE`, `EXTRACTION`, `DEPENDENCY_SUGGESTION`, `FOLLOWUP_DRAFTING`, `BRIEFING`, `SIMULATOR_EXPLANATION`, `ROADMAP`, `BOTTLENECK_INSIGHTS`, `ASSISTANT` |
| `AI_TIMEOUT_MS` | `180000` | Per-call timeout |
| `OLLAMA_STRUCTURED_OUTPUTS` | `true` | Send JSON Schema in `format` (set `false` for very old Ollama versions) |
| `DEMO_EVALUATION_DATE` | `2026-10-14` | The single evaluation clock |
| `STALE_AFTER_DAYS`, `FOLLOW_UP_AFTER_DAYS`, `REMINDER_AFTER_DAYS`, `ESCALATE_AFTER_DAYS` | 7, 3, 3, 7 | Thresholds (see `docs/ASSUMPTIONS.md`) |

## Tests and checks

```bash
npm run typecheck
npm run lint
npm test               # Vitest: builds a scratch prisma/test.db (migrate deploy + seed); never touches dev.db
npm run build
npx playwright install chromium               # once
npm run test:e2e -- --grep-invert @llm        # demo journey without the LLM
npm run test:e2e                              # includes @llm tests (needs Ollama running)
```

The e2e global setup re-seeds the dev database, because the journey changes data like a real user. Set `E2E_RESEED=false` to skip.

## Feature tour

Each role has its own home page and short navigation (`/` sends you there):

| Role | Home | Also |
|---|---|---|
| **PMO** | **Portfolio**: project health with reasons, portfolio briefing, top bottlenecks → improvements | Projects (create/edit wizard, team tree, requirements, pre-boarding, briefing), Briefing, Insights & improvements, Audit & AI log |
| **Additional Manager** | **My projects**: projects, Line Managers with team size / blocked / overdue, Technical Lead gaps, own improvements | Team, Escalations, Briefing; chooses each project's Technical Lead |
| **Line Manager** | **My team**: people grouped by phase with blocker and next step; pre-boarding items | Pre-boarding (hand-over), Follow-ups, Briefing |
| **Technical Lead** | **Onboarding**: readiness, reliability, requirement progress, sign-offs, findings, skills to confirm | Requirements (editor + matrix with automatic skill check-off), Investigations, Evidence, Follow-ups, Briefing, Audit & AI log |
| **HR** | **Pre-boarding**: everyone not yet started, checklist progress, start dates, missing contacts | Follow-ups, Briefing |
| **Employee** | **My onboarding**: phase, next steps, waiting on, contacts, requirements, access (Confirm it works) | My profile (skills and earlier projects), Knowledge, Assistant |

The **case hub** `/employees/[id]` keeps every earlier feature: overview (reported / assessed / validated readiness, gates as plain sentences, access, KT, technical validation), requirements, pre-boarding, findings (facts vs assumptions in a details drawer), dependency map, simulator, roadmap, evidence and reliability, follow-ups and history. Tabs and actions follow the permissions in `docs/SPECIFICATION.md`.

### Demo mode

Accounts are switched from the account menu (top right → **Switch demo account**, grouped by role). A small **Demo** tag is the only sign that demo mode is on; there is no password because this is not production authentication (an HTTP-only cookie selects a seeded account). Data is "as of 14 Oct 2026" (`DEMO_EVALUATION_DATE`), shown once in the account menu. People, projects, skills and histories that are not in the starter pack are **sample data** and carry a "Sample data" tag (see `docs/ASSUMPTIONS.md`).

End-to-end tests run against any running server: `E2E_BASE_URL=http://localhost:3100 npm run test:e2e -- --grep-invert @llm` (default: the dev server on port 3000).

## Documentation

| File | Contents |
|---|---|
| [docs/AGENTS.md](docs/AGENTS.md) | Agent and deterministic-engine specifications |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Pipeline, data model, information states, privacy |
| [docs/AI_USAGE.md](docs/AI_USAGE.md) | Where AI is used, where rules are, traceability, failure handling |
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | Roles, rules, gates, permission matrix |
| [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) | Thresholds, interpretations, Business Owner questions |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | What is simulated, what was cut, next improvements |
| [docs/DEMO.md](docs/DEMO.md) | 5–7 minute demo script and slide outline |

Do not enter confidential company data or credentials into this demo.
