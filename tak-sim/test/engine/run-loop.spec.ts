import { describe, expect, it } from "vitest";
import { EngineRunLoop } from "../../app/engine/run-loop.js";
import { MAIN_VIEW_SCHEDULE } from "../../app/scenario/views.js";

describe("EngineRunLoop — clock halting is a consequence of state (SPEC/05 §4)", () => {
  it("starts unhalted from BOOT", () => {
    const loop = new EngineRunLoop(MAIN_VIEW_SCHEDULE);
    expect(loop.clock.isHalted()).toBe(false);
  });

  it("halts the clock on entering FREEZING", () => {
    const loop = new EngineRunLoop(MAIN_VIEW_SCHEDULE);
    // Drive to RUNNING first.
    loop.transition("start");
    loop.transition("preflight_passed");
    loop.transition("briefing_complete");
    loop.transition("warmup_complete");
    loop.transition("tutorial_complete");
    expect(loop.clock.isHalted()).toBe(false);

    loop.transition("freeze");
    expect(loop.freeze.current()).toBe("FREEZING");
    expect(loop.clock.isHalted()).toBe(true);
    expect(() => loop.clock.advance(1)).toThrow(/halted/);
  });

  it("keeps the clock halted through both probing modes and RESUMING, then resumes on return to RUNNING", () => {
    const loop = new EngineRunLoop(MAIN_VIEW_SCHEDULE);
    for (const t of ["start", "preflight_passed", "briefing_complete", "warmup_complete", "tutorial_complete", "freeze"] as const) {
      loop.transition(t);
    }
    loop.transition("enter_probing_visible");
    expect(loop.clock.isHalted()).toBe(true);
    loop.transition("probe_complete"); // -> RESUMING
    expect(loop.clock.isHalted()).toBe(true);
    loop.transition("resumed"); // -> RUNNING
    expect(loop.clock.isHalted()).toBe(false);
    loop.clock.advance(5); // does not throw
    expect(loop.clock.now()).toBe(5);
  });

  it("does NOT halt the clock for PROBING_ONLINE (amendment 2026-09-17)", () => {
    const loop = new EngineRunLoop(MAIN_VIEW_SCHEDULE);
    for (const t of ["start", "preflight_passed", "briefing_complete", "warmup_complete", "tutorial_complete"] as const) {
      loop.transition(t);
    }
    loop.transition("online_probe");
    expect(loop.freeze.current()).toBe("PROBING_ONLINE");
    expect(loop.clock.isHalted()).toBe(false);
    loop.clock.advance(3); // does not throw — this is the point of PROBING_ONLINE
  });

  it("halts the clock during FAULT_PAUSED and resumes it on fault_resolved", () => {
    const loop = new EngineRunLoop(MAIN_VIEW_SCHEDULE);
    for (const t of ["start", "preflight_passed", "briefing_complete", "warmup_complete", "tutorial_complete"] as const) {
      loop.transition(t);
    }
    loop.transition("fault");
    expect(loop.freeze.current()).toBe("FAULT_PAUSED");
    expect(loop.clock.isHalted()).toBe(true);
    loop.transition("fault_resolved");
    expect(loop.clock.isHalted()).toBe(false);
  });

  it("halts the clock on entering HINGE_PAUSE directly from RUNNING", () => {
    const loop = new EngineRunLoop(MAIN_VIEW_SCHEDULE);
    for (const t of ["start", "preflight_passed", "briefing_complete", "warmup_complete", "tutorial_complete", "hinge_reached"] as const) {
      loop.transition(t);
    }
    expect(loop.freeze.current()).toBe("HINGE_PAUSE");
    expect(loop.clock.isHalted()).toBe(true);
  });

  it("endCycle() advances the clock (RUNNING throughout) and dismissHinge() keeps the halt/resume invariant intact", () => {
    const loop = new EngineRunLoop(MAIN_VIEW_SCHEDULE);
    for (const t of ["start", "preflight_passed", "briefing_complete", "warmup_complete", "tutorial_complete"] as const) {
      loop.transition(t);
    }
    for (let i = 0; i < 7; i++) loop.endCycle(); // V1-V7, hinge after V7 (SPEC/26 §3)
    expect(loop.freeze.current()).toBe("HINGE_PAUSE");
    expect(loop.clock.isHalted()).toBe(true);
    loop.dismissHinge();
    expect(loop.freeze.current()).toBe("RUNNING");
    expect(loop.clock.isHalted()).toBe(false);
    expect(loop.cycles.currentCycle()).toBe(8);
  });

  it("requires a schedule: there is no default twenty-cycle model (SPEC/26)", () => {
    // @ts-expect-error — the schedule argument is required
    expect(() => new EngineRunLoop()).toThrow();
  });

  it("is a pure function of the call sequence", () => {
    const run = () => {
      const loop = new EngineRunLoop(MAIN_VIEW_SCHEDULE);
      for (const t of ["start", "preflight_passed", "briefing_complete", "warmup_complete", "tutorial_complete"] as const) {
        loop.transition(t);
      }
      for (let i = 0; i < 7; i++) loop.endCycle();
      loop.dismissHinge();
      loop.endCycle();
      return { cycle: loop.cycles.currentCycle(), t: loop.clock.now(), halted: loop.clock.isHalted() };
    };
    expect(run()).toEqual(run());
  });
});
