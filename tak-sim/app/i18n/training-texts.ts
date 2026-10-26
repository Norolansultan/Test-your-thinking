/**
 * PLACEHOLDER (bp integration stub): work package A replaces this file with the training's fi/en texts. Same exports.
 */

import type { Lang } from "./lang";
import type { TrainingTexts } from "./training-texts-types";

const placeholder: TrainingTexts = {
  intro: { title: "", body: [], start: "" },
  section: () => ({ title: "", body: [], go: "" }),
  item: () => ({ stem: "", options: {} }),
  feedback: () => [],
  demo: () => ({ title: "", intro: "", examples: [] }),
  demoLines: { limitation: "", leave: "" },
  ui: {},
};

export const TRAINING_TEXT: Readonly<Record<Lang, TrainingTexts>> = { fi: placeholder, en: placeholder };
