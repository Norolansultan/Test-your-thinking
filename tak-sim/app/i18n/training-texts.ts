/**
 * The training incident's texts (SPEC/08 (bp) §bp.5, SPEC/30 (bp)) in both languages: the Finnish is DRAFT (native check), the
 * English DRAFT. S1–S4 are the same in every cell; only S5's recording (`demo(cell)`) differs by group. The words are in
 * `training-texts-fi.ts`, `training-texts-en.ts` and `training-texts-demo.ts`; the figures come from the build.
 */

import type { Lang } from "./lang.js";
import { trainingDemo, trainingDemoLines } from "./training-texts-demo.js";
import { TRAINING_WORDS_EN } from "./training-texts-en.js";
import { TRAINING_WORDS_FI } from "./training-texts-fi.js";
import { makeTrainingTexts } from "./training-texts-shared.js";
import type { TrainingTexts } from "./training-texts-types.js";

export const TRAINING_TEXT: Readonly<Record<Lang, TrainingTexts>> = {
  fi: makeTrainingTexts(TRAINING_WORDS_FI, (cell) => trainingDemo("fi", cell), trainingDemoLines("fi")),
  en: makeTrainingTexts(TRAINING_WORDS_EN, (cell) => trainingDemo("en", cell), trainingDemoLines("en")),
};
