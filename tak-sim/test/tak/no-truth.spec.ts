/**
 * I4 for the TAK base (SPEC/28 §2.1, §7): truth cannot reach a CoT event.
 *
 * 1. Every compiled event of every view of the real scenario (VP and V1–V14, both steps of a merged
 *    view) passes `assertNoTruthKeysPresent`.
 * 2. The serialised XML of every view and the timed stream contain none of the truth field names.
 * 3. By construction: the compiler's runtime import graph reaches no `app/scenario/` module (types only).
 */

import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { assertNoTruthKeysPresent, TruthLeakError } from "../../app/boundary/render-boundary.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { ScenarioContract } from "../../app/scenario/types.js";
import { serializeCot, serializeCotEvents, type CotEvent } from "../../app/tak/cot.js";
import { compileViewCot, viewLabel, type ViewCotInput } from "../../app/tak/compile.js";
import { cotJsonLines, sessionCotInputs } from "../../tools/tak/export.js";

/** The truth field names SPEC/28 §2.1 lists, the rest of `TruthAnnotation` (SPEC/04 §3.2), and the bundle's truth fields. */
const TRUTH_NAMES = [
  "flag=", '"flag"', "breachGeometry", "isOmissionCycle", "actualPerimeterAtEnd", "actualDetachedAtEnd", "consistentWithEnvelope", "whatWasHappening",
  "isGroundTruth", "isDecoy", "contradictionRole", "relevantInvariants", "tierRationale", "saidOn", "accuracy_label", "truthAtEnd", "truthDetached", "derivedFlag",
  "breach_quantitative", "breach_categorical",
] as const;

function truthNamesIn(text: string): string[] {
  return TRUTH_NAMES.filter((name) => text.includes(name));
}

let scenario: ScenarioContract;
let inputs: ViewCotInput[];
let perStep: { readonly label: string; readonly events: CotEvent[] }[];

beforeAll(() => {
  scenario = buildDemoScenario();
  inputs = sessionCotInputs(scenario);
  perStep = inputs.map((input) => ({ label: `${viewLabel(input.cycle.index)}.${input.cycle.stepShown}`, events: compileViewCot(input) }));
});

describe("I4 — no truth in any CoT event of any view (SPEC/28 §7)", () => {
  it("walks all fifteen views, every step, and a non-trivial number of events", () => {
    expect(new Set(perStep.map((s) => s.label.slice(0, 3)))).toEqual(new Set(Array.from({ length: 15 }, (_, i) => viewLabel(i))));
    expect(perStep.length).toBe(21);
    expect(perStep.reduce((n, s) => n + s.events.length, 0)).toBeGreaterThan(500);
  });

  it("every compiled event passes assertNoTruthKeysPresent; so does every compiler input", () => {
    for (const input of inputs) expect(() => assertNoTruthKeysPresent(input)).not.toThrow();
    for (const { label, events } of perStep) {
      events.forEach((e, i) => expect(() => assertNoTruthKeysPresent(e), `${label} #${i} ${e.uid}`).not.toThrow());
    }
  });

  it("the serialised XML of every view step, the whole-session documents and the timed stream contain no truth field name", () => {
    for (const { label, events } of perStep) {
      expect(truthNamesIn(serializeCotEvents(events)), label).toEqual([]);
      for (const e of events) expect(serializeCot(e)).not.toMatch(/\sflag\w*="/i);
    }
    const all = perStep.flatMap((s) => s.events);
    expect(truthNamesIn(cotJsonLines(all))).toEqual([]);
  });

  it("the scenario does hold truth under those names, so the checks above are not vacuous", () => {
    const raw = JSON.stringify({ cycles: scenario.cycles, envelopes: scenario.envelopes, atoms: scenario.atoms.slice(0, 50) });
    expect(truthNamesIn(raw)).toEqual(expect.arrayContaining(["\"flag\"", "isOmissionCycle", "actualPerimeterAtEnd", "consistentWithEnvelope", "isGroundTruth", "isDecoy"]));
  });

  it("negative controls: a smuggled truth key or truth name is caught", () => {
    const e = perStep[1]!.events[0]!;
    expect(() => assertNoTruthKeysPresent({ ...e, detail: { ...e.detail, isGroundTruth: true } })).toThrow(TruthLeakError);
    const leaky = { ...e, detail: { ...e.detail, remarks: { text: "breach_categorical" } } };
    expect(truthNamesIn(serializeCot(leaky))).toEqual(["breach_categorical"]);
    // A truth-bearing input is refused by the compiler itself (the presence assertion at the CoT boundary).
    const input = inputs[1]!;
    expect(() => compileViewCot({ ...input, envelope: { ...input.envelope!, isDecoy: false } as unknown as ViewCotInput["envelope"] })).toThrow(TruthLeakError);
  });
});

// ---------------------------------------------------------------------------
// by construction: the compiler's runtime import graph
// ---------------------------------------------------------------------------

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** The value (runtime) imports of a TypeScript module: `import type` and all-`type` specifier lists are erased by the compiler. */
function runtimeImports(source: string): string[] {
  const out: string[] = [];
  const statement = /(?:^|\n)\s*(import|export)\s+([^;]*?)\s+from\s+["']([^"']+)["']/g;
  for (const m of source.matchAll(statement)) {
    const clause = m[2]!.trim();
    if (clause.startsWith("type ")) continue;
    const braces = /^\{([^}]*)\}$/.exec(clause);
    if (braces && braces[1]!.split(",").map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith("type "))) continue;
    out.push(m[3]!);
  }
  for (const m of source.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) out.push(m[1]!);
  for (const m of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]!);
  return out;
}

function reachable(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [resolve(ROOT, entry)];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue; // JSON and other leaves
    for (const spec of runtimeImports(readFileSync(file, "utf8"))) {
      if (!spec.startsWith(".")) continue; // packages
      const target = join(dirname(file), spec).replace(/\.js$/, ".ts");
      stack.push(target);
    }
  }
  return [...seen].map((f) => relative(ROOT, f)).sort();
}

describe("I4 by construction — app/tak/compile.ts imports no scenario value (SPEC/28 §2.1)", () => {
  it("its runtime import graph reaches no app/scenario/ module and no scenario JSON", () => {
    const graph = reachable("app/tak/compile.ts");
    expect(graph).toContain("app/tak/compile.ts");
    expect(graph).toContain("app/boundary/render-boundary.ts");
    expect(graph.filter((f) => f.startsWith("app/scenario/") || f.endsWith("site-scenario.json") || f.startsWith("tools/"))).toEqual([]);
    for (const tak of ["app/tak/cot.ts", "app/tak/time.ts", "app/tak/symbols.ts", "app/tak/geochat.ts"]) {
      expect(reachable(tak).filter((f) => !f.startsWith("app/tak/") && !f.startsWith("app/engine/"))).toEqual([]);
    }
  });

  it("the graph walker sees through to a scenario module when one is imported (control)", () => {
    expect(reachable("tools/tak/export.ts")).toContain("app/scenario/demo-scenario.ts");
    expect(runtimeImports('import type { A } from "./a.js";\nimport { type B, type C } from "./b.js";\nimport { type D, E } from "./c.js";\nexport { F } from "./d.js";')).toEqual(["./c.js", "./d.js"]);
  });
});
