/**
 * The training incident's content types (SPEC/08 (bp), `15` (bp)): a small fire at Kaitajärvi in the basemap's north-east corner,
 * played with the session's real components. Types only; the data is `spec-data.ts` (built by `tools/review/training.ts` into
 * `content/training/`). Every key is computed from the site data, never typed.
 */

import type { LatLon } from "../../engine/primitives";
import type { RenderableCycle } from "../../boundary/render-boundary";

export type TrainingSectionId = "s1" | "s2" | "s3" | "s4" | "s5";

/** Where an item's answer could be found (the feedback names it for every item, right or wrong). */
export type TrainingSourceClass = "log" | "map" | "records" | "reasoning";

/** The pre-stated covariates (`09` (bp)): measured before any group-specific content. */
export type TrainingCovariate = "point_visible" | "seek_first" | "point_memory";

/** A mark drawn on an item's map: what the texts call it ("A", "★", "1", a call sign) and how it is drawn. */
export interface TrainingMark {
  readonly id: string;
  readonly label: string;
  readonly kind: "point" | "star" | "water" | "unit" | "head";
  readonly at: LatLon;
}

export type TrainingKey = { readonly optionId: string } | { readonly point: LatLon };

/** What an item's feedback draws and fills in (its words are `TRAINING_TEXT[lang].feedback`). */
export interface TrainingFeedbackGeometry {
  readonly ring?: readonly LatLon[];
  readonly line?: readonly LatLon[];
  readonly routes?: readonly (readonly LatLon[])[];
  readonly numbers: Readonly<Record<string, number | string>>;
}

export interface TrainingItem {
  readonly id: string;
  readonly section: TrainingSectionId;
  /** 1–13, the order on screen. */
  readonly position: number;
  /** `live` on the live map, `card` a SPAM-style question card (tools at hand, 60 s), `freeze` the freeze screen (tools off). */
  readonly mode: "live" | "card" | "freeze";
  readonly answer: "choice" | "point";
  readonly scene: "s1" | "incident";
  readonly source: TrainingSourceClass | null;
  readonly covariate: TrainingCovariate | null;
  /** Dropped first if pilot 2 runs long. */
  readonly optional?: boolean;
  readonly marks: readonly TrainingMark[];
  readonly options: readonly { readonly id: string }[];
  readonly key: TrainingKey;
  readonly feedback: TrainingFeedbackGeometry;
  /** The memory item: the unit shown for `exposureMs`, then the blank map. */
  readonly memory?: { readonly unit: string; readonly at: LatLon; readonly exposureMs: number };
  /** The search lesson: the pre-recorded question and the record(s) it shows. */
  readonly lesson?: { readonly questionId: string; readonly recordIds: readonly string[] };
}

export interface TrainingSpec {
  readonly version: string;
  /** 720 000: real time from S1 to S4's end. */
  readonly capMs: number;
  /** 60 000: a question card's window. */
  readonly cardWindowMs: number;
  /** 10 000: S5's button is enabled after this. */
  readonly demoMinDwellMs: number;
  /** The training's "now": 10.18 (virtual time −10 920 s). */
  readonly now: { readonly virtualTimeS: number; readonly label: string };
  /** The live map is locked to `bounds` plus `lockMarginM`. */
  readonly area: { readonly bounds: { readonly south: number; readonly west: number; readonly north: number; readonly east: number }; readonly lockMarginM: number; readonly centre: LatLon };
  readonly roadLabels: readonly { readonly road: string; readonly at: LatLon }[];
  readonly scenes: Readonly<Record<"s1" | "incident", RenderableCycle>>;
  /** The 13 items, in order. */
  readonly items: readonly TrainingItem[];
  readonly sections: readonly { readonly id: TrainingSectionId; readonly itemIds: readonly string[] }[];
}
