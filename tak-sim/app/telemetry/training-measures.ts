/**
 * PLACEHOLDER (bp integration stub): work package A replaces this file with the training's covariates (SPEC/09 (bp)). Same exports.
 */

import type { LogRecord } from "./log";

export interface TrainingCovariates {
  /** S1's first-try point error on the visible-map item, m (null when not answered). */
  readonly point_visible: number | null;
  /** S4's memory item's first-try error, m. */
  readonly point_memory: number | null;
  /** S3's first records question: did they search before answering, and how soon. */
  readonly seek_first: { readonly searchedBefore: boolean | null; readonly seekLatencyMs: number | null };
}

export function trainingCovariates(_records: readonly LogRecord[]): TrainingCovariates {
  return { point_visible: null, point_memory: null, seek_first: { searchedBefore: null, seekLatencyMs: null } };
}
