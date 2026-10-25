/**
 * The records the difficulty audit's changes add (23 Oct 2026, format 0.15.0; `docs/audits/2026-10-23-difficulty/`), split out of
 * `record-kinds.ts` as the public and interaction records are. Raw (SPEC/07 §1): nothing here is scored or derived.
 *
 * - The map-reading pretest (`proposal-map.md` c.2): started, one answer per item, completed. Every session with the step on (the
 *   header's `mapPretest`), both groups and both audiences, before the practice view. Since 0.17.0 (25 Oct 2026, SPEC/07 (bj)) the step
 *   is the map training (`app/session/map-training.ts`; its `version` "map-training-…"): started, per task its first answer and its
 *   feedback left (`map_pretest_feedback_left`), completed. The kinds keep their names, so the step's records stay together.
 * - The practice feedback screen (`app/session/practice-feedback.ts`, `proposal.md` (b.3)): shown once after the practice view; it is
 *   left with `briefing_advanced` "practice.feedback" and its dwell (the header's `practiceFeedback`).
 * - The "New records" badge on the Haku button is NOT logged: it is shown at every view's start (`cycle_start`) and step boundary
 *   (`step_boundary_reached`) unless the Haku tool is open, and cleared when Haku is opened (`tab_selected` "haku"), so its state is a
 *   function of records the log already has.
 */

/** The pretest on screen: its version and items, the cap, the time left, and (a resume) the items already answered. */
export interface MapPretestStartedDetail {
  readonly version: string;
  readonly itemIds: readonly string[];
  readonly timeLimitMs: number;
  readonly remainingMs: number;
  readonly resumed: boolean;
  readonly keptItemIds: readonly string[];
}

/**
 * A pretest item answered and left (final): the option chosen, the item's position (1-based) and its time on screen (ms).
 * 0.17.0 (the map training, 25 Oct 2026; SPEC/07 (bj)): a training task's FIRST answer, logged before its feedback is shown — a choice
 * task's `choiceId`, or a point task's `point` (extract pixels, 4 m each, 0.1 px) and `errorM` (its distance from the task's key, m,
 * rounded); `rtMs` from the question's appearance (the memory task: from the blank map's); `measures` the measure tool's readings on
 * the task before the answer (m, rounded, in order; [] when unused); `memoryMs` the memory task's exposure before the blank map.
 */
export interface MapPretestAnswerDetail {
  readonly itemId: string;
  readonly choiceId?: string;
  readonly point?: { readonly x: number; readonly y: number };
  readonly errorM?: number;
  readonly position: number;
  readonly rtMs: number;
  readonly measures?: readonly number[];
  readonly memoryMs?: number;
}

/** 0.17.0: a training task's feedback left ("Next task" / "Done"): its time on screen (ms). One per task answered, after its answer. */
export interface MapPretestFeedbackLeftDetail {
  readonly itemId: string;
  readonly position: number;
  readonly dwellMs: number;
}

/** How the pretest (since 0.17.0 the training) ended: every item answered (and, in the training, its feedback left), or the cap. */
export type MapPretestEndReason = "completed" | "timeout";

export interface MapPretestCompletedDetail {
  readonly endReason: MapPretestEndReason;
  readonly answeredCount: number;
  readonly missingItemIds: readonly string[];
  readonly durationMs: number;
}

/** The practice feedback screen shown (after VP): the practice items it lists, in order. */
export interface PracticeFeedbackShownDetail {
  readonly itemIds: readonly string[];
}
