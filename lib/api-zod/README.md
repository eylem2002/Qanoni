# api-zod — Generated Zod Schemas

Auto-generated Zod validation schemas derived from the OpenAPI spec. Used by the API server to validate request and response bodies.

---

## Important

**Do not edit these files manually.** They are fully regenerated every time you run:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Any manual changes will be overwritten.

---

## What's Generated

Zod schemas for every request body and response object defined in `openapi.yaml`:

- `GenerateContractBody` — validates the employment contract form submission
- `ContractResult` — validates the AI response shape
- `HealthStatus`, `ApiError`, `ContractValidationError` — other spec schemas

---

## How It's Used

The API server imports these schemas for input validation:

```ts
import { GenerateContractBody } from "@workspace/api-zod";

const parsed = GenerateContractBody.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ error: "Invalid input" });
}
```

This ensures the server never processes malformed data before it reaches the AI.

---

## Regenerating

```bash
pnpm --filter @workspace/api-spec run codegen
```
