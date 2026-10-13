---
name: repo-tooling-untracked
description: "Since 3 Oct 2026 the GitHub repo holds only the project; .claude/, .claude-flow/, .agents/, CLAUDE.md are local-only and gitignored"
metadata:
  node_type: memory
  type: project
  originSessionId: 57841d3c-6e9d-4c18-8272-b2d3aa0a94b4
  modified: 2026-10-03T05:53:41.311Z
---

The user wants the GitHub repository to contain only the project, without ruflo or Claude Code tooling. Commit 7781fee (3 Oct 2026) untracked `.claude/`, `.claude-flow/`, `.agents/` and the ruflo-generated `CLAUDE.md`, and ignores them. The files still exist locally, and ruflo and the hooks still work. Older commits still contain them; history was not rewritten.

**Why:** the user said "github repo should not perhaps contain ruflo and etc".

**How to apply:**
- Never `git add` tooling files again. If ruflo re-init creates new ones, check that `.gitignore` covers them.
- Gotcha: agent worktrees under `.claude/worktrees` contain a `node_modules` junction to the main checkout. Deleting them with PowerShell `Remove-Item -Recurse` follows the junction and wipes the real `node_modules`. Use `git worktree remove`, or `cmd /c rmdir` on the junction first. If it happens anyway, `npm ci` restores it. On 3 Oct 2026 the same deletion also emptied `.cache/thinker-models`. `npm run thinker:index` re-downloads the model; since a88d109 it also mirrors the files so the offline server finds the tokenizer.
- Localhost needs two processes: `npm run dev` (5173) and `npm run thinker:server` (8787). Without ANTHROPIC_API_KEY the server answers from templates.

Related: [[feedback-ruflo-every-step]], [[project-ruflo-hooks-fix]].
