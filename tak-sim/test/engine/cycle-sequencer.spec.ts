import { describe, expect, it } from "vitest";
import { VirtualClock } from "../../app/engine/clock.js";
import { CycleSequencer, CycleSequencerError, formatClockLabel, phaseOf } from "../../app/engine/cycle-sequencer.js";
import { FreezeMachine } from "../../app/engine/freeze-machine.js";
import type { CycleIndex } from "../../app/engine/primitives.js";
import { MAIN_VIEW_SCHEDULE, MAIN_VIEWS } from "../../app/scenario/views.js";

const S = MAIN_VIEW_SCHEDULE;

describe("view boundary arithmetic (SPEC/26 §3)", () => {
  it("fourteen views, the hinge after V7", () => {
    expect(S.count).toBe(14);
    expect(S.hingeAfter).toBe(7);
  });

  it("V1 starts at 0 (13:20) and V14 ends at the end of step 20", () => {
    expect(S.startOf(1)).toBe(0);
    expect(S.endOf(14)).toBe(20 * 1200);
  });

  it("a view ends one or two steps after it starts, as its step span says", () => {
    for (const v of MAIN_VIEWS) {
      const i = v.index as CycleIndex;
      expect(S.endOf(i) - S.startOf(i)).toBe(v.steps.length * 1200);
    }
  });

  it("endOf(n) === startOf(n+1) for every adjacent pair: steps are covered once, in order", () => {
    for (let i = 1; i < 14; i++) expect(S.endOf(i as CycleIndex)).toBe(S.startOf((i + 1) as CycleIndex));
  });

  it("merged views are never V7, V8, V9 or V13 (SPEC/26 §3)", () => {
    for (const i of [7, 8, 9, 13]) expect(S.endOf(i as CycleIndex) - S.startOf(i as CycleIndex)).toBe(1200);
  });

  it("there is no view 0 or 15 in the engine's schedule (the practice view runs in WARMUP)", () => {
    expect(() => S.endOf(15 as CycleIndex)).toThrow(RangeError);
    expect(() => S.startOf(0 as CycleIndex)).toThrow(RangeError);
  });
});

describe("phaseOf (SPEC/26 §3)", () => {
  it("V1-V7 are phase A", () => {
    for (let i = 1; i <= 7; i++) expect(phaseOf(S, i as CycleIndex)).toBe("A");
  });
  it("V8-V14 are phase B", () => {
    for (let i = 8; i <= 14; i++) expect(phaseOf(S, i as CycleIndex)).toBe("B");
  });
});

describe("formatClockLabel", () => {
  it("renders the start time with zero elapsed", () => {
    expect(formatClockLabel("13:20", 0 as never)).toBe("13:20");
  });

  it("adds elapsed virtual seconds, rounding down to the minute", () => {
    expect(formatClockLabel("13:20", 1200 as never)).toBe("13:40");
  });

  it("wraps past midnight", () => {
    expect(formatClockLabel("23:50", 1200 as never)).toBe("00:10");
  });

  it("rejects a malformed start time", () => {
    expect(() => formatClockLabel("1pm", 0 as never)).toThrow(RangeError);
  });
});

describe("CycleSequencer", () => {
  function make() {
    const clock = new VirtualClock();
    const freeze = new FreezeMachine("RUNNING");
    return { clock, freeze, seq: new CycleSequencer(clock, freeze, S) };
  }

  it("starts at view 1, phase A", () => {
    const { seq } = make();
    expect(seq.currentCycle()).toBe(1);
    expect(seq.currentPhase()).toBe("A");
  });

  it("endCycle() jumps the clock to the view's end and advances to the next view", () => {
    const { clock, seq } = make();
    seq.endCycle(); // V1, one step
    expect(clock.now()).toBe(1200);
    expect(seq.currentCycle()).toBe(2);
    seq.endCycle(); // V2, two steps (2+3)
    expect(clock.now()).toBe(3 * 1200);
    expect(seq.currentCycle()).toBe(3);
  });

  it("endCycle() requires the freeze machine to be RUNNING", () => {
    const clock = new VirtualClock();
    const freeze = new FreezeMachine("FREEZING");
    const seq = new CycleSequencer(clock, freeze, S);
    expect(() => seq.endCycle()).toThrow(CycleSequencerError);
  });

  it("V7's end enters HINGE_PAUSE rather than advancing directly to V8", () => {
    const { clock, freeze, seq } = make();
    for (let i = 0; i < 6; i++) seq.endCycle(); // V1..V6 end -> now at V7
    expect(seq.currentCycle()).toBe(7);
    seq.endCycle(); // V7 ends
    expect(freeze.current()).toBe("HINGE_PAUSE");
    expect(seq.currentCycle()).toBe(7); // not yet advanced
    expect(clock.now()).toBe(S.endOf(7));
    expect(clock.now()).toBe(10 * 1200); // 16:40, after step 10
  });

  it("dismissHinge() requires HINGE_PAUSE", () => {
    const { seq } = make();
    expect(() => seq.dismissHinge()).toThrow(CycleSequencerError);
  });

  it("dismissHinge() advances into V8 and returns the machine to RUNNING", () => {
    const { freeze, seq } = make();
    for (let i = 0; i < 7; i++) seq.endCycle(); // through V7 -> HINGE_PAUSE
    seq.dismissHinge();
    expect(freeze.current()).toBe("RUNNING");
    expect(seq.currentCycle()).toBe(8);
    expect(seq.currentPhase()).toBe("B");
  });

  it("V14's end enters DEBRIEF_HANDOFF and does not advance further", () => {
    const { clock, freeze, seq } = make();
    for (let i = 0; i < 7; i++) seq.endCycle(); // V1..V7
    seq.dismissHinge(); // -> V8
    for (let i = 0; i < 6; i++) seq.endCycle(); // V8..V13 end -> at V14
    expect(seq.currentCycle()).toBe(14);
    seq.endCycle(); // V14 ends
    expect(freeze.current()).toBe("DEBRIEF_HANDOFF");
    expect(clock.now()).toBe(20 * 1200);
  });

  it("the clock may already stand inside the view (a merged view's step boundary) when it ends", () => {
    const { clock, seq } = make();
    seq.endCycle(); // V1 -> V2 (steps 2+3)
    clock.advanceTo(S.startOf(2) + 1200 as never); // step 3 reached inside V2
    seq.endCycle();
    expect(clock.now()).toBe(3 * 1200);
  });

  it("is a pure function of the call sequence", () => {
    const run = () => {
      const { seq, clock } = make();
      for (let i = 0; i < 7; i++) seq.endCycle();
      seq.dismissHinge();
      seq.endCycle();
      return { cycle: seq.currentCycle(), t: clock.now() };
    };
    expect(run()).toEqual(run());
  });
});
