/**
 * Invariants for the TAK shell (SPEC/28 §7): I4 — its components import nothing truth-bearing (no scenario bundle, no
 * scenario builder, no item bank, no truth-side module; scenario modules for types only), and what it builds from a real
 * snapshot carries no truth key; I1 — no clock, no randomness, no unordered iteration anywhere in it (the determinism lint
 * reads `.ts` files only, so its `.tsx` files are checked here); I3 — no network. A static check over every file's import
 * specifiers, in the manner of `test/boundary/directive-keys-boundary.spec.ts`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = "app/render/ui/tak";
const files = readdirSync(DIR).sort().filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => join(DIR, f));

// Static (named, type, re-export), side-effect, dynamic and require() imports, with whether the import is type-only.
const IMPORT = /(import|export)(\s+type)?\s[^;]*?from\s*["'`]([^"'`]+)["'`]|import\s*["'`]([^"'`]+)["'`]|import\(\s*["'`]([^"'`]+)["'`]\s*\)|require\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
interface Imp { readonly spec: string; readonly typeOnly: boolean }
function importsOf(file: string): Imp[] {
  return [...readFileSync(file, "utf8").matchAll(IMPORT)].map((m) => ({ spec: m[3] ?? m[4] ?? m[5] ?? m[6] ?? "", typeOnly: !!m[2] }));
}
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');

/** Truth-bearing modules, or modules that read the scenario bundle (`site-scenario.ts` holds the CA truth and the flags). */
const FORBIDDEN = [/scenario\/site-scenario/, /scenario\/demo-/, /scenario\/.*\.json/, /\.json$/, /engine\/run-loop/, /session\/orchestrator\.js$/, /retrieval\//, /^node:/, /tools\//, /server\//, /excon/i, /tak\/compile/, /tak\/export/, /tak\/replay/];

describe("the TAK shell imports nothing truth-bearing (I4)", () => {
  it("finds the shell's files and their imports (sanity: the check is not vacuous)", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
    expect(importsOf(join(DIR, "TakSessionLayout.tsx")).some((i) => i.spec === "./shell.js")).toBe(true);
    expect(importsOf(join(DIR, "shell.ts")).some((i) => i.spec === "../../../tak/geochat.js")).toBe(true);
  });

  it("no file imports a scenario bundle, builder, item bank, the run loop, retrieval, tooling or the network", () => {
    for (const f of files) {
      for (const { spec, typeOnly } of importsOf(f)) {
        const bad = FORBIDDEN.filter((re) => re.test(spec));
        // The orchestrator module is allowed for its types only (the snapshot and the record types).
        if (/session\/orchestrator\.js$/.test(spec) && typeOnly) continue;
        expect(bad, `${f} imports ${spec}`).toEqual([]);
      }
    }
  });

  it("scenario, boundary and session modules are imported for their types only", () => {
    for (const f of files) {
      for (const { spec, typeOnly } of importsOf(f)) {
        if (/\/(scenario|boundary|session)\//.test(spec)) expect(typeOnly, `${f}: ${spec}`).toBe(true);
      }
    }
  });

  it("no file names a truth field", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(src, f).not.toMatch(/\b(truthAtEnd|truthDetached|derivedFlag|breachGeometry|isGroundTruth|isDecoy|isOmissionCycle|actualPerimeterAtEnd|consistentWithEnvelope|whatWasHappening|correct:|\.flag\b|mapKey|keyAtomIds)\b/);
    }
  });
});

describe("no clock, no randomness, no network in the TAK shell (I1, I2, I3)", () => {
  it("no file calls a banned API (the lint's rules, applied to the .tsx files too)", () => {
    const banned = [/\bDate\.now\s*\(/, /\bnew Date\s*\(\s*\)/, /\bperformance\.now\s*\(/, /\bMath\.random\s*\(/, /\bcrypto\.(getRandomValues|randomUUID)\s*\(/, /\bfetch\s*\(/, /\bnew XMLHttpRequest\s*\(/, /\bnew WebSocket\s*\(/, /\.sort\s*\(\s*\)/, /\bIntl\./, /\bObject\.(keys|values|entries)\s*\(/];
    for (const f of files) {
      const src = code(f);
      for (const re of banned) expect(re.test(src), `${f}: ${re}`).toBe(false);
    }
  });

  it("logs only through the session's logMapUse and logTabSelected", () => {
    const layout = code(join(DIR, "TakSessionLayout.tsx"));
    expect(layout).toMatch(/const log = \(event: MapUseEvent\) => \{ void orchestrator\.logMapUse\(event\)\.catch\(\(\) => undefined\); \};/);
    for (const f of files) expect(code(f), f).not.toMatch(/orchestrator\.(event|log)\(|appendTelemetryEvent|localStorage|indexedDB/);
  });
});
