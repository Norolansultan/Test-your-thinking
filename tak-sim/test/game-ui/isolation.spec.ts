/**
 * SPEC/29 §2: game mode is separate from the study. The study's code never imports the game (one dynamic import on
 * the demonstration start page is the only door, and `?tuotanto` never opens it); the participant entry's static import
 * graph never reaches app/game; and the game's code reaches nothing of the study's session log, telemetry or store.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const GAME_DIR = join(ROOT, "app", "game");
const APP_TSX = join(ROOT, "app", "render", "ui", "App.tsx");
const CODE_EXT = new Set([".ts", ".tsx", ".mts", ".js", ".mjs", ".html"]);
const rel = (f: string) => relative(ROOT, f).split(sep).join("/");
const insideGame = (f: string) => f === GAME_DIR || f.startsWith(GAME_DIR + sep);

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (e === "node_modules" || e === "dist" || e.startsWith(".")) continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (CODE_EXT.has(extname(full))) out.push(full);
  }
  return out;
}

/** Static imports and re-exports (and an HTML page's module scripts). */
function staticSpecifiers(file: string): string[] {
  const src = readFileSync(file, "utf8");
  if (file.endsWith(".html")) return [...src.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)].map((m) => m[1]!);
  const out: string[] = [];
  for (const m of src.matchAll(/(?:^|[\s;}])(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g)) out.push(m[1]!);
  for (const m of src.matchAll(/(?:^|[\s;])import\s*["']([^"']+)["']/g)) out.push(m[1]!);
  return out;
}

function dynamicSpecifiers(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]!);
}

function resolveSpecifier(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec.split("?")[0]!);
  const candidates = [base, base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"), `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

/** Every file reachable from `entry` through static relative imports. */
function staticClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (!CODE_EXT.has(extname(f))) continue;
    for (const spec of staticSpecifiers(f)) {
      const target = resolveSpecifier(f, spec);
      if (target && !seen.has(target)) stack.push(target);
    }
  }
  return seen;
}

describe("game mode isolation — imports (SPEC/29 §2)", () => {
  it("nothing under app/render, app/session or app/engine statically imports app/game", () => {
    const offenders: string[] = [];
    for (const d of ["app/render", "app/session", "app/engine"]) {
      for (const f of filesUnder(join(ROOT, d))) {
        for (const spec of staticSpecifiers(f)) {
          const target = resolveSpecifier(f, spec);
          if (target && insideGame(target)) offenders.push(`${rel(f)} -> ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the only door is one dynamic import of the game screen, from the start page", () => {
    const doors: string[] = [];
    for (const d of ["app/render", "app/session", "app/engine", "app/boundary", "app/telemetry", "app/scenario", "app/tak", "app/i18n"]) {
      for (const f of filesUnder(join(ROOT, d))) {
        for (const spec of dynamicSpecifiers(f)) {
          const target = resolveSpecifier(f, spec);
          if (target && insideGame(target)) doors.push(`${rel(f)} -> ${rel(target)}`);
        }
      }
    }
    expect(doors).toEqual(["app/render/ui/App.tsx -> app/game/ui/GameApp.tsx"]);
  });

  it("the participant entry's static import graph never reaches app/game (the game is its own chunk)", () => {
    const closure = staticClosure(join(ROOT, "app", "render", "ui", "index.html"));
    expect(closure.has(APP_TSX)).toBe(true);
    expect(closure.size).toBeGreaterThan(50);
    expect([...closure].filter(insideGame).map(rel)).toEqual([]);
  });

  it("the game reaches none of the study's session log, telemetry, store or upload", () => {
    const closure = staticClosure(join(GAME_DIR, "ui", "GameApp.tsx"));
    expect(closure.has(join(GAME_DIR, "sim", "game.ts"))).toBe(true); // the walker reaches the game loop
    // Two pure helpers are shared: the asset URL resolver (the topo tiles) and the sorted-keys helper the place names use.
    const SHARED = new Set(["app/session/asset-url.ts", "app/engine/deterministic-object.ts"]);
    const study = [...closure].map(rel).filter((f) => !SHARED.has(f) && /^app\/(telemetry|boundary|engine|session)\//.test(f));
    expect(study).toEqual([]);
    // SPEC/34 §2: the one game-only store, the player's progress under its own key prefix (never the study's keys).
    const PROGRESS = "app/game/course/progress.ts";
    for (const f of closure) {
      if (!CODE_EXT.has(extname(f)) || !insideGame(f)) continue;
      const src = readFileSync(f, "utf8");
      const banned = rel(f) === PROGRESS ? /indexedDB|sessionStorage|fetch\s*\(|sendBeacon/ : /indexedDB|localStorage|sessionStorage|fetch\s*\(|sendBeacon/;
      expect(banned.test(src), rel(f)).toBe(false);
    }
    const progress = readFileSync(join(ROOT, PROGRESS), "utf8");
    expect(/\.getItem\((?!PROGRESS_KEY\b)|\.setItem\((?!PROGRESS_KEY\b)|removeItem|\.clear\(/.test(progress)).toBe(false);
  });
});

describe("the recruitment gate's marker (SPEC/29 (ay) rule 2)", () => {
  const MARKER_FILE = join(GAME_DIR, "ui", "marker.ts");
  const literal = /export const GAME_CHUNK_MARKER = "([^"]+)"/.exec(readFileSync(MARKER_FILE, "utf8"))![1]!;

  it("only the game screen imports it, so it lands in the game's chunk and nowhere else", () => {
    const importers: string[] = [];
    for (const f of filesUnder(join(ROOT, "app"))) {
      for (const spec of [...staticSpecifiers(f), ...dynamicSpecifiers(f)]) if (resolveSpecifier(f, spec) === MARKER_FILE) importers.push(rel(f));
    }
    expect(importers).toEqual(["app/game/ui/GameApp.tsx"]);
    expect(readFileSync(join(GAME_DIR, "ui", "GameApp.tsx"), "utf8")).toMatch(/data-build=\{GAME_CHUNK_MARKER\}/);
  });

  it("no file of the study carries the literal (the gated server would refuse the study's own code)", () => {
    const carriers = filesUnder(join(ROOT, "app")).filter((f) => f !== MARKER_FILE && readFileSync(f, "utf8").includes(literal)).map(rel);
    expect(carriers).toEqual([]);
  });
});

describe("the start page entry", () => {
  const src = readFileSync(APP_TSX, "utf8");

  it("imports the game only dynamically, as its own chunk", () => {
    expect(src).toMatch(/import\(\s*"\.\.\/\.\.\/game\/ui\/GameApp\.js"\s*\)/);
    expect(staticSpecifiers(APP_TSX).filter((s) => s.includes("/game/"))).toEqual([]);
  });

  it("shows the game button only outside the study (?tuotanto), and opens the game only there", () => {
    expect(src).toMatch(/const inStudy = new URLSearchParams\(search\)\.has\(STUDY_PARAM\)/);
    expect(src).toMatch(/\{!inStudy && <button[^>]*data-testid="game-mode-button"/);
    expect(src).toMatch(/if \(gameOpen && !inStudy\) return <GameMode/);
    // The dynamic import lives in the component that only that branch renders.
    const gameMode = src.slice(src.indexOf("function GameMode"), src.indexOf("function localStore"));
    expect(gameMode).toContain('import("../../game/ui/GameApp.js")');
    expect(src.split('import("../../game/ui/GameApp.js")')).toHaveLength(2);
  });

  it("labels the button in both languages and hands the start page's language to the game", () => {
    expect(src).toContain("Pelitila — komentajan peli");
    expect(src).toContain("Game mode — commander's game");
    expect(src).toMatch(/<GameMode lang=\{lang\}/);
  });
});
