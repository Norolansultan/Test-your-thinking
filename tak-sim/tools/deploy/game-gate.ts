/**
 * The recruitment gate in the build (SPEC/29 revision (ay) rule 2, `31` P-12; docs/DEPLOYMENT.md §2.1).
 * `npm run build:prod` with RECRUITMENT_GATE=1 (or `-- --recruitment-gate`) leaves game mode out of `dist/ui`:
 * after `vite build`, {@link gameChunkFiles} finds the game's chunks in the build's chunk graph — the dynamic
 * entry of `app/game/ui/GameApp.tsx` and everything only it reaches — {@link dropGameChunks} deletes them, and
 * {@link gameLeaks} confirms that no file still carries the game's marker (`app/game/ui/marker.ts`). The study's
 * chunks are never touched: a study chunk that bundled a module of `app/game/` stops the build instead.
 * The production server is the other lock (`server/production/recruitment-gate.ts`).
 */

import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { GAME_CHUNK_MARKER } from "../../app/game/ui/marker.js";

/** The parts of a Vite/Rollup output chunk the gate reads. */
export interface BuiltChunk {
  readonly type: "chunk";
  readonly fileName: string;
  readonly isEntry: boolean;
  readonly isDynamicEntry: boolean;
  readonly facadeModuleId: string | null;
  readonly imports: readonly string[];
  readonly dynamicImports: readonly string[];
  readonly moduleIds: readonly string[];
  /** Vite's per-chunk CSS and assets. */
  readonly viteMetadata?: { readonly importedCss: ReadonlySet<string>; readonly importedAssets: ReadonlySet<string> };
}
export interface BuiltAsset { readonly type: "asset"; readonly fileName: string }
export type BuiltFile = BuiltChunk | BuiltAsset;

const slash = (id: string): string => id.split("\\").join("/");
/** A module of game mode (its code or its world). */
export const isGameModule = (id: string): boolean => /\/app\/game\/|\/content\/game\//.test(slash(id));

/** The files `vite build` returned, from any of its result shapes. */
export function builtFiles(result: unknown): BuiltFile[] {
  const outputs = Array.isArray(result) ? result : [result];
  const files: BuiltFile[] = [];
  for (const o of outputs) {
    if (o === null || typeof o !== "object" || !("output" in o) || !Array.isArray((o as { output: unknown }).output)) {
      throw new Error("game-gate: vite build returned no output (a watcher?)");
    }
    files.push(...((o as { output: BuiltFile[] }).output));
  }
  return files;
}

function closure(roots: readonly BuiltChunk[], byName: ReadonlyMap<string, BuiltChunk>, dynamic: boolean): Set<string> {
  const seen = new Set<string>();
  const stack = roots.map((c) => c.fileName);
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const c = byName.get(f);
    if (c === undefined) continue;
    for (const next of dynamic ? [...c.imports, ...c.dynamicImports] : c.imports) if (!seen.has(next)) stack.push(next);
  }
  return seen;
}

/**
 * The files of game mode in a build: the chunks reachable from a dynamic entry in `app/game/` that the study's
 * entries do not reach statically, with the CSS and assets only they use (sorted). Throws when a study chunk
 * holds a game module (the study would carry the game, SPEC/29 §2.1).
 */
export function gameChunkFiles(files: readonly BuiltFile[]): string[] {
  const chunks = files.filter((f): f is BuiltChunk => f.type === "chunk");
  const byName = new Map(chunks.map((c) => [c.fileName, c] as const));
  const study = closure(chunks.filter((c) => c.isEntry), byName, false);
  const leaked = chunks.filter((c) => study.has(c.fileName) && c.moduleIds.some(isGameModule));
  if (leaked.length > 0) throw new Error(`game-gate: the study's chunks hold game modules: ${leaked.map((c) => c.fileName).join(", ")}`);
  const roots = chunks.filter((c) => c.isDynamicEntry && c.facadeModuleId !== null && isGameModule(c.facadeModuleId));
  const game = [...closure(roots, byName, true)].filter((f) => !study.has(f) && byName.has(f));
  const studyAssets = new Set<string>();
  for (const f of study) for (const a of [...(byName.get(f)?.viteMetadata?.importedCss ?? []), ...(byName.get(f)?.viteMetadata?.importedAssets ?? [])]) studyAssets.add(a);
  const out = new Set(game);
  for (const f of game) {
    for (const a of [...(byName.get(f)!.viteMetadata?.importedCss ?? []), ...(byName.get(f)!.viteMetadata?.importedAssets ?? [])]) if (!studyAssets.has(a)) out.add(a);
  }
  return [...out].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Deletes the game's files (paths relative to `distDir`) and returns them. */
export function dropGameChunks(distDir: string, files: readonly BuiltFile[]): string[] {
  const drop = gameChunkFiles(files);
  for (const f of drop) rmSync(join(distDir, f), { force: true });
  return drop;
}

const TEXT_EXTENSIONS = new Set([".html", ".js", ".mjs", ".cjs", ".css", ".json", ".map", ".txt"]);

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

/** Files under `distDir` that carry the game's marker (paths relative to `distDir`, `/`-separated). */
export function gameLeaks(distDir: string): string[] {
  const leaks: string[] = [];
  for (const file of filesUnder(distDir)) {
    if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    if (readFileSync(file, "utf8").includes(GAME_CHUNK_MARKER)) leaks.push(relative(distDir, file).split(sep).join("/"));
  }
  return leaks;
}
