/**
 * What the training incident's texts in both languages share (SPEC/08 (bp) §bp.5): the built content they read (the items' computed
 * figures, the corpus's records and pre-recorded questions), number and compass formatting, and the assembly of a language's words
 * into the `TrainingTexts` shape. The words themselves are `training-texts-fi.ts` (DRAFT, native check) and `training-texts-en.ts`;
 * S5's recordings are `training-texts-demo.ts`. Feedback is descriptive, never directive ((bn) S7; (bl)).
 */

import type { Cell } from "../scenario/types.js";
import { TRAINING } from "../session/training/spec-data.js";
import { TRAINING_QUESTIONS, trainingAtom } from "../session/training/corpus.js";
import type { TrainingItem, TrainingSectionId, TrainingSourceClass } from "../session/training/spec.js";
import { clockAt, recordText } from "../session/template-answer.js";
import type { Lang } from "./lang.js";
import { recordIn } from "./text.js";
import type { TrainingFeedbackContext, TrainingTexts, TrainingUiKey } from "./training-texts-types.js";

export function trainingItem(id: string): TrainingItem {
  const it = TRAINING.items.find((x) => x.id === id);
  if (!it) throw new Error(`training texts: no item ${id}`);
  return it;
}

/** A computed figure of an item's feedback (`numbers`), as written by the build. */
export function figure(id: string, name: string): number | string {
  const v = trainingItem(id).feedback.numbers[name];
  if (v === undefined) throw new Error(`training texts: ${id} has no figure ${name}`);
  return v;
}

/** A number in the language's notation (fi decimal comma). */
export const decimal = (lang: Lang, v: number, digits = 1): string => (lang === "fi" ? v.toFixed(digits).replace(".", ",") : v.toFixed(digits));
/** Metres as kilometres with one decimal. */
export const km = (lang: Lang, metres: number): string => decimal(lang, Math.round(metres / 100) / 10);

/** A record as the lessons quote it: its source, its clock ("10.05") and its text in the language. */
export function quoteRecord(lang: Lang, id: string): { readonly source: string; readonly clock: string; readonly text: string } {
  const a = trainingAtom(id);
  const fi = recordText(a.record);
  return { source: a.provenance.sourceId, clock: clockAt(a.provenance.observedAt), text: recordIn(lang, id, fi) };
}

/** A pre-recorded question in the language. */
export function question(lang: Lang, questionId: string): string {
  const q = TRAINING_QUESTIONS[questionId];
  if (!q) throw new Error(`training texts: no question ${questionId}`);
  return q[lang];
}

/** What a language's words give for one item's feedback. */
export interface FeedbackArgs {
  readonly item: TrainingItem;
  readonly ctx: TrainingFeedbackContext;
  /** The right option's label (choice items). */
  readonly keyLabel: string;
  /** The participant's line: their option, their distance, or that they gave none. */
  readonly yours: string;
}

/** One language's words, in the order the screen shows them. */
export interface TrainingWords {
  readonly lang: Lang;
  readonly intro: TrainingTexts["intro"];
  readonly sections: Readonly<Record<TrainingSectionId, { readonly title: string; readonly body: readonly string[]; readonly go: string }>>;
  readonly stems: Readonly<Record<string, string>>;
  readonly options: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** The source line's class name ("Lähde: viestiloki." / "Source: the message log."). */
  readonly source: (c: TrainingSourceClass) => string;
  readonly chose: (label: string) => string;
  readonly markedAway: (m: number) => string;
  readonly noMark: string;
  readonly timedOut: string;
  readonly noAnswer: string;
  /** The explanation after the right answer and the source line; the first element is the right answer as a sentence. */
  readonly feedback: Readonly<Record<string, (a: FeedbackArgs) => { readonly answer: string; readonly explain: readonly string[] }>>;
  /** Every interface string the screen shows (`TRAINING_UI_KEYS`). */
  readonly ui: Readonly<Record<TrainingUiKey, string>>;
}

/** The sentence form of an option's label: capitalised, a full stop. */
export const sentence = (label: string): string => `${label.charAt(0).toUpperCase()}${label.slice(1)}.`;

export function makeTrainingTexts(w: TrainingWords, demo: (cell: Cell) => ReturnType<TrainingTexts["demo"]>, demoLines: TrainingTexts["demoLines"]): TrainingTexts {
  const item = (id: string) => {
    const stem = w.stems[id];
    if (stem === undefined) throw new Error(`training texts (${w.lang}): no stem for ${id}`);
    return { stem, options: w.options[id] ?? {} };
  };
  return {
    intro: w.intro,
    section: (id) => w.sections[id],
    item,
    feedback: (id, ctx) => {
      const it = trainingItem(id);
      const labels = w.options[id] ?? {};
      const keyLabel = "optionId" in ctx.key ? labels[ctx.key.optionId] ?? "" : "";
      const answered = ctx.answer && "choiceId" in ctx.answer ? labels[ctx.answer.choiceId] ?? ctx.answer.choiceId : null;
      const yours = it.answer === "point"
        ? ctx.errorM !== null ? w.markedAway(ctx.errorM) : w.noMark
        : ctx.timedOut ? w.timedOut : answered !== null ? w.chose(answered) : w.noAnswer;
      const make = w.feedback[id];
      if (!make) throw new Error(`training texts (${w.lang}): no feedback for ${id}`);
      const f = make({ item: it, ctx, keyLabel, yours });
      return [f.answer, ...(it.source ? [w.source(it.source)] : []), ...f.explain, yours];
    },
    demo,
    demoLines,
    ui: w.ui,
  };
}

/** The item ids in screen order (the texts cover exactly these). */
export const TRAINING_ITEM_IDS: readonly string[] = TRAINING.items.map((it) => it.id);
