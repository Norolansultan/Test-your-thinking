/**
 * The virtual clock — invariant I2 (SPEC/00_README.md §3).
 *
 * "Virtual time is the only time any decision, schedule or transition
 * reads. Wall-clock appears in the log solely as the annotation field
 * `tWallOffsetMs`."
 *
 * This class therefore never reads `Date.now()`, `performance.now()`, or
 * any other wall-clock source. It advances only in response to explicit
 * calls, so the caller (the cycle sequencer / freeze machine) fully
 * controls pacing and the resulting sequence of VirtualTime values is a
 * pure function of the calls made to it.
 */

import { asVirtualTime, type VirtualTime } from "./primitives.js";

export class VirtualClock {
  private t: VirtualTime;
  private halted = false;

  constructor(startAt: VirtualTime = asVirtualTime(0)) {
    if (startAt < 0) {
      throw new RangeError(`VirtualClock cannot start negative: ${startAt}`);
    }
    this.t = startAt;
  }

  now(): VirtualTime {
    return this.t;
  }

  isHalted(): boolean {
    return this.halted;
  }

  /** Halts the clock. Advancing while halted throws — callers must resume first. */
  halt(): void {
    this.halted = true;
  }

  resume(): void {
    this.halted = false;
  }

  /**
   * Advances the clock by a non-negative number of virtual seconds.
   * Throws if the clock is halted or the delta is negative — time never
   * moves backward and never advances silently while frozen.
   */
  advance(deltaSeconds: number): VirtualTime {
    if (this.halted) {
      throw new Error("VirtualClock.advance called while halted");
    }
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError(`VirtualClock.advance requires a non-negative finite delta, got ${deltaSeconds}`);
    }
    this.t = asVirtualTime(this.t + deltaSeconds);
    return this.t;
  }

  /**
   * Jumps directly to an absolute virtual time, e.g. a cycle boundary.
   * Throws on any attempt to move backward — that would be non-monotonic
   * and would corrupt latency computations that assume `tVirtual` only
   * increases.
   */
  advanceTo(target: VirtualTime): VirtualTime {
    if (this.halted) {
      throw new Error("VirtualClock.advanceTo called while halted");
    }
    if (target < this.t) {
      throw new RangeError(`VirtualClock.advanceTo cannot move backward: ${this.t} -> ${target}`);
    }
    this.t = target;
    return this.t;
  }
}
