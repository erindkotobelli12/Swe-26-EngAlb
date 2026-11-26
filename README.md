# OnboardIQ

Evidence-based employee onboarding and knowledge transfer prototype for the Engineering Albania Student Hackathon.

## Run

```powershell
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open http://localhost:3000.

## Environment

Copy `.env.example` to `.env`. Install Ollama and pull the configured model (`ollama pull llama3.2:latest`) if it is not already present. The assistant sends requests to the local Ollama service only and grounds responses in SQLite records; if Ollama or the model is unavailable, it reports an error and does not return simulated answers. SQLite persists application changes in `prisma/dev.db`; run migrations and seed only when initializing or resetting the local demo database.

The database seed contains fictional hackathon examples. Replace or import records for real organizational use; do not enter confidential company data into this demo without appropriate authorization.

## Demo users

Use the sidebar role switcher: PMO Coordinator, Employee or Technical Lead. This is demo role switching, not production authentication.

## Test

```powershell
npm run typecheck
npm test
npm run build
```

