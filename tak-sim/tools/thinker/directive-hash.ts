/** `npx tsx tools/thinker/directive-hash.ts` — prints the sha256 of the directive text (for content/thinker/directive-premises.json's `directiveSha256`). */
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { normaliseNewlines, sha256Hex } from "../../server/thinker/config.js";

console.log(sha256Hex(normaliseNewlines(buildDemoScenario().hinge.intentStatement)));
