/**
 * The cycle-to-cycle driver: jumps the virtual clock to each view's end and routes the hinge
 * view's end through `HINGE_PAUSE`.
 *
 * SPEC/26 (revision (p)) and SPEC/05 revision (p): the run loop drives fourteen main VIEWS of one
 * or two 20-minute world-state steps each, with the hinge after V7. How many views there are,
 * which one the hinge follows and where each starts and ends is a {@link CycleSchedule}, built from
 * the scenario by `app/scenario/views.ts` `cycleScheduleOf(scenario)`. There is deliberately no
 * default schedule: the old fixed twenty-cycle model (`CYCLE_COUNT = 20`, hinge after cycle 10,
 * `(index-1) x 1200` boundaries) is removed, so nothing can silently run it.
 *
 * The practice view (VP, SPEC/26 D3) is not a cycle of this sequencer: it runs in the `WARMUP`
 * state (SPEC/05 §4 revision (o)), before the main timeline's virtual 0 (13:20), and the clock
 * never goes negative (`VirtualClock`).
 */

import { FreezeMachine } from "./freeze-machine.js";
import type { CycleIndex, Phase, VirtualTime } from "./primitives.js";
import { VirtualClock } from "./clock.js";

/** How many views the session has, which one the hinge follows, and where each starts and ends. */
export interface CycleSchedule {
  readonly count: number;
  readonly hingeAfter: CycleIndex;
  readonly startOf: (index: CycleIndex) => VirtualTime;
  readonly endOf: (index: CycleIndex) => VirtualTime;
}

/** SPEC/26 §3: phase A is the views up to and including the hinge view (V1-V7), phase B the rest. */
export function phaseOf(schedule: Pick<CycleSchedule, "hingeAfter">, index: CycleIndex): Phase {
  return index <= schedule.hingeAfter ? "A" : "B";
}

/**
 * Renders the on-screen clock label ("14:35") for a given amount of
 * elapsed virtual time, given the scenario's `startVirtualClock` ("HH:MM").
 * Pure function of its inputs — reads no wall clock (invariant I2).
 */
export function formatClockLabel(startVirtualClock: string, elapsed: VirtualTime): string {
  const match = /^(\d{2}):(\d{2})$/.exec(startVirtualClock);
  if (!match) {
    throw new RangeError(`startVirtualClock must be "HH:MM", got "${startVirtualClock}"`);
  }
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const elapsedMinutes = Math.floor(elapsed / 60);
  const totalMinutes = ((startMinutes + elapsedMinutes) % 1440 + 1440) % 1440;
  const hh = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const mm = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export class CycleSequencerError extends Error {}

/**
 * Drives a {@link VirtualClock} and {@link FreezeMachine} together across
 * the scheduled views: jumping the clock at `cycle_end`, and routing the
 * hinge view's end through `HINGE_PAUSE` (SPEC/05 §4) before the next view begins.
 */
export class CycleSequencer {
  private cycle: CycleIndex = 1;

  constructor(
    private readonly clock: VirtualClock,
    private readonly freeze: FreezeMachine,
    private readonly schedule: CycleSchedule,
  ) {
    // Guards untyped callers too: without a schedule there is no session to run (no default model).
    if (!schedule) throw new CycleSequencerError("CycleSequencer needs the session's CycleSchedule (SPEC/26: cycleScheduleOf(scenario))");
  }

  currentCycle(): CycleIndex {
    return this.cycle;
  }

  currentPhase(): Phase {
    return phaseOf(this.schedule, this.cycle);
  }

  /**
   * `cycle_end` (SPEC/03 §2.2): jumps the virtual clock to the view's end and,
   * for the hinge view (V7), enters `HINGE_PAUSE` instead of advancing directly — the
   * five-minute pause is dismissed explicitly via {@link dismissHinge}.
   * For the last view (V14), enters `DEBRIEF_HANDOFF` and does not advance further.
   * Must be called with the freeze machine in `RUNNING` — cycle_end only
   * happens once every probe for the cycle has resolved back to RUNNING.
   */
  endCycle(): VirtualTime {
    if (this.freeze.current() !== "RUNNING") {
      throw new CycleSequencerError(
        `endCycle() requires the freeze machine to be RUNNING, was ${this.freeze.current()}`,
      );
    }
    // No halt/resume juggling here: RUNNING is never a clock-halted state
    // (SPEC/05 §4), so if the freeze machine reports RUNNING the clock is
    // already resumed by construction (see EngineRunLoop, which is the
    // sole place that syncs clock halt state to freeze state). If it is
    // not, that is a bug upstream and advanceTo() below will surface it.
    const boundary = this.schedule.endOf(this.cycle);
    this.clock.advanceTo(boundary);

    if (this.cycle === this.schedule.hingeAfter) {
      this.freeze.transition("hinge_reached");
      return this.clock.now();
    }
    if (this.cycle === this.schedule.count) {
      this.freeze.transition("session_complete");
      return this.clock.now();
    }
    this.cycle = (this.cycle + 1) as CycleIndex;
    return this.clock.now();
  }

  /**
   * Dismisses `HINGE_PAUSE` (participant-dismissible early, SPEC/05 §4) and
   * advances into the first phase-B view (V8).
   */
  dismissHinge(): void {
    if (this.freeze.current() !== "HINGE_PAUSE") {
      throw new CycleSequencerError(`dismissHinge() requires HINGE_PAUSE, was ${this.freeze.current()}`);
    }
    this.freeze.transition("hinge_dismissed");
    this.cycle = (this.cycle + 1) as CycleIndex;
  }
}
