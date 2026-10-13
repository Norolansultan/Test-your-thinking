/**
 * Derived measures for the visible probe Type U (readiness round, agent H, 5 Oct 2026) — pure folds over the raw records (SPEC/07 §1: nothing derived is ever stored). The keys
 * are TRUTH, passed in by the analysis (`probeKeysOf`, `app/scenario/probe-keys.ts`), never read from
 * the log. Times are `tWallOffsetMs` (real ms since the session started); `openMs` is how long the
 * probe was on screen — the view's clock stood still for it, so it is a covariate (extra time with the
 * map in view), not task time.
 *
 * (Type E was withdrawn with H6, and Type F and the branch choice with Type J, on 6 Oct 2026; their
 * measures went with them.)
 * - U area item, V13 (§3.5, revision (ai); the open text until then): the yes/no, the parts chosen (each
 *   a binary indicator, never a count), and `areaHit` — "north edge" among them (H3's primary measure);
 *   the key's position in the participant's order as a covariate.
 * - U backup: the option and its confidence, `correct` against the key (recognition, H3's secondary). Coverage: the value and the outcome, and its
 *   Brier score ((value/100 − outcome)²).
 */

import type { ProbeKeys } from "../scenario/probe-keys.js";
import type { LogRecord } from "./log.js";
import type { AreaCheckResponse, ProbePresentedDetail, ProbeSubmittedDetail } from "./record-kinds.js";

type Rec<D> = LogRecord & { readonly detail: D };
const presented = (records: readonly LogRecord[], type: string) =>
  records.filter((r) => r.kind === "probe_presented" && (r.detail as ProbePresentedDetail).type === type) as Rec<ProbePresentedDetail>[];
const answerOf = <D extends { readonly probeId: string }>(records: readonly LogRecord[], kind: string, probeId: string) =>
  records.find((r) => r.kind === kind && (r.detail as D).probeId === probeId) as Rec<D> | undefined;

// ---- U --------------------------------------------------------------------------------------------------

export interface AreaProbeMeasure {
  readonly probeId: string;
  readonly view: number | null;
  readonly atViewSeconds: number | null;
  readonly openMs: number | null;
  /** The yes/no; null if never answered. */
  readonly unsure: boolean | null;
  /** The parts chosen (option ids, in the order shown); empty after "no"; null if never answered. */
  readonly areas: readonly string[] | null;
  /** Whether the key's part was among them ("no" is a miss); null if never answered. */
  readonly areaHit: boolean | null;
  /** The key's 0-based position in the order shown (an order-effect covariate); null if not shown. */
  readonly keyPosition: number | null;
}

function areaMeasure(records: readonly LogRecord[], key: { readonly probeId: string; readonly key: string }): AreaProbeMeasure | null {
  const p = presented(records, "U").find((x) => x.detail.probeId === key.probeId);
  if (!p) return null;
  const submitted = answerOf<ProbeSubmittedDetail>(records, "probe_submitted", key.probeId);
  const r = submitted?.detail.response as AreaCheckResponse | undefined;
  const answered = r !== undefined && typeof r === "object" && r !== null && typeof r.unsure === "boolean";
  const at = p.detail.optionIds.indexOf(key.key);
  return {
    probeId: key.probeId, view: p.detail.cycle ?? null, atViewSeconds: p.detail.atViewSeconds ?? null,
    openMs: submitted ? submitted.tWallOffsetMs - p.tWallOffsetMs : null,
    unsure: answered ? r.unsure : null, areas: answered ? r.areas : null,
    areaHit: answered ? r.unsure && r.areas.includes(key.key) : null,
    keyPosition: at < 0 ? null : at,
  };
}

export interface UncertaintyMeasures {
  readonly area: AreaProbeMeasure | null;
  readonly backup: { readonly probeId: string; readonly openMs: number | null; readonly optionId: string | null; readonly confidence: number | null; readonly correct: boolean | null } | null;
  readonly coverage: { readonly probeId: string; readonly openMs: number | null; readonly value: number | null; readonly allInside: boolean; readonly brier: number | null } | null;
}

export function uncertaintyMeasures(records: readonly LogRecord[], keys: Pick<ProbeKeys, "contradictionArea" | "contradictionPair" | "coverage">): UncertaintyMeasures {
  const shown = (probeId: string | undefined) => (probeId ? presented(records, "U").find((p) => p.detail.probeId === probeId) : undefined);
  const pairShown = shown(keys.contradictionPair?.probeId);
  const pairAnswer = pairShown && answerOf<ProbeSubmittedDetail>(records, "probe_submitted", pairShown.detail.probeId);
  const optionId = pairAnswer && typeof pairAnswer.detail.response === "string" ? pairAnswer.detail.response : null;
  const covShown = shown(keys.coverage?.probeId);
  const covAnswer = covShown && answerOf<ProbeSubmittedDetail>(records, "probe_submitted", covShown.detail.probeId);
  const value = covAnswer && typeof covAnswer.detail.response === "number" ? covAnswer.detail.response : null;
  return {
    area: keys.contradictionArea ? areaMeasure(records, keys.contradictionArea) : null,
    backup: pairShown && keys.contradictionPair ? {
      probeId: pairShown.detail.probeId, openMs: pairAnswer ? pairAnswer.tWallOffsetMs - pairShown.tWallOffsetMs : null,
      optionId, confidence: typeof pairAnswer?.detail.confidence === "number" ? pairAnswer.detail.confidence : null, correct: optionId === null ? null : optionId === keys.contradictionPair.key,
    } : null,
    coverage: covShown && keys.coverage ? {
      probeId: covShown.detail.probeId, openMs: covAnswer ? covAnswer.tWallOffsetMs - covShown.tWallOffsetMs : null,
      value, allInside: keys.coverage.allInside,
      brier: value === null ? null : Math.round((value / 100 - (keys.coverage.allInside ? 1 : 0)) ** 2 * 10_000) / 10_000,
    } : null,
  };
}
