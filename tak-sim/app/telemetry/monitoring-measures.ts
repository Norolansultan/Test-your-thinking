/**
 * Metacognitive monitoring and control from the log (SPEC/30 §4, §5.4, §6; 19 Oct 2026): pure folds, analysis only,
 * never called at runtime and never stored (SPEC/07 §1). The directive keys are TRUTH and are passed in by the analysis
 * (`app/scenario/demo-directive.ts` may not be imported under app/: `test/boundary/directive-keys-boundary.spec.ts`).
 *
 * - `planConfidencePairs` (H18): per keyed view (a key that codes soundness: V9–V14), the participant's
 *   `plan_confidence_submitted.value` with the correctness of the plan it rates — the plan in force at the view's end,
 *   coded as Paper 2 codes it (`directiveAdherence`): correct = sound (cells A and C: the plan fits the situation, which
 *   is what the item asks), with the boundary-sector coding beside it as the sensitivity. `planCalibration` folds the
 *   pairs into the mean confidence, proportion correct, Brier score and gap, as `calibrationPairs` does for freezes.
 * - `consultExposure` (SPEC/30 §4): per main view, whether the content-free consult notice was shown, whether and how
 *   soon (`tWallOffsetMs` difference) it was opened, how it was dismissed, and whether a Haku or Thinker query followed
 *   it in the same view (and whether to the tool it named).
 * A view replayed after a resume counts its last attempt (its last `cycle_start`), as `directiveAdherence` does.
 */

import type { LogRecord } from "./log.js";
import type {
  AiChatQuerySubmittedDetail, ConsultPromptDetail, ConsultPromptDismissedDetail, ConsultPromptShownDetail, ConsultTool, CycleStartDetail,
  PlanConfidenceSubmittedDetail,
} from "./record-kinds.js";
import { directiveAdherence, type DirectiveCell, type DirectiveKeyLike } from "./derived-measures.js";

// ---------------------------------------------------------------------------
// H18: plan confidence against the plan's correctness
// ---------------------------------------------------------------------------

export interface PlanConfidencePair {
  readonly view: number;
  /** 25 | 50 | 75 | 100; null when not given in the view's (last) attempt. */
  readonly confidence: number | null;
  readonly confidenceSeq: number | null;
  /** The coded plan (in force at the view's end); null with no plan. */
  readonly planSeq: number | null;
  readonly cell: DirectiveCell | null;
  /** The plan is sound (A or C) under the primary coding; null with no plan. */
  readonly correct: boolean | null;
  /** The same with the boundary-accepted sectors (the sensitivity coding). */
  readonly correctWithBoundary: boolean | null;
}

export function planConfidencePairs(records: readonly LogRecord[], keys: Readonly<Record<number, DirectiveKeyLike | null>>): PlanConfidencePair[] {
  return directiveAdherence(records, keys)
    .filter((a) => keys[a.view]?.sound != null)
    .map((a) => {
      const rated = records.find((r) => r.kind === "plan_confidence_submitted" && (r.seq as number) > a.attemptStartSeq
        && ((r.detail as PlanConfidenceSubmittedDetail).cycle as number) === a.view);
      const plan = a.atViewEnd;
      return {
        view: a.view,
        confidence: rated ? (rated.detail as PlanConfidenceSubmittedDetail).value : null,
        confidenceSeq: rated ? (rated.seq as number) : null,
        planSeq: plan?.seq ?? null, cell: plan?.cell ?? null, correct: plan?.sound ?? null, correctWithBoundary: plan?.soundWithBoundary ?? null,
      };
    });
}

export interface PlanCalibration {
  /** Views with both a confidence and a coded plan. */
  readonly n: number;
  readonly meanConfidence: number | null;
  readonly proportionCorrect: number | null;
  /** Mean (confidence/100 − correct)². */
  readonly brier: number | null;
  /** Mean confidence/100 − proportion correct: > 0 overconfident. */
  readonly gap: number | null;
}

export function planCalibration(pairs: readonly PlanConfidencePair[], opts: { readonly withBoundary?: boolean } = {}): PlanCalibration {
  const usable = pairs.flatMap((p) => {
    const correct = opts.withBoundary ? p.correctWithBoundary : p.correct;
    return p.confidence === null || correct === null ? [] : [{ c: p.confidence / 100, o: correct ? 1 : 0 }];
  });
  const n = usable.length;
  if (n === 0) return { n, meanConfidence: null, proportionCorrect: null, brier: null, gap: null };
  const mean = (f: (x: { c: number; o: number }) => number) => usable.reduce((s, x) => s + f(x), 0) / n;
  const c = mean((x) => x.c), o = mean((x) => x.o);
  return { n, meanConfidence: c * 100, proportionCorrect: o, brier: mean((x) => (x.c - x.o) ** 2), gap: c - o };
}

// ---------------------------------------------------------------------------
// The consult notice's exposure
// ---------------------------------------------------------------------------

export type QueryTool = "haku" | "thinker";

export interface ConsultExposure {
  readonly view: number;
  readonly shown: boolean;
  readonly tool: ConsultTool | null;
  readonly atViewSeconds: number | null;
  readonly opened: boolean;
  /** `consult_prompt_opened` − `consult_prompt_shown` (real ms); null when not opened. */
  readonly openDelayMs: number | null;
  readonly dismissed: ConsultPromptDismissedDetail["cause"] | null;
  /** Haku or Thinker queries in the view before the notice (all of the view's when it was not shown), and after it. */
  readonly queriesBefore: number;
  readonly queriesAfter: number;
  readonly queriedAfter: boolean;
  /** The first query after the notice: its delay (real ms) and tool. */
  readonly firstQueryAfterMs: number | null;
  readonly firstQueryAfterTool: QueryTool | null;
  /** A query to the tool the notice named followed it. */
  readonly queriedNamedTool: boolean;
}

/** A Haku or Thinker query, and its tool: the chats' questions, and Haku's builder and free text (the demonstration's index search). */
function queryTool(r: LogRecord): QueryTool | null {
  if (r.kind === "ai_chat_query_submitted") return (r.detail as AiChatQuerySubmittedDetail).tool === "haku" ? "haku" : "thinker";
  return r.kind === "query_submitted" || r.kind === "nav_query_submitted" ? "haku" : null;
}

interface ViewState {
  shown: LogRecord | null;
  opened: LogRecord | null;
  dismissed: ConsultPromptDismissedDetail["cause"] | null;
  queries: { readonly record: LogRecord; readonly tool: QueryTool }[];
}

export function consultExposure(records: readonly LogRecord[]): ConsultExposure[] {
  const byView = new Map<number, ViewState>();
  let view = -1;
  for (const r of records) {
    if (r.kind === "cycle_start") {
      view = (r.detail as CycleStartDetail).cycle as number;
      if (view >= 1) byView.set(view, { shown: null, opened: null, dismissed: null, queries: [] }); // a replay: its last attempt counts
      continue;
    }
    const s = byView.get(view);
    if (!s) continue;
    const cycleOf = () => ((r.detail as ConsultPromptDetail).cycle as number);
    if (r.kind === "consult_prompt_shown" && cycleOf() === view) { s.shown ??= r; continue; }
    if (r.kind === "consult_prompt_opened" && cycleOf() === view && s.shown) { s.opened ??= r; continue; }
    if (r.kind === "consult_prompt_dismissed" && cycleOf() === view && s.shown) { s.dismissed ??= (r.detail as ConsultPromptDismissedDetail).cause; continue; }
    const tool = queryTool(r);
    if (tool) s.queries.push({ record: r, tool });
  }
  return [...byView.entries()].sort(([a], [b]) => a - b).map(([v, s]) => {
    const shown = s.shown, d = shown?.detail as ConsultPromptShownDetail | undefined;
    const after = shown ? s.queries.filter((q) => q.record.seq > shown.seq) : [];
    const first = after[0];
    return {
      view: v, shown: shown !== null, tool: d?.tool ?? null, atViewSeconds: d?.atViewSeconds ?? null,
      opened: s.opened !== null, openDelayMs: shown && s.opened ? s.opened.tWallOffsetMs - shown.tWallOffsetMs : null,
      dismissed: s.dismissed,
      queriesBefore: s.queries.length - after.length, queriesAfter: after.length, queriedAfter: after.length > 0,
      firstQueryAfterMs: shown && first ? first.record.tWallOffsetMs - shown.tWallOffsetMs : null, firstQueryAfterTool: first?.tool ?? null,
      queriedNamedTool: d !== undefined && after.some((q) => q.tool === d.tool),
    };
  });
}
