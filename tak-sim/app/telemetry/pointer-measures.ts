/**
 * Revision (bm), 25 Oct 2026 (SPEC/09 (bm), pre-registered): the follow-up of the "report filed" pointers (`app/scenario/pointers.ts`).
 * A Paper 3 feature (information seeking that predicts errors) and the manipulation check that pointers are noticed; decoy pointers,
 * whose records no item asks about, give the baseline of search driven by curiosity or compliance and are reported apart.
 *
 * For each pointer a participant received (its `bubble_available`, the first if a resumed view delivered it again): did a Haku or
 * Thinker question asked after the pointer and before its view ended (`cycle_end`) bring back the pointed record — retrieved (rank ≤ 8,
 * every record the answer was built on) or shown (rank 1) — and how long after the pointer was that question asked. Wall time from the
 * delivery to the question's submission; `latencyOutsideFreezeMs` takes out the time spent in a freeze in between (the tools are locked
 * there). Only the answer's ranked `retrieved` list counts, not the model's digest or recent context (`digestAtomIds`,
 * `recentAtomIds`): those reach the model, not the participant's list. The demonstration-only Indexed search (`query_submitted`,
 * `nav_query_submitted`; never in study data) counts by its result order.
 *
 * Pure folds over the log, as every derived measure (SPEC/07 §1); the pointer mark never reaches the log (format unchanged): the
 * pointers are named here, from the scenario.
 */

import { POINTERS } from "../scenario/pointers.js";
import type { LogRecord } from "./log.js";
import type { CycleEndDetail, CycleStartDetail, FreezeStartedDetail } from "./record-kinds.js";
import type { AiChatAnswerReceivedDetail, AiChatQuerySubmittedDetail, BubbleAvailableDetail, NavQuerySubmittedDetail, QuerySubmittedDetail } from "./record-kinds.js";

/** A record retrieved at rank ≤ 8 (Haku's and the Thinker's top-k, `hybrid.ts`): every record the answer was built on. */
export const POINTER_RETRIEVED_MAX_RANK = 8;

export interface PointerSpec {
  readonly atomId: string;
  readonly to: string;
  readonly kind: "real" | "decoy";
  /** Real pointers: the items whose record it points to (analysis only). */
  readonly serves?: readonly string[];
}

/** The scenario's pointers (`pointers.ts`). */
export const POINTER_SPECS: readonly PointerSpec[] = POINTERS.map((p) => ({ atomId: p.id, to: p.to, kind: p.kind, serves: p.serves }));

export type FollowUpTool = "haku" | "open_thinker" | "thinker" | "indexed_search";

export interface FollowUpQuery {
  readonly queryId: string;
  readonly tool: FollowUpTool;
  /** The pointed record's rank in what the question brought back (1 = shown). */
  readonly rank: number;
  /** Wall ms from the pointer's delivery to the question's submission. */
  readonly latencyMs: number;
  /** The same less the wall time spent in a freeze between them. */
  readonly latencyOutsideFreezeMs: number;
  /** Asked before the view's freeze (null: the view has no freeze, or the freeze came before the pointer). */
  readonly beforeFreeze: boolean | null;
}

export interface PointerFollowUp {
  readonly pointerId: string;
  readonly to: string;
  readonly kind: "real" | "decoy";
  readonly serves: readonly string[];
  readonly view: number | null;
  /** The pointed record was already brought back (rank ≤ 8) by a question asked before the pointer arrived. */
  readonly reachedBefore: boolean;
  /** Questions (Haku, Thinker) asked after the pointer and before the view ended, whatever they brought back. */
  readonly questionsAfter: number;
  /** One of those questions retrieved the pointed record (rank ≤ 8). */
  readonly followed: boolean;
  /** One of them showed it (rank 1). */
  readonly shown: boolean;
  /** The first question that retrieved it, and the first that showed it. */
  readonly firstRetrieved: FollowUpQuery | null;
  readonly firstShown: FollowUpQuery | null;
}

interface Asked {
  readonly seq: number;
  readonly wallMs: number;
  readonly queryId: string;
  readonly tool: FollowUpTool;
  /** Ranked ids it brought back (empty until its answer is found). */
  readonly ranked: readonly string[];
}

/** Every question with what it brought back, at the moment it was asked (the submission; the answer's own record when none). */
function questionsOf(records: readonly LogRecord[]): Asked[] {
  const submitted = new Map<string, LogRecord>();
  for (const r of records) if (r.kind === "ai_chat_query_submitted") submitted.set((r.detail as AiChatQuerySubmittedDetail).queryId, r);
  const out: Asked[] = [];
  for (const r of records) {
    if (r.kind === "ai_chat_answer_received") {
      const d = r.detail as AiChatAnswerReceivedDetail;
      const at = submitted.get(d.queryId) ?? r;
      const tool: FollowUpTool = d.tool === "haku" ? "haku" : d.tool === "open_thinker" ? "open_thinker" : "thinker";
      out.push({ seq: at.seq as number, wallMs: at.tWallOffsetMs, queryId: d.queryId, tool, ranked: d.retrieved.map((x) => x.id) });
    } else if (r.kind === "query_submitted") {
      const d = r.detail as QuerySubmittedDetail;
      out.push({ seq: r.seq as number, wallMs: r.tWallOffsetMs, queryId: d.queryId, tool: "indexed_search", ranked: d.resultAtomIds ?? [] });
    } else if (r.kind === "nav_query_submitted") {
      const d = r.detail as NavQuerySubmittedDetail;
      out.push({ seq: r.seq as number, wallMs: r.tWallOffsetMs, queryId: d.queryId, tool: "indexed_search", ranked: d.resultAtomIds });
    }
  }
  return out.sort((a, b) => a.seq - b.seq);
}

/** Wall-time intervals spent in a freeze (`freeze_started` to the next `freeze_submitted`). */
function freezeSpans(records: readonly LogRecord[]): { readonly from: number; readonly to: number; readonly view: number; readonly seq: number }[] {
  const spans: { from: number; to: number; view: number; seq: number }[] = [];
  let open: LogRecord | null = null;
  for (const r of records) {
    if (r.kind === "freeze_started") open = r;
    else if (r.kind === "freeze_submitted" && open) {
      spans.push({ from: open.tWallOffsetMs, to: r.tWallOffsetMs, view: (open.detail as FreezeStartedDetail).cycle as number, seq: open.seq as number });
      open = null;
    }
  }
  return spans;
}

const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * The follow-up of every pointer delivered in `records` (one entry per pointer received, in delivery order). `pointers` defaults to
 * the scenario's.
 */
export function pointerFollowUps(records: readonly LogRecord[], pointers: readonly PointerSpec[] = POINTER_SPECS): PointerFollowUp[] {
  const specOf = new Map(pointers.map((p) => [p.atomId, p] as const));
  const asked = questionsOf(records);
  const freezes = freezeSpans(records);
  const seen = new Set<string>();
  const out: PointerFollowUp[] = [];
  let view: number | null = null;
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    if (r.kind === "cycle_start") view = (r.detail as CycleStartDetail).cycle as number;
    if (r.kind !== "bubble_available") continue;
    const spec = specOf.get((r.detail as BubbleAvailableDetail).atomId);
    if (!spec || seen.has(spec.atomId)) continue;
    seen.add(spec.atomId);
    const delivered = r.seq as number;
    const end = records.slice(i + 1).find((x) => (x.kind === "cycle_end" && (x.detail as CycleEndDetail).cycle === view) || x.kind === "cycle_start");
    const endSeq = end ? (end.seq as number) : Number.POSITIVE_INFINITY;
    const freeze = freezes.find((fz) => fz.view === view && fz.seq > delivered && fz.seq < endSeq) ?? null;
    const rankIn = (q: Asked): number | null => {
      const k = q.ranked.indexOf(spec.to);
      return k >= 0 && k < POINTER_RETRIEVED_MAX_RANK ? k + 1 : null;
    };
    const after = asked.filter((q) => q.seq > delivered && q.seq < endSeq);
    const hit = (q: Asked, rank: number): FollowUpQuery => {
      const inFreeze = freezes.reduce((s, fz) => s + overlap(r.tWallOffsetMs, q.wallMs, fz.from, fz.to), 0);
      return {
        queryId: q.queryId, tool: q.tool, rank, latencyMs: q.wallMs - r.tWallOffsetMs, latencyOutsideFreezeMs: q.wallMs - r.tWallOffsetMs - inFreeze,
        beforeFreeze: freeze === null ? null : q.seq < freeze.seq,
      };
    };
    let firstRetrieved: FollowUpQuery | null = null, firstShown: FollowUpQuery | null = null;
    for (const q of after) {
      const rank = rankIn(q);
      if (rank === null) continue;
      firstRetrieved ??= hit(q, rank);
      if (rank === 1) { firstShown = hit(q, rank); break; }
    }
    out.push({
      pointerId: spec.atomId, to: spec.to, kind: spec.kind, serves: spec.serves ?? [], view,
      reachedBefore: asked.some((q) => q.seq < delivered && rankIn(q) !== null),
      questionsAfter: after.length, followed: firstRetrieved !== null, shown: firstShown !== null, firstRetrieved, firstShown,
    });
  }
  return out;
}

export interface FollowUpRate {
  /** Pointers received. */
  readonly received: number;
  readonly followed: number;
  readonly shown: number;
  /** followed / received; null when none was received. */
  readonly followedRate: number | null;
  readonly shownRate: number | null;
  /** Median latency (wall ms, freezes taken out) of the first retrieving question; null when none followed. */
  readonly medianLatencyOutsideFreezeMs: number | null;
}

const median = (xs: readonly number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** The participant's follow-up rates, real and decoy pointers apart (decoys are the baseline, never pooled with the real ones). */
export function pointerFollowUpRates(followUps: readonly PointerFollowUp[]): { readonly real: FollowUpRate; readonly decoy: FollowUpRate } {
  const rate = (kind: "real" | "decoy"): FollowUpRate => {
    const xs = followUps.filter((f) => f.kind === kind);
    const followed = xs.filter((f) => f.followed);
    const shown = xs.filter((f) => f.shown).length;
    return {
      received: xs.length, followed: followed.length, shown,
      followedRate: xs.length ? followed.length / xs.length : null, shownRate: xs.length ? shown / xs.length : null,
      medianLatencyOutsideFreezeMs: median(followed.map((f) => f.firstRetrieved!.latencyOutsideFreezeMs)),
    };
  };
  return { real: rate("real"), decoy: rate("decoy") };
}
