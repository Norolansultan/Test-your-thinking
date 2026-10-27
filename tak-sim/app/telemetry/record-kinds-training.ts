/**
 * The training incident's records (format 0.18.0, SPEC/07 (bp)): all with the prefix `training_`, none of them a session record. Its
 * Haku questions are not `ai_chat_*`, its freeze items are not `freeze_*`, and its map use is not logged. Raw (SPEC/07 §1): nothing
 * here is scored or derived; `errorM` is computed in the browser from the keys in `content/training/incident.json`.
 */

import type { TrainingConfidence } from "../session/training/host";

/** The intro shown: version, sections, items, the cap, the time left, and (a resume) the items whose feedback was left. */
export interface TrainingStartedDetail {
  readonly version: string;
  readonly sectionIds: readonly string[];
  readonly itemIds: readonly string[];
  readonly capMs: number;
  readonly remainingMs: number;
  readonly resumed: boolean;
  readonly keptItemIds: readonly string[];
}

/** A section card left (s1–s4). */
export interface TrainingSectionLeftDetail {
  readonly sectionId: string;
  readonly dwellMs: number;
}

/** An item's FIRST answer, logged before its feedback shows; one per item. */
export interface TrainingAnswerDetail {
  readonly itemId: string;
  readonly sectionId: string;
  readonly position: number;
  /** From the question's appearance (the memory item: from the blank map's). */
  readonly rtMs: number;
  /** The R&B readings before the answer, m; [] when unused. */
  readonly measures: readonly number[];
  readonly choiceId?: string;
  /** WGS84, 6 decimals. */
  readonly point?: { readonly lat: number; readonly lon: number };
  /** Metres from the key, rounded. */
  readonly errorM?: number;
  /** A question card or freeze item; absent when timed out. */
  readonly confidence?: TrainingConfidence;
  /** The memory item's exposure (8 000). */
  readonly memoryMs?: number;
  /** A question card: the `training_haku_asked` of this item before the answer. */
  readonly hakuBefore?: number;
  /** A question card: true at 0 s. */
  readonly timedOut?: boolean;
}

/** An item's feedback left. */
export interface TrainingFeedbackLeftDetail {
  readonly itemId: string;
  readonly position: number;
  readonly dwellMs: number;
}

/** A Haku question in S3, durable before the pane shows it. */
export interface TrainingHakuAskedDetail {
  readonly queryId: string;
  readonly itemId: string;
  readonly text: string;
  readonly charCount: number;
  /** From the item's appearance. */
  readonly atItemMs: number;
}

/** The answer shown. `retrieved` holds `trn.r..` ids only. */
export interface TrainingHakuAnsweredDetail {
  readonly queryId: string;
  readonly itemId: string;
  readonly retrieved: readonly { readonly id: string; readonly fusedScore: number }[];
  readonly retrievalMode: "lexical_only";
  readonly retrievalLanguage: "fi" | "en";
  /** `model` the study's proxy, `bridge` the demonstration's, `template` the local fallback and the play harness. */
  readonly answerSource: "model" | "bridge" | "template";
  readonly modelId: string | null;
  readonly promptHash: string | null;
  readonly fallback: boolean;
  readonly fallbackReason: string | null;
  readonly latencyMs: number;
  readonly answer: { readonly vastaus: string; readonly perusteet: string; readonly varmuus: string; readonly muuttaisi: string };
}

/** S5 left: the cell's recording. */
export interface TrainingDemoShownDetail {
  readonly demoId: "haku" | "guide";
  readonly exampleIds: readonly string[];
  readonly dwellMs: number;
}

/**
 * The cap reached (review 27 Oct 2026; SPEC/07 (bp), `15` (bp) §bp.3–§bp.4): written once, when the 12 minutes run out before S4's
 * end, durable before S5 shows. `remainingItemIds`: the items with no answer logged (`training_completed.missingItemIds`); `atItemId`:
 * the item on screen (its question, exposure, feedback or section card; null on the intro); `activeMs`: the training's active time at
 * the cap (the cap, or more on a resume that found none left). A resume that finds it goes straight to S5 (`endReason` timeout).
 */
export interface TrainingCapReachedDetail {
  readonly remainingItemIds: readonly string[];
  readonly atItemId: string | null;
  readonly activeMs: number;
}

/** S5 left: the training's end. `durationMs` from S1 to S4's end (S5 excluded). */
export interface TrainingCompletedDetail {
  readonly endReason: "completed" | "timeout";
  readonly answeredCount: number;
  readonly missingItemIds: readonly string[];
  readonly durationMs: number;
}
