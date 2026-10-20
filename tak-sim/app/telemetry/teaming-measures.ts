/**
 * Paper 1's teaming measures (SPEC/30 §5–§6, 19 Oct 2026): pure folds over the log and the content passed in (TRUTH: the
 * freeze keys, the SPAM keys), in the style of `derived-measures.ts`; analysis only, never called at runtime and never
 * stored (SPEC/07 §1).
 *
 * - `overconfidenceGap` (H2, primary): per participant, mean confidence (0–1) − proportion correct over a window, by
 *   default H2's (`H2_PRIMARY_WINDOW`: every L2/L3 item of the V2, V4, V5, V7 freezes; the count comes from the
 *   content and the log — 24 with SPEC/30 §5.1's phase-A items — and is never assumed).
 * - `h2tSplit` (H2t): the same pairs and gap restricted to the items whose key no AI answer had stated before the freeze
 *   (`aiStatedKey` false: "own"), and to the stated ones ("borrowed"). SPEC/31 §3.6 (parity P-3; RC): also the three-way split by
 *   `toldClass` — stream-told (every key record pushed before the freeze), AI-told (stated by a shown answer, the key recorded or
 *   computed) and neither; H2t contrasts AI-told against neither and reports stream-told; H2's sensitivity without the stream-told
 *   items (`withoutStreamTold`, sagat F10).
 * - `handOverIndex` (H-T): team accuracy on the phase-A SPAM L2/L3 items (by default the second SPAM item of a phase-A
 *   view, probe id `<first probe id>.b`: V3 and V6) minus own accuracy on the phase-A freeze L2/L3 items (H2's window).
 *   A SPAM item not answered (timed out) or without a key is missing, not wrong, as a freeze item left unanswered is.
 * - `handOverItemRows` (H-T, SPEC/31 §3.7, sagat F05): the same answers as item-level rows (participant, cell, measure own/team, item,
 *   correct, confidence) for the pre-registered mixed logistic model (own vs team × group, item random effects) — the second SPAM
 *   items are "tool-aided probes": accuracy only, no latency-as-SA claim.
 * - `aiAnswerLength` (SPEC/32 §7, a covariate for confidence): per view, the number and total characters of the AI answers shown —
 *   Haku's chat and the Thinker, as `shownAnswers` reads them (Haku's four parts joined by newlines, the Thinker's answer text; an Open
 *   Thinker fallback shows no text and is not counted), keyed by the view the question was asked in — and the review's premise lines
 *   (`plan_review_shown.premiseLines`, the guide group; fixed template text, counted apart). Every answer logged counts, a replayed
 *   view's both attempts included: the participant saw them all.
 */

import type { FreezeItemLevel } from "../scenario/types.js";
import type { LogHeader, LogRecord } from "./log.js";
import type { CycleStartDetail, RecallConfidenceSubmittedDetail, SpamAnsweredDetail } from "./record-kinds.js";
import {
  calibrationPairs, freezeItemScores, H2_PRIMARY_WINDOW, replayedViews,
  type CalibrationFilter, type CalibrationSummary, type FreezeContentLike, type FreezeItemScore,
} from "./freeze-measures.js";
import { shownAnswers, type AiStatedKey, type ToldClass } from "./ai-stated-key.js";
import type { PlanReviewShownDetail } from "./record-kinds.js";

// ---------------------------------------------------------------------------
// H2: the per-participant overconfidence gap
// ---------------------------------------------------------------------------

export interface Overconfidence {
  /** Items in the window answered. */
  readonly n: number;
  /** Mean confidence on the 0–100 scale; null when n = 0 (as are the two below). */
  readonly meanConfidence: number | null;
  readonly proportionCorrect: number | null;
  /** Mean confidence / 100 − proportion correct: > 0 overconfident. */
  readonly gap: number | null;
}

const overconfidenceOf = (c: CalibrationSummary): Overconfidence =>
  ({ n: c.n, meanConfidence: c.meanConfidence, proportionCorrect: c.proportionCorrect, gap: c.overUnderGap });

/** H2's outcome for one participant: the gap over `filter` (default H2's window) from the scored freeze answers. */
export function overconfidenceGap(scores: readonly FreezeItemScore[], filter: CalibrationFilter = H2_PRIMARY_WINDOW): Overconfidence {
  return overconfidenceOf(calibrationPairs(scores, filter));
}

// ---------------------------------------------------------------------------
// H2t: borrowed versus own
// ---------------------------------------------------------------------------

export interface H2tSplit {
  /** Items whose key no AI answer had stated before the freeze (`aiStatedKey` false): "own". */
  readonly notStated: CalibrationSummary;
  readonly notStatedGap: Overconfidence;
  /** Items whose key an answer had stated: "borrowed". */
  readonly stated: CalibrationSummary;
  readonly statedGap: Overconfidence;
  /** Window items left out of both: no `aiStatedKey` row, or (with `dropUnscreenable`) one whose rules were empty. */
  readonly unscreened: readonly { readonly view: number; readonly itemId: string }[];
  /** SPEC/31 §3.6 (RC): the three-way split by `toldClass`. H2t contrasts `aiTold` against `neither`; `streamTold` is reported. */
  readonly streamTold: CalibrationSummary;
  readonly streamToldGap: Overconfidence;
  readonly aiTold: CalibrationSummary;
  readonly aiToldGap: Overconfidence;
  readonly neither: CalibrationSummary;
  readonly neitherGap: Overconfidence;
  /** H2's sensitivity without the stream-told items (AI-told ∪ neither). */
  readonly withoutStreamTold: CalibrationSummary;
  readonly withoutStreamToldGap: Overconfidence;
  /**
   * Window items left out of the three-way split: no row, or (with `dropUnscreenable`) not stream-told and unscreenable — a stream-told
   * item needs no screening (the stream told it).
   */
  readonly toldUnscreened: readonly { readonly view: number; readonly itemId: string }[];
}

/**
 * The H2 pairs and gap split by `aiStatedKey` (joined on view and item). An item that could not be screened (a map item
 * without `keyStatements`: `rules` empty) counts as not stated, unless `dropUnscreenable` (a sensitivity analysis).
 */
export function h2tSplit(
  scores: readonly FreezeItemScore[], statedKeys: readonly AiStatedKey[],
  opts: { readonly filter?: CalibrationFilter; readonly dropUnscreenable?: boolean } = {},
): H2tSplit {
  const filter = opts.filter ?? H2_PRIMARY_WINDOW;
  const byItem = new Map(statedKeys.map((s) => [`${s.view}::${s.itemId}`, s]));
  const inWindow = calibrationPairs(scores, filter).pairs;
  const notStated: FreezeItemScore[] = [], stated: FreezeItemScore[] = [];
  const told: Record<ToldClass, FreezeItemScore[]> = { stream_told: [], ai_told: [], neither: [] };
  const unscreened: { view: number; itemId: string }[] = [], toldUnscreened: { view: number; itemId: string }[] = [];
  const scoreOf = new Map<string, FreezeItemScore>();
  for (const s of scores) if (!scoreOf.has(`${s.view}::${s.itemId}`)) scoreOf.set(`${s.view}::${s.itemId}`, s); // the first, as `calibrationPairs`
  for (const p of inWindow) {
    const k = `${p.view}::${p.itemId}`;
    const s = byItem.get(k);
    const unscreenable = s !== undefined && opts.dropUnscreenable === true && s.rules.length === 0;
    if (!s || unscreenable) unscreened.push({ view: p.view, itemId: p.itemId });
    else (s.stated ? stated : notStated).push(scoreOf.get(k)!);
    if (!s || (unscreenable && s.toldClass !== "stream_told")) toldUnscreened.push({ view: p.view, itemId: p.itemId });
    else told[s.toldClass].push(scoreOf.get(k)!);
  }
  const summary = (xs: readonly FreezeItemScore[]) => calibrationPairs(xs, filter);
  const notStatedPairs = summary(notStated), statedPairs = summary(stated);
  const streamTold = summary(told.stream_told), aiTold = summary(told.ai_told), neither = summary(told.neither);
  const withoutStreamTold = summary([...told.ai_told, ...told.neither]);
  return {
    notStated: notStatedPairs, notStatedGap: overconfidenceOf(notStatedPairs),
    stated: statedPairs, statedGap: overconfidenceOf(statedPairs),
    unscreened,
    streamTold, streamToldGap: overconfidenceOf(streamTold), aiTold, aiToldGap: overconfidenceOf(aiTold), neither, neitherGap: overconfidenceOf(neither),
    withoutStreamTold, withoutStreamToldGap: overconfidenceOf(withoutStreamTold), toldUnscreened,
  };
}

// ---------------------------------------------------------------------------
// H-T: the hand-over index
// ---------------------------------------------------------------------------

/** The default team items: a phase-A view's second SPAM item (`<first probe id>.b`, SPEC/30 §5.2). */
export function isSecondSpamItem(probeId: string, phase: "A" | "B" | "practice"): boolean {
  return phase === "A" && probeId.endsWith(".b");
}

export interface TeamItemAnswer {
  readonly probeId: string;
  readonly view: number;
  /** The option chosen; null when the answer timed out. */
  readonly response: string | null;
  /** Against the key (passed in, `spamKeysOf`); null when there is no answer or no key. */
  readonly correct: boolean | null;
}

export interface HandOverIndex {
  readonly team: readonly TeamItemAnswer[];
  /** Team items answered and keyed; their proportion correct (null when none). */
  readonly teamN: number;
  readonly teamAccuracy: number | null;
  /** Own items (the freeze window) answered; their proportion correct (null when none). */
  readonly ownN: number;
  readonly ownAccuracy: number | null;
  /** teamAccuracy − ownAccuracy; null when either is missing. */
  readonly index: number | null;
}

export interface HandOverOptions {
  /** Which SPAM probes are team items; default `isSecondSpamItem`. */
  readonly isTeamItem?: (probeId: string, phase: "A" | "B" | "practice") => boolean;
  /** The own items' window; default H2's. */
  readonly ownWindow?: CalibrationFilter;
  readonly includeReplayed?: boolean;
}

/** The first answer to each SPAM probe, with the view and phase it was given in (the last `cycle_start` before it). */
function firstSpamAnswers(records: readonly LogRecord[], includeReplayed: boolean): { probeId: string; view: number; phase: "A" | "B" | "practice"; response: string | null }[] {
  const replayed = includeReplayed ? new Set<number>() : replayedViews(records);
  const seen = new Set<string>();
  const out: { probeId: string; view: number; phase: "A" | "B" | "practice"; response: string | null }[] = [];
  let view = -1;
  let phase: "A" | "B" | "practice" = "practice";
  for (const r of records) {
    if (r.kind === "cycle_start") { const d = r.detail as CycleStartDetail; view = d.cycle as number; phase = d.phase; continue; }
    if (r.kind !== "spam_answered" || replayed.has(view)) continue;
    const d = r.detail as SpamAnsweredDetail;
    if (seen.has(d.probeId)) continue;
    seen.add(d.probeId);
    out.push({ probeId: d.probeId, view, phase, response: d.timedOut ? null : d.response });
  }
  return out;
}

export function handOverIndex(
  records: readonly LogRecord[], freezes: readonly FreezeContentLike[], spamKeys: ReadonlyMap<string, string>, opts: HandOverOptions = {},
): HandOverIndex {
  const isTeamItem = opts.isTeamItem ?? isSecondSpamItem;
  const includeReplayed = opts.includeReplayed ?? false;
  const team: TeamItemAnswer[] = firstSpamAnswers(records, includeReplayed)
    .filter((a) => isTeamItem(a.probeId, a.phase))
    .map(({ probeId, view, response }) => {
      const key = spamKeys.get(probeId);
      return { probeId, view, response, correct: response === null || key === undefined ? null : response === key };
    });
  const scored = team.filter((t) => t.correct !== null);
  const teamAccuracy = scored.length === 0 ? null : scored.filter((t) => t.correct).length / scored.length;
  const own = calibrationPairs(freezeItemScores(records, freezes, { includeReplayed }), opts.ownWindow ?? H2_PRIMARY_WINDOW);
  return {
    team, teamN: scored.length, teamAccuracy, ownN: own.n, ownAccuracy: own.proportionCorrect,
    index: teamAccuracy === null || own.proportionCorrect === null ? null : teamAccuracy - own.proportionCorrect,
  };
}

// ---------------------------------------------------------------------------
// H-T as an item-level model (SPEC/31 §3.7): one row per scored answer
// ---------------------------------------------------------------------------

export interface HandOverItemRow {
  readonly sessionId: string | null;
  readonly participantCode: string | null;
  /** The header's cell (`radio` is the Haku group): the model's group term. */
  readonly cell: string | null;
  /** `own`: a freeze item of the own window (blanked screen); `team`: a tool-aided SPAM probe (`isTeamItem`). */
  readonly measure: "own" | "team";
  readonly view: number;
  readonly itemId: string;
  /** The freeze item's level; a team item's from `teamLevels` (null when not given). */
  readonly level: FreezeItemLevel | null;
  readonly correct: boolean;
  /** 25 | 50 | 75 | 100: the freeze item's confidence; a SPAM probe's `recall_confidence_submitted`, null when none was given. */
  readonly confidence: number | null;
}

/**
 * The item-level rows of the H-T model (own vs team × group, item random effects): the own window's scored freeze items (the first
 * answer, replayed views dropped) and the answered, keyed team items (a timed-out or unkeyed one is missing, not wrong), by view, own
 * items first within a view.
 */
export function handOverItemRows(
  records: readonly LogRecord[], freezes: readonly FreezeContentLike[], spamKeys: ReadonlyMap<string, string>,
  opts: HandOverOptions & { readonly teamLevels?: ReadonlyMap<string, FreezeItemLevel> } = {},
): HandOverItemRow[] {
  const header = records.find((r) => r.kind === "session_started")?.detail as LogHeader | undefined;
  const who = { sessionId: header?.sessionId ?? null, participantCode: header?.participantCode ?? null, cell: header?.cell ?? null };
  const includeReplayed = opts.includeReplayed ?? false;
  const own = calibrationPairs(freezeItemScores(records, freezes, { includeReplayed }), opts.ownWindow ?? H2_PRIMARY_WINDOW).pairs
    .map((p): HandOverItemRow => ({ ...who, measure: "own", view: p.view, itemId: p.itemId, level: p.level, correct: p.correct, confidence: p.confidence }));
  const isTeamItem = opts.isTeamItem ?? isSecondSpamItem;
  const confidenceOf = (probeId: string): number | null => {
    const r = records.find((x) => x.kind === "recall_confidence_submitted" && (x.detail as RecallConfidenceSubmittedDetail).probeId === probeId);
    return r ? (r.detail as RecallConfidenceSubmittedDetail).value : null;
  };
  const team = firstSpamAnswers(records, includeReplayed).filter((a) => isTeamItem(a.probeId, a.phase)).flatMap((a): HandOverItemRow[] => {
    const key = spamKeys.get(a.probeId);
    if (a.response === null || key === undefined) return [];
    return [{ ...who, measure: "team", view: a.view, itemId: a.probeId, level: opts.teamLevels?.get(a.probeId) ?? null, correct: a.response === key, confidence: confidenceOf(a.probeId) }];
  });
  return [...own, ...team].sort((x, y) => x.view - y.view || (x.measure === y.measure ? 0 : x.measure === "own" ? -1 : 1));
}

// ---------------------------------------------------------------------------
// AI answer length (SPEC/32 §7): the amount of AI text shown, per view
// ---------------------------------------------------------------------------

export interface TextAmount {
  /** Answers (or, for the review, premise lines) shown. */
  readonly count: number;
  /** Their total length in characters (UTF-16 code units, as `String.length`). */
  readonly chars: number;
}

export interface AiAnswerLength {
  readonly view: number;
  readonly haku: TextAmount;
  readonly thinker: TextAmount;
  /** The plan review's premise lines (guide group): fixed template text, kept apart from the model's answers. */
  readonly reviewPremise: TextAmount;
}

/** One entry per view with any AI text shown, in view order (a view with none has no entry: zero, not missing). */
export function aiAnswerLength(records: readonly LogRecord[]): AiAnswerLength[] {
  const byView = new Map<number, { haku: TextAmount; thinker: TextAmount; reviewPremise: TextAmount }>();
  const zero: TextAmount = { count: 0, chars: 0 };
  const entry = (view: number) => {
    let e = byView.get(view);
    if (!e) { e = { haku: zero, thinker: zero, reviewPremise: zero }; byView.set(view, e); }
    return e;
  };
  const add = (t: TextAmount, chars: number): TextAmount => ({ count: t.count + 1, chars: t.chars + chars });
  for (const a of shownAnswers(records)) { const e = entry(a.view); e[a.tool] = add(e[a.tool], a.text.length); }
  for (const r of records) {
    if (r.kind !== "plan_review_shown") continue;
    const d = r.detail as PlanReviewShownDetail;
    if (d.premiseLines === null) continue;
    const e = entry(d.cycle as number);
    for (const line of d.premiseLines) e.reviewPremise = add(e.reviewPremise, line.length);
  }
  return [...byView.entries()].sort(([a], [b]) => a - b).map(([view, e]) => ({ view, ...e }));
}
