# Architecture

```mermaid
flowchart LR
  UI[Next.js UI] --> API[Server actions and route handlers]
  API --> AUTH[Demo role guard]
  API --> DB[(SQLite / Prisma)]
  API --> GAP[Deterministic gap engine]
  API --> READY[Readiness engine]
  API --> AI[AI provider abstraction]
  AI --> OLLAMA[Local Ollama model]
  GAP --> DB
  READY --> DB
```

The modular monolith keeps server-side business rules outside React components. Prisma parameterizes database access. Demo role state is stored in HTTP-only cookies; all mutations require server-side Zod validation.
