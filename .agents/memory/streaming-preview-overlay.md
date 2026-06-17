---
name: Streaming preview overlay (legal-ai)
description: How the contract preview must render during NDJSON streaming to preserve live-streaming UX.
---

In `portals/home/ContractPreview.tsx`, the generated-contract text and the loading state are NOT mutually exclusive branches.

- Always render `generatedContract` (when present) in the content area.
- Render the loading spinner as an **absolute overlay** (`position: absolute; inset: 0; zIndex`) on top of the content while `isGenerating` is true.
- The empty placeholder only shows when there is no contract AND not generating.

**Why:** `submitContract` calls `onResult(streamedText, partyName)` on every chunk, so `generatedContract` builds up live during generation. If the spinner replaces the text (an `isGenerating ? spinner : text` branch), the streamed text is hidden and the live-streaming behavior is lost — this regressed once and was caught in review.

**How to apply:** keep the spinner as an overlay layer, not a sibling branch that swaps out the text, whenever editing the preview render.
