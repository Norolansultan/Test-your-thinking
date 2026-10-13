/**
 * Composes the virtual clock with the freeze state machine so that clock
 * halting is a direct, automatic consequence of state — SPEC/05
 * §4: "On FREEZING: halt the virtual clock ... On RESUMING: restore the
 * picture, flush buffered events with their original virtual timestamps,
 * resume the clock."
 *
 * {@link VirtualClock} and {@link FreezeMachine} are each independently
 * testable (and are), but neither one is allowed to know about the other —
 * `engine/` modules stay small and single-purpose. This is the one place
 * that wires them together, so "which states halt the clock" has exactly
 * one authority ({@link CLOCK_HALTED_STATES}) instead of being duplicated
 * or, worse, left to each caller to remember.
 */

import { CLOCK_HALTED_STATES, FreezeMachine, type EngineState, type StateTransitionEvent, type Trigger } from "./freeze-machine.js";
import { VirtualClock } from "./clock.js";
import { CycleSequencer, type CycleSchedule } from "./cycle-sequencer.js";

export class EngineRunLoop {
  readonly clock: VirtualClock;
  readonly freeze: FreezeMachine;
  readonly cycles: CycleSequencer;

  /** `schedule` is required (SPEC/26): the session's views, from `cycleScheduleOf(scenario)`. */
  constructor(schedule: CycleSchedule, clock: VirtualClock = new VirtualClock(), freeze: FreezeMachine = new FreezeMachine("BOOT")) {
    this.clock = clock;
    this.freeze = freeze;
    this.cycles = new CycleSequencer(clock, freeze, schedule);
    this.syncClockHaltState(freeze.current());
  }

  private syncClockHaltState(state: EngineState): void {
    const shouldHalt = CLOCK_HALTED_STATES.has(state);
    if (shouldHalt && !this.clock.isHalted()) {
      this.clock.halt();
    } else if (!shouldHalt && this.clock.isHalted()) {
      this.clock.resume();
    }
  }

  /** Applies a freeze-machine trigger and syncs the clock's halted state to the result. */
  transition(trigger: Trigger): StateTransitionEvent {
    const event = this.freeze.transition(trigger);
    this.syncClockHaltState(event.to);
    return event;
  }

  /** `cycle_end` via the wrapped {@link CycleSequencer}; syncs clock halt state afterward (the hinge view enters HINGE_PAUSE, the last view DEBRIEF_HANDOFF). */
  endCycle() {
    const result = this.cycles.endCycle();
    this.syncClockHaltState(this.freeze.current());
    return result;
  }

  /** `dismissHinge` via the wrapped {@link CycleSequencer}; syncs clock halt state afterward. */
  dismissHinge(): void {
    this.cycles.dismissHinge();
    this.syncClockHaltState(this.freeze.current());
  }
}
