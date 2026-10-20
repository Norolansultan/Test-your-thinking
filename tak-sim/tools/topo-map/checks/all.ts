/**
 * `npm run map:check` — every check of the built map (SPEC/33 §5): the geometry contract (contract.ts), then hydro, road and
 * realism (gate A). Exits non-zero if any reports a violation.
 */

import { main as contractMain } from "./contract.js";
import { checkHydro, printResult } from "./hydro.js";
import { checkRoads } from "./road.js";
import { checkRealism } from "./realism.js";
import { loadLayers } from "./built-layers.js";

await contractMain();
const layers = loadLayers();
let failed = 0;
for (const r of [checkHydro(layers), checkRoads(layers), checkRealism(layers)]) {
  printResult(r);
  failed += r.violations.length;
}
console.log(`map:check — hydro, road and realism: ${failed} violation(s)`);
if (failed > 0) process.exitCode = 1;
