/**
 * The records the difficulty audit's changes add (23 Oct 2026, format 0.15.0; `docs/audits/2026-10-23-difficulty/`), split out of
 * `record-kinds.ts` as the public and interaction records are. Raw (SPEC/07 §1): nothing here is scored or derived.
 *
 * - The map-reading pretest (`app/session/map-pretest.ts`, `proposal-map.md` c.2): started, one answer per item, completed. Every
 *   session with the pretest on (the header's `mapPretest`), both groups and both audiences, before the practice view.
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

/** A pretest item answered and left (final): the option chosen, the item's position (1-based) and its time on screen (ms). */
export interface MapPretestAnswerDetail {
  readonly itemId: string;
  readonly choiceId: string;
  readonly position: number;
  readonly rtMs: number;
}

/** How the pretest ended: every item answered, or the cap. */
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
