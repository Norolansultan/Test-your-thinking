/**
 * The demo scenario as the module `npm run validate:scenario` loads (`tools/validate/scenario.ts`).
 *
 * Fix pass 2 (7 Oct 2026): the TRUTH key modules are loaded too — `freeze-keys.ts` and
 * `demo-directive.ts`, which no app module imports — so a key whose record pattern no longer
 * matches exactly one record throws here, and every key's basis atom (the directive keys' and the
 * freeze items') must exist in the scenario, failing validation instead of the analysis.
 */

import { sortedKeys } from "../../app/engine/deterministic-object.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import "../../app/scenario/freeze-keys.js";
import { DIRECTIVE_KEYS } from "../../app/scenario/demo-directive.js";

export const scenario = buildDemoScenario();

const atomIds = new Set(scenario.atoms.map((a) => a.id));
const missing = [
  ...sortedKeys(DIRECTIVE_KEYS).map(Number).sort((a, b) => a - b)
    .flatMap((view) => (DIRECTIVE_KEYS[view]?.basisAtomIds ?? []).filter((id) => !atomIds.has(id)).map((id) => `directive key V${view}: ${id}`)),
  ...[scenario.practice.freeze, ...scenario.freezes].flatMap((f) => f.items.flatMap((item) => (item.keyAtomIds ?? []).filter((id) => !atomIds.has(id)).map((id) => `freeze item ${item.id}: ${id}`))),
];
if (missing.length > 0) throw new Error(`Key basis atoms not in the scenario:\n  ${missing.join("\n  ")}`);
