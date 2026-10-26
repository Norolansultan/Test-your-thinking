/**
 * The training incident's pre-registered covariates (SPEC/09 (bp) §bp.1), read from the log's `training_*` records only (format
 * 0.18.0, `07` (bp)). All three are measured before any group-specific content (S5 follows S4's last feedback), from the FIRST answer
 * logged for each item; they are baselines of the person, never an exclusion criterion or a shown score.
 * - `point_visible`: `training.s1.place`'s `errorM` (the R5/R6 junction found on the live map), metres.
 * - `point_memory`: `training.s4.memory`'s `errorM` (EK53 shown for 8 s, then marked on the blank memory-check map), metres.
 * - `seek_first`: `training.s3.records1` — `searchedBefore` (at least one `training_haku_asked` for the item before its answer, i.e.
 *   `hakuBefore` > 0) and `seekLatencyMs` (`atItemMs` of the item's first question; censored at the answer's `rtMs` when none, and
 *   `seekCensored` says so). A timed-out card counts as answered at 0 s: its `hakuBefore` decides `searchedBefore`.
 * A value is null when the item was never answered (the cap ended the training first): the analysis imputes it (`09` (bp)).
 */

import type { LogRecord } from "./log.js";
import type { TrainingAnswerDetail, TrainingHakuAskedDetail } from "./record-kinds-training.js";

export interface TrainingCovariates {
  /** S1's first-try point error on the visible-map item, m (null when not answered). */
  readonly point_visible: number | null;
  /** S4's memory item's first-try error, m. */
  readonly point_memory: number | null;
  /** S3's first records question: did they search before answering, and how soon (censored at the answer when they did not). */
  readonly seek_first: { readonly searchedBefore: boolean | null; readonly seekLatencyMs: number | null; readonly seekCensored?: boolean | null };
}

export const COVARIATE_ITEMS = { point_visible: "training.s1.place", point_memory: "training.s4.memory", seek_first: "training.s3.records1" } as const;

const bySeq = (records: readonly LogRecord[]) => [...records].sort((a, b) => a.seq - b.seq);

/** The first `training_answer` for an item, with its place in the log. */
function firstAnswer(records: readonly LogRecord[], itemId: string): { readonly seq: number; readonly detail: TrainingAnswerDetail } | null {
  const r = bySeq(records).find((x) => x.kind === "training_answer" && (x.detail as TrainingAnswerDetail).itemId === itemId);
  return r ? { seq: r.seq, detail: r.detail as TrainingAnswerDetail } : null;
}

const errorOf = (records: readonly LogRecord[], itemId: string): number | null => {
  const a = firstAnswer(records, itemId);
  return a && typeof a.detail.errorM === "number" ? a.detail.errorM : null;
};

export function trainingCovariates(records: readonly LogRecord[]): TrainingCovariates {
  const item = COVARIATE_ITEMS.seek_first;
  const answer = firstAnswer(records, item);
  let seek: TrainingCovariates["seek_first"] = { searchedBefore: null, seekLatencyMs: null, seekCensored: null };
  if (answer) {
    const asked = bySeq(records).filter((r) => r.kind === "training_haku_asked" && r.seq < answer.seq && (r.detail as TrainingHakuAskedDetail).itemId === item)
      .map((r) => r.detail as TrainingHakuAskedDetail);
    const before = typeof answer.detail.hakuBefore === "number" ? answer.detail.hakuBefore : asked.length;
    const first = asked[0];
    seek = first
      ? { searchedBefore: before > 0, seekLatencyMs: first.atItemMs, seekCensored: false }
      : { searchedBefore: before > 0, seekLatencyMs: answer.detail.rtMs, seekCensored: true };
  }
  return { point_visible: errorOf(records, COVARIATE_ITEMS.point_visible), point_memory: errorOf(records, COVARIATE_ITEMS.point_memory), seek_first: seek };
}
