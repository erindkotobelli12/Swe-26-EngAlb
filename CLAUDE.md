# Repository conventions

- Use Next.js App Router and strict TypeScript.
- Keep database and business logic in server modules, not React components.
- Use Prisma parameterized queries and Zod input validation.
- Never let AI output write database readiness or evidence state directly.
- Preserve source evidence; separate approvals and corrections.
- Run `npm run typecheck`, `npm test`, `npm run db:seed`, and `npm run build`.
