/**
 * The commander profile (SPEC/35 §4, work package P3, 21 Oct 2026): the participant's own pattern, shown once after the
 * questionnaire in public sessions. A pure, deterministic fold over the session's records; nothing is stored back into the log
 * (SPEC/07 §1). It reuses the analysis measures and returns AGGREGATES ONLY: no item id, option, key, correct answer or record id
 * leaves this function, so the profile cannot leak answers to later participants.
 *
 * Dimensions and band rules:
 * - **Calibration.** Every first answer of the main-view freezes (V1–V14, all levels; the practice freeze is not scored here; V12's F7
 *   item, scored for H9 only, is left out by `calibrationPairs`: play-test D6, 24 Oct 2026),
 *   scored by `freezeItemScores` and folded by `calibrationPairs`. `gapPoints` = mean confidence − percent correct (0–100 scale).
 *   Band: |gap| ≤ 10 points → well calibrated; gap > 10 → overconfident; gap < −10 → underconfident. At least
 *   `MIN_CALIBRATION_ANSWERS` answers, else "not enough answers". **Resolution** (a rough, individual indication only: SPEC/32 §7
 *   keeps the inferential resolution measure at group level): mean confidence on correct answers − on wrong ones; ≥ 5 points →
 *   higher when right, ≤ −5 → higher when wrong, otherwise about the same; needs at least `MIN_RESOLUTION_EACH` of each.
 * - **Checking.** Per decision (a main view whose last attempt has a plan with a posture, `directiveAdherence`'s `first`): the
 *   participant checked before acting when an information-seeking act (`isInformationSeekingAct`: a Haku search or question, a
 *   Thinker question, a tool tab opened) came before the view's first plan, or when they opened a record the plan review cited
 *   (`reviewMeasures(...).citedRecordOpened`, the guide group's deciding records, SPEC/32 §3). Band of the share: ≥ 2/3 often,
 *   < 1/3 rarely, otherwise sometimes; at least `MIN_DECISIONS` decisions. The typical latency is the median, over the decisions
 *   checked by a look-up before the plan, of the time from the view's start to the first look-up
 *   (`timeToFirstInformationSeekingActMs`, real time).
 *   Why not `roadblockLatencies` here: its module imports the premise-evidence table (Paper 2's no-fit key, kept server-side), which
 *   must not reach the participant's browser, and in this build only the guide group can open a deciding record, so its share
 *   would be zero by design for the Haku group. The analysis can pass its rows (`opts.roadblock`) to get the SPEC/32 §7 reading
 *   beside the profile (`checking.decidingRecords`); the screen never needs it.
 * - **Tool use.** Haku searches (the Haku chat's questions and its builder and free-text queries) and Thinker questions (the guide
 *   group only: null in the Haku group) asked in the main views, every attempt counted; and of the plan reviews shown
 *   (`reviewMeasures`, phase B), how many ended with the plan changed (`revisedAtReview`). Null reviews: none in the session
 *   (a phase-A session, or phase B not reached).
 * - **Comparison.** `EXPERT_REFERENCE`, the expert sample's median per dimension: null until that sample exists.
 *
 * The directive keys are TRUTH and stay out of app/ (`test/boundary/directive-keys-boundary.spec.ts`): the plan folds here run on
 * `NEUTRAL_KEYS`, which code nothing; only key-free fields (`first.seq`, the review's choice and revision) are read.
 */

import type { LogHeader, LogRecord } from "./log.js";
import type { AiChatQuerySubmittedDetail, CycleStartDetail } from "./record-kinds.js";
import type { RoadblockLatency } from "./roadblock-measures.js"; // type only: the module's table never enters the bundle
import { calibrationPairs, freezeItemScores, type FreezeContentLike } from "./freeze-measures.js";
import { directiveAdherence, isInformationSeekingAct, timeToFirstInformationSeekingActMs } from "./derived-measures.js";
import { reviewMeasures, type ReviewKeyLike } from "./review-measures.js";
import { buildFreezes } from "../scenario/demo-probes.js";
import { MAIN_VIEWS } from "../scenario/views.js";

export const MIN_CALIBRATION_ANSWERS = 8;
export const WELL_CALIBRATED_POINTS = 10;
export const MIN_RESOLUTION_EACH = 3;
export const RESOLUTION_POINTS = 5;
export const MIN_DECISIONS = 3;
const FLOAT_SLACK = 1e-9;

export type DimensionStatus = "ok" | "not_enough" | "unavailable";
export type CalibrationBand = "well" | "over" | "under";
export type ResolutionBand = "higher_when_right" | "about_same" | "higher_when_wrong";
export type CheckingBand = "often" | "sometimes" | "rarely";

export interface CalibrationProfile {
  readonly status: DimensionStatus;
  readonly answers: number;
  /** 0–100; null unless `status` is ok (as every value below). */
  readonly meanConfidence: number | null;
  readonly percentCorrect: number | null;
  readonly gapPoints: number | null;
  readonly band: CalibrationBand | null;
  readonly resolution: { readonly status: DimensionStatus; readonly diffPoints: number | null; readonly band: ResolutionBand | null };
}

/** The SPEC/32 §7 reading (deciding records opened before the first relevant act), from `roadblockLatencies` rows the analysis passes. */
export interface DecidingRecordCheck {
  readonly reached: number;
  readonly opened: number;
  readonly share: number | null;
  readonly medianLatencySeconds: number | null;
}

export interface CheckingProfile {
  readonly status: DimensionStatus;
  readonly decisions: number;
  readonly checked: number;
  readonly share: number | null;
  readonly band: CheckingBand | null;
  readonly medianSecondsToFirstLookup: number | null;
  readonly decidingRecords: DecidingRecordCheck | null;
}

export interface ToolUseProfile {
  readonly status: DimensionStatus;
  readonly hakuSearches: number;
  /** Null: the participant's group had no Thinker. */
  readonly guideQuestions: number | null;
  /** Null: no plan review in the session. */
  readonly reviews: { readonly shown: number; readonly changed: number } | null;
}

/** The expert sample's median per dimension (null until the expert study's data exist; then the screen shows them). */
export interface ExpertReference {
  readonly calibrationGapPoints: number | null;
  readonly checkingShare: number | null;
  readonly hakuSearches: number | null;
  readonly guideQuestions: number | null;
  readonly reviewChangeShare: number | null;
}

export const EXPERT_REFERENCE: ExpertReference = { calibrationGapPoints: null, checkingShare: null, hakuSearches: null, guideQuestions: null, reviewChangeShare: null };

export interface CommanderProfile {
  readonly calibration: CalibrationProfile;
  readonly checking: CheckingProfile;
  readonly toolUse: ToolUseProfile;
  readonly expert: ExpertReference;
  /** The session reached phase B (V8–V14). */
  readonly phaseBReached: boolean;
}

export interface ProfileOptions {
  /** The freeze content to score against; default the scenario's (`buildFreezes`, the same the session showed). */
  readonly freezes?: readonly FreezeContentLike[];
  /** Analysis only: `roadblockLatencies` rows, for `checking.decidingRecords`. */
  readonly roadblock?: readonly RoadblockLatency[];
  readonly expert?: ExpertReference;
}

/** A key per main view that codes nothing (no aligned or sound posture): the plan folds run, and no truth is read. */
const NEUTRAL_KEYS: Readonly<Record<number, ReviewKeyLike>> = (() => {
  const keys: Record<number, ReviewKeyLike> = {};
  for (const v of MAIN_VIEWS) keys[v.index] = { aligned: [], sound: [] };
  return keys;
})();

let scenarioFreezes: readonly FreezeContentLike[] | null = null;
function defaultFreezes(): readonly FreezeContentLike[] {
  scenarioFreezes ??= buildFreezes();
  return scenarioFreezes;
}

/** The records as the log holds them; anything else (the screen's props are `unknown[]`) is dropped. */
export function asLogRecords(records: readonly unknown[]): LogRecord[] {
  return records.filter((r): r is LogRecord => {
    if (typeof r !== "object" || r === null) return false;
    const x = r as Partial<LogRecord>;
    return typeof x.kind === "string" && typeof x.seq === "number" && typeof x.tWallOffsetMs === "number" && typeof x.detail === "object" && x.detail !== null;
  });
}

const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Runs a dimension's fold; a log the fold cannot read gives `fallback` (the screen says "not available"), never a thrown screen. */
function guarded<T>(fold: () => T, fallback: T): T {
  try { return fold(); } catch { return fallback; }
}

const NO_RESOLUTION = { status: "not_enough", diffPoints: null, band: null } as const;

export function calibrationProfile(records: readonly LogRecord[], freezes: readonly FreezeContentLike[]): CalibrationProfile {
  const views = MAIN_VIEWS.map((v) => v.index);
  const { pairs, n, meanConfidence, proportionCorrect } = calibrationPairs(freezeItemScores(records, freezes), { views });
  if (n < MIN_CALIBRATION_ANSWERS || meanConfidence === null || proportionCorrect === null) {
    return { status: "not_enough", answers: n, meanConfidence: null, percentCorrect: null, gapPoints: null, band: null, resolution: NO_RESOLUTION };
  }
  const percentCorrect = proportionCorrect * 100;
  const gapPoints = meanConfidence - percentCorrect;
  // The edge is inclusive; a float error of the mean (e.g. 10.000000000000002) does not move an answer pattern across it.
  const band: CalibrationBand = Math.abs(gapPoints) <= WELL_CALIBRATED_POINTS + FLOAT_SLACK ? "well" : gapPoints > 0 ? "over" : "under";
  const right = pairs.filter((p) => p.correct).map((p) => p.confidence), wrong = pairs.filter((p) => !p.correct).map((p) => p.confidence);
  let resolution: CalibrationProfile["resolution"] = NO_RESOLUTION;
  if (right.length >= MIN_RESOLUTION_EACH && wrong.length >= MIN_RESOLUTION_EACH) {
    const diffPoints = mean(right) - mean(wrong);
    const band: ResolutionBand = diffPoints >= RESOLUTION_POINTS - FLOAT_SLACK ? "higher_when_right" : diffPoints <= -RESOLUTION_POINTS + FLOAT_SLACK ? "higher_when_wrong" : "about_same";
    resolution = { status: "ok", diffPoints, band };
  }
  return { status: "ok", answers: n, meanConfidence, percentCorrect, gapPoints, band, resolution };
}

/** An attempt's records: its `cycle_start`, then everything up to the next `cycle_start`. */
function attemptSlice(records: readonly LogRecord[], startSeq: number): LogRecord[] {
  const out: LogRecord[] = [];
  for (const r of records) {
    if ((r.seq as number) < startSeq) continue;
    if ((r.seq as number) > startSeq && r.kind === "cycle_start") break;
    out.push(r);
  }
  return out;
}

function decidingRecordCheck(rows: readonly RoadblockLatency[]): DecidingRecordCheck {
  const reached = rows.filter((r) => r.record === "deciding" && r.arrivalRoute !== null);
  const opened = reached.filter((r) => r.actKind === "opened" || r.actKind === "opened_from_review");
  return {
    reached: reached.length, opened: opened.length, share: reached.length === 0 ? null : opened.length / reached.length,
    medianLatencySeconds: median(opened.flatMap((r) => (r.latencyViewSeconds === null ? [] : [r.latencyViewSeconds]))),
  };
}

export function checkingProfile(records: readonly LogRecord[], roadblock?: readonly RoadblockLatency[]): CheckingProfile {
  const reviewed = new Set(reviewMeasures(records, NEUTRAL_KEYS).filter((m) => m.citedRecordOpened).map((m) => m.view));
  let decisions = 0, checked = 0;
  const latenciesMs: number[] = [];
  for (const a of directiveAdherence(records, NEUTRAL_KEYS)) {
    if (a.first === null) continue;
    decisions += 1;
    const slice = attemptSlice(records, a.attemptStartSeq);
    const planSeq = a.first.seq;
    const lookedFirst = slice.some((r) => (r.seq as number) < planSeq && isInformationSeekingAct(r));
    if (lookedFirst || reviewed.has(a.view)) checked += 1;
    const ms = lookedFirst ? timeToFirstInformationSeekingActMs(slice) : null;
    if (ms !== null) latenciesMs.push(ms);
  }
  const decidingRecords = roadblock ? decidingRecordCheck(roadblock) : null;
  if (decisions < MIN_DECISIONS) {
    return { status: "not_enough", decisions, checked, share: null, band: null, medianSecondsToFirstLookup: null, decidingRecords };
  }
  const share = checked / decisions;
  const band: CheckingBand = share >= 2 / 3 ? "often" : share < 1 / 3 ? "rarely" : "sometimes";
  const med = median(latenciesMs);
  return { status: "ok", decisions, checked, share, band, medianSecondsToFirstLookup: med === null ? null : med / 1000, decidingRecords };
}

/** A query and its tool, as `monitoring-measures.ts` reads them: the chats' questions by their `tool`, Haku's builder and free text. */
function queryTool(r: LogRecord): "haku" | "guide" | null {
  if (r.kind === "ai_chat_query_submitted") return (r.detail as AiChatQuerySubmittedDetail).tool === "haku" ? "haku" : "guide";
  return r.kind === "query_submitted" || r.kind === "nav_query_submitted" ? "haku" : null;
}

export function toolUseProfile(records: readonly LogRecord[]): ToolUseProfile {
  let view = -1, haku = 0, guide = 0;
  for (const r of records) {
    if (r.kind === "cycle_start") { view = (r.detail as CycleStartDetail).cycle as number; continue; }
    if (view < 1) continue;
    const tool = queryTool(r);
    if (tool === "haku") haku += 1;
    else if (tool === "guide") guide += 1;
  }
  const header = records.find((r) => r.kind === "session_started")?.detail as Partial<LogHeader> | undefined;
  const hasGuide = header?.cell !== undefined ? header.cell !== "radio" : guide > 0;
  const shown = reviewMeasures(records, NEUTRAL_KEYS).filter((m) => m.reviewShown);
  return {
    status: "ok", hakuSearches: haku, guideQuestions: hasGuide ? guide : null,
    reviews: shown.length === 0 ? null : { shown: shown.length, changed: shown.filter((m) => m.revisedAtReview).length },
  };
}

/** The commander profile of one session's records (the log body, in `seq` order). */
export function commanderProfile(records: readonly unknown[], opts: ProfileOptions = {}): CommanderProfile {
  const log = asLogRecords(records);
  const unavailableCalibration: CalibrationProfile = {
    status: "unavailable", answers: 0, meanConfidence: null, percentCorrect: null, gapPoints: null, band: null, resolution: { status: "unavailable", diffPoints: null, band: null },
  };
  return {
    calibration: guarded(() => calibrationProfile(log, opts.freezes ?? defaultFreezes()), unavailableCalibration),
    checking: guarded(() => checkingProfile(log, opts.roadblock), {
      status: "unavailable", decisions: 0, checked: 0, share: null, band: null, medianSecondsToFirstLookup: null, decidingRecords: null,
    }),
    toolUse: guarded(() => toolUseProfile(log), { status: "unavailable", hakuSearches: 0, guideQuestions: null, reviews: null }),
    expert: opts.expert ?? EXPERT_REFERENCE,
    phaseBReached: log.some((r) => r.kind === "cycle_start" && (r.detail as CycleStartDetail).phase === "B"),
  };
}
