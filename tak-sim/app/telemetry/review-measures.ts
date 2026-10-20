/**
 * The plan review at commitment and Paper 2 as signal detection (SPEC/32 §3 Analysis, §4; 20 Oct 2026): pure folds over the
 * log and the directive keys passed in (TRUTH: `app/scenario/demo-directive.ts` may not be imported under app/,
 * `test/boundary/directive-keys-boundary.spec.ts`); analysis only, never called at runtime and never stored (SPEC/07 §1).
 *
 * Operational definitions:
 * - **Keyed views** are those of the existing Paper 2 coding: a key that codes both alignment and soundness (`aligned` and
 *   `sound` not null: V9–V14 with `DIRECTIVE_KEYS`). `fit` is the key's `fit` (`"yes"` true, `"no"` false; null when the key
 *   carries none, and then `departed` is null).
 * - **The attempt** is the one `directiveAdherence` codes (its `attemptStartSeq`: the last attempt of a view replayed after a
 *   resume); every record below is read from that `cycle_start` up to the next `cycle_start`.
 * - **The final plan** is `directiveAdherence(...).atViewEnd` (H13–H15's coded plan, intention to treat).
 * - **The plan before the review** is the last plan of the attempt logged before the view's `plan_review_shown` (the first one in
 *   the attempt with that view's `cycle`), counted as `directiveAdherence` counts plans (the first `allocation_submitted` with a
 *   posture, then the `allocation_revised` after it) and coded with the same `codePosture`. Null with no review or no plan before it.
 * - **Alignment** for a departure: in a no-fit view the act coding (`h15Aligned`, H13's primary since SPEC/31 §3.1), in a fit view
 *   `h14Aligned` (the two are equal there unless a secondary task attends a keyed front, which only no-fit keys name).
 *   `departed` = that alignment is 0 (C or D in a no-fit view; not aligned in a fit view); null with no final plan or no fit.
 * - **`revisedAtReview`**: the review closed with `revise` and an `allocation_revised` with a posture followed in the attempt.
 *   `movedToCAtReview` (H17): revised at the review, the final plan's act cell C, and the plan before it not C.
 * - **`citedRecordOpened`**: a `plan_review_record_opened` of the view after the review was shown and before it closed (before
 *   the attempt's end when no close was logged). `premiseFlagShown`: a premise status `contradicted` in `plan_review_shown`.
 * - **The SDT pair** (`reviewSignalDetection`): hits = departed no-fit views / coded no-fit views; false alarms = departed fit
 *   views / coded fit views ("coded": `departed` not null). Rates are null with no coded view of that kind.
 */

import { codePosture, directiveAdherence, type DirectiveCell, type DirectiveKeyLike, type DirectivePostureCoding } from "./derived-measures.js";
import type { LogRecord } from "./log.js";
import type {
  AllocationRevisedDetail, AllocationSubmittedDetail, PlanReviewClosedDetail, PlanReviewRecordOpenedDetail, PlanReviewShownDetail,
} from "./record-kinds.js";

/** A directive key with the view's fit, as `DIRECTIVE_KEYS` carries it. */
export type ReviewKeyLike = DirectiveKeyLike & { readonly fit?: "neutral" | "yes" | "no" };

export interface ReviewViewMeasure {
  readonly view: number;
  /** The directive fits the view; null when the key carries no fit. */
  readonly fit: boolean | null;
  readonly reviewShown: boolean;
  readonly trigger: PlanReviewShownDetail["trigger"] | null;
  readonly reviewAtViewSeconds: number | null;
  readonly reviewChoice: PlanReviewClosedDetail["choice"] | null;
  readonly reviewDwellMs: number | null;
  readonly revisedAtReview: boolean;
  readonly citedRecordOpened: boolean;
  readonly premiseFlagShown: boolean;
  /** The review's premise lookup failed (the guide group saw the neutral review). */
  readonly premiseError: boolean;
  /** The plan in force when the review was shown; null with no review or no plan before it. */
  readonly beforeReview: DirectivePostureCoding | null;
  readonly cellBefore: DirectiveCell | null;
  /** The departure-relevant alignment (h15 in a no-fit view, h14 in a fit view) of the plan before the review. */
  readonly alignedBefore: 0 | 1 | null;
  /** The final plan (in force at the view's end), as H13–H15 code it. */
  readonly final: DirectivePostureCoding | null;
  readonly cellFinal: DirectiveCell | null;
  readonly alignedFinal: 0 | 1 | null;
  readonly movedToCAtReview: boolean;
  /** SPEC/32 §4: the final plan departs from the directive. Null where not coded. */
  readonly departed: boolean | null;
}

const isPlan = (r: LogRecord) => r.kind === "allocation_submitted" || r.kind === "allocation_revised";
const postureOf = (r: LogRecord): string | undefined => (r.detail as AllocationSubmittedDetail | AllocationRevisedDetail).plan.posture as string | undefined;
const cycleOf = (r: LogRecord): number => (r.detail as { readonly cycle: number }).cycle as number;

function alignmentFor(fit: boolean | null, coding: DirectivePostureCoding | null): 0 | 1 | null {
  if (fit === null || coding === null) return null;
  return fit ? coding.h14Aligned : coding.h15Aligned;
}

/** The records of an attempt: after its `cycle_start` up to the next `cycle_start`. */
function attemptRecords(records: readonly LogRecord[], startSeq: number): LogRecord[] {
  const out: LogRecord[] = [];
  for (const r of records) {
    if ((r.seq as number) <= startSeq) continue;
    if (r.kind === "cycle_start") break;
    out.push(r);
  }
  return out;
}

/** The plans of an attempt as `directiveAdherence` counts them: the first submission with a posture, then the revisions after it. */
function countedPlans(segment: readonly LogRecord[]): LogRecord[] {
  const out: LogRecord[] = [];
  for (const r of segment) {
    if (!isPlan(r) || postureOf(r) === undefined) continue;
    if (r.kind === "allocation_submitted" && out.length === 0) out.push(r);
    else if (r.kind === "allocation_revised" && out.length > 0) out.push(r);
  }
  return out;
}

function codePlan(r: LogRecord, key: DirectiveKeyLike): DirectivePostureCoding {
  const plan = (r.detail as AllocationSubmittedDetail | AllocationRevisedDetail).plan;
  return codePosture(r.seq as number, plan.posture as string, plan.mainEffort, key, plan.secondary ?? null, plan.departureNoted === true);
}

/** One entry per keyed view the log entered (V9–V14 with `DIRECTIVE_KEYS`), in view order. */
export function reviewMeasures(records: readonly LogRecord[], keys: Readonly<Record<number, ReviewKeyLike | null>>): ReviewViewMeasure[] {
  const out: ReviewViewMeasure[] = [];
  for (const a of directiveAdherence(records, keys)) {
    const key = keys[a.view];
    if (!key || key.aligned === null || key.sound === null) continue;
    const fit = key.fit === "yes" ? true : key.fit === "no" ? false : null;
    const segment = attemptRecords(records, a.attemptStartSeq);
    const shown = segment.find((r) => r.kind === "plan_review_shown" && cycleOf(r) === a.view) ?? null;
    const closed = shown ? segment.find((r) => r.kind === "plan_review_closed" && cycleOf(r) === a.view && r.seq > shown.seq) ?? null : null;
    const shownD = shown?.detail as PlanReviewShownDetail | undefined;
    const closedD = closed?.detail as PlanReviewClosedDetail | undefined;
    const plans = countedPlans(segment);
    const before = shown ? plans.filter((p) => p.seq < shown.seq).at(-1) ?? null : null;
    const beforeReview = before ? codePlan(before, key) : null;
    const revisedAtReview = closedD?.choice === "revise" && plans.some((p) => p.kind === "allocation_revised" && p.seq > closed!.seq);
    const citedRecordOpened = shown !== null && segment.some((r) => r.kind === "plan_review_record_opened"
      && (r.detail as PlanReviewRecordOpenedDetail).cycle === a.view && r.seq > shown.seq && (closed === null || r.seq < closed.seq));
    const final = a.atViewEnd;
    const alignedFinal = alignmentFor(fit, final);
    out.push({
      view: a.view, fit, reviewShown: shown !== null, trigger: shownD?.trigger ?? null, reviewAtViewSeconds: shownD?.atViewSeconds ?? null,
      reviewChoice: closedD?.choice ?? null, reviewDwellMs: closedD?.dwellMs ?? null, revisedAtReview, citedRecordOpened,
      premiseFlagShown: (shownD?.premiseStatuses ?? []).some((s) => s.status === "contradicted"),
      premiseError: shownD?.premiseError !== undefined,
      beforeReview, cellBefore: beforeReview?.cellByAct ?? null, alignedBefore: alignmentFor(fit, beforeReview),
      final, cellFinal: final?.cellByAct ?? null, alignedFinal,
      movedToCAtReview: revisedAtReview && final?.cellByAct === "C" && beforeReview?.cellByAct !== "C",
      departed: alignedFinal === null ? null : alignedFinal === 0,
    });
  }
  return out;
}

export interface ReviewSignalDetection {
  /** No-fit views with a coded departure, and those departed (hits). */
  readonly noFitCoded: number;
  readonly hits: number;
  readonly hitRate: number | null;
  /** Fit views with a coded departure, and those departed (false alarms). */
  readonly fitCoded: number;
  readonly falseAlarms: number;
  readonly falseAlarmRate: number | null;
}

/** SPEC/32 §4: one participant's hit and false-alarm rates over the keyed views (`reviewMeasures`). */
export function reviewSignalDetection(views: readonly ReviewViewMeasure[]): ReviewSignalDetection {
  const coded = (fit: boolean) => views.filter((v) => v.fit === fit && v.departed !== null);
  const noFit = coded(false), fitViews = coded(true);
  const hits = noFit.filter((v) => v.departed).length, falseAlarms = fitViews.filter((v) => v.departed).length;
  return {
    noFitCoded: noFit.length, hits, hitRate: noFit.length === 0 ? null : hits / noFit.length,
    fitCoded: fitViews.length, falseAlarms, falseAlarmRate: fitViews.length === 0 ? null : falseAlarms / fitViews.length,
  };
}
