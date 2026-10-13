import { defineConfig } from "vitest/config";

// Separate from vite.config.ts (whose `root` points at the preview UI's
// app/render/ui directory for the dev server / build) so `vitest` keeps
// discovering test files from the repo root.
export default defineConfig({
  test: {
    include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    // .claude/worktrees holds agent worktrees (full repo copies); their tests are not ours.
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**", ".claude/**"],
  },
});
