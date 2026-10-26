/**
 * The session's map views — SPEC/26_Fifteen_Views_and_Rekindle.md §2–§3.
 *
 * A STEP is a 20-minute world-state interval: the old cycle number, used unchanged by the fire
 * model, the weather, the deployment timeline and the traffic corpus (SPEC/18, SPEC/24). A VIEW is
 * what the participant experiences as a cycle: one map state, one envelope, one decision phase.
 * A view covers one step, or two consecutive steps ("merge, don't skip", SPEC/26 D2); a merged
 * view's envelope projects to the end of its second step (40 minutes).
 *
 * Step numbers are integers on one axis: W1–W5 are steps −4…0 and the main steps are 1…20, so a
 * step starts at `(step − 1) × 1200` virtual seconds (0 = 13:20, the start of step 1; W5 = −1200).
 *
 * The practice view (SPEC/26 D3) is view index 0, `VP`, covering W2 (`PRACTICE_STEP`). It is not scored and its
 * flag is not checked. The main views are indices 1–14 (`V1`–`V14`), phase A = V1–V7, the hinge
 * after V7, phase B = V8–V14.
 */

import { asVirtualTime, type CycleIndex } from "../engine/primitives.js";
import { deriveSeed, Xorshift64Star } from "../engine/prng.js";
import type { CycleSchedule } from "../engine/cycle-sequencer.js";
import { CANONICAL_FLAG_SEQUENCE, type Flag, type Phase, type ScenarioContract } from "./types.js";

/** SPEC/26 §2: one world-state step is twenty minutes of virtual time. */
export const STEP_SECONDS = 1200;
/** SPEC/26 D3: the practice view's index. Main views are 1…MAIN_VIEW_COUNT. */
export const PRACTICE_VIEW_INDEX = 0;
/**
 * The practice view's step: W2 (12:00–12:20), a small fire just after the first crews arrived
 * (researcher decision 1 Oct 2026; it was W5, 13:00).
 */
export const PRACTICE_STEP = -3;
/** SPEC/26 D1: fourteen main views, seven per phase. */
export const MAIN_VIEW_COUNT = 14;
/** SPEC/26 §3: the hinge (strategic guidance) falls between V7 and V8. */
export const HINGE_AFTER_VIEW = 7;
/**
 * The view's timing (researcher decision 1 Oct 2026, superseding SPEC/26 §4's 90 s / 120 s locked
 * exploration phase): a view opens with the map, its messages and the projection; the decision
 * panel opens {@link DECISION_OPENS_AFTER_S} seconds in; the view lasts at least its minimum length
 * (fixed exposure for everyone) and ends at the later of that and the participant's confirmation.
 */
export const DECISION_OPENS_AFTER_S = 20;
/** The minimum length of a single-step view, in seconds. */
export const VIEW_MIN_SECONDS = 120;
/** The minimum length of a merged (two-step) view, in seconds (150 until 2 Oct 2026; shortened so minimum + freeze fits the cap). */
export const MERGED_VIEW_MIN_SECONDS = 130;
/**
 * The hard maximum of a view: 150 s of the view's own time (SPEC/15 revision (x), 6 Oct 2026: the
 * researcher's 2 min 30 s per view; 180 s from 2 Oct) — real time minus the time spent in a freeze or
 * a probe (SPEC/15 r.12: the simulation is paused then, so it does not count). The searches and the
 * plan fit in it. Not scaled by the preview override.
 */
export const VIEW_MAX_SECONDS = 150;
/**
 * The freeze's own cap, real seconds from the freeze being shown (fix pass 7, 9 Oct 2026, revision (ad); researcher's open item "partial
 * freeze answers accepted"). Every item stays required on the screen; at the cap the freeze closes with the items confirmed so far, every
 * other item logged as `missing` (not wrong) and the submission flagged `timedOut`. Not scaled by the preview override.
 */
export const FREEZE_MAX_SECONDS = 180;
/**
 * `31` §2.1 F12 (19 Oct 2026): the cap of a freeze of {@link LONG_FREEZE_ITEMS} items or more (the phase-A freezes' eight, SPEC/30
 * §5.1): ≈ 19 s per item (SPEC/15 (ax)) with the map items and the L3 items last needs more than 180 s for a slow reader, so a
 * timeout would drop H2's L3 items first. The order stays fixed (identical stimulus); timeouts by position are reported in pilot 2.
 */
export const FREEZE_MAX_SECONDS_LONG = 240;
export const LONG_FREEZE_ITEMS = 8;
/** The cap of a freeze with `items` items, real seconds from the freeze being shown. */
export function freezeMaxSecondsFor(items: number): number {
  return items >= LONG_FREEZE_ITEMS ? FREEZE_MAX_SECONDS_LONG : FREEZE_MAX_SECONDS;
}
export function viewMinSecondsFor(steps: number): number {
  return steps === 2 ? MERGED_VIEW_MIN_SECONDS : VIEW_MIN_SECONDS;
}

/** The window a SAGAT freeze may fall in: from 25 s into the view to 20 s before its minimum length. */
export const FREEZE_EARLIEST_S = 25;
export const FREEZE_LATEST_BEFORE_END_S = 20;
/**
 * In a merged view the freeze falls only after the second step has arrived (at half the minimum
 * length), with this clearance, so the SA items' answer keys are those of the view's last step and
 * the freeze never lands on the burst of second-step reports (review 2 Oct 2026; default pending
 * the researcher's confirmation, SPEC/11 §7.10).
 */
export const FREEZE_AFTER_BOUNDARY_S = 10;
/*
 * The practice view's freeze moment (`PRACTICE_FREEZE_AT_S`, 69 s after the tour since 11 Oct 2026) is retired with VP's practice freeze
 * by revision (bp), 26 Oct 2026 (SPEC/15 §bp.5): VP, the first look, has no freeze; its SPAM pair comes at 85 s as a freeze-less view's.
 */
/**
 * The practice view's length (researcher, 11 Oct 2026; was 120 s minimum, 150 s cap): at least 180 s, so
 * there is time to look at the situation and learn what the screen shows; its cap keeps the main views'
 * 30 s of grace after the minimum for confirming the plan.
 */
export const PRACTICE_VIEW_MIN_SECONDS = 180;
export const PRACTICE_VIEW_MAX_SECONDS = 210;
/** The [earliest, latest] whole seconds a view's freeze may fall at. */
export function freezeWindowFor(minViewSeconds: number, merged: boolean): readonly [number, number] {
  return [merged ? minViewSeconds / 2 + FREEZE_AFTER_BOUNDARY_S : FREEZE_EARLIEST_S, minViewSeconds - FREEZE_LATEST_BEFORE_END_S];
}
/**
 * The pre-planned moment of a view's freeze, in whole seconds into the view: uniform over
 * [{@link FREEZE_EARLIEST_S}, minimum length − {@link FREEZE_LATEST_BEFORE_END_S}], drawn once at
 * build time from the scenario seed and the view index (its own stream, so no other draw moves),
 * identical for every participant (the identical-stimulus rule). The freeze interrupts whatever
 * the participant is doing then — exploring or mid-decision (supersedes SPEC/15 §9's "before the
 * decision phase, never after a response").
 */
export function freezeOffsetSecondsFor(seed: bigint, viewIndex: number, minViewSeconds: number, merged = false): number {
  const [earliest, latest] = freezeWindowFor(minViewSeconds, merged);
  const rng = new Xorshift64Star(deriveSeed(seed, "freeze-offset", `view_${viewIndex}`));
  return earliest + rng.nextInt(latest - earliest + 1);
}
/**
 * SPEC/30 §5.1 (19 Oct 2026): the no-fit views whose freeze comes after the plan is final — at the view's end,
 * after the plan-confidence item, before the next view — so its items cannot point the participant at the
 * deciding front before the plan. The single source of truth: the scenario builder sets `freezeAtViewEnd` on
 * these views (no pre-planned moment, `freezeAtSeconds: null`) and the contract checks the property's shape.
 * Every other freeze view keeps its pre-planned random moment. `31` §3.8 (coa F10, 19 Oct 2026): V12 joins them — its items name
 * Lahdenkylä and would cue the aligned cell in a fit view (H14); F7's key records (steps 6–8) and H3's view (V13) are untouched. For
 * these freezes "now" is the view's end (V10 17.40, V12 19.00, V14 20.00), stated in the freeze's header.
 */
export const FREEZE_AT_VIEW_END: ReadonlySet<number> = new Set([10, 12, 14]);
/**
 * SPEC/30 §4: the consult notification's moment on the view's clock, every main view (never the practice
 * view). A view moment like the others, so a development preview scales it (`scaleViewSeconds`).
 */
export const CONSULT_PROMPT_AT_S = 60;
/**
 * `31` §2.1 F23 (19 Oct 2026): the least time between the consult notification and a freeze. When the view's freeze falls due
 * less than this after the notification's moment, the notification waits until the freeze has closed (as it does under an
 * open freeze), so nobody who opens it is cut off by the blanked screen a moment later. Deterministic: both moments are
 * fixed at build time, so the deferral is the same for every participant (identical stimulus).
 */
export const CONSULT_FREEZE_GAP_S = 15;
/** Whether the consult notification is held until after the view's freeze (both moments in unscaled view seconds; null: no moment). */
export function consultHeldForFreeze(consultAtSeconds: number | null, freezeAtSeconds: number | null): boolean {
  if (consultAtSeconds === null || freezeAtSeconds === null) return false;
  const gap = freezeAtSeconds - consultAtSeconds;
  return gap >= 0 && gap < CONSULT_FREEZE_GAP_S;
}
/**
 * SPEC/30 §5.2: a view's second SPAM item (V3, V6) is a probe of its own, shown after the first under the same
 * "ready"; its id is the first item's with `.b` (`probe.s.cycle_3` → `probe.s.cycle_3.b`), its key the invariant
 * `<first item's invariant>.b`. The one convention the scenario builder and the session share.
 */
export const SECOND_SPAM_SUFFIX = ".b";
export function secondSpamProbeId(firstProbeId: string): string {
  return `${firstProbeId}${SECOND_SPAM_SUFFIX}`;
}
/** The first main step and the last one (SPEC/26 §3: the main views cover steps 1–20). */
export const FIRST_MAIN_STEP = 1;
export const LAST_MAIN_STEP = 20;

export interface SessionView {
  readonly index: number; // 0 = VP, 1–14 = V1–V14
  readonly id: string; // "VP", "V1".."V14"
  readonly steps: readonly number[]; // one or two consecutive step numbers
  readonly practice: boolean;
  readonly phase: Phase | null; // null for the practice view
  /** SPEC/26 §3's flag; null for the practice view (not scored, not checked). */
  readonly flag: Flag | null;
}

/** SPEC/26 §3, the "Steps" column, main views V1–V14. */
const MAIN_VIEW_STEPS: readonly (readonly number[])[] = [
  [1], [2, 3], [4], [5, 6], [7], [8, 9], [10], // phase A
  [11], [12], [13], [14, 15], [16, 17], [18], [19, 20], // phase B
];

export const SESSION_VIEWS: readonly SessionView[] = [
  { index: PRACTICE_VIEW_INDEX, id: "VP", steps: [PRACTICE_STEP], practice: true, phase: null, flag: null },
  ...MAIN_VIEW_STEPS.map((steps, i) => ({
    index: i + 1,
    id: `V${i + 1}`,
    steps,
    practice: false,
    phase: (i + 1 <= HINGE_AFTER_VIEW ? "A" : "B") as Phase,
    flag: CANONICAL_FLAG_SEQUENCE[i]!,
  })),
];

export const MAIN_VIEWS: readonly SessionView[] = SESSION_VIEWS.filter((v) => !v.practice);

/** "W5" for step 0, "W1" for step −4, "7" for step 7 — the forcing and CA ids (SPEC/18 §6–§7). */
export function stepId(step: number): string {
  return step <= 0 ? `W${step + 5}` : String(step);
}

/** Inverse of {@link stepId}. */
export function stepNumber(id: string): number {
  return id.startsWith("W") ? Number(id.slice(1)) - 5 : Number(id);
}

export function stepStartVirtual(step: number): number {
  return (step - 1) * STEP_SECONDS;
}

/** The view a step is shown in, or null for prologue steps W1–W4 (history, SPEC/26 §6). */
export function viewOfStep(step: number): SessionView | null {
  return SESSION_VIEWS.find((v) => v.steps.includes(step)) ?? null;
}

export function viewStartVirtual(view: Pick<SessionView, "steps">): number {
  return stepStartVirtual(view.steps[0]!);
}

/** The end of the view's last step: its envelope's horizon. */
export function viewEndVirtual(view: Pick<SessionView, "steps">): number {
  return stepStartVirtual(view.steps[view.steps.length - 1]!) + STEP_SECONDS;
}

/** The engine's cycle schedule for a scenario's views (SPEC/26 §3): count, hinge, and each view's start and end. */
export function cycleScheduleOf(scenario: Pick<ScenarioContract, "cycles" | "hinge">): CycleSchedule {
  const viewOf = (index: CycleIndex) => {
    const view = scenario.cycles.find((c) => c.index === index);
    if (!view) throw new RangeError(`the scenario has no view ${index}`);
    return view;
  };
  return {
    count: scenario.cycles.length,
    hingeAfter: scenario.hinge.afterCycle as CycleIndex,
    startOf: (index) => viewOf(index).startsAtVirtual,
    endOf: (index) => {
      const view = viewOf(index);
      return asVirtualTime(view.startsAtVirtual + view.steps * STEP_SECONDS);
    },
  };
}

/**
 * The same schedule straight from SPEC/26 §3's table ({@link MAIN_VIEWS}), for code that runs the
 * engine without a scenario (the engine tests and the golden determinism harness). A session
 * always uses {@link cycleScheduleOf} on its scenario.
 */
export const MAIN_VIEW_SCHEDULE: CycleSchedule = {
  count: MAIN_VIEW_COUNT,
  hingeAfter: HINGE_AFTER_VIEW as CycleIndex,
  startOf: (index) => asVirtualTime(viewStartVirtual(mainView(index))),
  endOf: (index) => asVirtualTime(viewEndVirtual(mainView(index))),
};

function mainView(index: number): SessionView {
  const view = MAIN_VIEWS.find((v) => v.index === index);
  if (!view) throw new RangeError(`there is no main view ${index}`);
  return view;
}

/**
 * SPEC/26 §3: the label a view is shown under — "Ensikatsaus" for the practice view (revision (bp), 26 Oct 2026: VP is the first look;
 * "Harjoitus" names the training incident), "Jakso n / 14" otherwise.
 */
export function viewLabelFi(index: number): string {
  return index === PRACTICE_VIEW_INDEX ? "Ensikatsaus" : `Jakso ${index} / ${MAIN_VIEW_COUNT}`;
}
