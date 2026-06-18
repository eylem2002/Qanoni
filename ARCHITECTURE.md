# قانوني AI — Architecture & System Reference

A complete technical reference covering the project structure, all features, workflows, API layers, and design decisions.

---

## Table of Contents

1. [What the System Does](#1-what-the-system-does)
2. [Monorepo Layout](#2-monorepo-layout)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Backend Architecture](#5-backend-architecture)
6. [API Endpoints](#6-api-endpoints)
7. [Contract Generation — The Hybrid Model](#7-contract-generation--the-hybrid-model)
8. [Contract Review Workflow](#8-contract-review-workflow)
9. [Authentication Workflow](#9-authentication-workflow)
10. [Word Export Workflow](#10-word-export-workflow)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Security Layers](#12-security-layers)
13. [Cross-Package Data Flow](#13-cross-package-data-flow)

---

## 1. What the System Does

قانوني AI is an Arabic-language legal assistant for the Jordanian legal market. It does four things:

| Feature | Description |
|---------|-------------|
| **Contract Generation** | User fills a form → AI drafts a contract grounded in real Jordanian law articles → streamed to the browser in real-time |
| **Contract Review** | User uploads a PDF/DOCX/TXT file → AI reads the text → returns a color-coded risk report (green/yellow/red per clause) |
| **Word Export** | Any generated contract or review report can be downloaded as a formatted `.docx` file with an RTL Arabic layout |
| **User Accounts** | Full session-based auth; every contract and review is saved per user and can be retrieved later |

Supported contract types:
- **Employment** (عقد عمل) — governed by Jordanian Labour Law no. 8 of 1996
- **Rental** (عقد إيجار)
- **Service** (عقد خدمات)
- **NDA** (اتفاقية سرية)
- **Supplier** (عقد توريد)

---

## 2. Monorepo Layout

```
/
├── artifacts/
│   ├── api-server/          Express 5 backend
│   │   └── src/
│   │       ├── index.ts             Entry point — starts the HTTP server
│   │       ├── app.ts               Creates and exports the Express app
│   │       ├── bootstrap/
│   │       │   ├── initApi.ts       Installs all middleware (session, CORS, CSRF, logging)
│   │       │   └── initRoutes.ts    Mounts all domain routers under /api
│   │       ├── api/
│   │       │   ├── middlewares/     CSRF, requireAuth, validate, rateLimiters, errorHandler
│   │       │   └── routes/          Health check route
│   │       ├── core/
│   │       │   ├── constants/       Rate limit values, shared Arabic error strings
│   │       │   ├── errors/          Typed error classes (ValidationError, NotFoundError, etc.)
│   │       │   └── logger/          Pino logger instance
│   │       ├── domains/
│   │       │   ├── auth/            Signup, login, logout, /me
│   │       │   ├── contracts/       Contract generation, listing, export
│   │       │   └── review/          File upload review, text review, listing
│   │       ├── infra/
│   │       │   └── anthropic/       Re-exports the OpenAI client from the workspace lib
│   │       └── services/
│   │           ├── law/             Loads Jordanian law article text from static files
│   │           └── wordExport/      Builds .docx files (contracts and review reports)
│   │
│   ├── legal-ai/            React 19 + Vite frontend
│   │   └── src/
│   │       ├── app/
│   │       │   ├── router/          Route definitions
│   │       │   ├── store/           Redux Toolkit store + slices (auth, contract, ui)
│   │       │   └── theme/           MUI v9 RTL theme setup
│   │       ├── domains/
│   │       │   ├── auth/            authApi.ts — fetch wrappers for signup/login/logout/me
│   │       │   ├── contracts/       contractsApi.ts, useContractStream.ts, types, constants
│   │       │   └── review/          reviewApi.ts, types
│   │       └── portals/             Page-level React components
│   │
│   └── mockup-sandbox/      Isolated Vite sandbox for UI prototyping (not production)
│
├── lib/
│   ├── db/                  PostgreSQL schema + Drizzle ORM
│   │   ├── drizzle.config.ts        Drizzle-kit config (auto-loads root .env)
│   │   └── src/
│   │       ├── index.ts             Exports db client, pool, and all table types
│   │       └── schema/              users, contracts, reviews, session tables
│   │
│   ├── api-spec/            OpenAPI 3.1 YAML spec — single source of truth for the API contract
│   │
│   ├── api-zod/             Zod validation schemas auto-generated from the OpenAPI spec (DO NOT EDIT)
│   │   └── src/generated/   GenerateContractBody, LoginInput, SignupInput, etc.
│   │
│   ├── api-client-react/    React Query hooks auto-generated from the OpenAPI spec (DO NOT EDIT)
│   │
│   └── integrations-anthropic-ai/   OpenAI SDK wrapper
│       └── src/
│           ├── client.ts    Creates and exports the OpenAI client (reads OPENAI_API_KEY)
│           └── index.ts     Re-exports the openai instance
│
└── scripts/                 One-off utility scripts
```

---

## 3. Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js 20+ | ESM (`"type": "module"`) throughout |
| Language | TypeScript 5.9 strict | All packages |
| Package manager | pnpm workspaces | Shared catalog for dependency versions |
| Frontend | React 19 + Vite 7 | MUI v9, RTL Arabic (stylis-plugin-rtl) |
| State management | Redux Toolkit + TanStack Query | Auth/UI state in Redux; server state in React Query |
| Backend | Express 5 | Async error propagation via `next(err)` |
| Database | PostgreSQL + Drizzle ORM | Schema-first; Drizzle-kit for migrations |
| Sessions | express-session + connect-pg-simple | Sessions stored in the `session` PostgreSQL table |
| AI | OpenAI GPT-4o | Streaming for generation; non-streaming for review |
| Logging | pino + pino-http | Structured JSON logs |
| Validation | Zod v4 | Schema validated at every API boundary |
| Word export | docx npm package | Server-side; RTL/Arabic font support |
| PDF parsing | pdf-parse (lazy-loaded) | Lazy to avoid file-read crash at startup |
| DOCX parsing | mammoth | Extracts raw text from Word files |
| Build tool | esbuild (api-server) | Single-file ESM bundle at `dist/index.mjs` |

---

## 4. Database Schema

Four tables in PostgreSQL. All IDs are UUIDs.

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auto-generated |
| `email` | text UNIQUE NOT NULL | Stored lowercase |
| `password_hash` | text NOT NULL | bcryptjs hash (cost factor 12) |
| `firm_name` | text nullable | Law firm name (optional at signup) |
| `created_at` | timestamptz | Defaults to now() |

### `contracts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | CASCADE DELETE |
| `contract_type` | text NOT NULL | `employment`, `rental`, `service`, `nda`, `supplier` |
| `generated_text` | text NOT NULL | Full assembled contract text |
| `input_data` | jsonb | The form values the user submitted |
| `law_articles_used` | jsonb | Which law articles were injected for grounding |
| `created_at` | timestamptz | |

### `reviews`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | CASCADE DELETE |
| `source_contract_id` | uuid FK → contracts nullable | SET NULL on delete; links if reviewing a generated contract |
| `findings` | jsonb NOT NULL | Array of `{status, severity, clause, finding, suggestion}` |
| `filename` | text nullable | Original uploaded filename |
| `created_at` | timestamptz | |

### `session`

Managed entirely by `connect-pg-simple`. Stores serialized session objects for express-session. Not accessed directly by application code.

---

## 5. Backend Architecture

### Startup sequence

```
index.ts
  └─ initApi()        → Express app + all middleware
  └─ initRoutes(app)  → All domain routers mounted at /api
  └─ app.listen(PORT)
```

### Middleware stack (applied in this order)

```
1. pino-http          → Structured request/response logging
2. cors()             → Allow all origins (browser-enforced by CSRF guard below)
3. express.json()     → JSON body parsing
4. express.urlencoded → Form body parsing
5. express-session    → Session cookie (PostgreSQL-backed)
6. csrfGuard          → Origin-based CSRF check for all state-mutating methods
```

### Domain structure

Each domain (`auth`, `contracts`, `review`) follows the same three-layer pattern:

```
routes.ts       → Declares HTTP routes, applies middleware (requireAuth, validateBody, multer)
controller.ts   → HTTP handler — parses req, calls logic/store, writes res
logic/          → Pure business logic (no HTTP types)
  *Logic.ts     → AI calls, password hashing, text extraction, prompt building
  *Store.ts     → Database read/write via Drizzle ORM
```

### Error classes (`core/errors/index.ts`)

| Class | HTTP Status |
|-------|------------|
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `UnprocessableError` | 422 |
| `AppError` (base) | configurable |

Errors thrown anywhere in an async handler propagate to the global `errorHandler` middleware, which serializes them into `{ error: string }` JSON with the correct status code.

---

## 6. API Endpoints

All routes are prefixed with `/api`. In local development the Vite dev server proxies `/api/*` to Express on port 5001.

### Auth — `/api/auth`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| POST | `/auth/signup` | No | Create account. Body: `{ email, password, firmName? }`. Returns `{ user }`. |
| POST | `/auth/login` | No | Login. Body: `{ email, password }`. Returns `{ user }`. Sets session cookie. |
| POST | `/auth/logout` | No | Destroys session, clears cookie. Returns 204. |
| GET | `/auth/me` | No (reads session) | Returns `{ user }` if session is valid, 401 otherwise. |

### Contracts — `/api/contracts`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| POST | `/contracts/generate` | Yes | Generate employment contract. Streams NDJSON. |
| POST | `/contracts/generate-rental` | Yes | Generate rental contract. Streams NDJSON. |
| POST | `/contracts/generate-service` | Yes | Generate service contract. Streams NDJSON. |
| POST | `/contracts/generate-nda` | Yes | Generate NDA. Streams NDJSON. |
| POST | `/contracts/generate-supplier` | Yes | Generate supplier contract. Streams NDJSON. |
| GET | `/contracts` | Yes | List current user's saved contracts (metadata only). |
| GET | `/contracts/:id` | Yes | Get one saved contract (full text). |
| POST | `/contracts/export-word` | No | Convert contract text to `.docx`. Returns binary. |
| POST | `/contracts/export-report` | No | Convert review findings to `.docx`. Returns binary. |

### Reviews — `/api/reviews` + `/api/contracts/review*`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| POST | `/contracts/review` | Yes | Upload file (PDF/DOCX/TXT, max 5MB). Returns `{ findings[], reviewId }`. |
| POST | `/contracts/review-text` | Yes | Review plain text. Body: `{ contractText }`. Returns `{ findings[], reviewId }`. |
| GET | `/reviews` | Yes | List current user's saved reviews. |
| GET | `/reviews/:id` | Yes | Get one saved review with findings. |

### Health

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| GET | `/healthz` | No | Returns `{ status: "ok" }`. |

### Rate limits

- Contract generation: **20 requests per 10 minutes** per IP
- Contract review: **5 requests per 10 minutes** per IP

---

## 7. Contract Generation — The Hybrid Model

This is the core intellectual design of the system. It solves a real problem: pure AI generation of legal text is unreliable (hallucinated law articles, missing mandatory clauses). The hybrid model separates clauses into two types.

### Fixed clauses (ثابتة)

- Contain **verbatim, lawyer-reviewed Arabic statutory text**
- Rendered by a deterministic TypeScript `render(data)` function
- The AI **never sees these for generation** — they are injected after the AI response
- Same input always produces byte-identical output
- Example: the probation period clause always cites "المادة (35)" exactly as written in Jordanian law

### Variable clauses (متغيّرة)

- Contain the **negotiable, deal-specific content** that differs per contract
- The AI is given an `instruction(data)` string telling it exactly what to write
- Example: job description, benefits, confidentiality terms

### Generation pipeline — step by step

```
1. User submits a form (e.g. employment contract form)
   ↓
2. Frontend sends POST /api/contracts/generate with the form data

3. Backend: prepareGeneration()
   - Validates the request body against the Zod schema (GenerateContractBody)
   - Loads the law articles text from the static data file (jordan-labor-law.ts)
   - Selects the correct ContractTemplate (employment, rental, etc.)
   - Returns { template, data, articlesText, validate, lawWarnings, ... }
   ↓
4. streamHybridContract() begins:
   - Sets Content-Type: application/x-ndjson
   - Calls res.flushHeaders() to open the stream immediately
   - Installs AbortController → aborts OpenAI request if browser disconnects
   ↓
5. buildHybridPrompt() constructs the AI prompt:
   - Tells the model it is a Jordanian lawyer
   - Provides ONLY the variable clause instructions (not the fixed ones)
   - Injects the law articles text as the only allowed source
   - Each variable clause is wrapped in [[[SECTION:id]]] ... [[[/SECTION]]] markers
   - Strict rules: no emoji, no invented law, cite article numbers, no preamble/conclusion
   ↓
6. openai.chat.completions.create({ stream: true }) — streams GPT-4o response
   - Each chunk is forwarded to the browser as: {"type":"chunk","text":"..."}\n
   - This keeps the connection alive and shows real-time typing effect
   ↓
7. parseSections(raw) extracts the model's output per section ID
   ↓
8. assembleContract() builds the final document:
   - For each clause in template.clauses (in legal order):
     - If fixed: render(data) → verbatim lawyer-reviewed text
     - If variable: model's drafted text (or "[يُرجى مراجعة محامٍ أردني مرخص]" if missing)
   - Joins: title + preamble + clauses + signatureBlock + disclaimer
   ↓
9. Deterministic validation layer:
   - Checks that required phrases are present (e.g. "قانون العمل", "الأجر", "التوقيعات")
   - Checks that no required variable clause was left as a placeholder
   ↓
10. If valid → send: {"type":"done","valid":true,"contract":"<full text>","validationWarnings":[]}\n
    If invalid → send: {"type":"done","valid":false,"error":"...","missingClauses":["..."]}\n
    ↓
11. After the done event is sent → persistContract() saves to the contracts table
    (persistence failure cannot block or corrupt the already-sent stream)
    ↓
12. res.end()
```

### NDJSON stream envelope

Every line sent to the browser is a JSON object followed by `\n`:

```json
{"type":"chunk","text":"يعمل الطرف الثاني..."}
{"type":"chunk","text":" لدى الطرف الأول"}
{"type":"done","valid":true,"contract":"<complete assembled text>","validationWarnings":[]}
```

On error:
```json
{"type":"error","error":"فشل في توليد العقد. يرجى المحاولة مرة أخرى."}
```

### Why the done event contains the assembled contract (not the stream)

The chunks that stream to the browser are the raw model output — they contain the section markers `[[[SECTION:id]]]` and only the variable parts. The final `contract` field in the done event contains the properly assembled document (fixed + variable, in legal order, without any markers). The frontend replaces the streamed preview with this final assembled text when the done event arrives.

---

## 8. Contract Review Workflow

```
1. User uploads a file (PDF, DOCX, or TXT) — max 5MB
   ↓
2. multer stores it in memory (memoryStorage) — never written to disk
   ↓
3. extractText(buffer, mimetype):
   - PDF: pdf-parse (lazy-loaded to avoid a crash on startup)
   - DOCX: mammoth.extractRawText()
   - TXT: Buffer.toString("utf-8")
   - Other: throws UnprocessableError (422)
   ↓
4. Minimum text length check: < 100 chars → 422 error
   ↓
5. buildReviewPrompt(contractText):
   - Tells GPT-4o it is a Jordanian lawyer reviewing the contract
   - Returns a JSON array of findings — strict rules enforce this format
   - Each finding: { status, severity, clause, finding, suggestion }
   - Status: "green" (safe) | "yellow" (unusual) | "red" (illegal/dangerous)
   - 6–15 findings required; missing mandatory clauses added as red findings
   - First 12,000 characters of the contract are sent
   ↓
6. openai.chat.completions.create() — non-streaming call
   ↓
7. Response is JSON.parse'd and array-validated
   ↓
8. persistReview() saves findings to the reviews table
   ↓
9. Returns: { reviewId, findings[], charCount, filename }
```

The frontend displays findings as color-coded cards. The user can export the full report to `.docx`.

---

## 9. Authentication Workflow

### Session-based auth

The system uses **cookie-based sessions** backed by PostgreSQL (not JWTs). A session row is created on login and destroyed on logout.

```
Signup:
  User submits { email, password, firmName? }
  → Validate with SignupBody Zod schema
  → findUserByEmail() → if found → 409 ConflictError
  → createUser() → bcryptjs.hash(password, 12) → INSERT INTO users
  → req.session.regenerate()   ← prevents session fixation
  → req.session.userId = user.id
  → req.session.save()
  → 201 { user: { id, email, firmName } }

Login:
  User submits { email, password }
  → findUserByEmail()
  → bcryptjs.compare(password, user.passwordHash)
  → req.session.regenerate()
  → req.session.userId = user.id
  → req.session.save()
  → 200 { user }

Logout:
  → req.session.destroy()
  → res.clearCookie("qanooni.sid")
  → 204

/me (session check):
  → req.session.userId exists?
  → findUserById()
  → 200 { user } or 401
```

### Session cookie configuration

| Environment | sameSite | secure | Reason |
|------------|----------|--------|--------|
| `NODE_ENV=development` | `lax` | `false` | HTTP localhost — SameSite=Lax gives built-in CSRF protection |
| `NODE_ENV=production` | `none` | `true` | HTTPS cross-site (Replit iframe) — requires SameSite=None |

Cookie name: `qanooni.sid`. Max age: 7 days.

### `requireAuth` middleware

Checks `req.session.userId`. If not set, returns 401. Applied to all endpoints that need a logged-in user.

---

## 10. Word Export Workflow

### Contract export (`/api/contracts/export-word`)

```
Request body: { contractText, contractTypeLabel, partyName }
↓
buildWordDocument() — using the docx npm package:
  - Document styles: Times New Roman, RTL, right-aligned
  - Header: "قانوني AI — <contractType>  |  تاريخ الإصدار: <date>"
  - Cover section: large contract type title + party name
  - Content: each line of contractText becomes a paragraph
    - Lines matching "البند|عقد |اتفاقية |التوقيعات" → bold heading style
    - Divider lines (━━━) → horizontal border
  - Footer: disclaimer + page number
↓
Packer.toBuffer(doc) → Buffer
↓
Response headers:
  Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
  Content-Disposition: attachment; filename*=UTF-8''<arabic-filename>.docx
```

### Review report export (`/api/contracts/export-report`)

```
Request body: { findings[], filename }
↓
buildReportDocument():
  - Cover: "تقرير مراجعة العقد" + filename + risk summary counts
    (e.g. "خطر: 2  |  مراجعة: 3  |  آمن: 8")
  - For each finding:
    - Status label in color ([آمن] green / [يحتاج مراجعة] amber / [خطر قانوني] red)
    - Clause name (bold)
    - Finding text
    - Suggestion (if not "لا يلزم تغيير.")
↓
Binary buffer → attachment download
```

---

## 11. Frontend Architecture

### Port separation

- **Frontend (Vite)**: port 5173
- **Backend (Express)**: port 5001
- Vite proxies `/api/*` → `http://127.0.0.1:5001` in dev mode

### Redux store slices

| Slice | State | Purpose |
|-------|-------|---------|
| `authSlice` | `{ user, status: "loading" \| "authenticated" \| "unauthenticated" }` | Auth state; initialized by `/auth/me` call on app mount |
| `contractSlice` | `{ contract, partyName, warnings, isGenerating }` | Holds the live-streaming contract text and final assembled result |
| `uiSlice` | UI toggles | Sidebar, drawer states, etc. |

### Contract streaming on the frontend

`contractsApi.ts → submitContract()`:

1. Sends the form data as POST with `credentials: "include"` (cookie forwarded)
2. Checks `Content-Type: application/x-ndjson` — if not, treats as a JSON error
3. Uses `ReadableStream` + `TextDecoder` to read the response byte by byte
4. Lines are split on `\n` and parsed as JSON
5. `chunk` events → dispatches `setResult({ contract: accumulatedText })` → live preview updates
6. `done` event with `valid: true` → dispatches `setResult` with final assembled contract
7. `done` with `valid: false` → shows toast with missing clauses
8. `error` event → shows error toast

### Domain API modules

Each domain has a dedicated `*Api.ts` file with plain `fetch` wrappers:

- `authApi.ts` — signup, login, logout, getMe
- `contractsApi.ts` — submitContract (streaming), exportContractWord, list, getById
- `reviewApi.ts` — uploadFile, reviewText, list, getById

All use `credentials: "include"` to forward the session cookie.

---

## 12. Security Layers

### CSRF protection

Origin-based guard on every state-mutating HTTP method (POST, PUT, PATCH, DELETE):

- **Non-browser clients** (curl, server-to-server) send no `Origin` header → allowed through (not a CSRF vector)
- **Local development** (`NODE_ENV !== "production"`) → `localhost` and `127.0.0.1` origins allowed
- **Production** → only origins in `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS`, or `ALLOWED_ORIGIN` env vars pass

### Password storage

bcryptjs with cost factor 12. Passwords are never stored, logged, or returned in API responses.

### Session fixation prevention

`req.session.regenerate()` is called on every login and signup. The pre-auth session ID is discarded and a new one issued before setting `userId`.

### Input validation

All request bodies are validated with Zod schemas before any business logic runs. The `validateBody(schema)` middleware short-circuits with a 400 ValidationError on failure.

### File upload limits

- Max file size: 5MB
- Accepted MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword`, `text/plain`
- Storage: in-memory only (never written to disk)

### Rate limiting

- `/contracts/generate*`: 20 requests / 10 minutes / IP
- `/contracts/review*`: 5 requests / 10 minutes / IP

### AI prompt grounding

The contract generation prompt explicitly forbids the model from inventing law articles. It is provided the law text and told to cite only what is in that text. If a topic is unclear, it must write `[يُرجى مراجعة محامٍ أردني مرخص]` rather than guess.

---

## 13. Cross-Package Data Flow

```
lib/api-spec/openapi.yaml
  ↓ (pnpm --filter @workspace/api-spec run codegen)
lib/api-zod/src/generated/         ← Zod schemas for all request/response shapes
lib/api-client-react/src/generated/ ← React Query hooks (not actively used; fetch used directly)

lib/db/src/schema/
  ↓ (imported by)
artifacts/api-server/src/domains/*/logic/*Store.ts   ← database operations

lib/integrations-anthropic-ai/src/client.ts
  ↓ (re-exported by)
artifacts/api-server/src/infra/anthropic/index.ts
  ↓ (imported by)
artifacts/api-server/src/domains/contracts/clauses/engine.ts   ← streaming generation
artifacts/api-server/src/domains/review/logic/ReviewLogic.ts   ← non-streaming review
```

### Environment variable consumers

| Variable | Consumed by |
|----------|------------|
| `DATABASE_URL` | `lib/db/src/index.ts` (pg Pool), `lib/db/drizzle.config.ts` |
| `SESSION_SECRET` | `artifacts/api-server/src/bootstrap/initApi.ts` |
| `OPENAI_API_KEY` | `lib/integrations-anthropic-ai/src/client.ts` |
| `PORT` | `artifacts/api-server/src/index.ts` |
| `VITE_PORT` | `artifacts/legal-ai/vite.config.ts` |
| `NODE_ENV` | `initApi.ts` (cookie config), `csrf.ts` (localhost bypass) |
| `ALLOWED_ORIGIN` | `csrf.ts` (production custom domain) |
| `REPLIT_DEV_DOMAIN` | `csrf.ts` (Replit deployment) |
| `REPLIT_DOMAINS` | `csrf.ts` (Replit deployment) |
