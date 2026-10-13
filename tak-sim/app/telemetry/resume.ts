/**
 * Session resume — SPEC/05_System_Architecture.md §9: "A session that is
 * interrupted... can be resumed from the last completed cycle boundary.
 * Resuming mid-cycle is not supported: the cycle is replayed from its
 * start, the interruption is logged as a fault span, and the analysis
 * may exclude that cycle." Also HANDOFF_Projection_Judgement_Loop.md §9:
 * "Resuming mid-judgement is not supported; do not try."
 *
 * `planResume` is a pure read of the log so far — no mutation, no
 * decision about *how* the app re-enters `RUNNING` (that is the run
 * loop's job, SPEC/05 §4's `RESUMING` state, already built in M1). Its
 * only job is: given what was durably persisted before the interruption,
 * which cycle must be replayed from its start.
 */

import type { CycleSchedule } from "../engine/cycle-sequencer.js";
import type { CycleIndex } from "../engine/primitives.js";
import { PRACTICE_VIEW_INDEX } from "../scenario/views.js";
import { appendTelemetryEvent } from "./emit.js";
import type { SessionLog, LogRecord } from "./log.js";
import type { CycleEndDetail, CycleStartDetail, SpamReadyDetail } from "./record-kinds.js";

export interface ResumePlan {
  /** The view to (re)start from. If the session ended cleanly at a boundary, this is the next view; SPEC/05 §9 gives no rule for resuming past the last view's boundary, so after V14 this is 15 (meaning "nothing left to resume into") rather than guessed. Practice-view records (view 0, SPEC/26 D3) are ignored, so an interruption during or after VP plans a resume at V1. */
  readonly resumeFromCycle: number;
  /** True when the interrupted cycle's `cycle_start` was logged without a matching `cycle_end` — the case SPEC/05 §9 says must replay from the cycle's start, never resume mid-cycle. */
  readonly cycleWasInterruptedMidway: boolean;
  readonly lastRecordSeq: number | null;
}

/**
 * Reads the durable log so far and determines what must happen on
 * resume. Walks every `cycle_start`/`cycle_end` pair in order (`seq`
 * order, which the log guarantees is append order, I5) rather than just
 * scanning from the end, so an out-of-order read from a sink that does
 * not preserve write order (defensive — `IndexedDbLogSink.readAll`
 * already sorts) cannot produce the wrong plan.
 */
export function planResume(records: readonly LogRecord[]): ResumePlan {
  const bySeq = records.slice().sort((a, b) => a.seq - b.seq);
  let lastCompletedCycle = 0;
  let openCycle: number | null = null;

  for (const record of bySeq) {
    if (record.kind === "cycle_start") {
      const detail = record.detail as CycleStartDetail;
      if (detail.cycle === PRACTICE_VIEW_INDEX) continue;
      openCycle = detail.cycle as number;
    } else if (record.kind === "cycle_end") {
      const detail = record.detail as CycleEndDetail;
      if (detail.cycle === PRACTICE_VIEW_INDEX) continue;
      lastCompletedCycle = detail.cycle as number;
      openCycle = null;
    }
  }

  const lastRecordSeq = bySeq.length > 0 ? bySeq[bySeq.length - 1]!.seq : null;

  if (openCycle !== null) {
    return { resumeFromCycle: openCycle, cycleWasInterruptedMidway: true, lastRecordSeq };
  }
  return { resumeFromCycle: lastCompletedCycle + 1, cycleWasInterruptedMidway: false, lastRecordSeq };
}

export interface ResumeOutcome {
  readonly plan: ResumePlan;
  readonly resumedRecord: LogRecord;
}

/**
 * Logs the resume event (`session_resumed`, SPEC/07 §2.1) reflecting the
 * plan computed from the log so far. Does not itself replay the cycle —
 * that is the caller's job, using `plan.resumeFromCycle` to know where to
 * restart the run loop.
 */
export async function resumeSession(log: SessionLog, schedule: CycleSchedule, resumeCount: number, intervalSinceInterruptionMs: number): Promise<ResumeOutcome> {
  const existing = await log.readAll();
  const plan = planResume(existing);
  // Edge case not addressed in prose by SPEC/05 §9 or SPEC/07: an
  // interruption cleanly after the last view's cycle_end (awaiting
  // DEBRIEF_HANDOFF) makes plan.resumeFromCycle = count + 1, which is not a
  // real view — there is none to replay. Clamped to the last view rather
  // than left to throw, since `session_resumed.cycleReplayed` is a
  // required field with no "not applicable" value in the record shape;
  // `plan.resumeFromCycle` (unclamped) remains available to the caller
  // for this exact case.
  const cycleReplayed = Math.min(plan.resumeFromCycle, schedule.count) as CycleIndex;
  // The replayed view restarts at its own start (SPEC/26: a view's start is its first step's).
  const resumedRecord = await appendTelemetryEvent(log, schedule.startOf(cycleReplayed), 0, {
    kind: "session_resumed",
    detail: { resumeCount, intervalSinceInterruptionMs, cycleReplayed },
  });
  return { plan, resumedRecord };
}

// ---- The browser resume (5 Oct 2026) ------------------------------------------------------------

/**
 * Where a resumed session re-enters (SPEC/05 §9), from the durable log so far. Extends
 * {@link planResume} (main views only) to the parts of the session around them:
 *
 * - `briefing` — the practice view never started: the session restarts at the briefing;
 * - `view` — a view to replay from its start: the practice view (0) if it was interrupted, else the
 *   main view `planResume` names (the interrupted one, or the next after a clean boundary);
 * - `training` — the practice view finished, V1 not started: the group-specific training again;
 * - `hinge` — V7 (the hinge view) ended and the hinge screen was not left: the hinge screen again
 *   (the directive and the manipulation check are shown and answered again; both answers stay in the log);
 * - `complete` — V14 ended: only the end of the session (completion and the upload) remains.
 *
 * - `spam_forced` (revision (ag), 9 Oct 2026) — the interrupted view's time had run out and its SPAM
 *   item was forced (`spam_ready` `forced`, not yet `spam_closed`): the session resumes INTO that item,
 *   not the view's start, and the view ends when it closes, with the end it was holding.
 *
 * Never mid-view, never mid-judgement (HANDOFF §9): whatever was answered in the interrupted view
 * stays in the log, and the view is run again from its start. The one exception is the forced SPAM
 * item, which lies after the view's time: nothing of the view is left to run, so it is not replayed.
 */
export type ResumeTarget =
  | { readonly kind: "briefing" }
  | { readonly kind: "view"; readonly view: number }
  | { readonly kind: "spam_forced"; readonly view: number; readonly probeId: string; readonly atViewSeconds: number; readonly viewEndedBy: NonNullable<SpamReadyDetail["viewEndedBy"]>; readonly planRecorded: boolean; readonly stepBoundaryReached: boolean }
  | { readonly kind: "training" }
  | { readonly kind: "hinge" }
  | { readonly kind: "complete" };

export interface SessionResumePlan {
  readonly target: ResumeTarget;
  /** This resume's number: 1 for the first, counting earlier `session_resumed` records. */
  readonly resumeCount: number;
  /** The last record's `tWallOffsetMs`: the resumed records continue the session's time base from here. */
  readonly lastWallOffsetMs: number;
  /** True when the session had already logged `session_completed` (nothing to resume; the upload may still be pending). */
  readonly alreadyCompleted: boolean;
}

export function planSessionResume(records: readonly LogRecord[], schedule: Pick<CycleSchedule, "count" | "hingeAfter">): SessionResumePlan {
  const bySeq = records.slice().sort((a, b) => a.seq - b.seq);
  const has = (kind: string, cycle?: number) => bySeq.some((r) => r.kind === kind && (cycle === undefined || (r.detail as { cycle?: number }).cycle === cycle));
  const resumeCount = bySeq.filter((r) => r.kind === "session_resumed").length + 1;
  const lastWallOffsetMs = bySeq.length > 0 ? bySeq[bySeq.length - 1]!.tWallOffsetMs : 0;
  const alreadyCompleted = has("session_completed");
  const plan = (target: ResumeTarget): SessionResumePlan => ({ target, resumeCount, lastWallOffsetMs, alreadyCompleted });

  const mainStarted = bySeq.some((r) => r.kind === "cycle_start" && (r.detail as CycleStartDetail).cycle !== PRACTICE_VIEW_INDEX);
  if (!mainStarted) {
    if (!has("cycle_start", PRACTICE_VIEW_INDEX)) return plan({ kind: "briefing" });
    if (!has("cycle_end", PRACTICE_VIEW_INDEX)) return plan(forcedSpamOf(bySeq, PRACTICE_VIEW_INDEX) ?? { kind: "view", view: PRACTICE_VIEW_INDEX });
    return plan({ kind: "training" });
  }
  const main = planResume(bySeq);
  if (main.cycleWasInterruptedMidway) return plan(forcedSpamOf(bySeq, main.resumeFromCycle) ?? { kind: "view", view: main.resumeFromCycle });
  const lastEnded = main.resumeFromCycle - 1;
  if (lastEnded >= schedule.count) return plan({ kind: "complete" });
  // The hinge screen is left with `hinge_pause_end`; without it the participant is still at the hinge.
  if (lastEnded === schedule.hingeAfter && !has("hinge_pause_end")) return plan({ kind: "hinge" });
  return plan({ kind: "view", view: main.resumeFromCycle });
}

/**
 * Revision (ag): the open view's forced SPAM item, if the interruption fell inside it — in the view's
 * last attempt (after its last `cycle_start`), a `spam_ready` with `forced` and no `spam_closed` for that
 * probe after it. What the resumed screen needs comes with it: the view moment and the end it holds,
 * whether a plan was recorded (the step under the item) and whether a merged view's second step was reached.
 */
function forcedSpamOf(bySeq: readonly LogRecord[], view: number): Extract<ResumeTarget, { kind: "spam_forced" }> | null {
  let start = -1;
  bySeq.forEach((r, i) => { if (r.kind === "cycle_start" && (r.detail as CycleStartDetail).cycle === view) start = i; });
  if (start < 0) return null;
  const attempt = bySeq.slice(start + 1);
  let forcedAt = -1;
  attempt.forEach((r, i) => { if (r.kind === "spam_ready" && (r.detail as SpamReadyDetail).forced === true) forcedAt = i; });
  if (forcedAt < 0) return null;
  const forced = attempt[forcedAt]!.detail as SpamReadyDetail;
  if (attempt.slice(forcedAt + 1).some((r) => r.kind === "spam_closed" && (r.detail as { probeId: string }).probeId === forced.probeId)) return null;
  if (forced.atViewSeconds === undefined || forced.viewEndedBy === undefined) return null; // malformed: replay the view
  return {
    kind: "spam_forced", view, probeId: forced.probeId, atViewSeconds: forced.atViewSeconds, viewEndedBy: forced.viewEndedBy,
    planRecorded: attempt.some((r) => r.kind === "allocation_submitted"),
    stepBoundaryReached: attempt.some((r) => r.kind === "step_boundary_reached"),
  };
}
