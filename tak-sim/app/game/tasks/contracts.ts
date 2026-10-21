/**
 * Game mode, SPEC/34: the shared contract of the training course (`app/game/course/`) and the decision tasks
 * (`app/game/tasks/`). A decision task is a fixed situation and one task, the same for every player (fixed scenario,
 * pre-burn, weather and seed); the course's exercises are small decision tasks. Data only, plus the criteria's
 * predicates, so a task plays on any `GameWorld`.
 */

import type { GameCommand, GameScenario, GameState, XY } from "../contracts.js";

/** The elements of command the course teaches; tasks and modules are tagged with one (SPEC/34 §3). */
export type CourseTopic = "map" | "fire" | "recon" | "orders" | "water" | "safety" | "protect" | "mopup";

/** One sample of the run, taken by the task runner every `TRACE_EVERY_S` game seconds from the commit. */
export interface TraceSample {
  readonly tS: number;
  readonly burnedHa: number;
  readonly flamingCells: number;
  readonly smoulderingCells: number;
  readonly units: readonly { readonly id: string; readonly pos: XY; readonly status: string; readonly waterL: number; readonly harm: number }[];
  readonly powerLineLive: boolean;
}

/** The game seconds between trace samples. */
export const TRACE_EVERY_S = 60;

/** What the runner recorded besides the samples (for criteria that need events, e.g. water near a live line). */
export interface TaskTrace {
  readonly samples: readonly TraceSample[];
  /** Every water application (attack, hose line, drop) within `POWER_LINE_SAFE_M` of the line while it was live. */
  readonly waterNearLiveLine: readonly { readonly tS: number; readonly unitId: string }[];
  /** Cells observed by the player's units at least once (fog of war), by cell index. */
  readonly everObserved: ReadonlySet<number>;
}

/** A criterion of a task: met or not, judged on the final state and the trace, with a reason the player reads. */
export interface TaskCriterion {
  readonly id: string;
  readonly labelFi: string;
  readonly labelEn: string;
  /** Pure: no clock, no randomness (the determinism lint applies). */
  readonly judge: (final: GameState, trace: TaskTrace) => { readonly met: boolean; readonly detailFi: string; readonly detailEn: string };
}

export interface DecisionTask {
  readonly id: string;
  readonly topic: CourseTopic;
  readonly titleFi: string;
  readonly titleEn: string;
  /** The task as the player reads it in the planning phase and in the instructions panel. */
  readonly promptFi: string;
  readonly promptEn: string;
  /** The situation. Its `preBurnS`, weather and events are part of the task; it is never shown in free play. */
  readonly scenario: GameScenario;
  /** The fixed seed: every player, every replay. */
  readonly seed: number;
  /** Game seconds from tS 0 to the planning moment (default 0: plan at the start). The game runs paused to it before planning. */
  readonly planAtS?: number;
  /** Game seconds the run lasts after the commit. */
  readonly horizonS: number;
  /** False (default): orders only in the planning phase — a static task. True: the player may also order during the run. */
  readonly allowLaterOrders?: boolean;
  readonly criteria: readonly TaskCriterion[];
  /** The expert reference: commands issued at `planAtS` (and later, when `allowLaterOrders`), replayed on the same seed. */
  readonly reference: {
    readonly commands: readonly GameCommand[];
    readonly explanationFi: string;
    readonly explanationEn: string;
  };
  /** Teaching points shown with the result. */
  readonly debriefFi: readonly string[];
  readonly debriefEn: readonly string[];
}

export interface TaskResult {
  readonly taskId: string;
  readonly criteria: readonly { readonly id: string; readonly met: boolean; readonly detailFi: string; readonly detailEn: string }[];
  readonly allMet: boolean;
  readonly points: number;
  readonly grade: "S" | "A" | "B" | "C" | "D" | "F";
  /** The player's commands, for the result's replay. */
  readonly commands: readonly GameCommand[];
}

/** Props of the task screen (`app/game/tasks/TaskScreen.tsx`); the course runs its exercises through it too. */
export interface TaskScreenProps {
  readonly lang: "fi" | "en";
  readonly task: DecisionTask;
  readonly onDone: (result: TaskResult) => void;
  readonly onBack: () => void;
}

/** A check question of a course module (SPEC/34 §3). */
export interface CheckQuestion {
  readonly id: string;
  readonly promptFi: string;
  readonly promptEn: string;
  readonly options: readonly { readonly textFi: string; readonly textEn: string }[];
  /** Index into `options`. */
  readonly correct: number;
  readonly explanationFi: string;
  readonly explanationEn: string;
}

export interface CoursePage {
  readonly headingFi: string;
  readonly headingEn: string;
  /** Paragraphs; "- " at a line start makes a bullet. */
  readonly bodyFi: string;
  readonly bodyEn: string;
  /** Optional map view to illustrate the page: centre (local metres) and width, m. */
  readonly view?: { readonly centre: XY; readonly widthM: number };
}

export interface CourseModule {
  readonly id: string;
  readonly topic: CourseTopic;
  readonly titleFi: string;
  readonly titleEn: string;
  readonly pages: readonly CoursePage[];
  readonly exercise?: DecisionTask;
  readonly checks: readonly CheckQuestion[];
}

/** The `localStorage` key prefix for game-mode progress (SPEC/34 §2). */
export const PROGRESS_KEY_PREFIX = "tak-game.";
