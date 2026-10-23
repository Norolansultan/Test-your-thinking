/**
 * `npm run demo:bridge` — DEMONSTRATION ONLY. Builds the published demonstration's Claude bridge into `dist/demo-bridge/`:
 *
 * - `bridge.js` — one classic script (IIFE) to place before the app's module script (README.md);
 * - `data.json` — the scenario's records and views as the handler reads them, and the six frozen prompts, checked against
 *   the Thinker manifest first (`data.ts`).
 *
 * The bridge runs the proxy's own handler in the page, so the build aliases the three Node built-ins that code imports
 * (`shims/`) and refuses any other. It fails if the bundle contains a forbidden module (the premise tables, the freeze banks
 * and keys, EXCON, the server's wiring or SDK) or either file contains premise or freeze-key content (`leaks.ts`).
 *
 *   npm run demo:bridge                     # → dist/demo-bridge/
 *   npm run demo:bridge -- --out <dir>      # elsewhere (the tests build into a temporary directory)
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "vite";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { MANIFEST_FILE, REPO_ROOT } from "../../server/thinker/config.js";
import { loadCheckedPrompts, readJson, type ManifestPrompts } from "../../server/thinker/deps.js";
import { bridgeDataOf, DEMO_BRIDGE_DATA_FILE } from "./data.js";
import { findLeaks, FORBIDDEN_MODULES } from "./leaks.js";

export const DEMO_BRIDGE_OUT_DIR = join(REPO_ROOT, "dist", "demo-bridge");
export const DEMO_BRIDGE_SCRIPT_FILE = "bridge.js";
const HERE = fileURLToPath(new URL("./", import.meta.url));
const SHIMS: Readonly<Record<string, string>> = {
  "node:crypto": join(HERE, "shims", "node-crypto.ts"),
  "node:fs": join(HERE, "shims", "node-fs.ts"),
  "node:url": join(HERE, "shims", "node-url.ts"),
};

/** The module address the server code's `import.meta.url` reads in the page (its file paths are never opened there). */
const BRIDGE_MODULE_URL = "file:///demo-bridge/server/thinker/";
const SITE_SCENARIO_JSON = "/app/scenario/site-scenario.json";

/**
 * Aliases the shimmed built-ins and refuses any other Node built-in; fixes the server code's `import.meta.url` (Vite would
 * otherwise bundle every repository file a `new URL(…, import.meta.url)` could name); gives the site bundle only its record
 * translations, the one part the bridge's modules read (`app/i18n/text.ts`); and records the bundle's modules for the guard.
 */
function bridgeGuard(modules: string[]): Plugin {
  const norm = (id: string) => id.split("\\").join("/").split("?")[0]!;
  return {
    name: "demo-bridge-guard",
    enforce: "pre",
    resolveId(id) {
      const shim = SHIMS[id] ?? SHIMS[`node:${id}`];
      if (shim) return shim;
      if (id.startsWith("node:")) this.error(`demo bridge: ${id} cannot run in the page (only ${Object.keys(SHIMS).join(", ")} are shimmed)`); // determinism-lint-allow: an error message (build time only)
      return null;
    },
    load(id) {
      if (!norm(id).endsWith(SITE_SCENARIO_JSON)) return null;
      const site = JSON.parse(readFileSync(join(REPO_ROOT, SITE_SCENARIO_JSON.slice(1)), "utf8")) as { english?: unknown };
      return JSON.stringify({ english: site.english ?? {} });
    },
    transform(code, id) {
      return /\/server\/thinker\/[^/]+\.ts$/.test(norm(id)) && code.includes("import.meta.url") ? code.split("import.meta.url").join(JSON.stringify(BRIDGE_MODULE_URL)) : null;
    },
    generateBundle(_options, bundle) {
      for (const out of Object.values(bundle)) if (out.type === "chunk") modules.push(...out.moduleIds.map((m) => m.split("\\").join("/"))); // determinism-lint-allow: one chunk (build time only)
    },
  };
}

export interface DemoBridgeBuild {
  readonly outDir: string;
  readonly files: readonly { readonly name: string; readonly bytes: number }[];
  readonly totalBytes: number;
  /** The bundle's source modules (repository-relative), for the isolation tests. */
  readonly modules: readonly string[];
}

export async function buildDemoBridge(outDir: string = DEMO_BRIDGE_OUT_DIR): Promise<DemoBridgeBuild> {
  // The frozen prompts, refused on a mismatch with the manifest exactly as the proxy refuses to start.
  const prompts = loadCheckedPrompts(readJson<ManifestPrompts>(MANIFEST_FILE));
  const data = bridgeDataOf(buildDemoScenario(), prompts);
  const modules: string[] = [];
  await build({
    configFile: false,
    root: REPO_ROOT,
    logLevel: "warn",
    plugins: [bridgeGuard(modules)],
    build: {
      outDir,
      emptyOutDir: true,
      target: "es2022",
      minify: true,
      sourcemap: false,
      lib: { entry: join(HERE, "bridge.ts"), formats: ["iife"], name: "TakSimDemoBridge", fileName: () => DEMO_BRIDGE_SCRIPT_FILE },
    },
  });
  const forbidden = modules.filter((m) => FORBIDDEN_MODULES.some((re) => re.test(m)));
  if (forbidden.length > 0) throw new Error(`demo bridge: forbidden modules in the bundle: ${forbidden.join(", ")}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, DEMO_BRIDGE_DATA_FILE), JSON.stringify(data), "utf8");
  // The same data as a classic script, for viewers whose sandbox blocks the page's fetch of its own files.
  writeFileSync(join(outDir, "data.js"), `window.__TAK_DEMO_BRIDGE_DATA__=${JSON.stringify(data)};\n`, "utf8");
  const names = [DEMO_BRIDGE_SCRIPT_FILE, DEMO_BRIDGE_DATA_FILE, "data.js"];
  const leaks = findLeaks(Object.fromEntries(names.map((n) => [n, readFileSync(join(outDir, n), "utf8")])));
  if (leaks.length > 0) throw new Error(`demo bridge: premise or freeze-key content in the outputs:\n  ${leaks.join("\n  ")}`);
  const files = names.map((name) => ({ name, bytes: statSync(join(outDir, name)).size }));
  const root = REPO_ROOT.split("\\").join("/");
  return { outDir, files, totalBytes: files.reduce((s, f) => s + f.bytes, 0), modules: modules.map((m) => (m.startsWith(root) ? m.slice(root.length) : m)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const at = process.argv.indexOf("--out");
  const result = await buildDemoBridge(at >= 0 && process.argv[at + 1] ? process.argv[at + 1]! : DEMO_BRIDGE_OUT_DIR);
  for (const f of result.files) console.log(`demo:bridge: ${join(result.outDir, f.name)} ${(f.bytes / 1024).toFixed(1)} KiB`);
  console.log(`demo:bridge: total ${(result.totalBytes / 1024).toFixed(1)} KiB — DEMONSTRATION ONLY, publish beside the page (tools/demo-bridge/README.md)`);
}
