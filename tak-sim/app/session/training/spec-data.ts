/**
 * The training incident as built (SPEC/08 (bp) §bp.9): `content/training/incident.json`, written by `npm run training:build`
 * (`tools/review/training.ts`) from the site data, the contract and the corpus — every key computed, never typed. Code against the
 * `TrainingSpec` type; `test/training/build.spec.ts` checks that this is exactly what the build writes now.
 */

import incident from "../../../content/training/incident.json" with { type: "json" };
import type { TrainingSpec } from "./spec.js";

export const TRAINING: TrainingSpec = incident as unknown as TrainingSpec;
