/**
 * `npm run bundle:hash` — prints the scenario bundle hash a session's log header carries
 * (`app/telemetry/bundle-hash.ts`), to check a log against the code it claims to have run.
 */

import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { scenarioBundleHash } from "../../app/telemetry/bundle-hash.js";

console.log(scenarioBundleHash(buildDemoScenario()));
