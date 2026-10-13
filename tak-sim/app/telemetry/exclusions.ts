/**
 * The exclusion helpers of SPEC/09 §6.2, as pure folds over the raw records (SPEC/07 §1: nothing
 * derived is stored): cumulative blur, cumulative idle and judgements submitted faster than a
 * plausible-reading floor. They report the amounts; the thresholds are named constants below,
 * proposed defaults (8 Oct 2026) that the researcher pre-registers, and applying them is the analysis'
 * decision, blind to condition and outcome. The failed attention check is `attentionCheckPassed`
 * (`derived-measures.ts`).
 *
 * Idle periods are already net of waits on the session and of the reading grace after an answer
 * (`app/session/attention.ts`), so no further correction is made here. Idle is counted only inside the
 * views (`cycle_start` to `view_ended`), the same scope as the denominator.
 */

import { firstFreezeAnswers, replayedViews } from "./freeze-measures.js";
import type { LogRecord } from "./log.js";
import type { FreezeSubmittedDetail, ViewEndedDetail } from "./record-kinds.js";

/** Pre-register: a freeze item answered in under this many ms (since the previous item, or the freeze opening) is too fast to have been read. */
export const TOO_FAST_FREEZE_ANSWER_MS = 1_500;
/** Pre-register: a session is excluded when the page was blurred for more than this share of the session's wall time. */
export const MAX_BLUR_SHARE_OF_SESSION = 0.1;
/** Pre-register: a session is excluded when idle time exceeds this share of the time spent in the views. */
export const MAX_IDLE_SHARE_OF_VIEW_TIME = 0.15;

type Interval = readonly [from: number, to: number];

/**
 * The periods between each `open` record and the next `close` record, as wall-time intervals. A period still open at the end of
 * the log runs to the last record; a repeated `open` (a record lost, or a resume) does not restart it.
 */
function intervals(records: readonly LogRecord[], open: string, close: string): Interval[] {
  let openedAt: number | null = null;
  const out: Interval[] = [];
  for (const r of records) {
    if (r.kind === open) {
      if (openedAt === null) openedAt = r.tWallOffsetMs;
    } else if (r.kind === close && openedAt !== null) {
      out.push([openedAt, Math.max(openedAt, r.tWallOffsetMs)]);
      openedAt = null;
    }
  }
  if (openedAt !== null && records.length > 0) out.push([openedAt, Math.max(openedAt, records[records.length - 1]!.tWallOffsetMs)]);
  return out;
}

const totalMs = (list: readonly Interval[]): number => list.reduce((s, [from, to]) => s + (to - from), 0);

/** The wall time of each view: from a `cycle_start` to the `view_ended` that closes it (a view replayed after a resume: from its last `cycle_start`); a view still open at the end of the log is not counted, as `viewTimeMs`. */
function viewWindows(records: readonly LogRecord[]): Interval[] {
  let startedAt: number | null = null;
  const out: Interval[] = [];
  for (const r of records) {
    if (r.kind === "cycle_start") startedAt = r.tWallOffsetMs;
    else if (r.kind === "view_ended" && startedAt !== null) {
      out.push([startedAt, Math.max(startedAt, r.tWallOffsetMs)]);
      startedAt = null;
    }
  }
  return out;
}

/** The part of `periods` that falls inside `windows`, in ms. */
function overlapMs(periods: readonly Interval[], windows: readonly Interval[]): number {
  let total = 0;
  for (const [a, b] of periods) for (const [from, to] of windows) total += Math.max(0, Math.min(b, to) - Math.max(a, from));
  return total;
}

/** Cumulative time the page was away (`window_blur` to `window_focus`), in ms. */
export function cumulativeBlurMs(records: readonly LogRecord[]): number {
  return totalMs(intervals(records, "window_blur", "window_focus"));
}

/**
 * Cumulative idle time (`idle_start` to `idle_end`), in ms; already net of waits and the reading grace. Counted only between a view's
 * `cycle_start` and its `view_ended` (fix pass 6, 8 Oct 2026: the scope of the denominator, `viewTimeMs`): idle before V1, between
 * views, in a briefing or in the questionnaire is not view time and does not count against the share.
 */
export function cumulativeIdleMs(records: readonly LogRecord[]): number {
  return overlapMs(intervals(records, "idle_start", "idle_end"), viewWindows(records));
}

/** The session's wall time: first to last record, in ms. */
export function sessionWallMs(records: readonly LogRecord[]): number {
  return records.length === 0 ? 0 : records[records.length - 1]!.tWallOffsetMs - records[0]!.tWallOffsetMs;
}

/** The time spent in the views: the sum of `view_ended.viewSeconds`, in ms. */
export function viewTimeMs(records: readonly LogRecord[]): number {
  let s = 0;
  for (const r of records) if (r.kind === "view_ended") s += (r.detail as ViewEndedDetail).viewSeconds;
  return s * 1000;
}

/** Whether blur exceeded `maxShare` of the session; false for an empty log. */
export function blurExcluded(records: readonly LogRecord[], maxShare: number = MAX_BLUR_SHARE_OF_SESSION): boolean {
  const total = sessionWallMs(records);
  return total > 0 && cumulativeBlurMs(records) / total > maxShare;
}

/** Whether idle time exceeded `maxShare` of the view time; false when there was none. */
export function idleExcluded(records: readonly LogRecord[], maxShare: number = MAX_IDLE_SHARE_OF_VIEW_TIME): boolean {
  const total = viewTimeMs(records);
  return total > 0 && cumulativeIdleMs(records) / total > maxShare;
}

/**
 * Pre-registered (fix pass 7, 9 Oct 2026, revision (ad); researcher's decision): a view with MORE than this share of its freeze items
 * missing is excluded from that view's SA score. Missing items are missing, never wrong: `freezeItemScores` scores only answers.
 */
export const MAX_MISSING_SHARE_PER_FREEZE = 0.5;

export interface FreezeMissing {
  readonly view: number;
  /** The freeze's items (answered + missing). */
  readonly items: number;
  /** The items logged `missing` (a timed-out or skipped freeze); empty for a complete one. */
  readonly missing: readonly string[];
  readonly timedOut: boolean;
  /** More than `maxShare` of the items missing: the view's SA score is excluded. */
  readonly excludedFromSa: boolean;
}

/**
 * Per submitted freeze (the first per view, replayed views dropped, as the scores), its missing items and whether the view's SA score is
 * excluded under the pre-registered rule. A freeze never submitted (the view not reached) is absent, not "all missing".
 */
export function freezeMissing(records: readonly LogRecord[], maxShare: number = MAX_MISSING_SHARE_PER_FREEZE): FreezeMissing[] {
  const replayed = replayedViews(records);
  const seen = new Set<number>();
  const out: FreezeMissing[] = [];
  for (const r of records) {
    if (r.kind !== "freeze_submitted") continue;
    const d = r.detail as FreezeSubmittedDetail;
    const view = d.cycle as number;
    if (replayed.has(view) || seen.has(view)) continue;
    seen.add(view);
    const missing = d.missing ?? [];
    const items = d.responses.length + missing.length;
    out.push({ view, items, missing, timedOut: d.timedOut === true, excludedFromSa: items > 0 && missing.length / items > maxShare });
  }
  return out;
}

/** The views whose SA score is excluded (more than half the freeze's items missing). */
export function viewsExcludedFromSa(records: readonly LogRecord[], maxShare: number = MAX_MISSING_SHARE_PER_FREEZE): number[] {
  return freezeMissing(records, maxShare).filter((f) => f.excludedFromSa).map((f) => f.view);
}

export interface TooFastFreezeAnswer {
  readonly view: number;
  readonly itemId: string;
  /** Real ms spent on the item: since the previous item of the freeze, or since the freeze opened. */
  readonly itemMs: number;
}

/**
 * The first answers (replayed views left out, as `firstFreezeAnswers`) given in under `thresholdMs`
 * on the item, from each answer's `msSinceFreezeOpened`. Answers without it (older logs) are skipped.
 */
export function tooFastFreezeAnswers(records: readonly LogRecord[], thresholdMs: number = TOO_FAST_FREEZE_ANSWER_MS): TooFastFreezeAnswer[] {
  const out: TooFastFreezeAnswer[] = [];
  let previous = { seq: -1, ms: 0 };
  for (const { record, view, answer } of firstFreezeAnswers(records)) {
    if (record.seq !== previous.seq) previous = { seq: record.seq, ms: 0 };
    if (answer.msSinceFreezeOpened === undefined) continue;
    const itemMs = answer.msSinceFreezeOpened - previous.ms;
    previous = { seq: record.seq, ms: answer.msSinceFreezeOpened };
    if (itemMs < thresholdMs) out.push({ view, itemId: answer.itemId, itemMs });
  }
  return out;
}
