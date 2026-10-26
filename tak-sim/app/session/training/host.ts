/**
 * The training incident as the session shows it (SPEC/15 (bp)): the view the orchestrator's snapshot carries while the step is
 * `training_incident`, the answer shape, and the orchestrator methods the screen and the play harness call. Types only.
 */

import type { LatLon } from "../../engine/primitives";
import type { TrainingSectionId } from "./spec";

export type TrainingConfidence = 25 | 50 | 75 | 100;

export type TrainingAnswer =
  | { readonly choiceId: string; readonly confidence?: TrainingConfidence }
  | { readonly point: LatLon; readonly confidence?: TrainingConfidence };

export interface TrainingView {
  readonly phase: "intro" | "section" | "question" | "study" | "feedback" | "demo" | "ended";
  readonly sectionId: TrainingSectionId | null;
  readonly itemId: string | null;
  /** 1–13; 0 before the first item. */
  readonly position: number;
  readonly itemCount: number;
  readonly scene: "s1" | "incident" | null;
  /** Which real tools are open for the current item (`haku` only on a question card). */
  readonly tools: { readonly map: boolean; readonly rb: boolean; readonly log: boolean; readonly haku: boolean };
  /** The item's logged first answer (feedback shows it). */
  readonly answer: TrainingAnswer | null;
  /** A point answer's distance from the key, m. */
  readonly errorM: number | null;
  readonly timedOut: boolean;
  /** S5's recording: `haku` in the Haku cell, `guide` in the Thinker cells. */
  readonly demoId: "haku" | "guide" | null;
  readonly capMs: number;
}

/** The orchestrator's training methods (B implements; the screen and `tools/play/` call them). */
export interface TrainingHost {
  trainingStart(): void;
  trainingLeaveSection(): void;
  answerTraining(itemId: string, answer: TrainingAnswer, measures?: readonly number[]): void;
  leaveTrainingFeedback(itemId: string): void;
  askTrainingHaku(text: string): Promise<void>;
  leaveTrainingDemo(): void;
  trainingSecondsLeft(): number;
  trainingStudySecondsLeft(): number;
  trainingCardSecondsLeft(): number;
}
