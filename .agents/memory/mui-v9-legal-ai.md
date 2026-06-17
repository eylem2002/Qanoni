---
name: MUI v9 quirks (legal-ai frontend)
description: Version-specific MUI v9 API gotchas that bit during the legal-ai RTL rewrite.
---

The legal-ai frontend resolved `@mui/material` to v9 (`^9.1.1`). Two non-obvious breaking changes vs the v5/v6 mental model:

- **No `Grid` component** — `Grid`/`Grid2` are not available. Use `Box` with CSS grid (`display: "grid"`, `gridTemplateColumns`) for layout instead.
- **`inputProps` removed** on inputs — pass native input attributes via `slotProps.htmlInput` (e.g. `slotProps={{ htmlInput: { maxLength: 10 } }}`), not the old `inputProps={{...}}`.

**Why:** these surfaced as TS errors during the Wouter/Shadcn/Tailwind → Redux+MUI rewrite and aren't guessable from generic MUI knowledge (most docs/examples target v5/v6).

**How to apply:** when adding/editing MUI components in `artifacts/legal-ai`, reach for `Box` grids and `slotProps.htmlInput` from the start.

RTL is wired via emotion cache + `stylis-plugin-rtl` (theme `direction: "rtl"`, `<html dir="rtl">`). A local `src/types/stylis.d.ts` declares the `stylis` / `stylis-plugin-rtl` modules.
