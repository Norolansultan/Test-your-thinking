---
name: feedback-ruflo-every-step
description: User requires ruflo routing + memory on every step; MetaHarness and the daemon only when ruflo indicates them
metadata:
  node_type: memory
  type: feedback
  originSessionId: 29757203-5b14-409f-9299-bd3ea8bee2f9
  modified: 2026-09-24T12:03:01.940Z
---

Use ruflo routing and ruflo memory on every step (recall before work, store what worked after). Use MetaHarness and the ruflo daemon only when ruflo indicates them — the `[RUFLO GATE]` context from `.claude/helpers/ruflo-gate.cjs` (ruflo `hooks worker detect`) says when.

**Why:** the user (24 Sep 2026) found ruflo had only been used when explicitly asked, and wants it mandatory. The daemon spawns headless Claude sessions and burns tokens, so it stays conditional.

**How to apply:** read the `[RUFLO GATE]` and routing lines each turn; if they say "INDICATED", dispatch the named worker / run the named `metaharness_*` tool. After a task succeeds, `npx @claude-flow/cli@latest memory store --namespace patterns …`. If the hooks print a Windows cmd banner instead of ruflo output, the hook commands have regressed to `cmd /c` (breaks under Git Bash) — see [[project-ruflo-hooks-fix]].
