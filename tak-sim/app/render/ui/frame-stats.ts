/**
 * `frame_stats` (SPEC/07 §2.1; first emitter SPEC/30 §5.4, 19 Oct 2026): once per view (VP and V1–V14), when the view
 * ends, the median frame time and the long-task count over the view — to identify a degraded machine, not a measure of
 * the participant. 15 records per session.
 *
 * - Frame time: the interval between consecutive animation frames, from the timestamps `requestAnimationFrame` hands
 *   its callback (no clock is read here; `app/game/ui/loop.ts` does the same). An interval over `FRAME_PAUSE_MS` is a
 *   pause (a hidden tab, rAF throttled), not a frame, and is left out, as is the first frame after the page is hidden.
 *   The median is kept in 0.1 ms buckets (constant memory over a long view) and reported to 0.1 ms.
 * - Long tasks: main-thread tasks over 50 ms, from the browser's Long Tasks API (`PerformanceObserver`, entry type
 *   `longtask`). A browser without it (Firefox, Safari: the header's `userAgent` tells) reports 0.
 * - The view's frames include its freeze and probes (they are the same machine), not the screens between views.
 * - The record is written just after the view's end is shown (the next view's `cycle_start` may precede it); it names its
 *   view (`cycle`). A view with no measured frame writes none.
 */

import type { FrameStatsDetail } from "../../telemetry/record-kinds.js";

/** An interval longer than this is a pause, not a frame. */
export const FRAME_PAUSE_MS = 1_000;
/** Buckets of 0.1 ms (multiplied, not divided by 0.1, so 33 ms is bucket 330 exactly). */
const BUCKETS_PER_MS = 10;
const BUCKETS = FRAME_PAUSE_MS * BUCKETS_PER_MS;

/** One view's frames and long tasks, free of the DOM. */
export class FrameStatsCollector {
  private readonly histogram = new Uint32Array(BUCKETS);
  private frames = 0;
  private longTasks = 0;
  private previousMs: number | null = null;

  /** An animation frame at `atMs` (its rAF timestamp). */
  frame(atMs: number): void {
    if (this.previousMs !== null) {
      const dt = atMs - this.previousMs;
      if (dt > 0 && dt <= FRAME_PAUSE_MS) {
        this.histogram[Math.min(BUCKETS - 1, Math.floor(dt * BUCKETS_PER_MS))]! += 1;
        this.frames += 1;
      }
    }
    this.previousMs = atMs;
  }

  longTask(): void { this.longTasks += 1; }

  /** The page was hidden: the next frame starts a new interval. */
  pause(): void { this.previousMs = null; }

  /** The view's record (null with no measured frame), and a fresh start. */
  take(cycle: number): FrameStatsDetail | null {
    const detail = this.frames === 0 ? null : { cycle, medianFrameTimeMs: this.median(), longTaskCount: this.longTasks };
    this.histogram.fill(0);
    this.frames = 0;
    this.longTasks = 0;
    this.previousMs = null;
    return detail as FrameStatsDetail | null;
  }

  private median(): number {
    const lower = this.bucketAt(Math.floor((this.frames - 1) / 2));
    const upper = this.bucketAt(Math.floor(this.frames / 2));
    // The two middle buckets' midpoints ((i + 0.5) tenths of a ms), averaged and rounded to a tenth: (lower + upper + 1) / 2 tenths.
    return Math.round((lower + upper + 1) / 2) / BUCKETS_PER_MS;
  }

  /** The bucket holding the `rank`-th (0-based) interval in ascending order. */
  private bucketAt(rank: number): number {
    let seen = 0;
    for (let i = 0; i < BUCKETS; i++) {
      seen += this.histogram[i]!;
      if (seen > rank) return i;
    }
    return BUCKETS - 1;
  }
}

/** What a frame source reports to. */
export interface FrameSink {
  readonly frame: (atMs: number) => void;
  readonly longTask: () => void;
  readonly pause: () => void;
}
/** Starts reporting frames; returns its stop. */
export type FrameSource = (sink: FrameSink) => () => void;

/** Collects frames while a view is on screen and writes its record when the view ends (`setView` with another view, or null). */
export class ViewFrameStats {
  private view: number | null = null;
  private stop: (() => void) | null = null;
  private readonly collector = new FrameStatsCollector();

  constructor(private readonly emit: (detail: FrameStatsDetail) => void, private readonly source: FrameSource) {}

  setView(view: number | null): void {
    if (view === this.view) return;
    this.end();
    this.view = view;
    if (view !== null) {
      const c = this.collector;
      this.stop = this.source({ frame: (t) => c.frame(t), longTask: () => c.longTask(), pause: () => c.pause() });
    }
  }

  /** The view ended (or the screen is unmounted): its record, if it measured any frame. */
  end(): void {
    this.stop?.();
    this.stop = null;
    if (this.view !== null) {
      const detail = this.collector.take(this.view);
      if (detail) this.emit(detail);
    }
    this.view = null;
  }
}

type FrameWindow = Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">;
type VisibilityTarget = Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">;

/** The browser's frames (rAF), long tasks (`PerformanceObserver`, where supported) and visibility. */
export function browserFrameSource(win: FrameWindow, doc: VisibilityTarget): FrameSource {
  return (sink) => {
    let handle = 0;
    const loop = (t: number) => { sink.frame(t); handle = win.requestAnimationFrame(loop); };
    handle = win.requestAnimationFrame(loop);
    const onVisibility = () => { if (doc.visibilityState === "hidden") sink.pause(); };
    doc.addEventListener("visibilitychange", onVisibility);
    let observer: PerformanceObserver | null = null;
    if (typeof PerformanceObserver !== "undefined" && (PerformanceObserver.supportedEntryTypes ?? []).includes("longtask")) {
      observer = new PerformanceObserver((list) => { for (const _entry of list.getEntries()) sink.longTask(); });
      observer.observe({ type: "longtask" });
    }
    return () => {
      win.cancelAnimationFrame(handle);
      doc.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  };
}
