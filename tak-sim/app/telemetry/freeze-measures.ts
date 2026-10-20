/**
 * Freeze (SAGAT) measures, 2 Oct 2026 — SPEC/07 §4 and its 2 Oct amendment; SPEC/09 Amendment
 * 2 Oct 2026 (H2 power with the 6-item freezes).
 *
 * Pure folds over the log plus the freeze content, passed in (never a global), in the style of
 * `derived-measures.ts`, and never stored back into the log (SPEC/07 §1). They work on any
 * `FreezeSpec[]`: the item bank is being rewritten, so nothing here names an item.
 *
 * - `freezeItemScores`: every answered item scored against its key — a `choice` item by the chosen
 *   option's `correct`, a `map_point` item by the tap's distance to `mapKey.point` (≤ `toleranceM`).
 *   F7's planted option is simply wrong here; H9 codes it elsewhere.
 * - `freezeItemExposure`: for items with `keyAtomIds`, whether each key atom had reached the
 *   participant before the view's `freeze_started`, by which route, and how long before — so an
 *   L1 error can be read as "not yet arrived" vs "arrived and lost".
 * - `calibrationPairs`: the confidence–accuracy pairs of a level/view window (default: H2's primary
 *   window, every L2/L3 item of the V2, V4, V5, V7 freezes — 24 since SPEC/30 §5.1, counted from the content, never
 *   assumed), with a Brier score and the over/under-confidence gap (H2's per-participant outcome).
 * - `aiStatedKey` (SPEC/30 §5.3, `ai-stated-key.ts`, re-exported here): whether an AI answer before the freeze stated
 *   an L2/L3 item's key; H2, H2t and H-T are folded in `teaming-measures.ts`.
 * - `lowestConfidenceShare` (SPEC/32 §7): the share of first answers given at confidence 25, overall and over L2/L3.
 */
export { aiStatedKey, shownAnswers, type AiStatedKey, type AiStatedKeyOptions, type StatingTool } from "./ai-stated-key.js";

import type { LatLon } from "../engine/primitives.js";
import { DESIGNED_EVENT_IDS, type FreezeItem, type FreezeItemLevel } from "../scenario/types.js";
import type { StatementFields } from "./key-statement-match.js";
import type { LogRecord } from "./log.js";
import type {
  AiChatAnswerReceivedDetail,
  BubbleAvailableDetail,
  FreezeItemAnsweredDetail,
  FreezeStartedDetail,
  FreezeSubmittedDetail,
  SessionResumedDetail,
  NavQuerySubmittedDetail,
  QuerySubmittedDetail,
  ResultItemDetail,
  TrafficReturnedDetail,
} from "./record-kinds.js";

/**
 * What an L3 item's projection rests on (SPEC/31 §3.9; WP-2 adds the fields to the bank's items, analysis metadata never in the session
 * or the render layer): `record` — the delivered records `basisAtomIds`; `map` — the map, an identical stimulus (counts as exposed);
 * `knowledge`, `ca_truth` — no record (the error-class fold gives NOT_APPLICABLE).
 */
export type BasisKind = "record" | "map" | "knowledge" | "ca_truth";
export const BASIS_KINDS: readonly BasisKind[] = ["record", "map", "knowledge", "ca_truth"];

/** The basis fields an item may carry (optional: the fold and the stated-key window read them when present). */
export interface BasisFields {
  readonly basisAtomIds?: readonly string[];
  readonly basisKind?: BasisKind;
}

/** A freeze item as the analysis reads it: the bank's item with its optional analysis-only fields (statements, basis). */
export type AnalysisFreezeItem = FreezeItem & StatementFields & BasisFields;

/** A freeze's content as scoring needs it: `FreezeSpec`, or the practice freeze (cycle 0). */
export interface FreezeContentLike {
  readonly cycle: number;
  readonly items: readonly AnalysisFreezeItem[];
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

export interface FreezeItemScore {
  readonly view: number;
  readonly itemId: string;
  readonly level: FreezeItemLevel;
  readonly goal: NonNullable<FreezeItem["goal"]> | null;
  readonly kind: "choice" | "map_point";
  readonly correct: boolean;
  /** `map_point` items: metres from the tap to the key point (null when no point was logged). Null for `choice`. */
  readonly distanceM: number | null;
  /** 25 | 50 | 75 | 100. */
  readonly confidence: number;
  /** Self-reported source (L2/L3 only since 2 Oct 2026); null when not asked. */
  readonly source: string | null;
}

const EARTH_RADIUS_M = 6_371_008.8; // IUGG mean radius

/** Great-circle distance in metres (haversine; WGS84 treated as a sphere — sub-metre error at the site's scale). */
export function haversineMetres(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function itemIndex(freezes: readonly FreezeContentLike[]): Map<string, FreezeItem> {
  const index = new Map<string, FreezeItem>();
  for (const f of freezes) for (const item of f.items) index.set(`${f.cycle}::${item.id}`, item);
  return index;
}

// ---------------------------------------------------------------------------
// Replayed freezes (final fix pass, 8 Oct 2026): a view can be shown twice (an interruption, then
// `session_resumed` with that view as `cycleReplayed`), and a freeze can be submitted twice. The
// scores keep only the FIRST answer to each (view, item), and drop a replayed view altogether: the
// participant has seen its content and its freeze before, so a second pass is not a fresh measure.
// ---------------------------------------------------------------------------

/**
 * The views replayed after a `session_resumed` (`cycleReplayed`, when the session re-entered at a view's start:
 * `resumedAt` "view", or absent in logs from before the browser resume was wired).
 */
export function replayedViews(records: readonly LogRecord[]): Set<number> {
  const views = new Set<number>();
  for (const r of records) {
    if (r.kind !== "session_resumed") continue;
    const d = r.detail as SessionResumedDetail;
    if (d.resumedAt === undefined || d.resumedAt === "view") views.add(d.cycleReplayed as number);
  }
  return views;
}

/** One answer to one freeze item, with the `freeze_submitted` record it came in. */
export interface FreezeAnswerRecord {
  readonly record: LogRecord;
  readonly view: number;
  readonly answer: FreezeItemAnsweredDetail;
}

/**
 * The answers that count: the first answer logged for each (view, item), in log order, leaving out the views of
 * `replayedViews` unless `includeReplayed` (a sensitivity analysis).
 */
export function firstFreezeAnswers(records: readonly LogRecord[], opts: { readonly includeReplayed?: boolean } = {}): FreezeAnswerRecord[] {
  const replayed = opts.includeReplayed ? new Set<number>() : replayedViews(records);
  const seen = new Set<string>();
  const out: FreezeAnswerRecord[] = [];
  for (const r of records) {
    if (r.kind !== "freeze_submitted") continue;
    const view = (r.detail as FreezeSubmittedDetail).cycle as number;
    if (replayed.has(view)) continue;
    for (const answer of (r.detail as FreezeSubmittedDetail).responses) {
      const k = `${view}::${answer.itemId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ record: r, view, answer });
    }
  }
  return out;
}

/**
 * Scores every answered item of every `freeze_submitted` (the first answer per item, replayed views dropped: `firstFreezeAnswers`).
 * An answer whose item is not in the content passed for that view is skipped (content passed for a subset of views scores that subset).
 * A log/content mismatch that makes scoring impossible — an unknown option id, a map item without
 * `mapKey` — throws: a silently wrong score is worse than a failed analysis.
 */
export function freezeItemScores(records: readonly LogRecord[], freezes: readonly FreezeContentLike[], opts: { readonly includeReplayed?: boolean } = {}): FreezeItemScore[] {
  const index = itemIndex(freezes);
  const scores: FreezeItemScore[] = [];
  for (const { view, answer } of firstFreezeAnswers(records, opts)) {
    const item = index.get(`${view}::${answer.itemId}`);
    if (!item) continue;
    const kind = item.kind ?? "choice";
    let correct: boolean;
    let distanceM: number | null = null;
    if (kind === "map_point") {
      if (!item.mapKey) throw new Error(`freeze item ${item.id} (V${view}) is map_point but has no mapKey`);
      if (answer.point) {
        distanceM = haversineMetres(answer.point, item.mapKey.point);
        correct = distanceM <= item.mapKey.toleranceM;
      } else {
        correct = false;
      }
    } else {
      const option = item.options.find((o) => o.id === answer.optionId);
      if (!option) throw new Error(`freeze item ${item.id} (V${view}): logged option ${answer.optionId} is not in the content`);
      correct = option.correct;
    }
    scores.push({
      view, itemId: item.id, level: item.level, goal: item.goal ?? null, kind, correct, distanceM,
      confidence: answer.confidence, source: answer.source ?? null,
    });
  }
  return scores;
}

// ---------------------------------------------------------------------------
// The lowest-confidence share (SPEC/32 §7, 20 Oct 2026; exploratory "don't know" index): of the first freeze answers (replayed views
// dropped, `firstFreezeAnswers`), the share given at the scale's lowest step, 25. `all` reads every first answer, practice view included
// only when its freeze is in the log; `l2l3` only the answers whose item the content passed lists as L2 or L3 (an item not in the
// content is left out of it). A share is null with no answer.
// ---------------------------------------------------------------------------

export const LOWEST_CONFIDENCE = 25;

export interface LowestConfidenceShare {
  readonly all: { readonly n: number; readonly lowest: number; readonly share: number | null };
  readonly l2l3: { readonly n: number; readonly lowest: number; readonly share: number | null };
}

export function lowestConfidenceShare(
  records: readonly LogRecord[], freezes: readonly FreezeContentLike[], opts: { readonly includeReplayed?: boolean; readonly views?: readonly number[] } = {},
): LowestConfidenceShare {
  const index = itemIndex(freezes);
  const answers = firstFreezeAnswers(records, opts).filter((a) => !opts.views || opts.views.includes(a.view));
  const share = (xs: readonly FreezeAnswerRecord[]) => {
    const lowest = xs.filter((a) => a.answer.confidence === LOWEST_CONFIDENCE).length;
    return { n: xs.length, lowest, share: xs.length === 0 ? null : lowest / xs.length };
  };
  const level = (a: FreezeAnswerRecord) => index.get(`${a.view}::${a.answer.itemId}`)?.level;
  return { all: share(answers), l2l3: share(answers.filter((a) => level(a) === "L2" || level(a) === "L3")) };
}

// ---------------------------------------------------------------------------
// The planted false record (F7, V12; SPEC/08 revision (o)): did the participant hold the planted value?
// ---------------------------------------------------------------------------

/** F7's item id and its planted option (`demo-probes.ts`: `freeze.12.f7`, `F7_FALSE_OPTION_ID`; a test holds the two together). */
export const F7_ITEM_ID = "freeze.12.f7";
export const F7_PLANTED_OPTION_ID = "de_energised";

export interface PlantedFalseValue {
  readonly view: number;
  readonly itemId: string;
  /** The first answer chose the planted (false) option: the planted record's value was held after the view. */
  readonly held: boolean;
  /** 25 | 50 | 75 | 100. */
  readonly confidence: number;
}

/**
 * H9's measure from the V12 F7 freeze answer: whether the participant answered with the planted false value, and how sure.
 * Null when F7 was not answered (the view not reached, skipped, or replayed: `firstFreezeAnswers`).
 */
export function plantedFalseValueHeld(
  records: readonly LogRecord[], opts: { readonly itemId?: string; readonly plantedOptionId?: string } = {},
): PlantedFalseValue | null {
  const itemId = opts.itemId ?? F7_ITEM_ID, planted = opts.plantedOptionId ?? F7_PLANTED_OPTION_ID;
  const hit = firstFreezeAnswers(records).find((a) => a.answer.itemId === itemId);
  if (!hit) return null;
  return { view: hit.view, itemId, held: hit.answer.optionId === planted, confidence: hit.answer.confidence };
}

// ---------------------------------------------------------------------------
// Exposure to the planted record (fix pass 6, H9): did the participant meet the planted false record (step 8:
// "20 kV linja jännitteetön, vahvistettu." (110 kV before SPEC/33 (bc))), and also the grid operator's own record that contradicts it (step 6: the line
// is live, de-energising only requested), before the V12 freeze was shown? Read from the same arrivals as `freezeItemExposure`
// (a pushed bubble, a Haku result, a Thinker retrieval); a retrieval is not proof it was read.
// ---------------------------------------------------------------------------

/** The planted false record's atom id (`DESIGNED_EVENT_IDS.planted`) and the grid operator's contradicting record. */
export const F7_PLANTED_ATOM_ID: string = DESIGNED_EVENT_IDS.planted;
export const F7_GRID_ATOM_ID: string = DESIGNED_EVENT_IDS.gridRecord;

export interface PlantedExposure {
  readonly view: number;
  /** The planted record reached the participant before `freeze_started`. */
  readonly metPlanted: boolean;
  /** The grid operator's record did too. */
  readonly metGrid: boolean;
  /** "planted_only": the planted record alone (the false value had no contradicting record beside it); "planted_and_grid": both; "grid_only"; "neither". */
  readonly exposure: "neither" | "planted_only" | "grid_only" | "planted_and_grid";
  readonly planted: KeyAtomExposure;
  readonly grid: KeyAtomExposure;
}

/**
 * Null when the V12 freeze was never shown. The F7 view is `F7_ITEM_ID`'s (12). SPEC/31 §3.6: the same exposure definition as the
 * freeze items' — retrieved ∪ digest ∪ recent (the guide's digest carries the grid record at steps 6–7 and the planted one at step 8,
 * parity P-2); `includeModelContext: false` is the retrieved-only sensitivity.
 */
export function plantedExposure(records: readonly LogRecord[], view = 12, opts: ExposureOptions = {}): PlantedExposure | null {
  const start = records.find((r) => r.kind === "freeze_started" && (r.detail as FreezeStartedDetail).cycle === view);
  if (!start) return null;
  const [planted, grid] = atomExposure(records, [F7_PLANTED_ATOM_ID, F7_GRID_ATOM_ID], start.seq as number, opts) as [KeyAtomExposure, KeyAtomExposure];
  const exposure = planted.reached ? (grid.reached ? "planted_and_grid" : "planted_only") : grid.reached ? "grid_only" : "neither";
  return { view, metPlanted: planted.reached, metGrid: grid.reached, exposure, planted, grid };
}

// ---------------------------------------------------------------------------
// Projection reliance (revision (x), 6 Oct 2026; exploratory): no question asks whether the projection
// holds, so reliance on it is read from where a `head_later` tap lands — nearer the projection's head
// at that clock (`projectionPoint`) or nearer the true head (`mapKey.point`).
// ---------------------------------------------------------------------------

export interface ProjectionRelianceAnswer {
  readonly view: number;
  readonly itemId: string;
  /** Metres from the tap to the true head and to the projection's head at the item's clock. */
  readonly toTruthM: number;
  readonly toProjectionM: number;
  /** The tap is nearer the projection's head than the true head. */
  readonly anchored: boolean;
  readonly confidence: number;
}

/**
 * Every answered map item that carries a `projectionPoint` (TRUTH, passed in with the content), with the
 * tap's distance to both heads. Unanswered taps are left out. Whether the projection held in the view is
 * the analysis's to join (the view's flag). Three items carry a `projectionPoint` (V2's and V12's ask
 * beyond their view's projection): V4 (breach; the heads 847 m apart), V5 (holds; 619 m apart, the
 * projection reaching further than the fire) and V14 (breach; only 122 m apart, inside the 300 m
 * tolerance, so it hardly discriminates). Exploratory: three items, two in phase A.
 */
export function projectionReliance(records: readonly LogRecord[], freezes: readonly FreezeContentLike[], opts: { readonly includeReplayed?: boolean } = {}): ProjectionRelianceAnswer[] {
  const index = itemIndex(freezes);
  const out: ProjectionRelianceAnswer[] = [];
  for (const { view, answer } of firstFreezeAnswers(records, opts)) {
    const item = index.get(`${view}::${answer.itemId}`);
    if (!item?.projectionPoint || !item.mapKey || !answer.point) continue;
    const toTruthM = haversineMetres(answer.point, item.mapKey.point);
    const toProjectionM = haversineMetres(answer.point, item.projectionPoint);
    out.push({ view, itemId: item.id, toTruthM, toProjectionM, anchored: toProjectionM < toTruthM, confidence: answer.confidence });
  }
  return out;
}

export interface ProjectionChoiceAnswer {
  readonly view: number;
  readonly itemId: string;
  readonly optionId: string;
  /** "projection": the option the view's projection implies (`projectionOptionId`); "report": the report-keyed key; "other". */
  readonly reading: "projection" | "report" | "other";
  readonly confidence: number;
}

/**
 * The projection-direction key's freeze reading (fix pass 7, 9 Oct 2026; `projectionOptionFor` in `freeze-keys.ts`): every first answer to a choice item
 * that carries a `projectionOptionId` (TRUTH, passed in with the content; V14 `se_front_r2`), read as projection-anchored, report-anchored
 * or other. Exploratory; in V14 the projection's band is also the band of the distance on record now (SPEC/09 revision (ad)).
 */
export function projectionChoiceReliance(records: readonly LogRecord[], freezes: readonly FreezeContentLike[], opts: { readonly includeReplayed?: boolean } = {}): ProjectionChoiceAnswer[] {
  const index = itemIndex(freezes);
  const out: ProjectionChoiceAnswer[] = [];
  for (const { view, answer } of firstFreezeAnswers(records, opts)) {
    const item = index.get(`${view}::${answer.itemId}`);
    if (!item?.projectionOptionId) continue;
    const key = item.options.find((o) => o.correct)?.id;
    const reading = answer.optionId === item.projectionOptionId ? "projection" : answer.optionId === key ? "report" : "other";
    out.push({ view, itemId: item.id, optionId: answer.optionId, reading, confidence: answer.confidence });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exposure: had the key's information arrived before the freeze?
// ---------------------------------------------------------------------------

/**
 * How an atom reached the participant:
 * - `bubble`: pushed into the message log (`bubble_available.atomId`);
 * - `haku`: shown in a builder result (`nav_query_submitted.resultAtomIds`) or a free-text result
 *   (`query_submitted.resultAtomIds`, logged from 6 Oct 2026);
 * - `thinker`: retrieved for an Open Thinker answer (`ai_chat_answer_received.retrieved[].id`, `tool`
 *   "open_thinker", or absent in logs before 8 Oct 2026: the old structured Thinker) — retrieved for the
 *   answer, which does not prove the answer's text relayed it;
 * - `haku_chat`: retrieved for an answer of Haku's chat (`tool` "haku"; 8 Oct 2026: Haku's chat runs in
 *   every cell, so it is kept apart from both `haku` results and the AI condition's `thinker`);
 * - `traffic`, `result_expanded`: older records (`traffic_returned.entryIds`, `result_item_expanded`),
 *   kept so logs from earlier formats score. `retrieval_returned` carries package ids, not atom
 *   ids, and is not read.
 * - `digest`, `recent` (format 0.11.0; SPEC/31 §3.6, parity P-2): put in the model's context WITHOUT a search — the Open Thinker's
 *   digest of the step's latest records (`ai_chat_answer_received.digestAtomIds`; the guide only) and both chats' best matches among
 *   the current step's records (`recentAtomIds`). Not counted for a fallback answer (no model answer was shown: the Open Thinker
 *   shows "unavailable", Haku's template reads `retrieved` only). Absent in older logs, which still score (without them).
 *   The pre-registered exposure is retrieved ∪ digest ∪ recent; `includeModelContext: false` drops these two routes, the
 *   retrieved-only sensitivity (SPEC/09 (ay)).
 */
export type ExposureRoute = "bubble" | "haku" | "haku_chat" | "thinker" | "digest" | "recent" | "traffic" | "result_expanded";

/** The routes that reach the model without a search (`includeModelContext: false` leaves them out). */
export const MODEL_CONTEXT_ROUTES: readonly ExposureRoute[] = ["digest", "recent"];

/** Exposure options: the primary definition counts the model's context (digest, recent matches); false is the retrieved-only sensitivity. */
export interface ExposureOptions {
  readonly includeModelContext?: boolean;
}

export interface KeyAtomExposure {
  readonly atomId: string;
  readonly reached: boolean;
  /** The route of the earliest arrival before the freeze. */
  readonly route: ExposureRoute | null;
  /** Every route that delivered it before the freeze, in order of first arrival. */
  readonly routes: readonly ExposureRoute[];
  /** `freeze_started.tWallOffsetMs` − the earliest arrival's `tWallOffsetMs` (real ms). */
  readonly msBeforeFreeze: number | null;
}

export interface FreezeItemExposure {
  readonly view: number;
  readonly itemId: string;
  readonly level: FreezeItemLevel;
  readonly keyAtoms: readonly KeyAtomExposure[];
  readonly allReached: boolean;
}

interface Arrival {
  readonly seq: number;
  readonly tWallOffsetMs: number;
  readonly route: ExposureRoute;
}

function atomIdsDelivered(r: LogRecord): readonly { atomId: string; route: ExposureRoute }[] {
  switch (r.kind) {
    case "bubble_available":
      return [{ atomId: (r.detail as BubbleAvailableDetail).atomId, route: "bubble" }];
    case "nav_query_submitted":
      return (r.detail as NavQuerySubmittedDetail).resultAtomIds.map((atomId) => ({ atomId, route: "haku" as const }));
    case "query_submitted":
      return ((r.detail as QuerySubmittedDetail).resultAtomIds ?? []).map((atomId) => ({ atomId, route: "haku" as const }));
    case "ai_chat_answer_received": {
      const d = r.detail as AiChatAnswerReceivedDetail;
      const route: ExposureRoute = d.tool === "haku" ? "haku_chat" : "thinker";
      const retrieved = d.retrieved.map((x) => ({ atomId: x.id, route }));
      if (d.fallback) return retrieved;
      return [
        ...retrieved,
        ...(d.digestAtomIds ?? []).map((atomId) => ({ atomId, route: "digest" as const })),
        ...(d.recentAtomIds ?? []).map((atomId) => ({ atomId, route: "recent" as const })),
      ];
    }
    case "traffic_returned":
      return (r.detail as TrafficReturnedDetail).entryIds.map((atomId) => ({ atomId, route: "traffic" as const }));
    case "result_item_expanded":
      return [{ atomId: (r.detail as ResultItemDetail).atomId, route: "result_expanded" }];
    default:
      return [];
  }
}

/** Every arrival per atom, in log order; without the model-context routes when `includeModelContext` is false. */
function arrivalsByAtom(records: readonly LogRecord[], opts: ExposureOptions = {}): Map<string, Arrival[]> {
  const arrivals = new Map<string, Arrival[]>();
  const drop = opts.includeModelContext === false ? MODEL_CONTEXT_ROUTES : [];
  for (const r of records) {
    for (const { atomId, route } of atomIdsDelivered(r)) {
      if (drop.includes(route)) continue;
      const list = arrivals.get(atomId) ?? [];
      list.push({ seq: r.seq as number, tWallOffsetMs: r.tWallOffsetMs, route });
      arrivals.set(atomId, list);
    }
  }
  return arrivals;
}

function exposureOf(atomId: string, arrivals: ReadonlyMap<string, readonly Arrival[]>, anchorSeq: number, anchorWallMs: number | null): KeyAtomExposure {
  const before = (arrivals.get(atomId) ?? []).filter((a) => a.seq < anchorSeq);
  const first = before[0];
  const routes: ExposureRoute[] = [];
  for (const a of before) if (!routes.includes(a.route)) routes.push(a.route);
  return {
    atomId, reached: first !== undefined, route: first?.route ?? null, routes,
    msBeforeFreeze: first && anchorWallMs !== null ? anchorWallMs - first.tWallOffsetMs : null,
  };
}

/**
 * Whether each of `atomIds` had reached the participant before the record with `seq` `beforeSeq`, by which routes
 * (pushed `bubble`; recorded `haku` results; `haku_chat` and open-`thinker` retrievals; the older `traffic` and
 * `result_expanded`), and how long before that record (`msBeforeFreeze`: null when no record has that seq). A retrieval
 * is not proof the answer relayed the atom — `answerRelaysAtom` screens for that. Exported for the exposure measures
 * of Paper 2 (an atom met before a plan, not only before a freeze). Since format 0.11.0 the model's context counts too (`digest`,
 * `recent`); `{ includeModelContext: false }` is the retrieved-only sensitivity.
 */
export function atomExposure(records: readonly LogRecord[], atomIds: readonly string[], beforeSeq: number, opts: ExposureOptions = {}): KeyAtomExposure[] {
  const arrivals = arrivalsByAtom(records, opts);
  const anchor = records.find((r) => (r.seq as number) === beforeSeq);
  return atomIds.map((atomId) => exposureOf(atomId, arrivals, beforeSeq, anchor ? anchor.tWallOffsetMs : null));
}

/**
 * For each answered item with `keyAtomIds`, whether each key atom reached the participant before the
 * view's `freeze_started` (the latest one for that view logged before the submission; the
 * submission itself if no start was logged). A Thinker answer received during the freeze is after
 * the anchor and does not count. Items without key atoms are omitted. As for the scores, only the first
 * answer to an item counts and a replayed view is dropped (`firstFreezeAnswers`). The model's context counts (format 0.11.0) unless
 * `includeModelContext` is false (the retrieved-only sensitivity); sagat F30's retrieval-only L1 items are read conditional on this.
 */
export function freezeItemExposure(
  records: readonly LogRecord[], freezes: readonly FreezeContentLike[], opts: { readonly includeReplayed?: boolean } & ExposureOptions = {},
): FreezeItemExposure[] {
  const index = itemIndex(freezes);
  const arrivals = arrivalsByAtom(records, opts);
  const starts: { readonly view: number; readonly record: LogRecord }[] = [];
  for (const r of records) if (r.kind === "freeze_started") starts.push({ view: (r.detail as FreezeStartedDetail).cycle as number, record: r });
  const out: FreezeItemExposure[] = [];
  for (const { record, view, answer } of firstFreezeAnswers(records, opts)) {
    const item = index.get(`${view}::${answer.itemId}`);
    if (!item?.keyAtomIds || item.keyAtomIds.length === 0) continue;
    const anchor = starts.filter((s) => s.view === view && (s.record.seq as number) < (record.seq as number)).at(-1)?.record ?? record;
    const keyAtoms = item.keyAtomIds.map((atomId) => exposureOf(atomId, arrivals, anchor.seq as number, anchor.tWallOffsetMs));
    out.push({ view, itemId: item.id, level: item.level, keyAtoms, allReached: keyAtoms.every((k) => k.reached) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Did an answer relay an atom? A screening aid for the coders, not a code.
// ---------------------------------------------------------------------------

export interface AtomRelay {
  /** The heuristic's verdict: the answer repeats enough of the atom's key phrases. */
  readonly relays: boolean;
  /** The atom's key phrases, and those found in the answer (normalised, lower case). */
  readonly phrases: readonly string[];
  readonly matched: readonly string[];
}

const normalise = (text: string): string =>
  text.toLowerCase().replace(/(\d),(\d)/g, "$1.$2").replace(/(\d)\s+(?=(?:ha|km|m\/min|m\/s|min|%|m|h)\b)/g, "$1").replace(/(\d{1,2})[.:](\d{2})(?!\d|ha|km|m|min|%|h)/g, "$1:$2");

/** Quantities ("380m", "8.8m/min", "0.8ha") and clock times ("19:47") of a normalised text. */
function quantityPhrases(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?<![–\-\d.])\d+(?:\.\d+)?(?:ha|km|m\/min|m\/s|min|%|m|h)(?![a-zäö])/g)) out.add(m[0]); // not the end of a range ("0,3–1 m")
  for (const m of text.matchAll(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)) out.add(m[0]);
  return [...out];
}

/** Identifiers ("ek12", "r2", "l3") and place-name stems (the first six letters of a capitalised word of five or more, so Finnish endings do not matter). */
function namePhrases(original: string): string[] {
  const out = new Set<string>();
  for (const m of original.matchAll(/\b[A-ZÄÖ]{1,5}\d{1,2}\b/g)) out.add(m[0].toLowerCase());
  for (const m of original.matchAll(/(?<=[a-zäöå0-9,;:)] )[A-ZÄÖ][a-zäöå]{4,}/g)) out.add(m[0].toLowerCase().slice(0, 6));
  return [...out];
}

/**
 * Deterministic screen for "the answer says what this atom says": the atom's key phrases — its quantities and clock times, its unit and place
 * names — looked up in the answer's text (`atomText` should be in the answer's language: the English record for an English session). Relayed
 * when every quantity the atom holds and at least one name (when it holds any) appear, or, for an atom with no quantity, at least half of its
 * names and not fewer than two (one, if that is all it has). A SCREENING AID for the blind coding of whether an answer relayed an atom: it
 * misses paraphrase and can match an answer that cites a number for another reason, so the coders decide.
 */
export function answerRelaysAtom(answerText: string, atomText: string): AtomRelay {
  const answer = normalise(answerText);
  const quantities = quantityPhrases(normalise(atomText));
  const names = namePhrases(atomText);
  const phrases = [...quantities, ...names];
  const found = (p: string) => answer.includes(p);
  const matched = phrases.filter(found);
  const q = quantities.filter(found).length, n = names.filter(found).length;
  const relays = quantities.length > 0
    ? q === quantities.length && (names.length === 0 || n >= 1)
    : names.length > 0 && n >= Math.min(names.length, Math.max(2, Math.ceil(names.length / 2)));
  return { relays, phrases, matched };
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

export interface CalibrationFilter {
  /** Levels to include; all when absent. */
  readonly levels?: readonly FreezeItemLevel[];
  /** Views to include; all when absent. */
  readonly views?: readonly number[];
}

/** H2's primary window (SPEC/09 revision (o), SPEC/26): the blanked L2/L3 items of the phase A freezes V2, V4, V5, V7. */
export const H2_PRIMARY_WINDOW: CalibrationFilter = { levels: ["L2", "L3"], views: [2, 4, 5, 7] };

export interface CalibrationPair {
  readonly view: number;
  readonly itemId: string;
  readonly level: FreezeItemLevel;
  readonly confidence: number;
  readonly correct: boolean;
}

export interface CalibrationSummary {
  readonly pairs: readonly CalibrationPair[];
  readonly n: number;
  /** Mean confidence on the 0–100 scale; null when n = 0 (as are the three below). */
  readonly meanConfidence: number | null;
  readonly proportionCorrect: number | null;
  /** Mean (confidence/100 − correct)²: 0 is perfect; lower is better. */
  readonly brier: number | null;
  /** Mean confidence/100 − proportion correct: > 0 overconfident, < 0 underconfident. */
  readonly overUnderGap: number | null;
}

/**
 * The confidence–accuracy pairs of a window, with a Brier score and the over/under-confidence gap. One pair per (view, item), the first
 * score listed (`freezeItemScores` already keeps the first answer and drops replayed views; scores assembled elsewhere are held to it too).
 */
export function calibrationPairs(scores: readonly FreezeItemScore[], filter: CalibrationFilter = H2_PRIMARY_WINDOW): CalibrationSummary {
  const seen = new Set<string>();
  const pairs: CalibrationPair[] = scores
    .filter((s) => { const k = `${s.view}::${s.itemId}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .filter((s) => (!filter.levels || filter.levels.includes(s.level)) && (!filter.views || filter.views.includes(s.view)))
    .map((s) => ({ view: s.view, itemId: s.itemId, level: s.level, confidence: s.confidence, correct: s.correct }));
  const n = pairs.length;
  if (n === 0) return { pairs, n, meanConfidence: null, proportionCorrect: null, brier: null, overUnderGap: null };
  let sumConf = 0;
  let sumCorrect = 0;
  let sumSq = 0;
  for (const p of pairs) {
    const c = p.confidence / 100;
    const o = p.correct ? 1 : 0;
    sumConf += c;
    sumCorrect += o;
    sumSq += (c - o) ** 2;
  }
  return {
    pairs, n, meanConfidence: (sumConf / n) * 100, proportionCorrect: sumCorrect / n,
    brier: sumSq / n, overUnderGap: sumConf / n - sumCorrect / n,
  };
}
