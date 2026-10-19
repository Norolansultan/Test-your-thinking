/**
 * `frame_stats` (SPEC/30 §5.4): once per view, at its end, the median frame interval (from rAF timestamps; pauses left
 * out) and the long-task count; which screens count as a view; the source's start and stop. No DOM.
 */

import { describe, expect, it } from "vitest";
import { FRAME_PAUSE_MS, FrameStatsCollector, ViewFrameStats, type FrameSink } from "../../app/render/ui/frame-stats.js";
import { frameStatsView } from "../../app/render/ui/useViewTelemetry.js";
import type { FrameStatsDetail } from "../../app/telemetry/record-kinds.js";

const frames = (c: FrameStatsCollector, from: number, count: number, stepMs: number): number => {
  let t = from;
  for (let i = 0; i < count; i++) { c.frame(t); t += stepMs; }
  return t - stepMs;
};

describe("FrameStatsCollector", () => {
  it("reports the median interval to 0.1 ms, robust to a few long frames, and the long tasks", () => {
    const c = new FrameStatsCollector();
    const last = frames(c, 0, 601, 1000 / 60); // 600 intervals of 16.67 ms
    c.frame(last + 120); c.frame(last + 300); // two long frames
    c.longTask(); c.longTask(); c.longTask();
    expect(c.take(3)).toEqual({ cycle: 3, medianFrameTimeMs: 16.7, longTaskCount: 3 });
  });

  it("averages the two middle intervals of an even count", () => {
    const c = new FrameStatsCollector();
    c.frame(0); c.frame(10); c.frame(30); // intervals 10 and 20
    expect(c.take(1)!.medianFrameTimeMs).toBe(15.1); // bucket midpoints 10.05 and 20.05
  });

  it("leaves out an interval over the pause limit and the first frame after the page is hidden", () => {
    const c = new FrameStatsCollector();
    c.frame(0); c.frame(33);
    c.frame(33 + FRAME_PAUSE_MS + 1); // a hidden tab
    c.pause();
    c.frame(5_000); c.frame(5_033);
    expect(c.take(2)).toEqual({ cycle: 2, medianFrameTimeMs: 33.1, longTaskCount: 0 });
  });

  it("writes nothing for a view with no measured frame, and starts afresh after each view", () => {
    const c = new FrameStatsCollector();
    c.frame(0);
    c.longTask();
    expect(c.take(4)).toBeNull();
    c.frame(100); c.frame(150);
    expect(c.take(5)).toEqual({ cycle: 5, medianFrameTimeMs: 50.1, longTaskCount: 0 });
  });
});

describe("ViewFrameStats", () => {
  it("writes each view's record when the next view (or a screen between views) replaces it, and stops the source", () => {
    const written: FrameStatsDetail[] = [];
    let sink: FrameSink | null = null;
    let starts = 0, stops = 0;
    const stats = new ViewFrameStats((d) => written.push(d), (s) => { sink = s; starts += 1; return () => { stops += 1; }; });
    stats.setView(0);
    sink!.frame(0); sink!.frame(20);
    stats.setView(0); // the same view: nothing
    stats.setView(1);
    sink!.frame(1000); sink!.frame(1010); sink!.longTask();
    stats.setView(null); // the hinge
    stats.setView(null);
    stats.setView(8);
    stats.end(); // unmounted with no frame measured in V8
    expect(written).toEqual([{ cycle: 0, medianFrameTimeMs: 20.1, longTaskCount: 0 }, { cycle: 1, medianFrameTimeMs: 10.1, longTaskCount: 1 }]);
    expect([starts, stops]).toEqual([3, 3]);
  });

  it("counts every view, VP and the freeze included, and nothing between views", () => {
    expect(frameStatsView({ step: "exploration", currentCycle: 0 })).toBe(0);
    expect(frameStatsView({ step: "freeze", currentCycle: 10 })).toBe(10);
    expect(frameStatsView({ step: "probe", currentCycle: 13 })).toBe(13);
    for (const step of ["hinge_pause", "training", "complete", "questionnaire"] as const) expect(frameStatsView({ step, currentCycle: 7 })).toBeNull();
    expect(frameStatsView(null)).toBeNull();
  });
});
