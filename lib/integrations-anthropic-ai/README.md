# integrations-anthropic-ai — Anthropic SDK Wrapper

Thin wrapper around the Anthropic SDK that provides a pre-configured client instance for use across the monorepo. Credentials are managed by the Replit Anthropic integration — no API key handling in code.

---

## What It Exports

```ts
import { anthropic } from "@workspace/integrations-anthropic-ai";
```

A ready-to-use `Anthropic` client instance. Import it anywhere in the backend and call the API directly.

---

## How It's Used

The API server uses it for all AI calls:

```ts
import { anthropic } from "@workspace/integrations-anthropic-ai";

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 8192,
  messages: [
    { role: "user", content: prompt }
  ],
});

const contractText = response.content[0].type === "text"
  ? response.content[0].text
  : "";
```

---

## Model Used

All routes use `claude-sonnet-4-6` with `max_tokens: 8192`.

The 8192 token limit is intentional — full contracts with all legal clauses require more tokens than the default 1024 limit.

---

## Credentials

The Anthropic API key is injected automatically by the Replit Anthropic integration. It does not need to be set manually in `.env` or environment secrets.
