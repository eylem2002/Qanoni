# api-client-react — Generated React Query Hooks

Auto-generated React Query (TanStack Query) hooks derived from the OpenAPI spec. Used by the frontend to call API endpoints with full TypeScript typing.

---

## Important

**Do not edit these files manually.** They are fully regenerated every time you run:

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Available Hooks

| Hook | Route | Used In |
|---|---|---|
| `useGenerateContract` | `POST /api/contracts/generate` | `Home.tsx` (employment form) |
| `useHealthCheck` | `GET /api/healthz` | Available but not currently used in UI |

---

## How It's Used

```tsx
import { useGenerateContract } from "@workspace/api-client-react";

const { mutate, isPending } = useGenerateContract({
  mutation: {
    onSuccess: (result) => {
      setGeneratedContract(result.contract);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  },
});

// Later...
mutate({ body: formData });
```

---

## Why Only Employment Uses This

The employment contract was the first implemented and was added to the OpenAPI spec. The other four contract types (Rental, Service, NDA, Supplier) were added later and use direct `fetch()` calls in `ContractForms.tsx`. To bring them into the codegen pipeline, add their routes to `lib/api-spec/openapi.yaml` and run codegen.

---

## Regenerating

```bash
pnpm --filter @workspace/api-spec run codegen
```
