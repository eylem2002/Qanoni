---
name: Hybrid contract generation pipeline
description: How contract generation is structured and the invariants to preserve
---

Contract generation (Arabic legal AI for Jordan) is HYBRID, not pure-generative:

- **Fixed/statutory clauses**: deterministic `render(data)` string interpolation in the per-type templates under `artifacts/api-server/src/routes/contracts/clauses/`. The LLM NEVER writes or rewrites these — they are lawyer-reviewable verbatim text marked "LAWYER REVIEW REQUIRED". Identical input → byte-identical clause text.
- **Variable/negotiated sections**: drafted by Claude, delimited with `[[[SECTION:id]]]...[[[/SECTION]]]`, grounded in RAG law + `STRICT_RULES_BASE`. These legitimately vary across runs.
- The engine streams variable drafting, then `assembleContract` injects fixed verbatim + parsed variable, then deterministic verification runs on the **assembled whole** before `done`.

**Invariants:**
- The NDJSON envelope is a hard contract with the frontend: `{type:"chunk",text}`, `{type:"done",valid,contract?,error?,missingClauses?,validationWarnings?}`, `{type:"error",error}`. Do not change shapes — the frontend `submitContract` consumer in `ContractForms.tsx` depends on it.
- Required variable clauses that the model fails to draft must FAIL validation (`missingRequiredSections`) — never ship a placeholder as `valid:true`.
- The frontend must consume this via the streaming `submitContract`, NOT the generated `useGenerateContract` hook (its customFetch mis-infers NDJSON as a blob, leaving `contract` undefined).
