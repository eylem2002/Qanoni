# قانوني AI — Arabic Legal Contract Generator (Jordan)

Generates Jordanian-law contracts (employment, rental, service, NDA, supplier) in Arabic, where mandatory statutory clauses are fixed lawyer-reviewable text and only the negotiated sections are AI-drafted.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/contracts/` — contract generation routes (one per type).
- `artifacts/api-server/src/routes/contracts/clauses/` — hybrid engine + per-type templates (source of truth for clause text).
  - `engine.ts` — `buildHybridPrompt`, `parseSections`, `assembleContract`, `streamHybridContract`, `missingRequiredSections`.
  - `types.ts` — `FixedClause` / `VariableClause` / `ContractTemplate`.
  - `employment.ts`, `rental.ts`, `service.ts`, `nda.ts`, `supplier.ts` — templates + co-located Zod bodies.
- `artifacts/api-server/src/lib/law-client.ts` — RAG: `retrieveArticlesForContract`, `formatArticlesForPrompt`.
- `artifacts/legal-ai/src/components/ContractForms.tsx` — the shared `submitContract` NDJSON streaming consumer (exported).
- `artifacts/legal-ai/src/pages/Home.tsx` — main UI; employment + non-employment forms.

## Architecture decisions

- **Hybrid generation:** statutory clauses are deterministic `render(data)` text (verbatim, lawyer-reviewable); only negotiated sections are AI-drafted, delimited by `[[[SECTION:id]]]...[[[/SECTION]]]`, grounded in RAG law. Assembled server-side; deterministic verification runs on the assembled whole.
- **NDJSON envelope is a contract:** `{type:"chunk"|"done"|"error"}` with `done` carrying `contract/valid/missingClauses/validationWarnings`. The frontend `submitContract` consumer depends on these shapes.
- **Frontend consumes the stream, not the generated hook:** the generated `useGenerateContract` hook mis-infers NDJSON as a blob; all contract types use `submitContract`.
- **Required variable clauses fail validation** if the model omits them (`missingRequiredSections`) — never ship a placeholder as `valid:true`.

## Product

Users pick a contract type, fill an Arabic form, and get a Jordanian-law contract streamed live. Mandatory legal clauses are fixed/verbatim (pending lawyer sign-off); negotiated parts are AI-written and grounded in retrieved law. Output can be copied or exported to Word.

## User preferences

- Architecture is not a substitute for market validation (the user plans to talk to ~10 lawyers before relying on clause wording).

## Gotchas

- **api-server `dev` is `build && start` with no watch.** Source edits do NOT reach the running server until you `restart_workflow "artifacts/api-server: API Server"`. Verifying a live endpoint without restarting tests a stale build.
- **All fixed clause text is marked "LAWYER REVIEW REQUIRED"** — it is a grounded starting point, not vetted legal text.
- Generation streams for ~40s; test endpoints with a synchronous foreground request that reads to the `done` event (backgrounded jobs get killed).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
