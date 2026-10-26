/**
 * The guided tour (researcher decision 2 Oct 2026, SPEC/15 r.11): popups that point at the parts
 * of the screen and say what is found where. VP opens with the full tour. Revision (am), 10 Oct 2026
 * (researcher: "In the training there should be the Thinker training if the Thinker exists for the
 * user"): in the Thinker cells the practice tour has one more step, `practiceThinker`, after Haku — it
 * opens the Thinker tab, says what Thinker is for, offers one pre-filled example question to send with a
 * click and lets the participant ask their own; the tour goes on once one question has been answered.
 * Revision (bl), 25 Oct 2026 (researcher): Haku has a second step, `hakuRecords`, right after it (what the
 * records hold and how to ask for it); the Thinker step now follows both Haku steps.
 * Revision (bp), 26 Oct 2026 (SPEC/15 §bp.5): VP is the first look ("Ensikatsaus"); the training incident before it teaches the tools,
 * so the welcome, log, Haku, records, memory-check, SPAM and ready steps refer back to it (the records step quotes no example and no VP
 * record) and say that the first look has no memory check. The step list and its order are unchanged (17 steps, 18 in the Thinker cells).
 * The radio cell's practice tour is unchanged and names no AI tool. V1 opens with the tool reminder:
 * Haku in both groups and, in the AI group, a short Thinker step (it was practised in VP, so its text
 * is not repeated). The view's time waits until each is finished.
 *
 * A step points at the element marked `data-tour="<target>"` (or at the first element matching a
 * CSS selector); a step whose target is missing, or has none, is shown in the middle of the
 * screen. The texts are in `ui.ts` (`tour`), one per step id, in both languages.
 */

import type { TourId } from "../../session/snapshot.js";
import type { Cell } from "../../scenario/types.js";

export type TourStepId =
  | "welcome" | "status" | "fire" | "projection" | "legend" | "wind" | "zoom" | "measure" | "sectors" | "units" | "log" | "haku" | "hakuRecords" | "decision" | "freeze" | "spam" | "ready"
  | "practiceThinker"
  | "toolsHaku" | "toolsThinker" | "toolsThinkerIntent";

export type Placement = "right" | "left" | "top" | "bottom";

export interface TourStep {
  readonly id: TourStepId;
  /** A CSS selector for the element the popup points at; null: the middle of the screen. */
  readonly target: string | null;
  readonly placement?: Placement;
  /**
   * Revision (am): an interactive step. `thinkerPractice` opens the Thinker tab ({@link TOUR_OPEN_TOOL_EVENT}),
   * leaves the ringed chat usable (the rest of the screen still takes no clicks), offers the example
   * question and goes on only once one question has been answered.
   */
  readonly interactive?: "thinkerPractice";
}

/** Revision (am): the window event the tour sends to open a right-panel tool (`detail`: "ai"); `RightPanel` listens. */
export const TOUR_OPEN_TOOL_EVENT = "tour-open-tool";

const at = (name: string) => `[data-tour="${name}"]`;

/** The practice tour's common steps, in order (the radio cell's whole practice tour; {@link practiceTour}). */
export const PRACTICE_TOUR: readonly TourStep[] = [
  { id: "welcome", target: null },
  { id: "status", target: at("status"), placement: "bottom" },
  { id: "fire", target: at("fire"), placement: "right" },
  { id: "projection", target: at("projection"), placement: "right" },
  { id: "legend", target: at("legend"), placement: "right" },
  { id: "wind", target: at("wind"), placement: "right" },
  { id: "zoom", target: at("zoom"), placement: "bottom" },
  // Difficulty audit (23 Oct 2026, `proposal-map.md` d5): the measure tool, the TAK shell's R&B button (the classic layout has none:
  // there the step shows in the middle of the screen).
  { id: "measure", target: '[data-testid="tak-tool-range_bearing"]', placement: "left" },
  // Revision (al), 10 Oct 2026: the four sectors by their terrain (`briefing.ts` SECTORS_*), in the middle of the screen.
  { id: "sectors", target: null },
  // Revision (al), map-overlay: folded markers are display:none inside a stack badge, so the first visible marker or badge.
  { id: "units", target: '.unit-marker:not([style*="display: none"]), .unit-stack', placement: "right" },
  { id: "log", target: at("log"), placement: "left" },
  { id: "haku", target: at("haku"), placement: "left" },
  // Revision (bl), 25 Oct 2026: what the records hold and how to ask for them, at the Haku pane. It teaches how to ask and never that
  // one must: nothing on the memory checks or on scores. Revision (bp): it refers back to the training incident and quotes no example.
  { id: "hakuRecords", target: at("haku"), placement: "left" },
  { id: "decision", target: at("decision"), placement: "top" },
  { id: "freeze", target: null },
  // The situation question (SPAM, 5 Oct 2026; revision (ag)): the ready prompt that waits (and is forced before the period ends),
  // the tools usable while answering; VP has one to try (`practice-spam.ts`).
  { id: "spam", target: null },
  { id: "ready", target: null },
];

/** Revision (am): the Thinker practice step, pointing at the Thinker chat (`RightPanel`, `data-tour="thinker-chat"`). */
export const PRACTICE_THINKER_STEP: TourStep = { id: "practiceThinker", target: at("thinker-chat"), placement: "left", interactive: "thinkerPractice" };

/**
 * Revision (am): the practice tour of a condition — the common steps, and in the AI group (both Thinker
 * cells, the same step and text) the Thinker practice right after Haku's two steps (revision (bl): after `hakuRecords`, so that
 * the Haku steps stay together). Identical within a cell.
 */
export function practiceTour(condition: "directed" | "substitutive"): readonly TourStep[] {
  if (condition !== "substitutive") return PRACTICE_TOUR;
  const i = PRACTICE_TOUR.findIndex((s) => s.id === "hakuRecords") + 1;
  return [...PRACTICE_TOUR.slice(0, i), PRACTICE_THINKER_STEP, ...PRACTICE_TOUR.slice(i)];
}

/**
 * V1's tool reminder: Haku for everyone; Thinker too in the AI group. Revision (al), 10 Oct 2026: the
 * Thinker step says truthfully what that cell's Thinker holds — `toolsThinkerIntent` in the
 * `reasoning_intent` cell (it also holds P2's orders as issued), `toolsThinker` otherwise (the same
 * information as Search). Revision (am): both are short — the participant practised Thinker in VP (the
 * practice tour always runs before this one), so what Thinker is for is not repeated.
 */
export function toolsTour(condition: "directed" | "substitutive", cell?: Cell): readonly TourStep[] {
  const thinker: TourStepId = cell === "reasoning_intent" ? "toolsThinkerIntent" : "toolsThinker";
  return condition === "substitutive"
    ? [{ id: "toolsHaku", target: at("haku"), placement: "left" }, { id: thinker, target: at("thinker"), placement: "left" }]
    : [{ id: "toolsHaku", target: at("haku"), placement: "left" }];
}

export function tourSteps(tour: TourId, condition: "directed" | "substitutive", cell?: Cell): readonly TourStep[] {
  return tour === "practice" ? practiceTour(condition) : toolsTour(condition, cell);
}

/** The data-tour names the steps point at, for the source check (`test/render/tour.spec.ts`). */
export const TOUR_TARGET_NAMES = ["status", "fire", "projection", "legend", "wind", "zoom", "log", "haku", "decision", "thinker", "thinker-chat"] as const;

/**
 * Revision (am): the step on screen, announced as a window event so that parts of the screen a step is about can show
 * themselves for it — the legend starts collapsed and opens while the tour's "legend" step is shown (identical for
 * everyone; not a participant action, so not logged as `layer_toggled`). `null`: no step (the tour ended).
 */
export const TOUR_STEP_EVENT = "tour-step";
export function announceTourStep(id: TourStepId | null): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<TourStepId | null>(TOUR_STEP_EVENT, { detail: id }));
}
