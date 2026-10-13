/**
 * Invariant I4 for the directive's keys (4 Oct 2026): `app/scenario/demo-directive.ts` is truth
 * (the sound postures and the fit of every view), so nothing the session, the render layer, the
 * scenario builder or the Thinker server loads may import it. Like `demo-outlook.ts`, its keys
 * reach only the analysis (`directiveAdherence` takes them as an argument). A static check over
 * every source file's import specifiers.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sources(dir: string): string[] {
  return readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

// Static (named, type, re-export), side-effect, dynamic (quoted or template) and require() imports (review 4 Oct 2026).
const IMPORT = /(?:import|export)\s[^;]*?from\s*["'`]([^"'`]+)["'`]|import\s*["'`]([^"'`]+)["'`]|import\(\s*["'`]([^"'`]+)["'`]\s*\)|require\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

describe("demo-directive.ts stays out of the session and the UI", () => {
  const files = [...sources("app"), ...sources("server")].filter((f) => !f.endsWith(join("scenario", "demo-directive.ts")));

  it("is imported by no file under app/ or server/ (the session, the render layer, the scenario builder, the analysis code)", () => {
    const importers = files.filter((f) => [...readFileSync(f, "utf8").matchAll(IMPORT)].some((m) => /demo-directive/.test(m[1] ?? m[2] ?? m[3] ?? m[4] ?? "")));
    expect(importers).toEqual([]);
  });

  it("the check sees real imports (the orchestrator's are found)", () => {
    const orchestrator = readFileSync("app/session/orchestrator.ts", "utf8");
    expect([...orchestrator.matchAll(IMPORT)].map((m) => m[1] ?? m[2]).some((s) => s === "./allocation.js")).toBe(true);
    expect(files.length).toBeGreaterThan(50);
  });
});
