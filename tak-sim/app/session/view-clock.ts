/**
 * The view's own time (researcher decision 1 Oct 2026): real seconds since the view opened, minus
 * any time spent in a SAGAT freeze — the view's time stands still while the picture is hidden, so
 * every participant sees the map for the same minimum length, and the 150 s cap (`VIEW_MAX_SECONDS`) is on this clock
 * too (`capCues`, SPEC/15 r.12). Split out of `orchestrator.ts`.
 *
 * A view's moments (the decision panel opening, a merged view's step boundary, the freeze, the
 * minimum length) are cues on this clock, run by the ordinary timers, so `vi` fake timers drive
 * them in tests. The one real-time reading is the participant's confirmation after the minimum
 * length (`view_ended`), through an injected clock; it times the participant, never the world.
 */

import { CONSULT_PROMPT_AT_S, consultHeldForFreeze, DECISION_OPENS_AFTER_S, PRACTICE_VIEW_INDEX } from "../scenario/views.js";
import type { ViewSpec } from "../scenario/types.js";
import { scaleViewSeconds, type PreviewOverride } from "./preview.js";

/** A monotonic real-time reading in milliseconds. */
export type RealClockMs = () => number;

/** The browser's monotonic clock; faked with the timers in tests. */
export const performanceClock: RealClockMs = () =>
  performance.now(); // determinism-lint-allow: the participant's response timing (SPEC/05 §3's telemetry carve-out), never fed to the world

/** A view's moments in view seconds, the preview override applied (`preview.ts`). */
export interface ViewTiming {
  readonly minViewSeconds: number;
  readonly decisionOpensAtSeconds: number;
  readonly freezeAtSeconds: number | null;
  /** SPEC/30 §5.1: the view's freeze comes at its end, after the plan-confidence item (no moment on the clock). */
  readonly freezeAtViewEnd: boolean;
  /** A merged view reaches its second step halfway through its minimum length (SPEC/26 §2); null in a single-step view. */
  readonly stepBoundaryAtSeconds: number | null;
  /** SPEC/30 §4: the consult notification's moment (every main view); null in the practice view. */
  readonly consultPromptAtSeconds: number | null;
  /**
   * `31` F23: the view's freeze falls due less than `CONSULT_FREEZE_GAP_S` after the notification's moment, so the notification
   * waits until the freeze has closed. Decided on the unscaled moments, so a preview defers exactly where the study does.
   */
  readonly consultHeldForFreeze: boolean;
}

export function viewTimingOf(spec: ViewSpec, override: PreviewOverride | null): ViewTiming {
  const scaled = (seconds: number) => scaleViewSeconds(seconds, override);
  const freezeAt = spec.hasFreeze && spec.freezeAtViewEnd !== true ? spec.freezeAtSeconds : null;
  const consultAt = spec.index === PRACTICE_VIEW_INDEX ? null : CONSULT_PROMPT_AT_S;
  return {
    minViewSeconds: scaled(spec.minViewSeconds),
    decisionOpensAtSeconds: scaled(DECISION_OPENS_AFTER_S),
    freezeAtSeconds: freezeAt !== null ? scaled(freezeAt) : null,
    freezeAtViewEnd: spec.hasFreeze && spec.freezeAtViewEnd === true,
    stepBoundaryAtSeconds: spec.stepBoundary ? scaled(spec.minViewSeconds) / 2 : null,
    consultPromptAtSeconds: consultAt !== null ? scaled(consultAt) : null,
    consultHeldForFreeze: consultHeldForFreeze(consultAt, freezeAt),
  };
}

export interface ViewCue {
  readonly atSeconds: number;
  readonly fire: () => void;
}

interface PendingCue {
  readonly atMs: number;
  readonly fire: () => void;
  handle: ReturnType<typeof setTimeout> | null;
}

export class ViewClock {
  private accumulatedMs = 0;
  private runningSinceMs: number | null = null;
  private pending: PendingCue[] = [];

  constructor(private readonly realMs: RealClockMs) {}

  /** Opens a view at view time 0 with its cues; drops whatever the last view left. */
  start(cues: readonly ViewCue[]): void {
    this.stop();
    this.accumulatedMs = 0;
    this.pending = cues.map((c) => ({ atMs: Math.round(c.atSeconds * 1000), fire: c.fire, handle: null })).sort((a, b) => a.atMs - b.atMs);
    this.run();
  }

  /** View seconds so far, to the millisecond. */
  elapsedSeconds(): number {
    const running = this.runningSinceMs === null ? 0 : this.realMs() - this.runningSinceMs;
    return Math.round(this.accumulatedMs + running) / 1000;
  }

  /**
   * Stops the view's time. Given `atSeconds` (the freeze cue's own moment), the view time is set to
   * exactly that, so timer jitter does not leak into the record.
   */
  pause(atSeconds?: number): void {
    if (this.runningSinceMs === null) return;
    this.accumulatedMs = atSeconds !== undefined ? Math.round(atSeconds * 1000) : this.accumulatedMs + this.realMs() - this.runningSinceMs;
    this.runningSinceMs = null;
    this.clearHandles();
  }

  resume(): void {
    if (this.runningSinceMs === null) this.run();
  }

  /**
   * More cues for the open view (SPEC/32 §3: the cap moved for a revision opened at the plan review). Scheduled at once while
   * the clock runs, else when it resumes; a cue whose moment has passed fires at once.
   */
  add(cues: readonly ViewCue[]): void {
    const added: PendingCue[] = cues.map((c) => ({ atMs: Math.round(c.atSeconds * 1000), fire: c.fire, handle: null }));
    this.pending = [...this.pending, ...added].sort((a, b) => a.atMs - b.atMs);
    if (this.runningSinceMs === null) return;
    const elapsedMs = this.accumulatedMs + this.realMs() - this.runningSinceMs;
    for (const cue of added) this.schedule(cue, elapsedMs);
  }

  stop(): void {
    this.clearHandles();
    this.pending = [];
    this.runningSinceMs = null;
  }

  private run(): void {
    this.runningSinceMs = this.realMs();
    for (const cue of this.pending) this.schedule(cue, this.accumulatedMs);
  }

  private schedule(cue: PendingCue, elapsedMs: number): void {
    cue.handle = setTimeout(() => {
      this.pending = this.pending.filter((c) => c !== cue);
      cue.fire();
    }, Math.max(0, cue.atMs - elapsedMs));
  }

  private clearHandles(): void {
    for (const cue of this.pending) {
      if (cue.handle !== null) clearTimeout(cue.handle);
      cue.handle = null;
    }
  }
}

/**
 * The view's hard maximum (`VIEW_MAX_SECONDS`) as cues on the view's own clock (2 Oct 2026, SPEC/15
 * r.12): the cap counts real time minus the time spent in freezes, as SAGAT pauses the simulation
 * while the picture is hidden (Endsley), so a long freeze takes nothing from the task's time.
 * `countdown(n)` gets the whole seconds left in the last {@link FINAL_COUNTDOWN_S}; `reached()`
 * fires at the cap. Paused and resumed with the view clock, so the cues shift by the freeze.
 */
export function capCues(capSeconds: number, countdown: (secondsLeft: number) => void, reached: () => void): ViewCue[] {
  const from = Math.min(FINAL_COUNTDOWN_S, Math.floor(capSeconds));
  return [
    ...Array.from({ length: from }, (_, i) => ({ atSeconds: capSeconds - (from - i), fire: () => countdown(from - i) })),
    { atSeconds: capSeconds, fire: reached },
  ];
}

/** The final countdown (researcher decision 2 Oct 2026): shown in the last 20 s before the view's minimum length. */
export const FINAL_COUNTDOWN_S = 20;
/**
 * One cue per second for the final countdown, on the view's own clock, so it stands still in a
 * freeze like every other view time. With the study's timing the freeze window ends exactly where
 * the countdown starts (minimum − 20 s), so the countdown never tells when a freeze is due.
 * `set(n)` gets the whole seconds left, then 0 at the minimum.
 */
export function finalCountdownCues(minViewSeconds: number, set: (secondsLeft: number) => void): ViewCue[] {
  const from = Math.min(FINAL_COUNTDOWN_S, Math.floor(minViewSeconds));
  return Array.from({ length: from + 1 }, (_, i) => ({ atSeconds: minViewSeconds - (from - i), fire: () => set(from - i) }));
}
