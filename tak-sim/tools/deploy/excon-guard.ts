/**
 * SPEC/28 §8: the researcher-only EXCON page (`app/excon/`, `excon.html`) SHOWS TRUTH and must never be in
 * the study build. `npm run build:prod` (`build.ts`) calls {@link exconLeaks} on `dist/ui` after `vite build`
 * and refuses the build if anything turns up. This is the second of three locks: `vite.config.ts`'s
 * `exconBuildGuard` already fails a build that bundles an app/excon module, and `server/production/static.ts`
 * refuses /excon paths whatever is on disk (test/excon/isolation.spec.ts covers all three).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

/** Text that only EXCON code carries (`app/excon/world.ts` `EXCON_MARKER`), and its source directory. */
export const EXCON_LEAK_MARKERS = ["EXCON-RESEARCHER-ONLY-SHOWS-TRUTH", "app/excon/"] as const;

const TEXT_EXTENSIONS = new Set([".html", ".js", ".mjs", ".cjs", ".css", ".json", ".map", ".txt", ".svg"]);

function filesUnder(dir: string): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return []; }
  const out: string[] = [];
  for (const e of [...entries].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

/** Files under `distDir` that are EXCON's or contain its markers (paths relative to `distDir`, `/`-separated). */
export function exconLeaks(distDir: string): string[] {
  const leaks: string[] = [];
  for (const file of filesUnder(distDir)) {
    const rel = relative(distDir, file).split(sep).join("/");
    if (/excon/i.test(rel)) { leaks.push(rel); continue; }
    if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    const text = readFileSync(file, "utf8");
    if (EXCON_LEAK_MARKERS.some((m) => text.includes(m))) leaks.push(rel);
  }
  return leaks;
}
