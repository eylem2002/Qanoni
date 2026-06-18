# قانوني AI — Arabic Legal Contract Platform

A full-stack web app for generating and reviewing Jordanian-law-compliant legal contracts in Arabic using AI.

---

## What It Does

1. **Contract Generation** — Fill a short form, get a complete Arabic contract backed by real Jordanian law articles.
2. **Contract Review** — Upload any contract (PDF, Word, TXT) and get a color-coded risk report.
3. **Word Export** — Download any contract or review report as a `.docx` file.
4. **User Accounts** — Full signup / login / session system; contracts and reviews are saved per user.

---

## Tech Stack

| Layer           | Technology                              |
| --------------- | --------------------------------------- |
| Runtime         | Node.js 20+                             |
| Language        | TypeScript 5.9 (strict)                 |
| Package Manager | pnpm workspaces                         |
| Frontend        | React 19 + Vite + MUI v9 (RTL / Arabic) |
| Backend         | Express 5                               |
| Database        | PostgreSQL + Drizzle ORM                |
| AI              | OpenAI GPT-4o                           |
| Word Export     | `docx` npm package (server-side)        |

---

## Setup Guide (Mac)

Follow every step in order. This takes about 10 minutes the first time.

### 1 — Install prerequisites

```bash
# Install Homebrew (skip if already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 20+
brew install node@20
node --version   # should print v20.x.x or higher

# Install pnpm
npm install -g pnpm
pnpm --version   # should print 9.x or 10.x

# Install PostgreSQL 16
brew install postgresql@16
brew services start postgresql@16
```

### 2 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 3 — Install dependencies

```bash
pnpm install
```

### 4 — Create the database

```bash
createdb qanooni_ai
```

Verify it was created:
```bash
psql -l | grep qanooni
# Should show: qanooni_ai
```

### 5 — Create your .env file

```bash
cp .env.example .env
```

Now open `.env` in any text editor and fill in **three values**:

```env
DATABASE_URL=postgresql://localhost:5432/qanooni_ai

SESSION_SECRET=<generate one — run this command and paste the output>
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

OPENAI_API_KEY=sk-your-real-openai-key-here
```

> Get your OpenAI key from: **platform.openai.com → API keys**

Leave the rest of the file as-is (`PORT=5001`, `VITE_PORT=5173`, `NODE_ENV=development`).

### 6 — Push the database schema

```bash
pnpm --filter @workspace/db run push
```

Expected output:
```
[✓] Changes applied
```

### 7 — Build the API server

```bash
pnpm --filter @workspace/api-server run build
```

### 8 — Run both servers (two terminals)

**Terminal 1 — API server:**
```bash
set -a && source .env && set +a
pnpm --filter @workspace/api-server run start
```

Expected output: `Server listening  port: 5001`

**Terminal 2 — Frontend:**
```bash
set -a && source .env && set +a
pnpm --filter @workspace/legal-ai run dev
```

Expected output: `Local: http://localhost:5173/`

### 9 — Open the app

**http://localhost:5173**

Create an account, log in, and start generating contracts.

---

## Environment Variables Reference

| Variable         | Required | Description                                        |
| ---------------- | -------- | -------------------------------------------------- |
| `DATABASE_URL`   | ✅        | PostgreSQL connection string                       |
| `SESSION_SECRET` | ✅        | Random 32+ character string for session signing    |
| `OPENAI_API_KEY` | ✅        | OpenAI API key (for contract generation + review)  |
| `PORT`           | ✅        | Express API server port (default: 5001)            |
| `VITE_PORT`      | ✅        | Vite dev server port (default: 5173)               |
| `NODE_ENV`       | ✅        | `development` locally, `production` on server      |
| `ALLOWED_ORIGIN` | ❌        | Custom allowed CORS origin for production deploys  |

---

## Common Commands

```bash
# Typecheck the full monorepo
pnpm run typecheck

# Rebuild the API server after code changes
pnpm --filter @workspace/api-server run build

# Push database schema changes
pnpm --filter @workspace/db run push

# Regenerate API hooks + Zod schemas from the OpenAPI spec (after editing openapi.yaml)
pnpm --filter @workspace/api-spec run codegen
```

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/     Express 5 backend — auth, AI, contracts, export
│   ├── legal-ai/       React 19 + Vite frontend — the user-facing app
│   └── mockup-sandbox/ UI prototyping sandbox (dev only, ignore)
│
├── lib/
│   ├── db/                          PostgreSQL schema + Drizzle ORM
│   ├── api-spec/                    OpenAPI 3.1 spec
│   ├── api-zod/                     Auto-generated Zod schemas (DO NOT EDIT)
│   ├── api-client-react/            Auto-generated React Query hooks (DO NOT EDIT)
│   └── integrations-anthropic-ai/   OpenAI SDK wrapper (named for history)
│
└── scripts/   Utility scripts
```

---

## Troubleshooting

**`drizzle-kit push` fails with DATABASE_URL error**
→ Make sure you ran `set -a && source .env && set +a` before the command, OR just run it directly — the config auto-loads `.env` from the project root.

**`Cannot find module @rollup/rollup-darwin-arm64`**
→ Run `pnpm install` again. This installs the missing native binary for Apple Silicon.

**Port already in use**
```bash
lsof -ti:5001 | xargs kill   # kill whatever is on the API port
lsof -ti:5173 | xargs kill   # kill whatever is on the Vite port
```

**`Session listening` but login doesn't work**
→ Make sure both servers are running. The frontend (5173) proxies `/api` to the backend (5001). If the backend is down, all API calls will fail silently.
