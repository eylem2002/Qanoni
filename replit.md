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
- Build: esbuild (CJS bundle, api-server) / Vite (legal-ai)
- Frontend: React + Redux Toolkit, MUI v9 (RTL dark, emotion + stylis-plugin-rtl), React Router, react-hook-form. No Tailwind/Shadcn/Wouter.

## Where things live (INSIGHT V3.0 layered architecture)

Backend (`artifacts/api-server/src/`) — layered: `core/` → `infra/` → `services/` → `domains/` → `api/`, wired by `bootstrap/`.
- `core/` — `errors/` (AppError hierarchy), `logger/`, `utils/` (sanitizer), `constants/`. No outward deps.
- `infra/anthropic/` — Anthropic client wrapper.
- `services/law/` — RAG: `retrieveArticlesForContract`, `formatArticlesForPrompt`, article loading. `services/wordExport/` — Word generation.
- `domains/contracts/` — `contracts.controller.ts` (HTTP/NDJSON), `contracts.logic/` (orchestration), `contractRegistry`, `clauses/` (hybrid engine + per-type templates — source of truth for clause text), `data/` (jordan-labor-law).
  - `clauses/engine.ts` — `buildHybridPrompt`, `parseSections`, `assembleContract`, `streamHybridContract`, `missingRequiredSections`.
  - `clauses/types.ts` — `FixedClause` / `VariableClause` / `ContractTemplate`.
  - `clauses/{employment,rental,service,nda,supplier}.ts` — templates + co-located Zod bodies.
- `domains/review/` — contract review logic.
- `api/middlewares/` (rateLimiters, validate, notFound/error handlers), `api/routes/` (route registry, health). `bootstrap/` — `initApi`, route registration; `app.ts` uses bootstrap.

Frontend (`artifacts/legal-ai/src/`) — `main.tsx` → `app/` → `portals/` + `domains/`.
- `app/` — `App`, `providers/` (Redux/Query/Theme RTL), `router/` (AppRouter + routeRegistry), `store/` (+ `slices/contractSlice.ts`), `theme/`.
- `portals/home/` — `HomePortal` (form side) + `ContractPreview` (streamed output, overlay-while-generating). `portals/reviewer/`, `portals/notFound/`.
- `domains/contracts/` — `forms/` (5 MUI forms), `constants.ts` (`CONTRACT_TYPE_LABEL`, `LOADING_MESSAGES` Records), `contractsApi.ts` (`submitContract` NDJSON consumer + `exportContractWord`), `useContractStream.ts` (wires callbacks → Redux), `types.ts`. `domains/review/` — review helpers.
- `components/form/` — RHF wrappers (`RHFTextField`, `RHFSelect`, `RHFSwitch`). `components/layout/PageShell.tsx`. `hooks/`, `lib/`, `types/`.

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
