---
name: Verifying long streaming endpoints from bash
description: How to test ~40s+ streaming generations without the job being killed
---

The bash tool terminates backgrounded processes (`nohup`/`setsid` + `&`) when the tool call returns — they die before completing. Two separate `curl`/`node` jobs writing the same output file also clobber each other, producing truncated NDJSON that looks like a server stall.

**Why:** Repeated attempts to background a ~40s contract generation across bash calls all showed dead processes / files truncated at the same line. The hybrid pipeline finishes in ~40s, well within the bash tool timeout.

**How to apply:** Run the streaming test **synchronously in one foreground bash call** (a small Node script that POSTs, reads the NDJSON stream to the `done` event, and writes the result). Use the bash tool's own timeout (≤120s). Do not background it; do not run two writers to the same file.
