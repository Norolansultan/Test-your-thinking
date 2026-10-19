/**
 * Paper 1's teaming measures (SPEC/30 §5–§6, 19 Oct 2026): pure folds over the log and the content passed in (TRUTH: the
 * freeze keys, the SPAM keys), in the style of `derived-measures.ts`; analysis only, never called at runtime and never
 * stored (SPEC/07 §1).
 *
 * - `overconfidenceGap` (H2, primary): per participant, mean confidence (0–1) − proportion correct over a window, by
 *   default H2's (`H2_PRIMARY_WINDOW`: every L2/L3 item of the V2, V4, V5, V7 freezes; the count comes from the
 *   content and the log — 24 with SPEC/30 §5.1's phase-A items — and is never assumed).
 * - `h2tSplit` (H2t): the same pairs and gap restricted to the items whose key no AI answer had stated before the freeze
 *   (`aiStatedKey` false: "own"), and to the stated ones ("borrowed").
 * - `handOverIndex` (H-T): team accuracy on the phase-A SPAM L2/L3 items (by default the second SPAM item of a phase-A
 *   view, probe id `<first probe id>.b`: V3 and V6) minus own accuracy on the phase-A freeze L2/L3 items (H2's window).
 *   A SPAM item not answered (timed out) or without a key is missing, not wrong, as a freeze item left unanswered is.
 */

import type { LogRecord } from "./log.js";
import type { CycleStartDetail, SpamAnsweredDetail } from "./record-kinds.js";
import {
  calibrationPairs, freezeItemScores, H2_PRIMARY_WINDOW, replayedViews,
  type CalibrationFilter, type CalibrationSummary, type FreezeContentLike, type FreezeItemScore,
} from "./freeze-measures.js";
import type { AiStatedKey } from "./ai-stated-key.js";

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
  const unscreened: { view: number; itemId: string }[] = [];
  const scoreOf = new Map<string, FreezeItemScore>();
  for (const s of scores) if (!scoreOf.has(`${s.view}::${s.itemId}`)) scoreOf.set(`${s.view}::${s.itemId}`, s); // the first, as `calibrationPairs`
  for (const p of inWindow) {
    const k = `${p.view}::${p.itemId}`;
    const s = byItem.get(k);
    if (!s || (opts.dropUnscreenable && s.rules.length === 0)) { unscreened.push({ view: p.view, itemId: p.itemId }); continue; }
    (s.stated ? stated : notStated).push(scoreOf.get(k)!);
  }
  const notStatedPairs = calibrationPairs(notStated, filter), statedPairs = calibrationPairs(stated, filter);
  return {
    notStated: notStatedPairs, notStatedGap: overconfidenceOf(notStatedPairs),
    stated: statedPairs, statedGap: overconfidenceOf(statedPairs),
    unscreened,
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
