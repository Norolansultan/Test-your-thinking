/**
 * The shape of the training incident's texts (SPEC/08 (bp)); the words are `training-texts*.ts` (fi DRAFT pending native review).
 */

import type { Cell } from "../scenario/types";
import type { TrainingAnswer } from "../session/training/host";
import type { TrainingKey, TrainingSectionId, TrainingSourceClass } from "../session/training/spec";

/** What an item's feedback is filled from: the logged answer, the key, the computed figures and (S3) the lesson. */
export interface TrainingFeedbackContext {
  readonly answer: TrainingAnswer | null;
  readonly key: TrainingKey;
  readonly errorM: number | null;
  readonly timedOut: boolean;
  readonly source: TrainingSourceClass | null;
  readonly numbers: Readonly<Record<string, number | string>>;
  readonly lesson?: { readonly questionId: string; readonly recordIds: readonly string[] };
}

export interface TrainingTexts {
  readonly intro: { readonly title: string; readonly body: readonly string[]; readonly start: string };
  section(id: TrainingSectionId): { readonly title: string; readonly body: readonly string[]; readonly go: string };
  item(id: string): { readonly stem: string; readonly options: Readonly<Record<string, string>> };
  feedback(id: string, ctx: TrainingFeedbackContext): readonly string[];
  /** S5: the cell's recording (`radio` → Haku's, a Thinker cell → the guide's). */
  demo(cell: Cell): { readonly title: string; readonly intro: string; readonly examples: readonly { readonly id: string; readonly question: string; readonly answer: readonly string[]; readonly note: string }[] };
  readonly demoLines: { readonly limitation: string; readonly leave: string };
  readonly ui: Readonly<Record<string, string>>;
}
