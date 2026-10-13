/**
 * SPEC/28 §8 and invariant I4: the researcher-only EXCON page (`app/excon/`) reads and shows TRUTH, so it must
 * be unreachable from the participant: no participant module imports it, the participant entry's import graph
 * never reaches it, it is only loaded by its own `excon.html`, no build contains it, and the production server
 * never serves it.
 */

import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile, type Plugin } from "vite";
import { EXCON_LEAK_MARKERS, exconLeaks } from "../../tools/deploy/excon-guard.js";
import { isExconPath, serveStatic } from "../../server/production/static.js";
import { EXCON_MARKER } from "../../app/excon/world.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const EXCON_DIR = join(ROOT, "app", "excon");
const PARTICIPANT_ENTRY = join(ROOT, "app", "render", "ui", "index.html");
const CODE_EXT = new Set([".ts", ".tsx", ".mts", ".js", ".mjs", ".html"]);

const rel = (f: string) => relative(ROOT, f).split(sep).join("/");
const insideExcon = (f: string) => f === EXCON_DIR || f.startsWith(EXCON_DIR + sep);

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

/** Module specifiers of a source file: static and dynamic imports, re-exports, and an HTML page's module scripts. */
function specifiersOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  if (file.endsWith(".html")) return [...src.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)].map((m) => m[1]!);
  const out: string[] = [];
  for (const m of src.matchAll(/(?:^|[\s;}])(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g)) out.push(m[1]!);
  for (const m of src.matchAll(/(?:^|[\s;])import\s*["']([^"']+)["']/g)) out.push(m[1]!);
  for (const m of src.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]!);
  return out;
}

/** A relative specifier resolved to a file (TypeScript's `.js` → `.ts`/`.tsx`), or null for a package or an asset. */
function resolveSpecifier(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec.split("?")[0]!);
  const candidates = [base, base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"), `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

/** Every source file reachable from `entry` through relative imports. */
function importClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (!CODE_EXT.has(extname(f))) continue;
    for (const spec of specifiersOf(f)) {
      const target = resolveSpecifier(f, spec);
      if (target && !seen.has(target)) stack.push(target);
    }
  }
  return seen;
}

/** Files outside app/excon/ whose imports (or script tags) resolve into app/excon/ or name it. */
function importersOfExcon(dirs: readonly string[]): string[] {
  const offenders: string[] = [];
  for (const d of dirs) {
    for (const f of filesUnder(join(ROOT, d))) {
      if (insideExcon(f)) continue;
      for (const spec of specifiersOf(f)) {
        const target = resolveSpecifier(f, spec);
        if ((target && insideExcon(target)) || /(^|\/)excon(\/|$)/.test(spec)) offenders.push(`${rel(f)} -> ${spec}`);
      }
    }
  }
  return offenders;
}

describe("EXCON isolation — imports (I4)", () => {
  it("no file under app/render, app/session, app/engine or app/tak imports anything from app/excon", () => {
    expect(importersOfExcon(["app/render", "app/session", "app/engine", "app/tak"])).toEqual([]);
  });

  it("nothing else outside app/excon imports it either (app, server, tools, test outside test/excon)", () => {
    const all = importersOfExcon(["app", "server", "tools", "test"]);
    // The detector detects: these very tests import app/excon (allowed, they are not shipped).
    expect(all.some((o) => o.startsWith("test/excon/isolation.spec.ts -> ../../app/excon/"))).toBe(true);
    expect(all.filter((o) => !o.startsWith("test/excon/"))).toEqual([]);
  });

  it("the participant entry's whole import graph never reaches app/excon", () => {
    const closure = importClosure(PARTICIPANT_ENTRY);
    // The walker works: it reaches the participant shell and the render boundary.
    expect(closure.has(join(ROOT, "app", "render", "ui", "main.tsx"))).toBe(true);
    expect(closure.has(join(ROOT, "app", "boundary", "render-boundary.ts"))).toBe(true);
    expect(closure.size).toBeGreaterThan(50);
    expect([...closure].filter(insideExcon).map(rel)).toEqual([]);
  });

  it("app/excon is loaded only from its own excon.html", () => {
    const page = join(EXCON_DIR, "excon.html");
    const closure = importClosure(page);
    expect(closure.has(join(EXCON_DIR, "main.tsx"))).toBe(true);
    expect(closure.has(join(EXCON_DIR, "world.ts"))).toBe(true);
    // No other page anywhere loads an EXCON module.
    const pages = filesUnder(join(ROOT, "app")).filter((f) => f.endsWith(".html") && f !== page);
    expect(pages.length).toBeGreaterThan(0);
    for (const p of pages) expect([...importClosure(p)].filter(insideExcon).map(rel)).toEqual([]);
  });

  it("there is no EXCON page or asset inside the participant Vite root (app/render/ui, its public/ included)", () => {
    const all: string[] = [];
    const walk = (d: string) => { for (const e of readdirSync(d)) { const f = join(d, e); if (statSync(f).isDirectory()) walk(f); else all.push(f); } };
    walk(join(ROOT, "app", "render", "ui"));
    expect(all.filter((f) => /excon/i.test(rel(f)))).toEqual([]);
  });
});

type Hook = (this: unknown, ...args: unknown[]) => unknown;
const hookFn = (h: unknown): Hook => (typeof h === "function" ? (h as Hook) : (h as { handler: Hook }).handler);

describe("EXCON isolation — the build", () => {
  async function buildPlugins(): Promise<{ plugins: Plugin[]; config: NonNullable<Awaited<ReturnType<typeof loadConfigFromFile>>>["config"] }> {
    const loaded = await loadConfigFromFile({ command: "build", mode: "production", isSsrBuild: false, isPreview: false }, join(ROOT, "vite.config.ts"), ROOT, "silent");
    if (!loaded) throw new Error("vite.config.ts did not load");
    return { plugins: (loaded.config.plugins ?? []).flat(Infinity as 1) as Plugin[], config: loaded.config };
  }

  it("the page is served by a dev-server-only plugin and is not a build input", async () => {
    const { plugins, config } = await buildPlugins();
    const page = plugins.find((p) => p?.name === "excon-dev-page");
    expect(page?.apply).toBe("serve");
    expect(config.root).toBe("app/render/ui");
    const input = config.build?.rollupOptions?.input;
    expect(input === undefined || !/excon/i.test(JSON.stringify(input))).toBe(true);
  });

  it("the build guard fails any bundle that contains an app/excon module or an excon file", async () => {
    const { plugins } = await buildPlugins();
    const guard = plugins.find((p) => p?.name === "excon-build-guard");
    expect(guard?.apply).toBe("build");
    const generate = hookFn(guard!.generateBundle);
    const ctx = { error: (msg: string) => { throw new Error(msg); } };
    const chunk = (fileName: string, moduleIds: string[]) => ({ [fileName]: { type: "chunk", fileName, moduleIds } });
    expect(() => generate.call(ctx, {}, chunk("assets/index-abc.js", [join(ROOT, "app", "render", "ui", "main.tsx")]), false)).not.toThrow();
    expect(() => generate.call(ctx, {}, chunk("assets/index-abc.js", [join(ROOT, "app", "excon", "world.ts")]), false)).toThrow(/EXCON/);
    expect(() => generate.call(ctx, {}, { "excon.html": { type: "asset", fileName: "excon.html" } }, false)).toThrow(/EXCON/);
  });

  it("npm run build:prod re-checks dist/ui with the leak guard", () => {
    const src = readFileSync(join(ROOT, "tools", "deploy", "build.ts"), "utf8");
    expect(src).toMatch(/exconLeaks\(`\$\{REPO_ROOT\}dist\/ui`\)/);
    expect(EXCON_LEAK_MARKERS).toContain(EXCON_MARKER);
  });

  it("the leak guard finds an EXCON file or marker in a build directory, and nothing in a clean one", () => {
    const dir = mkdtempSync(join(tmpdir(), "excon-guard-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><script type=module src=/assets/index.js></script>");
    writeFileSync(join(dir, "assets", "index.js"), "console.log('participant')");
    writeFileSync(join(dir, "assets", "topo.webp"), Buffer.from([0, 1, 2]));
    expect(exconLeaks(dir)).toEqual([]);
    writeFileSync(join(dir, "assets", "chunk-x.js"), `const m = "${EXCON_MARKER}";`);
    writeFileSync(join(dir, "excon.html"), "<!doctype html>");
    expect(exconLeaks(dir)).toEqual(["assets/chunk-x.js", "excon.html"]);
  });
});

describe("EXCON isolation — the production server", () => {
  it("never serves an EXCON path, even when such a file is on disk, and still serves the app", async () => {
    const dir = mkdtempSync(join(tmpdir(), "excon-static-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>participant</title>");
    writeFileSync(join(dir, "excon.html"), "<!doctype html><title>EXCON</title>");
    writeFileSync(join(dir, "assets", "excon-abc.js"), "x");
    for (const p of ["/excon.html", "/excon", "/EXCON.html", "/%65xcon.html", "/assets/excon-abc.js", "/excon/"]) {
      expect(isExconPath(p)).toBe(true);
      expect((await serveStatic(dir, p)).status).toBe(404);
    }
    expect((await serveStatic(dir, "/")).status).toBe(200);
    expect((await serveStatic(dir, "/session")).status).toBe(200); // the single-page fallback still works
  });
});
