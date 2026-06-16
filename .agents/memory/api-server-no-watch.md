---
name: api-server dev has no file watch
description: Why code edits may not appear at runtime until the workflow is restarted
---

The `@workspace/api-server` `dev` script is `build && start` (esbuild bundle, then `node dist`). There is **no watch/HMR**. Editing source does NOT change the running server.

**Why:** During the hybrid-contract refactor, a live generation returned the OLD pure-generative output even though the source was already refactored — the running process was a stale build. This produced a false "the refactor didn't work" signal.

**How to apply:** After editing any api-server source, run `restart_workflow "artifacts/api-server: API Server"` before testing the live endpoint. Never trust a live response as reflecting your latest edit unless the server was restarted after the edit.
