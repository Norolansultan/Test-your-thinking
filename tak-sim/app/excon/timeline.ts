/**
 * EXCON (SPEC/28 §8) — the white cell's timeline: the practice view VP (step W2) and V1–V14 with their
 * world-state steps (SPEC/26 §2–§3, `app/scenario/views.ts`), laid end to end as one playback axis of
 * "timeline seconds". Each step is 1200 virtual seconds wide; VP's step (12:00–12:20) is followed directly by
 * step 1 (13:20) — the hour between them (W3–W5) is not part of the session, and nothing is interpolated
 * across that gap.
 *
 * Pure and deterministic: a playback position maps to exactly one (step, fraction, virtual time).
 */

import { SESSION_VIEWS, STEP_SECONDS, stepId, stepStartVirtual, type SessionView } from "../scenario/views.js";

export interface ExconStep {
  /** Position on the timeline, 0-based (0 = VP's step). */
  readonly frame: number;
  /** World-state step number: −3 (W2) for VP, 1–20 for the main views. */
  readonly step: number;
  readonly stepId: string;
  readonly viewIndex: number;
  readonly viewId: string;
  /** Which of its view's steps this is: 2 = a merged view after its step boundary (SPEC/26 §2). */
  readonly stepShown: 1 | 2;
  readonly stepsInView: 1 | 2;
  /** Virtual seconds of the step's start (0 = 13:20, the start of step 1). */
  readonly startVirtual: number;
  /** The next step on the timeline when it is the world's next step (`step + 1`); null at the end and across the VP gap. */
  readonly nextFrame: number | null;
  readonly prevFrame: number | null;
}

export function buildTimeline(views: readonly SessionView[] = SESSION_VIEWS): ExconStep[] {
  const flat: Omit<ExconStep, "frame" | "nextFrame" | "prevFrame">[] = [];
  for (const v of [...views].sort((a, b) => a.index - b.index)) {
    v.steps.forEach((step, k) => {
      flat.push({
        step, stepId: stepId(step), viewIndex: v.index, viewId: v.id,
        stepShown: (k + 1) as 1 | 2, stepsInView: v.steps.length as 1 | 2,
        startVirtual: stepStartVirtual(step),
      });
    });
  }
  return flat.map((s, i) => ({
    ...s,
    frame: i,
    nextFrame: i + 1 < flat.length && flat[i + 1]!.step === s.step + 1 ? i + 1 : null,
    prevFrame: i > 0 && flat[i - 1]!.step === s.step - 1 ? i - 1 : null,
  }));
}

export function timelineLengthS(timeline: readonly ExconStep[]): number {
  return timeline.length * STEP_SECONDS;
}

export interface Playhead {
  readonly positionS: number;
  readonly frame: number;
  /** 0 at the step's start, approaching 1 at its end (exactly 1 only at the very end of the timeline). */
  readonly fraction: number;
  readonly step: ExconStep;
  /** Virtual seconds (0 = 13:20). */
  readonly virtualS: number;
  /** Seconds into the VIEW (a merged view's second step starts at 1200), as the session schedules deliveries. */
  readonly viewOffsetS: number;
}

/** Where `positionS` falls on the timeline (clamped to it). */
export function locate(timeline: readonly ExconStep[], positionS: number): Playhead {
  if (timeline.length === 0) throw new RangeError("locate: empty timeline");
  const length = timelineLengthS(timeline);
  const p = Math.min(Math.max(positionS, 0), length);
  const frame = Math.min(Math.floor(p / STEP_SECONDS), timeline.length - 1);
  const step = timeline[frame]!;
  const into = p - frame * STEP_SECONDS;
  return {
    positionS: p, frame, step,
    fraction: into / STEP_SECONDS,
    virtualS: step.startVirtual + into,
    viewOffsetS: (step.stepShown - 1) * STEP_SECONDS + into,
  };
}

/** The timeline position of a view's start. */
export function viewStartPosition(timeline: readonly ExconStep[], viewIndex: number): number {
  const s = timeline.find((x) => x.viewIndex === viewIndex && x.stepShown === 1);
  if (!s) throw new RangeError(`no view ${viewIndex} on the timeline`);
  return s.frame * STEP_SECONDS;
}

export function frameStartPosition(frame: number): number {
  return frame * STEP_SECONDS;
}

/** The views in timeline order with their first frame and width in steps (for the timeline bar). */
export function viewSpans(timeline: readonly ExconStep[]): { readonly viewIndex: number; readonly viewId: string; readonly firstFrame: number; readonly steps: number }[] {
  const out: { viewIndex: number; viewId: string; firstFrame: number; steps: number }[] = [];
  for (const s of timeline) {
    const last = out[out.length - 1];
    if (last && last.viewIndex === s.viewIndex) last.steps += 1;
    else out.push({ viewIndex: s.viewIndex, viewId: s.viewId, firstFrame: s.frame, steps: 1 });
  }
  return out;
}

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

/**
 * Virtual seconds as the incident clock "HH:MM:SS" (0 = 13:20:00, SPEC/26 §2). Plain arithmetic, no Date or
 * Intl (I2; the determinism lint bans both in app/).
 */
export function clockOf(virtualS: number): string {
  const total = Math.floor(13 * 3600 + 20 * 60 + virtualS);
  const day = ((total % 86_400) + 86_400) % 86_400;
  return `${pad(Math.floor(day / 3600))}:${pad(Math.floor((day % 3600) / 60))}:${pad(day % 60)}`;
}
