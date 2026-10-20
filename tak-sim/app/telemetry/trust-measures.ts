/**
 * Trust calibration without in-session items (SPEC/32 §5, 20 Oct 2026): pure folds over the log, the freeze content (TRUTH, passed in)
 * and the projection-error schedule; analysis only, never called at runtime and never stored (SPEC/07 §1).
 *
 * Operational definitions:
 * - **The schedule** is `CANONICAL_FLAG_SEQUENCE` (`app/scenario/types.ts`, SPEC/26 §3): the projection's flag in V1–V14, which the
 *   scenario builds every view's projection from (`views.ts`, `demo-scenario.ts`) and whose scoring label is `accuracyLabel`
 *   (`demo-map.ts`): `holds` → correct, `breach_quantitative` → partly, `breach_categorical` → incorrect. **Correct share** = views
 *   whose projection holds / views (7/14 = .5, the debrief's "7 of 14"); `partly` counts as not correct. `correctShareLenient`
 *   counts a partly-correct projection as half (a sensitivity: 8.5/14).
 * - **Stated reliability** is the post-session `reliability.projection` answer, each option mapped to the midpoint of the quarter of
 *   the scale it names: rarely .125, sometimes .375, mostly .625, always .875. Any other value, or none, is null.
 * - **The trust gap** = stated − actual correct share: > 0 the participant believed the projection more reliable than it was.
 * - **Reliance by correctness**: `projectionReliance`'s answers (map items with a projection point, the first answer, replayed views
 *   dropped) split by their view's flag — right (`holds`) or wrong (either breach). Reliance is the share of answers `anchored`
 *   (nearer the projection's head than the true head); `discrimination` = reliance when right − reliance when wrong (> 0 relied on it
 *   more when it held).
 * - **S-TIAS** (McGrath et al. 2025; SPEC/32 §5): the mean of the answered items `stias.tools.1–3` (Haku, everyone) and
 *   `stias.thinker.1–3` (the guide group), 1–7. An item's value is its first non-null answer over the `questionnaire_submitted`
 *   records (`notShown` is no answer); it counts when that is an integer 1–7 (a number, or a numeric string), else it is unanswered.
 *   Null with no answered item.
 */

import { CANONICAL_FLAG_SEQUENCE, type Flag } from "../scenario/types.js";
import { projectionReliance, type FreezeContentLike, type ProjectionRelianceAnswer } from "./freeze-measures.js";
import type { LogRecord } from "./log.js";
import type { QuestionnaireSubmittedDetail } from "./record-kinds.js";

export const RELIABILITY_PROJECTION_ITEM_ID = "reliability.projection";

/** The stated-reliability options mapped to the midpoint of the quarter they name. */
export const STATED_RELIABILITY_VALUE: ReadonlyMap<string, number> = new Map([["rarely", 0.125], ["sometimes", 0.375], ["mostly", 0.625], ["always", 0.875]]);

export interface ProjectionCorrectShare {
  readonly views: number;
  readonly holds: number;
  readonly partly: number;
  readonly correctShare: number;
  readonly correctShareLenient: number;
}

/** The projection's actual correct share over a flag schedule (default the fourteen main views'). */
export function projectionCorrectShare(schedule: readonly Flag[] = CANONICAL_FLAG_SEQUENCE): ProjectionCorrectShare {
  const holds = schedule.filter((f) => f === "holds").length, partly = schedule.filter((f) => f === "breach_quantitative").length;
  const n = schedule.length;
  return { views: n, holds, partly, correctShare: n === 0 ? 0 : holds / n, correctShareLenient: n === 0 ? 0 : (holds + partly / 2) / n };
}

/** The first non-null answer to an item over the questionnaires submitted, in log order (a `notShown` item has no answer). */
export function questionnaireValue(records: readonly LogRecord[], itemId: string): QuestionnaireSubmittedDetail["answers"][number]["value"] {
  for (const r of records) {
    if (r.kind !== "questionnaire_submitted") continue;
    const a = (r.detail as QuestionnaireSubmittedDetail).answers.find((x) => x.itemId === itemId);
    if (a && a.notShown !== true && a.value !== null) return a.value;
  }
  return null;
}

export interface ProjectionTrustGap {
  readonly statedOption: string | null;
  readonly stated: number | null;
  readonly actual: number;
  /** stated − actual; null when no reliability was stated. */
  readonly gap: number | null;
}

export function projectionTrustGap(records: readonly LogRecord[], schedule: readonly Flag[] = CANONICAL_FLAG_SEQUENCE): ProjectionTrustGap {
  const value = questionnaireValue(records, RELIABILITY_PROJECTION_ITEM_ID);
  const option = typeof value === "string" ? value : null;
  const stated = option === null ? null : STATED_RELIABILITY_VALUE.get(option) ?? null;
  const actual = projectionCorrectShare(schedule).correctShare;
  return { statedOption: stated === null ? null : option, stated, actual, gap: stated === null ? null : stated - actual };
}

export interface RelianceGroup {
  readonly n: number;
  readonly anchored: number;
  /** anchored / n; null when n = 0. */
  readonly reliance: number | null;
  readonly meanConfidence: number | null;
}

export interface RelianceByCorrectness {
  readonly right: RelianceGroup;
  readonly wrong: RelianceGroup;
  /** Reliance when right − reliance when wrong; null when either is missing. */
  readonly discrimination: number | null;
  /** The answers read, with their view's flag (null: a view outside the schedule, left out of both groups). */
  readonly answers: readonly (ProjectionRelianceAnswer & { readonly flag: Flag | null })[];
}

function group(xs: readonly ProjectionRelianceAnswer[]): RelianceGroup {
  const n = xs.length, anchored = xs.filter((x) => x.anchored).length;
  return { n, anchored, reliance: n === 0 ? null : anchored / n, meanConfidence: n === 0 ? null : xs.reduce((s, x) => s + x.confidence, 0) / n };
}

/** Projection reliance split by whether the view's projection held (the schedule is indexed by view − 1). */
export function relianceByProjectionCorrectness(
  records: readonly LogRecord[], freezes: readonly FreezeContentLike[], schedule: readonly Flag[] = CANONICAL_FLAG_SEQUENCE,
): RelianceByCorrectness {
  const answers = projectionReliance(records, freezes).map((a) => ({ ...a, flag: schedule[a.view - 1] ?? null }));
  const right = group(answers.filter((a) => a.flag === "holds")), wrong = group(answers.filter((a) => a.flag !== null && a.flag !== "holds"));
  return { right, wrong, discrimination: right.reliance === null || wrong.reliance === null ? null : right.reliance - wrong.reliance, answers };
}

export type StiasScale = "tools" | "thinker";
export const STIAS_ITEM_IDS: Readonly<Record<StiasScale, readonly string[]>> = {
  tools: ["stias.tools.1", "stias.tools.2", "stias.tools.3"],
  thinker: ["stias.thinker.1", "stias.thinker.2", "stias.thinker.3"],
};

export interface StiasScore {
  readonly answered: number;
  readonly mean: number | null;
}

function scale7(value: QuestionnaireSubmittedDetail["answers"][number]["value"]): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null;
}

/** The S-TIAS mean of one scale: the mean of its answered items (1–7). */
export function stiasMean(records: readonly LogRecord[], scale: StiasScale): StiasScore {
  const values = STIAS_ITEM_IDS[scale].map((id) => scale7(questionnaireValue(records, id))).filter((v): v is number => v !== null);
  return { answered: values.length, mean: values.length === 0 ? null : values.reduce((s, v) => s + v, 0) / values.length };
}
