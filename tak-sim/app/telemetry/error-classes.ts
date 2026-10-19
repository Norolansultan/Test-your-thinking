/**
 * The descriptive error-class fold (SPEC/31 §3.9; sagat proposal (c), parity P-4) and two exposure-conditional readings, analysis only:
 * pure folds over the log and the content passed in (TRUTH: the keys, `basisAtomIds`, `basisKind`), never called at runtime, never
 * stored (SPEC/07 §1); the basis fields never reach the session or the render layer.
 *
 * `errorClasses`: one row per scored freeze item (the first answer; a replayed view dropped, `firstFreezeAnswers`), in order:
 * - CORRECT — the answer is right;
 * - STATED_LURE — wrong, and the option chosen is a distractor an AI answer in the stated-key window had stated (`aiStatedKey`
 *   `lureOptionIds`, F16);
 * - STATED_WRONG — wrong, and an answer in the window had stated the key;
 * - NOT_APPLICABLE — wrong, and the item's basis is no record: `basisKind` `knowledge` or `ca_truth`, or no basis record at all
 *   (an item with neither `keyAtomIds` nor `basisAtomIds`: the vacuous "all of none reached" is not an exposure, P-4);
 * - EXPOSED_WRONG — wrong, and the basis had reached the participant before the freeze: every basis record (the item's
 *   `keyAtomIds` ∪ `basisAtomIds`) by any route, or `basisKind` `map` (the map is an identical stimulus: exposed for everyone);
 * - NOT_EXPOSED — wrong, and some basis record had not.
 * Seq-anchored (the view's `freeze_started` before the submission, as `freezeItemExposure`) and route-aware: the model's context counts
 * (`digest`, `recent`; format 0.11.0) unless `includeModelContext` is false, the retrieved-only sensitivity. An old log without the ids
 * classes the guide's digest-only records NOT_EXPOSED (the undercount P-2 describes). `score_freezes.py` is a pilot-2 cross-check only.
 *
 * `exposureConditionalScores` (sagat F30): each scored item with key records, joined to whether they had reached the participant —
 * the retrieval-only L1 items (V2, V4, V5 infra; V12 `longest_shift`) are reported conditional on it.
 *
 * `lureAcceptance` (sagat proposal (b), exploratory): of the items with a known lure (the stale or report-now option: `LureItem`, passed
 * in), the share answered with the lure; a QASA-free acceptance index at no session time.
 */

import type { FreezeItemLevel } from "../scenario/types.js";
import { aiStatedKey, basisRecordIds, type AiStatedKey, type AiStatedKeyOptions } from "./ai-stated-key.js";
import {
  atomExposure, firstFreezeAnswers, freezeItemScores, type AnalysisFreezeItem, type BasisKind, type ExposureOptions, type ExposureRoute,
  type FreezeContentLike,
} from "./freeze-measures.js";
import type { LogRecord } from "./log.js";
import type { CycleStartDetail, FreezeStartedDetail, SpamAnsweredDetail } from "./record-kinds.js";

export type ErrorClass = "CORRECT" | "NOT_EXPOSED" | "EXPOSED_WRONG" | "STATED_WRONG" | "STATED_LURE" | "NOT_APPLICABLE";

export interface ErrorClassRow {
  readonly view: number;
  readonly itemId: string;
  readonly level: FreezeItemLevel;
  readonly correct: boolean;
  readonly errorClass: ErrorClass;
  /** The item's `basisKind`; null when it has none (an L1/L2 item read by its key records). */
  readonly basisKind: BasisKind | null;
  /** The records the exposure reads (`keyAtomIds` ∪ `basisAtomIds`). */
  readonly basisAtomIds: readonly string[];
  /** Every basis record reached before the freeze (true for a `map` basis); null where no exposure applies. */
  readonly exposed: boolean | null;
  /** The routes by which basis records arrived, in order of first arrival. */
  readonly routes: readonly ExposureRoute[];
  /** From `aiStatedKey` (L2/L3 by default); false where no row was given. */
  readonly stated: boolean;
  readonly statedLure: boolean;
  /** The option chosen (null for a map item). */
  readonly optionId: string | null;
}

export interface ErrorClassOptions extends ExposureOptions {
  readonly includeReplayed?: boolean;
  /** The stated-key rows to read; default `aiStatedKey(records, freezes, statedKeyOptions)`. */
  readonly statedKeys?: readonly AiStatedKey[];
  readonly statedKeyOptions?: AiStatedKeyOptions;
}

/** The view's `freeze_started` before `seq` (the latest), else null. */
function freezeAnchorBefore(records: readonly LogRecord[], view: number, seq: number): LogRecord | null {
  let anchor: LogRecord | null = null;
  for (const r of records) {
    if ((r.seq as number) >= seq) break;
    if (r.kind === "freeze_started" && ((r.detail as FreezeStartedDetail).cycle as number) === view) anchor = r;
  }
  return anchor;
}

function exposureOfItem(records: readonly LogRecord[], item: AnalysisFreezeItem, anchorSeq: number, opts: ExposureOptions): { exposed: boolean | null; routes: ExposureRoute[] } {
  const kind = item.basisKind;
  if (kind === "knowledge" || kind === "ca_truth") return { exposed: null, routes: [] };
  if (kind === "map") return { exposed: true, routes: [] };
  const ids = basisRecordIds(item);
  if (ids.length === 0) return { exposed: null, routes: [] };
  const exposure = atomExposure(records, ids, anchorSeq, opts);
  const routes: ExposureRoute[] = [];
  for (const e of exposure) for (const r of e.routes) if (!routes.includes(r)) routes.push(r);
  return { exposed: exposure.every((e) => e.reached), routes };
}

/** The error class of every scored freeze item (SPEC/31 §3.9). */
export function errorClasses(records: readonly LogRecord[], freezes: readonly FreezeContentLike[], opts: ErrorClassOptions = {}): ErrorClassRow[] {
  const index = new Map<string, AnalysisFreezeItem>();
  for (const f of freezes) for (const item of f.items) index.set(`${f.cycle}::${item.id}`, item);
  const stated = new Map((opts.statedKeys ?? aiStatedKey(records, freezes, { ...opts.statedKeyOptions, ...(opts.includeReplayed ? { includeReplayed: true } : {}) }))
    .map((s) => [`${s.view}::${s.itemId}`, s]));
  const scores = new Map(freezeItemScores(records, freezes, opts).map((s) => [`${s.view}::${s.itemId}`, s]));
  const out: ErrorClassRow[] = [];
  for (const { record, view, answer } of firstFreezeAnswers(records, opts)) {
    const k = `${view}::${answer.itemId}`;
    const item = index.get(k), score = scores.get(k);
    if (!item || !score) continue;
    const anchor = freezeAnchorBefore(records, view, record.seq as number) ?? record;
    const { exposed, routes } = exposureOfItem(records, item, anchor.seq as number, opts);
    const s = stated.get(k);
    const optionId = (item.kind ?? "choice") === "choice" ? answer.optionId : null;
    const errorClass: ErrorClass = score.correct ? "CORRECT"
      : optionId !== null && s?.lureOptionIds.includes(optionId) ? "STATED_LURE"
        : s?.stated ? "STATED_WRONG"
          : exposed === null ? "NOT_APPLICABLE"
            : exposed ? "EXPOSED_WRONG" : "NOT_EXPOSED";
    out.push({
      view, itemId: item.id, level: item.level, correct: score.correct, errorClass, basisKind: item.basisKind ?? null, basisAtomIds: basisRecordIds(item),
      exposed, routes, stated: s?.stated ?? false, statedLure: s?.statedLure ?? false, optionId,
    });
  }
  return out;
}

/** The count of each class over rows (all six, zero included), in the order of `ERROR_CLASSES`. */
export const ERROR_CLASSES: readonly ErrorClass[] = ["CORRECT", "STATED_LURE", "STATED_WRONG", "NOT_APPLICABLE", "EXPOSED_WRONG", "NOT_EXPOSED"];
export function errorClassCounts(rows: readonly ErrorClassRow[]): readonly { readonly errorClass: ErrorClass; readonly n: number }[] {
  return ERROR_CLASSES.map((errorClass) => ({ errorClass, n: rows.filter((r) => r.errorClass === errorClass).length }));
}

// ---------------------------------------------------------------------------
// sagat F30: accuracy conditional on exposure
// ---------------------------------------------------------------------------

export interface ExposureConditionalScore {
  readonly view: number;
  readonly itemId: string;
  readonly level: FreezeItemLevel;
  readonly correct: boolean;
  /** Every key record reached the participant before the freeze (the model's context counted unless `includeModelContext` is false). */
  readonly allReached: boolean;
  readonly routes: readonly ExposureRoute[];
}

/** Each scored item with key records, with whether they had all reached the participant before the freeze; `itemIds` narrows them. */
export function exposureConditionalScores(
  records: readonly LogRecord[], freezes: readonly FreezeContentLike[], opts: ExposureOptions & { readonly includeReplayed?: boolean; readonly itemIds?: readonly string[] } = {},
): ExposureConditionalScore[] {
  const index = new Map<string, AnalysisFreezeItem>();
  for (const f of freezes) for (const item of f.items) index.set(`${f.cycle}::${item.id}`, item);
  const scores = new Map(freezeItemScores(records, freezes, opts).map((s) => [`${s.view}::${s.itemId}`, s]));
  const out: ExposureConditionalScore[] = [];
  for (const { record, view, answer } of firstFreezeAnswers(records, opts)) {
    const item = index.get(`${view}::${answer.itemId}`), score = scores.get(`${view}::${answer.itemId}`);
    if (!item || !score || !item.keyAtomIds?.length || (opts.itemIds && !opts.itemIds.includes(item.id))) continue;
    const anchor = freezeAnchorBefore(records, view, record.seq as number) ?? record;
    const exposure = atomExposure(records, item.keyAtomIds, anchor.seq as number, opts);
    const routes: ExposureRoute[] = [];
    for (const e of exposure) for (const r of e.routes) if (!routes.includes(r)) routes.push(r);
    out.push({ view, itemId: item.id, level: item.level, correct: score.correct, allReached: exposure.every((e) => e.reached), routes });
  }
  return out;
}

// ---------------------------------------------------------------------------
// sagat proposal (b): the lure-acceptance index (exploratory)
// ---------------------------------------------------------------------------

/** An item with a known lure: a freeze item (`view`, `itemId`) or a SPAM probe (`itemId` = probe id), and its lure option(s). */
export interface LureItem {
  readonly probe: "freeze" | "spam";
  readonly view: number | null;
  readonly itemId: string;
  readonly lureOptionIds: readonly string[];
}

export interface LureAcceptance {
  readonly items: readonly { readonly itemId: string; readonly view: number; readonly optionId: string; readonly acceptedLure: boolean }[];
  /** Items answered. */
  readonly n: number;
  readonly accepted: number;
  /** accepted / n; null when n = 0. */
  readonly index: number | null;
}

/** The share of lure items answered with their lure (the first answer; a replayed view dropped; a timed-out SPAM answer is missing). */
export function lureAcceptance(records: readonly LogRecord[], lures: readonly LureItem[], opts: { readonly includeReplayed?: boolean } = {}): LureAcceptance {
  const items: { itemId: string; view: number; optionId: string; acceptedLure: boolean }[] = [];
  for (const { view, answer } of firstFreezeAnswers(records, opts)) {
    const lure = lures.find((l) => l.probe === "freeze" && l.view === view && l.itemId === answer.itemId);
    if (lure && answer.optionId) items.push({ itemId: answer.itemId, view, optionId: answer.optionId, acceptedLure: lure.lureOptionIds.includes(answer.optionId) });
  }
  const seen = new Set<string>();
  let view = -1;
  for (const r of records) {
    if (r.kind === "cycle_start") { view = (r.detail as CycleStartDetail).cycle as number; continue; }
    if (r.kind !== "spam_answered") continue;
    const d = r.detail as SpamAnsweredDetail;
    const lure = lures.find((l) => l.probe === "spam" && l.itemId === d.probeId);
    if (!lure || seen.has(d.probeId)) continue;
    seen.add(d.probeId);
    if (d.timedOut || d.response === null) continue;
    items.push({ itemId: d.probeId, view, optionId: d.response, acceptedLure: lure.lureOptionIds.includes(d.response) });
  }
  const accepted = items.filter((i) => i.acceptedLure).length;
  return { items, n: items.length, accepted, index: items.length === 0 ? null : accepted / items.length };
}
