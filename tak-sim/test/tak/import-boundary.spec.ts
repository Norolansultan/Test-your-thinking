/**
 * I3 for the TAK base (SPEC/28 §6–§7): the replay tool is offline tooling. No file under `app/` imports
 * `tools/tak` (the export, the data package, the replay) or a raw socket module (`node:net`,
 * `node:dgram`, `net`, `dgram`), so nothing in the participant's bundle can open a TAK connection.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const BANNED_MODULES = new Set(["node:net", "net", "node:dgram", "dgram"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|mjs|cjs|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every module specifier a source mentions: static imports and re-exports (type-only included), dynamic `import()`, `require()`. */
function specifiers(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g)) out.push(m[1]!);
  for (const m of source.matchAll(/\b(?:import|require)\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) out.push(m[1]!);
  return out;
}

function violation(file: string, spec: string): string | null {
  if (BANNED_MODULES.has(spec)) return `${spec} (raw sockets)`;
  if (spec.startsWith(".")) {
    const target = relative(ROOT, resolve(file, "..", spec));
    if (target === "tools/tak" || target.startsWith("tools/tak/")) return `${target} (TAK tooling)`;
  }
  if (/(^|\/)tools\/tak(\/|$)/.test(spec)) return `${spec} (TAK tooling)`;
  return null;
}

describe("I3 — app/ never imports the TAK tooling or socket modules (SPEC/28 §6)", () => {
  it("no file under app/ imports tools/tak, node:net, node:dgram, net or dgram", () => {
    const files = sourceFiles(join(ROOT, "app"));
    expect(files.length).toBeGreaterThan(100);
    const found: string[] = [];
    for (const file of files) {
      for (const spec of specifiers(readFileSync(file, "utf8"))) {
        const v = violation(file, spec);
        if (v) found.push(`${relative(ROOT, file)} -> ${v}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("the check catches each form (control)", () => {
    const app = join(ROOT, "app/tak/x.ts");
    const caught = (src: string) => specifiers(src).map((s) => violation(app, s)).filter((v) => v !== null);
    expect(caught('import { createConnection } from "node:net";')).toHaveLength(1);
    expect(caught('import * as dgram from "dgram";')).toHaveLength(1);
    expect(caught('const net = require("net");')).toHaveLength(1);
    expect(caught('const m = await import("node:dgram");')).toHaveLength(1);
    expect(caught('import { replay } from "../../tools/tak/replay.js";')).toHaveLength(1);
    expect(caught('export { exportTak } from "../../tools/tak/export.js";')).toHaveLength(1);
    expect(caught('import type { CotEvent } from "./cot.js";\nimport "./side-effect.js";')).toHaveLength(0);
  });

  it("the replay tool is where the sockets are (so the check above guards something real)", () => {
    const replay = readFileSync(join(ROOT, "tools/tak/replay.ts"), "utf8");
    expect(specifiers(replay)).toEqual(expect.arrayContaining(["node:net", "node:dgram"]));
  });
});
