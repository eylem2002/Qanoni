# قانوني AI — Arabic Legal Contract Platform

A full-stack web app for generating and reviewing Jordanian-law-compliant legal contracts in Arabic using AI.

---

## What It Does

1. **Contract Generation** — Fill a short form, get a complete Arabic contract backed by real Jordanian law articles.
2. **Contract Review** — Upload any contract (PDF, Word, TXT) and get a color-coded risk report.
3. **Word Export** — Download any contract or review report as a `.docx` file.
4. **User Accounts** — Full signup / login / session system; contracts and reviews are saved per user.

---

## Setup Guide — Windows

### Step 1 — Install the tools

Open **PowerShell as Administrator** and run:

```powershell
# Install Node.js (LTS)
winget install OpenJS.NodeJS.LTS

# Install Git
winget install Git.Git

# Install PostgreSQL 16
winget install PostgreSQL.PostgreSQL.16
```

After these finish, **close PowerShell and open a new one** (so the PATH updates).

Then install pnpm:
```powershell
npm install -g pnpm
```

Verify everything installed:
```powershell
node --version     # should show v20.x or higher
pnpm --version     # should show 9.x or 10.x
git --version      # should show git version 2.x
```

---

### Step 2 — Create the database

PostgreSQL installs with a default `postgres` user. Open a new PowerShell and run:

```powershell
# Switch to the postgres user and create the database
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE qanooni_ai;"
```

It will ask for the **postgres password** you chose during installation. Type it and press Enter.

---

### Step 3 — Clone the repository

```powershell
git clone https://github.com/eylem2002/Qanoni.git
cd Qanoni
```

---

### Step 4 — Install dependencies

```powershell
pnpm install
```

---

### Step 5 — Create your `.env` file

```powershell
copy .env.example .env
```

Open `.env` with Notepad (or VS Code):
```powershell
notepad .env
```

Fill in these three values:

```env
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/qanooni_ai
```
> Replace `YOUR_POSTGRES_PASSWORD` with the password you set when installing PostgreSQL.

```env
SESSION_SECRET=paste-a-long-random-string-here
```
> Generate one by running this in PowerShell:
> ```powershell
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> Copy the output and paste it as the value.

```env
OPENAI_API_KEY=sk-your-real-openai-key-here
```
> Get your key from **platform.openai.com → API keys**

Leave `PORT=5001`, `VITE_PORT=5173`, `NODE_ENV=development` as they are.

Save and close the file.

---

### Step 6 — Push the database schema

```powershell
pnpm --filter @workspace/db run push
```

Expected output:
```
[✓] Changes applied
```

---

### Step 7 — Build the API server

```powershell
pnpm --filter @workspace/api-server run build
```

---

### Step 8 — Run both servers (two PowerShell windows)

**PowerShell window 1 — API server:**
```powershell
pnpm --filter @workspace/api-server run start
```
Expected: `Server listening  port: 5001`

**PowerShell window 2 — Frontend:**
```powershell
pnpm --filter @workspace/legal-ai run dev
```
Expected: `Local: http://localhost:5173/`

---

### Step 9 — Open the app

Go to: **http://localhost:5173**

Create an account and start using it.

---

## Setup Guide — Mac

### Step 1 — Install the tools

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js, pnpm, PostgreSQL
brew install node@20 postgresql@16
npm install -g pnpm
brew services start postgresql@16
```

### Step 2 — Clone and install

```bash
git clone https://github.com/eylem2002/Qanoni.git
cd Qanoni
pnpm install
```

### Step 3 — Create the database

```bash
createdb qanooni_ai
```

### Step 4 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in:
- `DATABASE_URL=postgresql://localhost:5432/qanooni_ai`
- `SESSION_SECRET` → generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `OPENAI_API_KEY` → from **platform.openai.com → API keys**

### Step 5 — Push schema, build, run

```bash
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run build
```

**Terminal 1:**
```bash
pnpm --filter @workspace/api-server run start
```

**Terminal 2:**
```bash
pnpm --filter @workspace/legal-ai run dev
```

Open **http://localhost:5173**

---

## Environment Variables Reference

| Variable         | Required | Description                                       |
| ---------------- | -------- | ------------------------------------------------- |
| `DATABASE_URL`   | ✅        | PostgreSQL connection string                      |
| `SESSION_SECRET` | ✅        | Random 32+ character string for session signing   |
| `OPENAI_API_KEY` | ✅        | OpenAI API key (contract generation + review)     |
| `PORT`           | ✅        | Express API server port (default: 5001)           |
| `VITE_PORT`      | ✅        | Vite dev server port (default: 5173)              |
| `NODE_ENV`       | ✅        | `development` locally, `production` on server     |

---

## Common Commands

```bash
# Typecheck the full monorepo
pnpm run typecheck

# Rebuild the API server after code changes
pnpm --filter @workspace/api-server run build

# Push database schema changes
pnpm --filter @workspace/db run push
```

---

## Troubleshooting

**`drizzle-kit push` fails with DATABASE_URL error**
→ Check that your `.env` file exists at the project root and has a valid `DATABASE_URL`. The config auto-loads it.

**PostgreSQL connection refused**
→ Make sure PostgreSQL is running:
- Mac: `brew services start postgresql@16`
- Windows: Open Services → find PostgreSQL → Start

**Port already in use**
- Mac: `lsof -ti:5001 | xargs kill`
- Windows: `netstat -ano | findstr :5001` → `taskkill /PID <PID> /F`

**`Cannot find module @rollup/rollup-darwin-arm64` (Mac Apple Silicon)**
→ Run `pnpm install` again.

**Login doesn't work after signup**
→ Make sure both servers are running. The frontend (5173) proxies `/api` to the backend (5001). If the backend is down, all API calls fail.
