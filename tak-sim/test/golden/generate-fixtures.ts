/**
 * One-off generator for the committed golden fixtures. NOT run by the test
 * suite — run manually (`npx tsx test/golden/generate-fixtures.ts`) only
 * when a reference sequence in `reference-sequences.ts` deliberately
 * changes. `engine.spec.ts` compares the live engine output against the
 * committed files this script writes; it never regenerates them itself,
 * or a real regression would silently "fix" the fixture instead of
 * failing the build.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, runReferenceSequence } from "./reference-runner.js";
import { REFERENCE_SEQUENCES } from "./reference-sequences.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");
mkdirSync(fixturesDir, { recursive: true });

for (const [name, spec] of Object.entries(REFERENCE_SEQUENCES)) {
  const result = await runReferenceSequence(spec.scenarioId, spec.seed, spec.actions);
  const path = join(fixturesDir, `${name}.json`);
  writeFileSync(path, canonicalJson(result));
  console.log(`wrote ${path} (${result.records.length} records)`);
}
