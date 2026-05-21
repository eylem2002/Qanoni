# قانوني AI — Complete Technical Context Document

> This document is the single source of truth for understanding this codebase.
> It is written for an LLM reading it cold with no prior context.
> Read it fully before making any change to the project.

---

## 1. What This Project Is

**قانوني AI** (Qanooni AI) is a full-stack Arabic-language web application that allows users in Jordan to:

1. **Generate** complete, legally compliant Arabic contracts — fully worded, citing real Jordanian law articles — by filling a short form.
2. **Review** any uploaded contract (PDF, DOCX, or TXT) and receive a color-coded risk report showing which clauses are safe, questionable, or legally dangerous.
3. **Export** generated contracts or review reports as formatted Microsoft Word (`.docx`) files.

The AI model is **Anthropic Claude `claude-sonnet-4-6`**. All text — UI labels, contract content, AI prompts, error messages — is in **Arabic (RTL)**. The legal reference is **Jordanian law**.

---

## 2. Monorepo Structure

This is a **pnpm workspace monorepo** running on Node.js 24 / TypeScript 5.9 (strict mode).

```
/
├── artifacts/
│   ├── api-server/          ← Express 5 backend (port from $PORT, routed at /api)
│   ├── legal-ai/            ← React 18 + Vite frontend (port from $PORT, routed at /)
│   └── mockup-sandbox/      ← Isolated Vite server for UI prototyping only (dev)
│
├── lib/
│   ├── db/                  ← PostgreSQL + Drizzle ORM (schema currently empty)
│   ├── api-spec/            ← OpenAPI 3.1.0 YAML + Orval config
│   ├── api-zod/             ← Auto-generated Zod schemas (DO NOT EDIT MANUALLY)
│   ├── api-client-react/    ← Auto-generated React Query hooks (DO NOT EDIT MANUALLY)
│   ├── integrations/        ← Integration helpers
│   └── integrations-anthropic-ai/  ← Anthropic SDK wrapper
│
└── scripts/                 ← Utility scripts
```

### Key conventions
- All packages are named `@workspace/<name>` (e.g., `@workspace/api-server`).
- `lib/*` packages are composite TypeScript (emit declarations).
- `artifacts/*` are leaf packages (typecheck only with `tsc --noEmit`).
- Root `tsconfig.json` lists only `lib/*` packages.
- Never run `pnpm dev` at the workspace root. Each artifact has its own Replit workflow.
- A shared reverse proxy routes traffic: `/api` → api-server, `/` → legal-ai.
- Paths are **not rewritten** by the proxy — services handle their own full path prefix.

---

## 3. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js 24 | |
| Language | TypeScript 5.9 strict | All packages |
| Package Manager | pnpm workspaces | |
| Frontend framework | React 18 + Vite | |
| Frontend styling | Tailwind CSS v3 + shadcn/ui | Dark theme, RTL |
| Frontend icons | lucide-react | |
| Frontend forms | react-hook-form + zodResolver | |
| Frontend data fetching | TanStack Query (React Query v5) | via generated hooks |
| Backend framework | Express 5 | |
| Database | PostgreSQL + Drizzle ORM | Schema currently empty |
| Input validation | Zod (v4) + drizzle-zod | |
| AI provider | Anthropic Claude | via Replit integration |
| AI model | `claude-sonnet-4-6` | `max_tokens: 8192` for generation, `4096` for review |
| API code generation | Orval (from OpenAPI spec) | generates Zod schemas + React Query hooks |
| Word export | `docx` npm package | server-side, no puppeteer |
| PDF parsing | `pdf-parse@1.1.1` | lazy-loaded via `require()` — see critical note below |
| DOCX parsing | `mammoth` | |
| Logging | pino + pino-http | `req.log` in routes, `logger` elsewhere — NEVER `console.log` |
| Rate limiting | `express-rate-limit` | Two separate limiters |

---

## 4. Environment Variables

| Variable | Where Used | Notes |
|---|---|---|
| `DATABASE_URL` | `lib/db` | PostgreSQL connection string |
| `SESSION_SECRET` | `artifacts/api-server` | Express session signing |
| `ANTHROPIC_API_KEY` | `lib/integrations-anthropic-ai` | Injected by Replit Anthropic integration — never set manually |
| `PORT` | Both artifacts | Injected per-artifact by Replit workflow config |
| `BASE_PATH` | Both artifacts | Injected per-artifact by Replit workflow config |

---

## 5. API Server — Full Detail

**File:** `artifacts/api-server/src/`

### 5.1 Entry Point (`index.ts` + `app.ts`)

`index.ts` reads `process.env.PORT` and starts the Express server.

`app.ts` builds the Express app with this exact middleware stack in order:
1. `pino-http` — structured request logging
2. `cors()` — allow all origins
3. `express.json()` — parse JSON bodies
4. `express.urlencoded({ extended: true })` — parse form bodies
5. `reviewRateLimit` applied to `POST /api/contracts/review` — **5 requests per 10 minutes** (strict because file processing + AI is expensive)
6. `contractRateLimit` applied to all `POST /api/contracts/*` — **20 requests per 10 minutes**
7. Main router at `/api`

Both rate limiters use `standardHeaders: true`, `legacyHeaders: false`, and return Arabic error messages.

### 5.2 Routes Overview

All routes are mounted under `/api`. The main router delegates:
- `GET /api/healthz` → `routes/health.ts` → returns `{ status: "ok" }`
- All contract routes → `routes/contracts/index.ts` (generation + export)
- Review routes → `routes/contracts/review.ts`

### 5.3 Shared Security Utilities (`routes/contracts/index.ts`)

Two functions protect every route from prompt injection:

**`sanitizeInput(value: unknown): unknown`**
- Only processes strings
- Trims whitespace
- Searches for 9 injection patterns using regex (`/gi` flags):
  - `ignore (all|previous|above|prior)? instructions?`
  - `disregard (all|previous|above|prior)? instructions?`
  - `forget (all|previous|above|prior)? instructions?`
  - `you are now`
  - `act as (a|an)?`
  - `system prompt`
  - `[INST]`
  - `<|system|>`
  - `### (instruction|system|prompt)`
- Replaces matches with the Arabic string `[محتوى غير مسموح]`
- Does NOT truncate — length limits are enforced by Zod schemas upstream

**`sanitizeObject<T>(obj: T): T`**
- Calls `sanitizeInput` on every string value in a flat object
- Used on every parsed request body before building an AI prompt

**`STRICT_RULES_BASE`** — a constant Arabic string injected into every AI prompt:
```
القواعد الصارمة:
1. لا تستخدم أي رموز تعبيرية (Emoji)
2. لا تخترع نصوصاً قانونية غير موجودة
3. أشر إلى رقم المادة القانونية في كل حكم
4. إذا كان موضوع ما غير مشمول، اكتب: [يُرجى مراجعة محامٍ أردني مرخص]
5. ابدأ مباشرةً بعنوان العقد دون أي مقدمة أو تعليق
```

### 5.4 Employment Contract Route (`POST /api/contracts/generate`)

**Constants:**
- `MIN_WAGE_JD = 290` (Jordanian minimum wage in dinars)
- `AI_MODEL = "claude-sonnet-4-6"`
- `MAX_TOKENS = 8192`

**Validation (Zod schema `GenerateContractBody` from `@workspace/api-zod`):**

Fields and their limits:
```typescript
employerName: string (min 2)
employerRegistrationNumber?: string (optional)
employeeName: string (min 2)
employeeId: string (min 6, max 20)
jobTitle: string (min 2)
department?: string (optional)
directManager?: string (optional)
monthlySalary: number (positive)
startDate: string
employmentType: string (min 2)
probationPeriodDays: number (0 | 30 | 60 | 90)
noticePeriod: string
annualLeaveDays: number
hasBonus: boolean
hasOvertime: boolean
benefits: string[]
hasConfidentialityClause: boolean
ipRights?: string (optional)
workLocation?: string (optional)
specialConditions?: string (optional, max 1000 implied)
```

Extra business rule: `probationPeriodDays` must not exceed 90 (Article 35 of Jordanian Labor Law). Returns `400` if violated.

**Prompt Construction (`buildEmploymentPrompt`):**
- Opens with system role: "أنت كاتب عدل قانوني أردني متخصص"
- Injects `STRICT_RULES_BASE`
- Adds two extra rules: no own knowledge, start immediately with "عقد عمل"
- Injects the **full text of the Jordanian Labor Law** (`JORDAN_LABOR_LAW_FULL` — the entire text of Law No. 8 of 1996 and 2023 amendments) as the only reference
- Injects all form data with inline salary warning if below `MIN_WAGE_JD`
- Specifies the exact 5-part, 22-clause structure to produce, with article references:
  - Part 1: Parties (م.15)
  - Part 2: Work conditions — contract type, probation (م.35), notice (م.21), hours (م.56), overtime (م.57)
  - Part 3: Salary and benefits — salary (م.46), bonus, benefits (م.74, م.33)
  - Part 4: Rights — annual leave (م.61), sick leave (م.65), maternity (م.70), occupational safety (م.71-85), confidentiality, IP
  - Part 5: Termination — notice/indemnity (م.21, م.25), summary dismissal (م.23), end-of-service (م.32), dispute resolution (م.77)
- Ends with pre-printed signature blocks

**Post-generation validation (`validateEmploymentContract`):**

Checks the generated text contains these Arabic strings:
- `"قانون العمل الأردني"` — Labor Law reference
- `"رقم (8) لسنة 1996"` — Law number
- `"الراتب"` — Salary clause
- `"الإجازة"` — Leave clause
- `"إنهاء"` — Termination clause
- `"التوقيع"` — Signature block

Also checks:
- Text length ≥ 2000 characters (otherwise adds warning)
- Salary ≥ MIN_WAGE (otherwise adds warning)

Returns: `{ valid: boolean, missingClauses: string[], warnings: string[] }`

If `valid === false` → HTTP 422 with `{ error, missingClauses }`
If `valid === true` → HTTP 200 with `{ contract: string, validationWarnings: string[] }`

### 5.5 Rental Contract Route (`POST /api/contracts/generate-rental`)

**Zod schema `RentalBody` (defined inline, not in OpenAPI):**
```typescript
landlordName: string (min 2, max 200)
tenantName: string (min 2, max 200)
propertyAddress: string (min 4, max 500)
propertyType: enum ["شقة","فيلا","محل تجاري","مستودع","مكتب"]
monthlyRent: number (positive, max 1_000_000)
contractDurationMonths: number (int, 1-120, default 12)
startDate: string
depositAmount: number (0 to 1_000_000, default 0)
paymentDayOfMonth: number (int, 1-28, default 1)
furnitureStatus: enum ["مفروش","نصف مفروش","غير مفروش"]
specialConditions?: string (max 1000, optional)
```

**Prompt:** References Jordanian Civil Law No. 43/1976 and Real Estate Rental Law No. 11/1994. Extra rules:
- Eviction clause with minimum 1-month notice
- Contract termination from either party
- Maintenance: major on landlord, minor on tenant

**Validation:** `validateGenericContract` — checks text ≥ 1500 chars AND contains: `"المؤجر"`, `"المستأجر"`, `"الإيجار"`, `"التوقيع"`

**Party name for export:** `tenantName`

### 5.6 Service Contract Route (`POST /api/contracts/generate-service`)

**Zod schema `ServiceBody` (inline):**
```typescript
clientName: string (min 2, max 200)
providerName: string (min 2, max 200)
serviceDescription: string (min 10, max 2000)
totalFee: number (positive, max 10_000_000)
paymentTerms: string (min 2, max 200)
deliveryDeadline: string
hasRevisions: boolean (default true)
revisionCount: number (int, 0-20, default 2)
ipOwnership: string (min 2, max 200)
hasConfidentialityClause: boolean (default true)
specialConditions?: string (max 1000, optional)
```

**Prompt:** References Jordanian Civil Law No. 43/1976. Extra rules:
- Provider independence clause (not an employee)
- Acceptance/rejection procedures
- Early termination clause with financial consequences

**Validation:** checks `["العميل","الخدمة","الأتعاب","التوقيع"]`

**Party name for export:** `clientName`

### 5.7 NDA Contract Route (`POST /api/contracts/generate-nda`)

**Zod schema `NdaBody` (inline):**
```typescript
partyOneName: string (min 2, max 200)     ← the disclosing party
partyTwoName: string (min 2, max 200)     ← the receiving party
purposeOfDisclosure: string (min 10, max 1000)
confidentialityDurationYears: number (int, 1-20, default 2)
scopeOfConfidential: string (min 10, max 2000)
permittedDisclosures?: string (max 1000, optional)
penaltyAmount?: number (0 to 10_000_000, optional)
startDate: string
```

**Prompt:** References Jordanian Civil Law + competition/trade secrets law. Extra rules:
- One-directional NDA (from party 1 to party 2)
- Explicit list of confidentiality exceptions (public info, pre-authorized disclosure, legally required)
- Return/destruction of information upon expiry

**Validation:** checks `["الطرف الأول","الطرف الثاني","السرية","التوقيع"]`

**Party name for export:** `partyOneName`

### 5.8 Supplier Contract Route (`POST /api/contracts/generate-supplier`)

**Zod schema `SupplierBody` (inline):**
```typescript
buyerName: string (min 2, max 200)
supplierName: string (min 2, max 200)
goodsOrServices: string (min 10, max 2000)
totalContractValue: number (positive, max 100_000_000)
paymentTerms: string (min 2, max 200)
deliverySchedule: string (min 2, max 200)
deliveryLocation: string (min 2, max 200)
warrantyPeriodDays: number (int, 0-3650, default 30)
penaltyForDelay?: number (optional)
hasExclusivity: boolean (default false)
specialConditions?: string (max 1000, optional)
```

**Prompt:** References Jordanian Civil Law + Commercial Law No. 12/1966. Extra rules:
- Delivery inspection/acceptance clause
- Force majeure clause
- Governing law: Jordanian courts

**Validation:** checks `["المشتري","المورد","التوريد","التوقيع"]`

**Party name for export:** `supplierName`

### 5.9 Contract Review Route (`POST /api/contracts/review`)

**File:** `artifacts/api-server/src/routes/contracts/review.ts`

Uses `multer` with memory storage. Config:
- `fileSize` limit: 5 MB
- `files` limit: 1
- Accepted MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword`, `text/plain`

**Text extraction (`extractText`):**
- PDF: calls `getPdfParse()` which lazy-loads `pdf-parse` via `require()` — THIS IS CRITICAL. `pdf-parse@1.1.1` reads a test file at module load time and crashes if imported at the top of the file. Always use this lazy-load pattern.
- DOCX/DOC: `mammoth.extractRawText({ buffer })`
- TXT: `buffer.toString("utf-8")`

**Guards before AI call:**
- If no file → 400
- If extraction fails → 422
- If extracted text is < 100 chars → 422 "empty file"

**Review prompt (`buildReviewPrompt`):**
- Role: "أنت محامٍ أردني خبير في مراجعة العقود"
- Strict rules: respond ONLY with valid JSON — no text before or after, no backticks
- Classification: `"green"` (safe), `"yellow"` (unusual/needs review), `"red"` (serious legal problem or missing mandatory clause)
- No inventing clauses not present in the contract
- Missing mandatory clauses → add as `red` with finding starting with `"بند مفقود:"`
- Minimum 6 findings, maximum 15
- All text in Arabic

**Required JSON response shape (array of objects):**
```json
{
  "status": "green" | "yellow" | "red",
  "severity": "safe" | "unusual" | "illegal",
  "clause": "اسم البند بالعربية",
  "finding": "ما وجدته في العقد",
  "suggestion": "الإجراء الموصى به. إذا كان آمناً: لا يلزم تغيير."
}
```

**Text cap:** The contract text is sliced to 12,000 characters before being sent to Claude to control token usage.

**JSON parsing:** Claude's response has backtick code fences stripped (`replace(/```json|```/gi, "").trim()`) before `JSON.parse`. If parsing fails or result is not an array → 500.

**Successful response:** `{ findings, charCount, filename }` where `charCount` is the full extracted text length and `filename` is the original file name.

### 5.10 Review-Text Route (`POST /api/contracts/review-text`)

**File:** same `review.ts`

Accepts JSON body `{ contractText: string, label?: string }`. Used when the user clicks "مراجعة" on a just-generated contract (no file upload needed).

Guards: `contractText` must be a string with length ≥ 100.

Uses identical `buildReviewPrompt` and JSON parsing logic.

Response: `{ findings, charCount, filename: "عقد مولَّد" }`

### 5.11 Word Export Routes

**File:** `artifacts/api-server/src/routes/contracts/word-export.ts`

#### `POST /api/contracts/export-word`

Body: `{ contractText: string, contractTypeLabel: string, partyName: string }`

Calls `buildWordDocument(opts)`:
- Splits contract text by `\n`
- Separator lines (matching `/^[━─=]{5,}$/`) become horizontal rule paragraphs with golden border (`#C9A94E`)
- Heading lines (matching `/^(الجزء|البند|عقد |اتفاقية |المراجع القانونية|التوقيعات)/`) get `bold: true`, size 24 (12pt), `before: 160` spacing
- All other lines: size 22 (11pt), `before: 60`
- Font everywhere: `{ name: "Times New Roman", hint: "cs" }` — the `hint: "cs"` (Complex Script) flag is critical for Arabic rendering in Word
- `bidirectional: true` and `rightToLeft: true` on all text runs
- `AlignmentType.RIGHT` on all paragraphs
- Document has a header: `"قانوني AI — {contractTypeLabel} | تاريخ الإصدار: {date}"` in gold
- Document has a footer: disclaimer + page number
- Title block: contract type label (size 40) + party name (size 26)
- Page margins: top/bottom 1200, left/right 1000 twips

Returns binary `.docx` buffer via `Packer.toBuffer(doc)`. Response headers set to `application/vnd.openxmlformats-officedocument.wordprocessingml.document` with `Content-Disposition: attachment; filename="contract.docx"`.

#### `POST /api/contracts/export-report`

Body: `{ findings: Finding[], filename: string }`

Calls `buildReportDocument(opts)`:
- Header: `"قانوني AI — تقرير مراجعة العقد | {date}"`
- Title block: `"تقرير مراجعة العقد"` + filename + summary line: `"خطر: X | مراجعة: Y | آمن: Z"`
- Each finding renders as 2-3 paragraphs:
  1. Status label + clause name (colored: green `#2D7D46`, yellow `#B45309`, red `#B91C1C`)
  2. Finding text
  3. Recommendation (only if suggestion is not `"لا يلزم تغيير."`)
- Footer: disclaimer text

---

## 6. Frontend — Full Detail

**Package:** `@workspace/legal-ai` at `artifacts/legal-ai/`

React 18 + Vite. Entry point: `src/main.tsx` → renders `<App />` inside React Query `QueryClientProvider`.

### 6.1 Routing (`src/App.tsx`)

React Router v6 with two routes:
- `/` → `<Home />` — contract generation
- `/review` → `<ContractReviewer />` — contract review

### 6.2 Theme and Layout

Global CSS sets:
- `background: hsl(222, 47%, 6%)` — very dark navy
- `--primary: #C9A94E` — gold color used throughout
- `dir="rtl"` on the HTML element — entire app is right-to-left
- Font: system Arabic font stack

### 6.3 Home Page (`src/pages/Home.tsx`)

**State:**
```typescript
generatedContract: string | null     ← the AI-returned contract text
validationWarnings: string[]         ← legal warnings from server
contractType: ContractType           ← "employment"|"rental"|"service"|"nda"|"supplier"
currentPartyName: string             ← party name used for .docx filename
wordLoading: boolean                 ← true while Word export is in flight
nonEmploymentLoading: boolean        ← true while non-employment form submits
advancedOpen: boolean                ← accordion state for advanced options
copied: boolean                      ← clipboard feedback (resets after 2s)
```

**Contract type tabs:**
5 buttons rendered from `CONTRACT_TYPES` array. Selecting a new type resets: `generatedContract`, `validationWarnings`, `currentPartyName`, `nonEmploymentLoading`.

**Employment form:**
Uses `react-hook-form` with `zodResolver(formSchema)`. The `formSchema` mirrors the server's `GenerateContractBody` with client-side messages.

Notable UI behaviors:
- Real-time `belowMinWage` warning when `monthlySalary < 290`
- Benefits as a multi-checkbox grid (8 options)
- Advanced section (collapsible) contains: department, direct manager, work location, IP rights, special conditions
- Uses `useGenerateContract` hook from `@workspace/api-client-react` (the only codegen-powered API call in the frontend)

**Non-employment forms:**
When `contractType !== "employment"`, the employment form is hidden and the corresponding component from `ContractForms.tsx` is rendered. These call `fetch()` directly (not via codegen hooks). Each passes a `partyName` string to `onResult` callback which updates `currentPartyName`.

**onResult callback signature:** `(contract: string, partyName: string) => void`

**Action buttons (shown after generation):**

| Button | Action |
|---|---|
| نسخ | `navigator.clipboard.writeText(generatedContract)` |
| تحميل Word | `handleDownloadWord()` — POST to `/api/contracts/export-word`, streams blob, triggers `<a>` download with filename `{contractTypeLabel}-{partyName}.docx` |
| واتساب | Copies contract to clipboard, then opens `wa.me` in new tab |
| مراجعة | `handleReviewThis()` — saves to `sessionStorage`, navigates to `/review` |

**handleReviewThis flow:**
```typescript
sessionStorage.setItem("reviewContract", generatedContract);
sessionStorage.setItem("reviewContractLabel", CONTRACT_TYPE_LABEL[contractType]);
window.location.href = "/review";
```

**Word export loading state:** `wordLoading` disables the button and shows a spinner + "جاري التصدير..." text while the export request is in flight.

### 6.4 Contract Forms (`src/components/ContractForms.tsx`)

Exports 4 React components: `RentalForm`, `ServiceForm`, `NdaForm`, `SupplierForm`.

**Shared type:**
```typescript
type FormCallbacks = {
  onResult: (contract: string, partyName: string) => void;
  onLoadingChange: (loading: boolean) => void;
};
```

**Shared function `submitContract`:**
```typescript
async function submitContract(
  url: string,
  payload: unknown,
  callbacks: FormCallbacks,
  successTitle: string,
  toast: ...,
  partyName: string = ""
): Promise<void>
```
- Sets `onLoadingChange(true)` → POST → sets `onLoadingChange(false)`
- On HTTP 422 with `missingClauses` → shows Arabic error list
- On success → calls `onResult(data.contract, partyName)`

**RentalForm:**
- Fields: landlordName, tenantName, propertyAddress, propertyType (select), monthlyRent, depositAmount, contractDurationMonths, startDate, paymentDayOfMonth, furnitureStatus (select), specialConditions
- Party name sent: `tenantName`
- Endpoint: `POST /api/contracts/generate-rental`

**ServiceForm:**
- Fields: clientName, providerName, serviceDescription, totalFee, deliveryDeadline, paymentTerms (select), ipOwnership (select), hasRevisions (switch), revisionCount (conditional), hasConfidentialityClause (switch), specialConditions
- Party name sent: `clientName`
- Endpoint: `POST /api/contracts/generate-service`

**NdaForm:**
- Fields: partyOneName, partyTwoName, purposeOfDisclosure, scopeOfConfidential, permittedDisclosures, confidentialityDurationYears, penaltyAmount (optional), startDate
- Shows a static info box: "القانون الحاكم: القانون الأردني — المحاكم الأردنية المختصة"
- Party name sent: `partyOneName`
- Endpoint: `POST /api/contracts/generate-nda`

**SupplierForm:**
- Fields: buyerName, supplierName, goodsOrServices, totalContractValue, paymentTerms (select), deliverySchedule, deliveryLocation, warrantyPeriodDays, penaltyForDelay (optional), hasExclusivity (switch), specialConditions
- Party name sent: `supplierName`
- Endpoint: `POST /api/contracts/generate-supplier`

### 6.5 Contract Reviewer (`src/pages/ContractReviewer.tsx`)

**State:**
```typescript
dragOver: boolean           ← drag-and-drop visual state
selectedFile: File | null   ← the chosen file
isLoading: boolean          ← AI review in progress
result: ReviewResult | null ← completed review data
filter: "all"|"green"|"yellow"|"red"  ← findings filter
reportLoading: boolean      ← Word report export in progress
```

**`ReviewResult` interface:**
```typescript
interface ReviewResult {
  findings: Finding[];
  charCount: number;
  filename: string;
}
```

**`Finding` interface:**
```typescript
interface Finding {
  status: "green" | "yellow" | "red";
  severity: "safe" | "unusual" | "illegal";
  clause: string;      ← clause name in Arabic
  finding: string;     ← what was found
  suggestion: string;  ← recommendation
}
```

**`STATUS_CONFIG` map** defines per-status: background color class, border class, icon component (`CheckCircle` / `AlertTriangle` / `AlertCircle`), icon color class, Arabic label, label background class.

**Auto-review `useEffect` (runs once on mount):**
```typescript
useEffect(() => {
  const stored = sessionStorage.getItem("reviewContract");
  const label = sessionStorage.getItem("reviewContractLabel");
  if (stored && stored.length > 100) {
    sessionStorage.removeItem("reviewContract");
    sessionStorage.removeItem("reviewContractLabel");
    setIsLoading(true);
    fetch("/api/contracts/review-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractText: stored, label }),
    })
    // ... sets result or shows error toast
  }
}, []);
```
This is the bridge between the Home page "مراجعة" button and the reviewer page.

**File upload area:** Supports both click-to-select and drag-and-drop. Visual state changes: dashed border becomes gold on drag, green on file selected.

**File validation (`validateFile`):**
- Checks MIME type or file extension against allowed list
- Checks size ≤ 5 MB

**`handleReview`:**
- Creates `FormData` with field `"contract"`
- POST to `/api/contracts/review` (multipart)
- Sets `result` or shows error toast

**Filter bar:** Appears after results load. Buttons: "الكل (N)", "خطر (N)", "مراجعة (N)", "آمن (N)". Each colored per its status.

**`handleDownloadReport`:**
- POST to `/api/contracts/export-report` with `{ findings, filename }`
- Triggers blob download with filename `تقرير-مراجعة-{filename}.docx`

---

## 7. Shared Libraries — Full Detail

### 7.1 `lib/api-spec` — OpenAPI Spec

**File:** `openapi.yaml` (OpenAPI 3.1.0)

`info.title` is `"Api"` — **do not change this**. It controls generated file names.

Currently documents only **2 of the 9 routes**:
- `GET /healthz`
- `POST /contracts/generate` (employment only)

All other routes use `fetch()` directly in the frontend. They are not in the spec yet.

Schemas in the spec:
- `ContractInput` — employment form fields
- `ContractResult` — `{ contract: string, validationWarnings?: string[] }`
- `ContractValidationError` — `{ error: string, missingClauses: string[] }`
- `ApiError` — `{ error: string }`
- `HealthStatus` — `{ status: string }`

**Codegen command:** `pnpm --filter @workspace/api-spec run codegen`

This regenerates both `lib/api-zod/src/` and `lib/api-client-react/src/`. Do not run it unless you have changed `openapi.yaml`.

### 7.2 `lib/api-zod` — Generated Zod Schemas

Auto-generated from the OpenAPI spec. Key export:
- `GenerateContractBody` — used by the API server to validate employment contract requests

### 7.3 `lib/api-client-react` — Generated React Query Hooks

Auto-generated from the OpenAPI spec. Key export:
- `useGenerateContract` — used in `Home.tsx` for the employment form submit mutation

### 7.4 `lib/integrations-anthropic-ai` — Anthropic SDK Wrapper

Exports a single pre-configured `anthropic` client instance. The API key is provided by the Replit Anthropic integration — it is injected into the environment automatically, not stored in code or `.env` files.

Usage throughout the codebase:
```typescript
import { anthropic } from "@workspace/integrations-anthropic-ai";

const msg = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 8192,
  messages: [{ role: "user", content: prompt }],
});
const text = msg.content[0].type === "text" ? msg.content[0].text : "";
```

### 7.5 `lib/db` — Database Package

Provides the Drizzle ORM client connected to PostgreSQL via `DATABASE_URL`.

**The schema is currently empty.** `lib/db/src/schema/index.ts` exports only `{}`.

The application is currently fully **stateless** — no contracts, sessions, or users are stored in the database. The DB package is scaffolded and ready for tables when needed.

To add a table:
1. Create `lib/db/src/schema/your-table.ts`
2. Define the Drizzle table, insert schema, and types
3. Re-export from `lib/db/src/schema/index.ts`
4. Run `pnpm --filter @workspace/db run push`

---

## 8. Complete Data Flows

### 8.1 Employment Contract Generation

```
User fills form on Home.tsx
  → react-hook-form validates with formSchema (Zod)
  → mutate({ data: values }) via useGenerateContract hook
  → POST /api/contracts/generate with JSON body
  → Express: GenerateContractBody.safeParse(req.body)
  → Extra check: probationPeriodDays <= 90
  → sanitizeObject(parsed.data)
  → buildEmploymentPrompt(data) — injects JORDAN_LABOR_LAW_FULL
  → anthropic.messages.create({ model, max_tokens: 8192, messages })
  → validateEmploymentContract(text, salary)
  → if invalid → 422 { error, missingClauses }
  → if valid → 200 { contract, validationWarnings }
  → Home.tsx: setGeneratedContract(result.contract)
  → Home.tsx: setCurrentPartyName(form.getValues().employeeName)
  → Contract shown in output panel
  → User clicks "تحميل Word"
  → handleDownloadWord() → POST /api/contracts/export-word
  → buildWordDocument() → Packer.toBuffer(doc)
  → Response: application/vnd.openxmlformats-officedocument.wordprocessingml.document
  → Browser triggers .docx download
```

### 8.2 Non-Employment Contract Generation (Rental/Service/NDA/Supplier)

```
User selects contract type tab
  → The matching component from ContractForms.tsx renders
  → User fills form
  → onSubmit calls submitContract(url, payload, callbacks, title, toast, partyName)
  → fetch(url, { method: "POST", body: JSON.stringify(payload) })
  → Server validates with inline Zod schema
  → sanitizeObject(data)
  → buildXxxPrompt(data) — references relevant Jordanian law
  → anthropic.messages.create({ model, max_tokens: 8192 })
  → validateGenericContract(text, REQUIRED_PHRASES)
  → if invalid → 422 { error, missingClauses }
  → if valid → 200 { contract, validationWarnings: [] }
  → callbacks.onResult(contract, partyName)
  → Home.tsx: setGeneratedContract(contract), setCurrentPartyName(partyName)
```

### 8.3 Contract Review via File Upload

```
User on ContractReviewer.tsx drops or selects a file
  → validateFile() checks MIME type and size
  → setSelectedFile(file)
  → User clicks "مراجعة العقد"
  → handleReview() → FormData with field "contract"
  → POST /api/contracts/review (multipart/form-data)
  → multer: checks MIME type, size limit, stores in memory
  → extractText(buffer, mimetype):
      PDF → lazy-load pdf-parse via require() → parse(buffer)
      DOCX → mammoth.extractRawText({ buffer })
      TXT → buffer.toString("utf-8")
  → Guard: text.length >= 100
  → buildReviewPrompt(contractText.slice(0, 12000))
  → anthropic.messages.create({ model, max_tokens: 4096 })
  → Strip backticks from response → JSON.parse
  → if not array → 500
  → 200 { findings, charCount, filename }
  → ContractReviewer.tsx: setResult(data)
  → Filter bar appears, findings rendered with color coding
  → User clicks "تحميل التقرير"
  → handleDownloadReport() → POST /api/contracts/export-report
  → buildReportDocument({ findings, filename, generatedDate })
  → .docx downloaded
```

### 8.4 One-Click Review of Generated Contract

```
User generated a contract on Home.tsx
  → Clicks "مراجعة" button
  → handleReviewThis():
      sessionStorage.setItem("reviewContract", generatedContract)
      sessionStorage.setItem("reviewContractLabel", CONTRACT_TYPE_LABEL[contractType])
      window.location.href = "/review"
  → Browser navigates to /review
  → ContractReviewer mounts → useEffect fires
  → Reads sessionStorage → removes keys immediately
  → setIsLoading(true)
  → POST /api/contracts/review-text { contractText, label }
  → Same AI review flow as file upload (no file parsing)
  → setResult({ findings, charCount, filename: label })
```

---

## 9. Important Technical Gotchas

### 9.1 pdf-parse Lazy Loading — CRITICAL

`pdf-parse@1.1.1` executes a file read at module load time (it looks for a test PDF). If you import it at the top of a file with `import pdfParse from "pdf-parse"`, the server crashes at startup.

The correct pattern, used in `review.ts`:
```typescript
async function getPdfParse() {
  return require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
}

// Then inside the function:
const pdfParse = await getPdfParse();
const result = await pdfParse(buffer);
```

Never change this to a top-level import.

### 9.2 Arabic Word Fonts — CRITICAL

Word documents default to Latin fonts for Arabic text unless explicitly configured. The setting that fixes this:
```typescript
const FONT = { name: "Times New Roman", hint: "cs" } as const;
// Applied to every TextRun as: font: FONT
```

The `hint: "cs"` means "Complex Script" — it tells Word to use the Arabic rendering engine. Without it, Arabic text appears garbled or in the wrong font.

### 9.3 API Codegen Pipeline

Only the employment contract endpoint is in the OpenAPI spec. The codegen output (`api-zod/` and `api-client-react/`) must NOT be edited manually. After any change to `openapi.yaml`, run:
```bash
pnpm --filter @workspace/api-spec run codegen
```

### 9.4 Rate Limiter Order

In `app.ts`, the review rate limiter must be registered BEFORE the general contracts rate limiter:
```typescript
app.use("/api/contracts/review", reviewRateLimit);   // 5/10min — registered first
app.use("/api/contracts", contractRateLimit);         // 20/10min — registered second
```
If reversed, the general limiter would match `/review` first and apply the wrong limit.

### 9.5 Proxy Path Routing

The Replit shared reverse proxy does NOT rewrite paths. The `api-server` must handle requests at `/api/contracts/...` not `/contracts/...`. All routes in the router are registered with the full path prefix (e.g., `contractsRouter.post("/contracts/generate", ...)`).

For `curl` tests, always use `localhost:80/api/...` not the service's direct port.

### 9.6 No console.log in Server Code

The server uses `pino` for logging. In route handlers, use `req.log.info()`, `req.log.error()`, etc. Outside request context, import and use the `logger` singleton from `./lib/logger`. Never use `console.log` in server code.

### 9.7 Zod Length Limits Come First

`sanitizeInput()` does NOT truncate strings. All length limits (e.g., `max(2000)`) are enforced by the Zod schema before `sanitizeInput()` or any AI call is reached. This is by design — the sanitizer's job is injection removal, not truncation.

### 9.8 Database is Empty

The database schema in `lib/db/src/schema/index.ts` currently exports `{}`. There are no tables. The application stores nothing persistently. Adding storage requires creating schema files and running `pnpm --filter @workspace/db run push`.

---

## 10. Commands Reference

```bash
# Typecheck the API server
pnpm --filter @workspace/api-server run typecheck

# Typecheck the frontend
pnpm --filter @workspace/legal-ai run typecheck

# Full monorepo typecheck (libs first, then artifacts)
pnpm run typecheck

# Regenerate Zod schemas + React Query hooks from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to dev database
pnpm --filter @workspace/db run push

# Build all packages
pnpm run build
```

---

## 11. File Map — Every Significant File

```
artifacts/api-server/src/
├── index.ts                          Server entry: reads PORT, starts Express
├── app.ts                            Express app: middleware + rate limiters
├── lib/
│   └── logger.ts                     Pino logger singleton
└── routes/
    ├── index.ts                      Main router: mounts health + contracts
    ├── health.ts                     GET /api/healthz
    └── contracts/
        ├── index.ts                  All 5 generation routes + 2 export routes
        ├── review.ts                 POST /api/contracts/review + /review-text
        ├── word-export.ts            buildWordDocument() + buildReportDocument()
        └── jordan-labor-law.ts       JORDAN_LABOR_LAW_FULL constant (full law text)

artifacts/legal-ai/src/
├── main.tsx                          React entry: QueryClientProvider wrapper
├── App.tsx                           React Router: / and /review
├── pages/
│   ├── Home.tsx                      Contract generation page (5 contract types)
│   └── ContractReviewer.tsx          Contract review + risk dashboard
├── components/
│   ├── ContractForms.tsx             RentalForm, ServiceForm, NdaForm, SupplierForm
│   └── ui/                           shadcn/ui components (Button, Card, Form, etc.)
├── hooks/
│   └── use-toast.ts                  Toast notification hook
└── lib/
    └── utils.ts                      Tailwind cn() utility

lib/api-spec/
├── openapi.yaml                      API contract (source of truth for codegen)
└── orval.config.ts                   Codegen config

lib/api-zod/src/                      AUTO-GENERATED — do not edit
lib/api-client-react/src/             AUTO-GENERATED — do not edit

lib/db/src/
├── index.ts                          Drizzle client (reads DATABASE_URL)
└── schema/index.ts                   Empty — no tables yet

lib/integrations-anthropic-ai/src/
└── index.ts                          Exports pre-configured anthropic client

artifacts/mockup-sandbox/             Dev-only: UI component prototyping server
```

---

## 12. What Is Not Yet Built

- **User accounts / authentication** — no login, no session, no user identity
- **Contract storage** — generated contracts are not saved anywhere
- **Review history** — review results disappear on page refresh
- **Audit trail** — no logging of what contracts were generated
- **OpenAPI spec coverage** — only employment contract is in the spec; the other 4 contract types + all review/export routes are not documented in `openapi.yaml`
- **Database tables** — the DB schema is empty; Drizzle is set up but nothing is persisted
- **Email / notifications** — no email delivery of contracts
- **Multi-language support** — UI and contracts are Arabic-only
