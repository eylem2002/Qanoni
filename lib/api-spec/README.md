# api-spec — OpenAPI Specification

The single source of truth for the API contract between the frontend and backend. All generated code (Zod schemas, React Query hooks) is derived from this file.

---

## File

```
openapi.yaml        OpenAPI 3.1.0 spec defining all routes, request bodies, and responses
orval.config.ts     Code generation configuration (Orval)
```

---

## Current Spec Coverage

| Route | Documented |
|---|---|
| `GET /healthz` | Yes |
| `POST /contracts/generate` (employment) | Yes |
| `POST /contracts/generate-rental` | No (uses direct fetch) |
| `POST /contracts/generate-service` | No (uses direct fetch) |
| `POST /contracts/generate-nda` | No (uses direct fetch) |
| `POST /contracts/generate-supplier` | No (uses direct fetch) |
| `POST /contracts/review` | No |
| `POST /contracts/review-text` | No |
| `POST /contracts/export-word` | No |
| `POST /contracts/export-report` | No |

Only the employment contract generation endpoint is currently in the spec. The others use direct `fetch()` in the frontend. Adding them to the spec would auto-generate typed hooks and validation for them too.

---

## Schemas Defined

- `ContractInput` — employment contract form fields (employerName, employeeName, salary, jobTitle, etc.)
- `ContractResult` — `{ contract: string, validationWarnings?: string[] }`
- `ContractValidationError` — returned when generated contract fails legal checks
- `ApiError` — standard error envelope `{ error: string }`
- `HealthStatus` — `{ status: string }`

---

## Regenerating Code

Any change to `openapi.yaml` must be followed by:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates:
- `lib/api-zod/src/` — Zod validation schemas
- `lib/api-client-react/src/` — React Query hooks

**Do not edit the generated files manually** — they will be overwritten on the next codegen run.

---

## Important: Do Not Change the Title

The `info.title` field in `openapi.yaml` is currently `Api`. Changing it will rename all generated file paths and break every import across the project.
