# api-server — Backend API

Express 5 server handling all AI contract generation, file parsing, and Word export. It serves routes under `/api`.

---

## Endpoints

### Health

| Method | Path           | Description                |
| ------ | -------------- | -------------------------- |
| GET    | `/api/healthz` | Returns `{ status: "ok" }` |

### Contract Generation

| Method | Path                               | Contract Type        |
| ------ | ---------------------------------- | -------------------- |
| POST   | `/api/contracts/generate`          | Employment (عقد عمل) |
| POST   | `/api/contracts/generate-rental`   | Rental (عقد إيجار)   |
| POST   | `/api/contracts/generate-service`  | Services (عقد خدمات) |
| POST   | `/api/contracts/generate-nda`      | NDA (اتفاقية سرية)   |
| POST   | `/api/contracts/generate-supplier` | Supplier (عقد توريد) |

### Contract Review

| Method | Path                         | Input                                              |
| ------ | ---------------------------- | -------------------------------------------------- |
| POST   | `/api/contracts/review`      | `multipart/form-data` — file upload (PDF/DOCX/TXT) |
| POST   | `/api/contracts/review-text` | `application/json` — `{ contractText, label }`     |

### Export

| Method | Path                           | Output                                 |
| ------ | ------------------------------ | -------------------------------------- |
| POST   | `/api/contracts/export-word`   | Downloads a `.docx` contract file      |
| POST   | `/api/contracts/export-report` | Downloads a `.docx` review report file |

---

## Source Layout

```
src/
├── app.ts                        Express app setup, middleware, rate limiting
├── index.ts                      Server entry point (binds to $PORT)
│
└── routes/
    ├── health.ts                 GET /healthz
    └── contracts/
        ├── index.ts              All generation + review routes
        ├── review.ts             File upload parsing + /review-text route
        ├── word-export.ts        buildWordDocument() + buildReportDocument()
        └── jordan-labor-law.ts   Full text of Jordanian Labor Law (AI reference)
```

---

## Rate Limiting

Two separate rate limiters protect the API:

| Limiter             | Routes                            | Limit                        |
| ------------------- | --------------------------------- | ---------------------------- |
| `reviewRateLimit`   | `POST /api/contracts/review`      | **5 requests / 10 minutes**  |
| `contractRateLimit` | All other `POST /api/contracts/*` | **20 requests / 10 minutes** |

Review has a tighter limit because it involves expensive file processing + AI analysis.

---

## AI Integration

Model: **`claude-sonnet-4-6`** with `max_tokens: 8192`

Each generation route builds a prompt containing:

1. **Strict rules** — No emojis, cite actual law articles, no invented text
2. **Contract-specific law reference** — e.g., for employment: the full text of `JORDAN_LABOR_LAW_FULL` (Law No. 8 of 1996 + 2023 amendments)
3. **Form data** — sanitized user inputs inserted into the prompt

The review routes instruct the model to return a **JSON array of findings**, each with:

```json
{
  "clause": "نص البند",
  "status": "green | yellow | red",
  "note": "تعليق قانوني",
  "recommendation": "التوصية"
}
```

---

## Security

### Prompt Injection Protection

`sanitizeInput()` scans all string fields for known injection patterns before they reach the AI:

- "ignore previous instructions"
- "act as"
- "system prompt"
- `[INST]`, `<|system|>`, `### instruction`, etc.

Matched text is replaced with `[محتوى غير مسموح]`.

### Input Validation

- All generation endpoints validate request bodies against **Zod schemas** (from `@workspace/api-zod`)
- Field length limits are enforced at the Zod layer before any sanitization or AI call

---

## Word Export

Built with the `docx` npm package (server-side, no puppeteer/browser needed).

Font used throughout: **Times New Roman** with `hint: "cs"` (Complex Script flag) — this forces Microsoft Word to use the Arabic rendering path instead of falling back to a Latin font.

`buildWordDocument(contractText, title)` — formats a generated contract
`buildReportDocument(findings, filename)` — formats a review report with colored status indicators

---

## File Parsing (Review)

| File Type  | Library                                                            |
| ---------- | ------------------------------------------------------------------ |
| PDF        | `pdf-parse` (lazy-loaded via `require()` — crashes at import time) |
| DOCX / DOC | `mammoth`                                                          |
| TXT        | Plain `Buffer.toString()`                                          |

Max file size: **5 MB**. Text is capped at **15,000 characters** before being sent to the AI.

---

## Logging

Uses `pino` via the `req.log` pattern — never `console.log` in route handlers.
