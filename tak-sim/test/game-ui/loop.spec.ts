/**
 * Game mode screen (SPEC/29 §3): the loop driver's accumulator — rAF timestamps → real dt (clamped) × speed → at most
 * N `game.tick` calls per frame.
 */

import { describe, expect, it } from "vitest";
import { frameTicks, MAX_REAL_DT_S, MAX_TICK_CALLS, MAX_TICK_S, SPEEDS, speedByKey, togglePause } from "../../app/game/ui/loop.js";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe("frameTicks", () => {
  it("the first frame after a start or resume only sets the reference", () => {
    expect(frameTicks(null, 1000, 60)).toEqual({ lastMs: 1000, calls: [], droppedS: 0 });
  });

  it("paused: no game time, the reference follows the frames", () => {
    expect(frameTicks(1000, 1016, 0)).toEqual({ lastMs: 1016, calls: [], droppedS: 0 });
  });

  it("advances real dt × speed in one call when it fits in one tick", () => {
    const r = frameTicks(1000, 1016, 1);
    expect(r.lastMs).toBe(1016);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]).toBeCloseTo(0.016, 9);
    const fast = frameTicks(1000, 1100, 60); // 0.1 s × 60 = 6 game s
    expect(fast.calls).toHaveLength(1);
    expect(fast.calls[0]).toBeCloseTo(6, 9);
  });

  it("splits a long frame into equal calls no longer than one tick", () => {
    const r = frameTicks(0, 250, 60); // 0.25 s × 60 = 15 s → 2 × 7.5
    expect(r.calls).toHaveLength(2);
    for (const c of r.calls) expect(c).toBeLessThanOrEqual(MAX_TICK_S + 1e-9);
    expect(sum(r.calls)).toBeCloseTo(15, 9);
    expect(r.droppedS).toBe(0);
  });

  it("clamps the real gap (a backgrounded tab resumes, it does not leap)", () => {
    const r = frameTicks(0, 60_000, 15);
    expect(sum(r.calls)).toBeCloseTo(MAX_REAL_DT_S * 15, 9);
  });

  it("never asks for more than the call cap; the rest is dropped and reported", () => {
    const r = frameTicks(0, 250, 1000, 2, 10); // wants 250 game s, cap 2 × 10
    expect(r.calls).toEqual([10, 10]);
    expect(r.droppedS).toBeCloseTo(230, 9);
    const def = frameTicks(0, 250, 600);
    expect(def.calls.length).toBeLessThanOrEqual(MAX_TICK_CALLS);
    expect(sum(def.calls)).toBeCloseTo(MAX_TICK_CALLS * MAX_TICK_S, 9);
  });

  it("a clock running backwards (or a repeated timestamp) advances nothing", () => {
    expect(frameTicks(2000, 1000, 60).calls).toEqual([]);
    expect(frameTicks(2000, 2000, 60).calls).toEqual([]);
  });

  it("over many frames the game time is real time × speed (no drift)", () => {
    let prev: number | null = null;
    let game = 0;
    for (let ms = 0; ms <= 10_000; ms += 1000 / 60) {
      const r = frameTicks(prev, ms, 15);
      prev = r.lastMs;
      game += sum(r.calls);
    }
    expect(game).toBeCloseTo(15 * 10, 0);
  });
});

describe("speed controls", () => {
  it("offers pause, 1×, 5×, 15× and 60×", () => {
    expect([...SPEEDS]).toEqual([0, 1, 5, 15, 60]);
  });
  it("keys 1–4 pick 1×, 5×, 15×, 60×; other keys nothing", () => {
    expect(["1", "2", "3", "4"].map(speedByKey)).toEqual([1, 5, 15, 60]);
    expect(speedByKey("5")).toBeNull();
    expect(speedByKey(" ")).toBeNull();
  });
  it("Space pauses, and resumes at the speed before the pause", () => {
    expect(togglePause(15, 15)).toBe(0);
    expect(togglePause(0, 15)).toBe(15);
    expect(togglePause(0, 0)).toBe(1);
  });
});
