/**
 * `pointer_track` (SPEC/30 §5.4): the sampling rule (at most 5 Hz while moving, a trailing sample where the pointer rests,
 * no tremor), when it runs (main views only, never in a freeze, the tour or outside a view), and the window listener
 * (mouse and pen only, the event's own timestamp). No DOM: a fake window and a manual scheduler.
 */

import { describe, expect, it } from "vitest";
import { POINTER_MIN_MOVE_PX, POINTER_SAMPLE_INTERVAL_MS, PointerSampler, pointerTrackView, trackPointer, type Schedule } from "../../app/render/ui/pointer-tracker.js";
import type { PointerTrackDetail } from "../../app/telemetry/record-kinds.js";
import type { SessionSnapshot } from "../../app/session/orchestrator.js";

/** A scheduler the test runs by hand. */
function manualSchedule() {
  const tasks: { fn: () => void; ms: number; cancelled: boolean }[] = [];
  const schedule: Schedule = (fn, ms) => { const t = { fn, ms, cancelled: false }; tasks.push(t); return () => { t.cancelled = true; }; };
  const runAll = () => { for (const t of tasks.splice(0)) if (!t.cancelled) t.fn(); };
  return { schedule, tasks, runAll };
}

function sampler() {
  const out: PointerTrackDetail[] = [];
  const clock = manualSchedule();
  return { s: new PointerSampler((d) => out.push(d), clock.schedule), out, clock };
}

const VP: readonly [number, number] = [1440, 900];
type Snap = Pick<SessionSnapshot, "step" | "currentCycle" | "tour">;
const snap = (step: Snap["step"], currentCycle: Snap["currentCycle"], tour: Snap["tour"] = null): Snap => ({ step, currentCycle, tour });

describe("when the pointer is sampled", () => {
  it("in a main view's steps, its probes included; never in VP, a freeze, the tour or outside a view", () => {
    expect(pointerTrackView(snap("exploration", 3))).toBe(3);
    expect(pointerTrackView(snap("allocation", 14))).toBe(14);
    expect(pointerTrackView(snap("probe", 13))).toBe(13);
    expect(pointerTrackView(snap("awaiting_view_end", 9))).toBe(9);
    expect(pointerTrackView(snap("exploration", 0))).toBeNull();
    expect(pointerTrackView(snap("freeze", 4))).toBeNull();
    expect(pointerTrackView(snap("exploration", 1, "tools"))).toBeNull();
    for (const step of ["hinge_pause", "training", "briefing", "complete", "questionnaire", "debrief", "consent"] as const) expect(pointerTrackView(snap(step, 7))).toBeNull();
    expect(pointerTrackView(null)).toBeNull();
  });
});

describe("PointerSampler", () => {
  it("samples the first move, then at most one per 200 ms (5 Hz), with the view and the window size", () => {
    const { s, out } = sampler();
    s.setView(2);
    s.move(100.4, 200.6, 1000, VP);
    s.move(150, 200, 1100, VP); // held back
    s.move(200, 200, 1200, VP); // 200 ms after the first: sampled
    expect(POINTER_SAMPLE_INTERVAL_MS).toBe(200);
    expect(out).toEqual([
      { x: 100, y: 201, cycle: 2, viewportPx: [1440, 900] },
      { x: 200, y: 200, cycle: 2, viewportPx: [1440, 900] },
    ]);
  });

  it("writes a trailing sample where the pointer rests after a held-back move", () => {
    const { s, out, clock } = sampler();
    s.setView(5);
    s.move(10, 10, 0, VP);
    s.move(40, 10, 50, VP);
    s.move(80, 10, 120, VP);
    expect(out).toHaveLength(1);
    expect(clock.tasks).toHaveLength(1); // one trailing timer, however many moves are held
    expect(clock.tasks[0]!.ms).toBe(150); // due 200 ms after the last sample
    clock.runAll();
    expect(out.map((d) => d.x)).toEqual([10, 80]);
    s.move(90, 10, 260, VP); // 60 ms after the trailing sample (due at 200): held
    expect(out).toHaveLength(2);
  });

  it("ignores tremor: a move under the minimum distance from the last sample is not sampled", () => {
    const { s, out, clock } = sampler();
    s.setView(1);
    s.move(100, 100, 0, VP);
    s.move(101, 101, 500, VP);
    s.move(102, 100, 900, VP);
    clock.runAll();
    expect(out).toHaveLength(1);
    s.move(100 + POINTER_MIN_MOVE_PX, 100, 1200, VP);
    expect(out).toHaveLength(2);
  });

  it("writes nothing while off, and a held-back sample with its own view when the view changes", () => {
    const { s, out, clock } = sampler();
    s.move(1, 1, 0, VP);
    expect(out).toEqual([]);
    s.setView(6);
    s.move(10, 10, 0, VP);
    s.move(50, 10, 100, VP); // held
    s.setView(null); // the freeze starts
    expect(out.map((d) => [d.x, d.cycle])).toEqual([[10, 6], [50, 6]]);
    clock.runAll(); // the cancelled timer writes nothing
    s.move(300, 300, 400, VP);
    expect(out).toHaveLength(2);
  });

  it("keeps a session's volume modest: continuous movement at 60 Hz for 150 s gives at most 5 samples a second", () => {
    const { s, out } = sampler();
    s.setView(8);
    for (let i = 0; i < 150 * 60; i++) s.move((i * 7) % 1400, (i * 3) % 880, i * (1000 / 60), VP);
    expect(out.length).toBeLessThanOrEqual(150 * 5 + 1);
    expect(out.length).toBeGreaterThan(150 * 4);
  });
});

describe("trackPointer", () => {
  it("feeds mouse and pen moves with the event's own timestamp, ignores touch, and detaches", () => {
    const listeners = new Map<string, (e: PointerEvent) => void>();
    const win = {
      innerWidth: 1280, innerHeight: 720,
      addEventListener: (type: string, fn: (e: PointerEvent) => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    } as unknown as Window;
    const { s, out } = sampler();
    s.setView(4);
    const detach = trackPointer(win, s);
    const move = (pointerType: string, clientX: number, timeStamp: number) => listeners.get("pointermove")!({ pointerType, clientX, clientY: 50, timeStamp } as PointerEvent);
    move("touch", 10, 0);
    move("mouse", 20, 0);
    move("pen", 400, 300);
    expect(out).toEqual([{ x: 20, y: 50, cycle: 4, viewportPx: [1280, 720] }, { x: 400, y: 50, cycle: 4, viewportPx: [1280, 720] }]);
    detach();
    expect(listeners.has("pointermove")).toBe(false);
  });
});
