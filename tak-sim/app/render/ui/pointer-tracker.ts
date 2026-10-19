/**
 * `pointer_track` (SPEC/07 §2.3; first emitter SPEC/30 §5.4, 19 Oct 2026): where the cursor is, as an attention-allocation
 * proxy without eye tracking, sampled at most 5 Hz (`POINTER_SAMPLE_INTERVAL_MS`) while it moves, plus one trailing
 * sample where it comes to rest. Each sample carries the view and the window's size in CSS pixels (`viewportPx`),
 * the frame `x`, `y` (`clientX`, `clientY`, whole pixels) are relative to; the map's camera at that moment is the last
 * `viewport_changed` before it.
 *
 * When (decided 19 Oct 2026): only in the main views V1–V14, only for a mouse or pen (a hover-capable pointer; a
 * touch drag is a map pan, logged as such), and never
 * - during a freeze: the screen is blanked, so a position says nothing about what was looked at; the items' option
 *   hovers (`probe_option_hovered`), answer changes and memory-map taps (`freeze_map_pick`) record what matters there;
 * - during the guided tour or the V1 tool reminder (the view's time has not started);
 * - on any screen outside a view (briefing, training, hinge, questionnaires, the end).
 * A move smaller than `POINTER_MIN_MOVE_PX` from the last sample is not a new sample (hand tremor).
 *
 * Volume: a main view lasts about 150 s outside its freeze; with the pointer moving about half of that time a view
 * gives ~375 samples, a session ~5,000 (~1 MB), at most ~10,000 if it never rests.
 *
 * No clock is read: the throttle runs on the timestamp each pointer event carries (`event.timeStamp`), and the record
 * is stamped by the session like every other (`tWallOffsetMs`).
 */

import type { SessionSnapshot } from "../../session/orchestrator.js";
import type { PointerTrackDetail } from "../../telemetry/record-kinds.js";

/** 5 Hz. */
export const POINTER_SAMPLE_INTERVAL_MS = 200;
/** A move shorter than this (CSS px, from the last sample) is not sampled. */
export const POINTER_MIN_MOVE_PX = 3;

/** Runs `fn` after `ms`; returns its cancel. */
export type Schedule = (fn: () => void, ms: number) => () => void;

/** The steps that are not part of a view (the study shell, the screens between views, the end). */
const OUTSIDE_VIEW: ReadonlySet<string> = new Set([
  "briefing", "training", "hinge_pause", "complete", "consent", "consent_declined", "ai_literacy", "preflight", "preflight_refused", "questionnaire", "debrief",
]);

/** Whether the snapshot is inside a view (VP or V1–V14, its freeze, probes and tour included). */
export function inView(snapshot: Pick<SessionSnapshot, "step"> | null): boolean {
  return snapshot !== null && !OUTSIDE_VIEW.has(snapshot.step);
}

/** The view the pointer is sampled for now, or null: main views only, never in a freeze or the tour (see the header). */
export function pointerTrackView(snapshot: Pick<SessionSnapshot, "step" | "currentCycle" | "tour"> | null): number | null {
  if (!inView(snapshot) || snapshot!.currentCycle < 1 || snapshot!.step === "freeze" || snapshot!.tour !== null) return null;
  return snapshot!.currentCycle;
}

interface Sample { readonly x: number; readonly y: number; readonly viewportPx: readonly [number, number] }

/** The sampling rule, free of the DOM: `move` for every pointer move, `setView` when the view (or null: off) changes. */
export class PointerSampler {
  private view: number | null = null;
  private lastAt: number | null = null; // the event time of the last sample
  private last: Sample | null = null;
  private pending: Sample | null = null; // a move held back by the throttle: the trailing sample
  private cancelTrailing: (() => void) | null = null;

  constructor(
    private readonly emit: (detail: PointerTrackDetail) => void,
    private readonly schedule: Schedule,
    private readonly intervalMs: number = POINTER_SAMPLE_INTERVAL_MS,
    private readonly minMovePx: number = POINTER_MIN_MOVE_PX,
  ) {}

  /** A new view (or null: stop). The previous view's held-back sample is written first, with its own view. */
  setView(view: number | null): void {
    if (view === this.view) return;
    this.flushTrailing();
    this.view = view;
    this.lastAt = null;
    this.last = null;
  }

  move(clientX: number, clientY: number, atMs: number, viewportPx: readonly [number, number]): void {
    if (this.view === null) return;
    const sample: Sample = { x: Math.round(clientX), y: Math.round(clientY), viewportPx: [Math.round(viewportPx[0]), Math.round(viewportPx[1])] };
    if (this.last !== null && !this.movedEnough(sample)) { this.pending = null; return; }
    if (this.lastAt === null || atMs - this.lastAt >= this.intervalMs) {
      this.clearTrailing();
      this.write(sample, atMs);
      return;
    }
    this.pending = sample;
    if (this.cancelTrailing === null) {
      const dueAt = this.lastAt + this.intervalMs;
      this.cancelTrailing = this.schedule(() => { this.cancelTrailing = null; this.writePending(dueAt); }, Math.max(0, dueAt - atMs));
    }
  }

  /** Stops: the held-back sample is written, the trailing timer cleared. */
  dispose(): void { this.setView(null); }

  private movedEnough(s: Sample): boolean {
    return Math.hypot(s.x - this.last!.x, s.y - this.last!.y) >= this.minMovePx;
  }

  private write(s: Sample, atMs: number): void {
    this.pending = null;
    this.last = s;
    this.lastAt = atMs;
    this.emit({ x: s.x, y: s.y, cycle: this.view!, viewportPx: s.viewportPx });
  }

  private writePending(atMs: number): void {
    if (this.pending !== null && this.view !== null && (this.last === null || this.movedEnough(this.pending))) this.write(this.pending, atMs);
    this.pending = null;
  }

  private flushTrailing(): void {
    this.clearTrailing();
    this.writePending(this.lastAt ?? 0);
  }

  private clearTrailing(): void {
    if (this.cancelTrailing !== null) this.cancelTrailing();
    this.cancelTrailing = null;
  }
}

type PointerTarget = Pick<Window, "addEventListener" | "removeEventListener" | "innerWidth" | "innerHeight">;

/** Feeds the window's mouse and pen moves to `sampler`; returns the function that removes the listener. */
export function trackPointer(win: PointerTarget, sampler: PointerSampler): () => void {
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    sampler.move(e.clientX, e.clientY, e.timeStamp, [win.innerWidth, win.innerHeight]);
  };
  win.addEventListener("pointermove", onMove, { capture: true, passive: true });
  return () => win.removeEventListener("pointermove", onMove, { capture: true });
}

/** `setTimeout` as a `Schedule` (the browser's timer; the record is still stamped by the session). */
export const timerSchedule: Schedule = (fn, ms) => {
  const handle = setTimeout(fn, ms);
  return () => clearTimeout(handle);
};
