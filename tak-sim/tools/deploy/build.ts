/**
 * `npm run build:prod` — the production build (docs/DEPLOYMENT.md): runs the full CI first, then
 * `vite build` into `dist/ui` with the commit stamped into the header's `appVersion`
 * (`<package version>+<short commit>`, `-dirty` when the working tree has uncommitted changes, which a
 * study build should never have), and prints the scenario bundle hash the logs will carry.
 *
 *   npm run build:prod                # CI, then build
 *   npm run build:prod -- --skip-ci   # build only (development)
 *
 * While recruitment runs (SPEC/29 (ay), docs/DEPLOYMENT.md §2.1), RECRUITMENT_GATE=1 (or `-- --recruitment-gate`)
 * leaves game mode out of `dist/ui` (`game-gate.ts`); the server's RECRUITMENT_GATE=1 hides the demonstration.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { build } from "vite";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { scenarioBundleHash } from "../../app/telemetry/bundle-hash.js";
import { REPO_ROOT } from "../../server/thinker/config.js";
import { recruitmentGateFrom } from "../../server/production/config.js";
import { exconLeaks } from "./excon-guard.js";
import { builtFiles, dropGameChunks, gameLeaks } from "./game-gate.js";

const recruitmentGate = recruitmentGateFrom(process.env.RECRUITMENT_GATE) || process.argv.includes("--recruitment-gate");

function git(args: string[]): string {
  try { return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim(); } catch { return ""; }
}

// On Windows npm is npm.cmd, which Node only spawns through a shell (ENOENT otherwise).
if (!process.argv.includes("--skip-ci")) execFileSync("npm", ["run", "ci"], { cwd: REPO_ROOT, stdio: "inherit", shell: process.platform === "win32" });

// A Docker build has no `.git` (Dockerfile): the commit comes in as APP_COMMIT (`--build-arg APP_COMMIT=…`).
const commit = git(["rev-parse", "--short=12", "HEAD"]) || (/^[0-9a-f]{7,40}$/.test(process.env.APP_COMMIT ?? "") ? process.env.APP_COMMIT! : "unknown");
// Dirty = a tracked change, or an untracked file where it can reach the build or the server (scratch files
// elsewhere, e.g. notes in the repository root, do not make the study build unusable).
const BUILD_INPUTS = /^(app|server|content|tools)\//;
const dirty = git(["status", "--porcelain"]).split("\n").filter((l) => l.trim() !== "")
  .some((l) => !l.startsWith("??") || BUILD_INPUTS.test(l.slice(3).replace(/^"/, "")));
process.env.APP_BUILD = `${commit}${dirty ? "-dirty" : ""}`;
const built = await build({ configFile: `${REPO_ROOT}vite.config.ts`, mode: "production" });
// SPEC/29 (ay): during recruitment the build carries no game mode at all (game-gate.ts).
if (recruitmentGate) {
  const dropped = dropGameChunks(`${REPO_ROOT}dist/ui`, builtFiles(built));
  const left = gameLeaks(`${REPO_ROOT}dist/ui`);
  if (dropped.length === 0 || left.length > 0) throw new Error(`build:prod: RECRUITMENT_GATE — game mode is still in dist/ui (dropped: ${dropped.join(", ") || "nothing"}; marker in: ${left.join(", ") || "nothing"})`);
  console.log(`build:prod: RECRUITMENT_GATE — game mode left out of dist/ui (${dropped.join(", ")}); serve with RECRUITMENT_GATE=1`);
}
// Without MapLibre's worker beside the bundle the map draws no fire at all (vite.config.ts, maplibreWorker).
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  if (!existsSync(`${REPO_ROOT}dist/ui/assets/${file}`)) throw new Error(`build:prod: dist/ui/assets/${file} is missing; the map would show no fire`);
}
// SPEC/28 §8: the researcher-only EXCON page shows truth; nothing of it may reach the study build (excon-guard.ts).
const exconFiles = exconLeaks(`${REPO_ROOT}dist/ui`);
if (exconFiles.length > 0) throw new Error(`build:prod: researcher-only EXCON material in dist/ui (SPEC/28 §8): ${exconFiles.join(", ")}`);

console.log(`build:prod: dist/ui built, appVersion build stamp ${process.env.APP_BUILD}${recruitmentGate ? " (recruitment build: no game mode)" : ""}`);
console.log(`build:prod: scenario bundleHash ${scenarioBundleHash(buildDemoScenario())}`);
if (dirty) console.warn("build:prod: WARNING — uncommitted changes; do not run a study session on this build");
