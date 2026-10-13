import { describe, expect, it } from "vitest";
import { VirtualClock } from "../../app/engine/clock.js";
import { asVirtualTime } from "../../app/engine/primitives.js";

describe("VirtualClock", () => {
  it("starts at zero by default", () => {
    const clock = new VirtualClock();
    expect(clock.now()).toBe(0);
  });

  it("starts at a given VirtualTime", () => {
    const clock = new VirtualClock(asVirtualTime(1200));
    expect(clock.now()).toBe(1200);
  });

  it("rejects a negative start time", () => {
    expect(() => new VirtualClock(asVirtualTime(-1))).toThrow(RangeError);
  });

  it("advance() accumulates deltas monotonically", () => {
    const clock = new VirtualClock();
    clock.advance(10);
    clock.advance(5);
    expect(clock.now()).toBe(15);
  });

  it("advance() rejects negative deltas", () => {
    const clock = new VirtualClock();
    expect(() => clock.advance(-1)).toThrow(RangeError);
  });

  it("advance() rejects non-finite deltas", () => {
    const clock = new VirtualClock();
    expect(() => clock.advance(NaN)).toThrow(RangeError);
    expect(() => clock.advance(Infinity)).toThrow(RangeError);
  });

  it("advanceTo() jumps directly to an absolute time", () => {
    const clock = new VirtualClock();
    clock.advanceTo(asVirtualTime(1200));
    expect(clock.now()).toBe(1200);
  });

  it("advanceTo() rejects moving backward", () => {
    const clock = new VirtualClock(asVirtualTime(100));
    expect(() => clock.advanceTo(asVirtualTime(50))).toThrow(RangeError);
  });

  it("advance() throws while halted", () => {
    const clock = new VirtualClock();
    clock.halt();
    expect(() => clock.advance(1)).toThrow(/halted/);
  });

  it("advanceTo() throws while halted", () => {
    const clock = new VirtualClock();
    clock.halt();
    expect(() => clock.advanceTo(asVirtualTime(10))).toThrow(/halted/);
  });

  it("resume() allows advancing again", () => {
    const clock = new VirtualClock();
    clock.halt();
    clock.resume();
    clock.advance(5);
    expect(clock.now()).toBe(5);
  });

  it("is a pure function of the call sequence: identical calls, identical result", () => {
    const run = () => {
      const clock = new VirtualClock();
      clock.advance(30);
      clock.halt();
      clock.resume();
      clock.advance(70);
      clock.advanceTo(asVirtualTime(1200));
      return clock.now();
    };
    expect(run()).toBe(run());
  });
});
