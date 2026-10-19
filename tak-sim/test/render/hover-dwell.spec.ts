/**
 * The hover records' dwell (SPEC/30 §5.4; `hover-dwell.ts`): an option counts as hovered once the pointer has rested on it
 * for 150 ms, once per entry; a sweep across options logs nothing; leaving and coming back counts again. Timers only.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOVER_DWELL_MS, HoverDwell } from "../../app/render/ui/components/hover-dwell.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the hover dwell (SPEC/30 §5.4)", () => {
  it("is ~150 ms", () => {
    expect(HOVER_DWELL_MS).toBe(150);
  });

  it("logs an option once its dwell is reached, once per entry", () => {
    const logged: string[] = [];
    const d = new HoverDwell((id) => logged.push(id));
    d.enter("posture:direct_attack");
    vi.advanceTimersByTime(149);
    expect(logged).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(logged).toEqual(["posture:direct_attack"]);
    vi.advanceTimersByTime(5_000); // resting on: still once
    expect(logged).toEqual(["posture:direct_attack"]);
    d.leave("posture:direct_attack");
    d.enter("posture:direct_attack"); // back again: a new entry
    vi.advanceTimersByTime(150);
    expect(logged).toEqual(["posture:direct_attack", "posture:direct_attack"]);
  });

  it("a sweep across options logs nothing; only the one rested on counts", () => {
    const logged: string[] = [];
    const d = new HoverDwell((id) => logged.push(id));
    for (const id of ["a", "b", "c"]) { d.enter(id); vi.advanceTimersByTime(60); d.leave(id); }
    d.enter("d");
    vi.advanceTimersByTime(100);
    d.enter("e"); // entered without a leave first (a re-render): the earlier entry ends
    vi.advanceTimersByTime(150);
    expect(logged).toEqual(["e"]);
  });

  it("a leave for another option does not cancel the current entry; a bare leave does", () => {
    const logged: string[] = [];
    const d = new HoverDwell((id) => logged.push(id));
    d.enter("a");
    d.leave("b");
    vi.advanceTimersByTime(150);
    expect(logged).toEqual(["a"]);
    d.enter("c");
    d.leave();
    vi.advanceTimersByTime(500);
    expect(logged).toEqual(["a"]);
  });

  it("runs on injected timers too (no clock read)", () => {
    const fired: (() => void)[] = [];
    const logged: string[] = [];
    const d = new HoverDwell((id) => logged.push(id), { set: (fire) => { fired.push(fire); return fired.length; }, clear: () => undefined }, 10);
    d.enter("x");
    fired[0]!();
    expect(logged).toEqual(["x"]);
  });
});
