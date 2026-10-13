---
name: project-ruflo-hooks-fix
description: "Why ruflo hooks silently did nothing until 24 Sep 2026, and the two fixes — re-check if `ruflo init` is re-run"
metadata:
  node_type: memory
  type: project
  originSessionId: 29757203-5b14-409f-9299-bd3ea8bee2f9
  modified: 2026-09-24T12:06:50.167Z
---

Until 24 Sep 2026 no ruflo hook in this project ever ran:
1. `.claude/settings.json` hooks were `cmd /c "IF EXIST …"`; Claude Code runs hooks through Git Bash here, which rewrites `/c` to a path, so cmd opened interactively and tried to execute the hook's stdin JSON. Fixed: commands are now `node "$CLAUDE_PROJECT_DIR/.claude/helpers/<file>" <arg>`.
2. Root `package.json` is `"type": "module"`, so CommonJS helpers (router.js, memory.js, session.js) loaded with empty exports → "Router not available". Fixed with `.claude/helpers/package.json` without a `type` field (Node detects syntax per file; github-safe.js is ESM and still works).

3. `~/.claude/settings.json` (all projects) held a second, equally broken `cmd /c node …` copy of the 16 ruflo hooks; removed 24 Sep 2026 at the user's request (backup: `%TEMP%/user-settings.before.json`). `ruflo init` without `--force` on this project is a no-op ("already initialized").

**Why:** re-running `ruflo init` / `doctor --fix` may regenerate the `cmd /c` commands and undo fix 1.

**How to apply:** after any ruflo re-init, pipe-test `echo '{"prompt":"x"}' | node .claude/helpers/hook-handler.cjs route` and check settings.json commands. Related: [[feedback-ruflo-every-step]].

4. 1 Oct 2026: global `claude-flow` updated 3.5.80 → 3.49.0 after adding the Windows11SDK.26100 component to VS 2026 Build Tools (node-gyp needs it for `hnswlib-node`). The compiled `addon.node` is still blocked by Windows Smart App Control (unsigned) — ruflo falls back to its JS vector search and works; don't try to bypass the policy.
