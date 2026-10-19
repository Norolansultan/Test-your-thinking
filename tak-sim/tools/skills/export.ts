/**
 * `npm run skills:export` — writes the tak-sim scenario as the six wildfire skills' data contract to
 * `dist/skills/scenario/` (gitignored; `package.ts` lists the files, DATA_SOURCES.md documents them).
 *
 * `npm run skills:export -- --responses <session files…> [--out <dir>]` — converts session logs
 * (`fire-sim-session-jsonl/1`) into `responses.csv`, `exposure.csv` (retrieved ∪ digest ∪ recent, the pre-registered
 * definition) and `exposure_retrieved_only.csv` (the sensitivity) for `score_freezes.py`, in `dist/skills/responses/`
 * unless `--out` names another folder (`responses.ts`).
 *
 * `--out <dir>` also moves the scenario package. The version written into every file is the git commit tak-sim was
 * built from (`-dirty` with uncommitted changes under tak-sim/), so the files bind to an exact source. The scenario's
 * flame table (`tools/fire-ca/flame-table.ts`, SPEC/31 §5 D1) is read when it exists (`scenario-extras.ts`).
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { buildScenarioPackage } from "./package.js";
import { convertSessions } from "./responses.js";
import { loadFlameTable } from "./scenario-extras.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const DEFAULT_PACKAGE_DIR = join(ROOT, "dist", "skills", "scenario");
export const DEFAULT_RESPONSES_DIR = join(ROOT, "dist", "skills", "responses");

/** The commit tak-sim is at, short, with `-dirty` for uncommitted changes under tak-sim/; "unknown" outside git. */
export function sourceVersion(): string {
  try {
    const head = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "--", "."], { cwd: ROOT, encoding: "utf8" }).trim() !== "";
    return `${head}${dirty ? "-dirty" : ""}`;
  } catch {
    return "unknown";
  }
}

export function writeFiles(dir: string, files: ReadonlyMap<string, string>): string[] {
  const written: string[] = [];
  for (const [path, text] of files) {
    const target = join(dir, ...path.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    written.push(target);
  }
  return written;
}

function argsAfter(argv: readonly string[], flag: string): string[] {
  const i = argv.indexOf(flag);
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < argv.length && !argv[j]!.startsWith("--"); j++) out.push(argv[j]!);
  return out;
}

export async function main(argv: readonly string[]): Promise<void> {
  const out = argsAfter(argv, "--out")[0];
  if (argv.includes("--responses")) {
    const paths = argsAfter(argv, "--responses");
    if (paths.length === 0) {
      console.error("usage: npm run skills:export -- --responses <session files…> [--out <dir>]");
      process.exitCode = 2;
      return;
    }
    const converted = convertSessions(paths.map((p) => readFileSync(resolve(p), "utf8")), buildDemoScenario());
    const dir = out ? resolve(out) : DEFAULT_RESPONSES_DIR;
    writeFiles(dir, new Map([
      ["responses.csv", converted.responsesCsv], ["exposure.csv", converted.exposureCsv], ["exposure_retrieved_only.csv", converted.exposureRetrievedOnlyCsv],
    ]));
    console.log(`${paths.length} session file(s): ${converted.responses.length} responses, ${converted.exposure.length} exposure rows (${converted.exposureRetrievedOnly.length} retrieved-only) -> ${dir}`);
    return;
  }
  const flameTable = await loadFlameTable();
  const pkg = buildScenarioPackage(sourceVersion(), buildDemoScenario(), { flameTable });
  const dir = out ? resolve(out) : DEFAULT_PACKAGE_DIR;
  const written = writeFiles(dir, pkg.files);
  console.log(`wrote ${written.length} files to ${dir}${flameTable ? ` (flame values from ${flameTable.source})` : " (flame bands quoted from the records)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e: unknown) => { console.error(e); process.exitCode = 1; });
}
