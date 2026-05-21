# قانوني AI — Arabic Legal Contract Platform

A full-stack web application for generating and reviewing Jordanian-law-compliant legal contracts in Arabic using AI.

---

## What It Does

1. **Contract Generation** — Fill a short form and get a complete, professionally worded Arabic contract in seconds, anchored to real Jordanian law articles.
2. **Contract Review** — Upload any contract (PDF, Word, TXT) and receive a color-coded risk report highlighting safe, questionable, and dangerous clauses.
3. **Word Export** — Download any generated contract or review report as a formatted `.docx` file ready for signing.

---

## Monorepo Layout

```
/
├── artifacts/
│   ├── api-server/          Express 5 backend — all AI and export logic
│   ├── legal-ai/            React + Vite frontend — the user-facing app
│   └── mockup-sandbox/      Isolated Vite server for UI prototyping (dev only)
│
├── lib/
│   ├── db/                  PostgreSQL schema + Drizzle ORM setup
│   ├── api-spec/            OpenAPI 3.1 spec (single source of truth for the API)
│   ├── api-zod/             Auto-generated Zod validation schemas (from OpenAPI)
│   ├── api-client-react/    Auto-generated React Query hooks (from OpenAPI)
│   ├── integrations/        Shared integration helpers
│   └── integrations-anthropic-ai/  Anthropic SDK wrapper (Claude)
│
└── scripts/                 One-off utility scripts
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 (strict) |
| Package Manager | pnpm workspaces |
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui |
| Backend | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod (v4) + drizzle-zod |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| API Contracts | OpenAPI 3.1 → Orval codegen |
| Word Export | `docx` npm package (server-side) |
| PDF Parsing | `pdf-parse` (lazy-loaded) + `mammoth` (DOCX) |

---

## Common Commands

```bash
# Run the backend API server (port from $PORT env, routed via /api)
pnpm --filter @workspace/api-server run dev

# Run the frontend dev server
pnpm --filter @workspace/legal-ai run dev

# Full typecheck across the entire monorepo
pnpm run typecheck

# Regenerate API hooks + Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push database schema changes (dev only)
pnpm --filter @workspace/db run push
```

---

## Required Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing key |
| `ANTHROPIC_API_KEY` | Anthropic AI access (managed via Replit integration) |
| `PORT` | Injected automatically by the Replit workflow per artifact |

---

## README Index

| Package | README |
|---|---|
| Frontend app | `artifacts/legal-ai/README.md` |
| Backend API | `artifacts/api-server/README.md` |
| Database | `lib/db/README.md` |
| OpenAPI spec | `lib/api-spec/README.md` |
| Zod schemas | `lib/api-zod/README.md` |
| React Query hooks | `lib/api-client-react/README.md` |
| Anthropic wrapper | `lib/integrations-anthropic-ai/README.md` |
