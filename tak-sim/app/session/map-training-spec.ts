/**
 * The map training's content as the build writes it (`tools/review/map-training.ts` → `content/pretest/map-training.json`;
 * SPEC/08 (bj)): the extract, the road codes drawn on it, the cap, the memory task's exposure and the seven tasks with their
 * geometry and keys (the training shows each key in its feedback). Pure types and two helpers shared by the session
 * (`map-training.ts`), the screen and the drawings (`map-training-overlay.ts`) and the build; no text (the words are
 * `app/i18n/map-training-texts.ts`).
 */

export interface Pt { readonly x: number; readonly y: number }

/** A mark on a task's map: what the texts call it ("A", "★", "1") and how it is drawn. */
export interface TrainingMark {
  readonly id: string;
  readonly label: string;
  /** `point` a red lettered dot; `water` a blue numbered fill point; `star` the pump. */
  readonly kind: "point" | "water" | "star";
  readonly x: number;
  readonly y: number;
}

/** A road code drawn on the extract as the live map's overlay draws R1–R3. */
export interface TrainingRoadLabel { readonly road: string; readonly x: number; readonly y: number }

/** A fire drawn as the live map draws the current edge, with the clock it was mapped at. */
export interface TrainingFire {
  readonly polygon: readonly Pt[];
  /** The head as drawn (the edge's furthest point in the direction of spread). */
  readonly head: Pt;
  readonly mappedAt: string;
  /** Where the "mapped at" label sits. */
  readonly label: Pt;
}

interface TaskBase {
  readonly id: string;
  /** What it teaches (analysis, SPEC/08 (bj)). */
  readonly skill: string;
  readonly marks: readonly TrainingMark[];
}
/** 1. Find a named place (the map on screen): the junction of two coded roads. Point answer. */
export interface PlaceTask extends TaskBase { readonly kind: "place"; readonly roads: readonly [string, string]; readonly key: Pt }
/** 2. Measure a distance: A to the nearest point of a road. Choice of four distances. */
export interface MeasureTask extends TaskBase {
  readonly kind: "measure"; readonly road: string; readonly metres: number; readonly foot: Pt;
  readonly options: readonly { readonly id: string; readonly metres: number }[]; readonly key: string;
}
/** 3. Fire and terrain: up a slope (B) or over level ground (C), no wind. */
export interface SlopeTask extends TaskBase { readonly kind: "slope"; readonly riseB: number; readonly options: readonly { readonly id: string }[]; readonly key: string }
/** 4. Water by road: fill point 1 or 2 for a pump at ★. */
export interface WaterTask extends TaskBase {
  readonly kind: "water"; readonly options: readonly { readonly id: string }[]; readonly key: string;
  /** Fill points 1 and 2: straight-line and road distances from ★ (km, one decimal) and each road route (px). */
  readonly straightKm: readonly [number, number]; readonly roadKm: readonly [number, number];
  readonly routes: readonly [readonly Pt[], readonly Pt[]];
}
/** 5. The map against the log: the edge as mapped at the period's start, a newer report in the log. */
export interface NowTask extends TaskBase {
  readonly kind: "now"; readonly road: string; readonly fire: TrainingFire;
  readonly report: { readonly clock: string; readonly from: string }; readonly headAt: Pt;
  readonly options: readonly { readonly id: string }[]; readonly key: string;
}
/** 6. Project by the clock: from the latest report's head, at a stated rate, to a named clock time. Point answer. */
export interface ProjectTask extends TaskBase {
  readonly kind: "project"; readonly road: string; readonly fire: TrainingFire; readonly headAt: Pt;
  readonly fromClock: string; readonly toClock: string; readonly minutes: number; readonly metresPerMin: number;
  readonly bearingDeg: number; readonly direction: string; readonly key: Pt;
}
/** 7. The memory-check map: a unit shown for `memoryMs`, then the blank map. Point answer. */
export interface MemoryTask extends TaskBase { readonly kind: "memory"; readonly unit: { readonly callsign: string; readonly x: number; readonly y: number }; readonly key: Pt }

export type TrainingTask = PlaceTask | MeasureTask | SlopeTask | WaterTask | NowTask | ProjectTask | MemoryTask;

export interface MapTrainingSpec {
  readonly generatedBy: string;
  readonly version: string;
  /** The extract: basemap pixels x0…x0+size, y0…y0+size, which lie in tile `tile` at tileX0, tileY0 (a tile is tilePx square). */
  readonly crop: {
    readonly x0: number; readonly y0: number; readonly size: number; readonly tile: string; readonly tileX0: number; readonly tileY0: number;
    readonly tilePx: number; readonly metresPerPixel: number;
  };
  readonly scaleBarMetres: number;
  readonly timeLimitMs: number;
  /** The memory task's exposure (ms). */
  readonly memoryMs: number;
  readonly roadLabels: readonly TrainingRoadLabel[];
  readonly tasks: readonly TrainingTask[];
}

/** What the participant answered: an option, or a point on the extract (its pixels). */
export type TrainingAnswer = { readonly choiceId: string } | { readonly point: Pt };
/** The phase a task is in: the unit on the map (memory only), the question, the feedback. */
export type TrainingPhase = "study" | "answer" | "feedback";


/** Whether a task is answered with a point on the map (else with an option). */
export const isPointTask = (task: TrainingTask): task is PlaceTask | ProjectTask | MemoryTask => task.kind === "place" || task.kind === "project" || task.kind === "memory";

/** The metres between a point answer and its key (rounded), or null for a choice task. */
export function pointErrorMetres(spec: MapTrainingSpec, task: TrainingTask, point: Pt): number | null {
  return isPointTask(task) ? Math.round(Math.hypot(point.x - task.key.x, point.y - task.key.y) * spec.crop.metresPerPixel) : null;
}
