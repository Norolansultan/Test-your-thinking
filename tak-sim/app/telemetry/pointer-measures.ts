/**
 * Revision (bm), 25 Oct 2026 (SPEC/09 (bm), pre-registered): the follow-up of the "report filed" pointers (`app/scenario/pointers.ts`).
 * A Paper 3 feature (information seeking that predicts errors) and the manipulation check that pointers are noticed; decoy pointers,
 * whose records no item asks about, give the baseline of search driven by curiosity or compliance and are reported apart.
 *
 * For each pointer a participant received (its `bubble_available`, the first if a resumed view delivered it again): did a Haku or
 * Thinker question asked within the pointer's WINDOW bring back the pointed record — retrieved (rank ≤ 8, every record the answer was
 * built on) or shown (rank 1) — and how long after the pointer was that question asked (wall time from the delivery to the question's
 * submission). Only the answer's ranked `retrieved` list counts, not the model's digest or recent context (`digestAtomIds`,
 * `recentAtomIds`): those reach the model, not the participant's list. The demonstration-only Indexed search (`query_submitted`,
 * `nav_query_submitted`; never in study data) counts by its result order.
 *
 * Revision (bn), 25 Oct 2026 (review S3; SPEC/09 (bn) §2):
 * - **The window.** A pointer's available window runs from its delivery to the view's freeze if one follows (`freeze_started`), else to
 *   the view's end (`cycle_end`). Its class is where it starts (the view's start, or a merged view's step boundary: the pointer's step
 *   is the view's second) and where it ends (`freeze` or `view_end`); `windowMs` is its wall length (null when the log ends inside it).
 *   Follow-up counts only within the window. Rates are reported per window class, and real and decoy pointers are compared only within
 *   a class (`pointerFollowUpRates(...).byWindow`), or with `windowMs` as a covariate.
 * - **No "reached before".** A pointer is delivered in the same burst that makes its record reachable (`time-gate.ts`), so no question
 *   can bring the record back before the pointer: the (bm) field `reachedBefore` and the class "found before" are withdrawn.
 * - **The items' classes** (`pointerItemClasses`): per real pointer and item it serves, whether the participant followed it before the
 *   ITEM's moment — its freeze (`freeze_started` of the item's view), or for a SPAM item its delivery's prompt (`spam_prompt_shown`;
 *   SPAM V3.b in the view after the pointer's, as SPEC/09 (bm) §4 pre-stated) — so V3.b's follow-up runs past the pointer's own view.
 *
 * Pure folds over the log, as every derived measure (SPEC/07 §1); the pointer mark never reaches the log (format unchanged): the
 * pointers are named here, from the scenario.
 */

import { POINTERS } from "../scenario/pointers.js";
import { viewOfStep } from "../scenario/views.js";
import type { LogRecord } from "./log.js";
import type { CycleEndDetail, CycleStartDetail, FreezeStartedDetail, SpamPromptShownDetail } from "./record-kinds.js";
import type { AiChatAnswerReceivedDetail, AiChatQuerySubmittedDetail, BubbleAvailableDetail, NavQuerySubmittedDetail, QuerySubmittedDetail } from "./record-kinds.js";

/** A record retrieved at rank ≤ 8 (Haku's and the Thinker's top-k, `hybrid.ts`): every record the answer was built on. */
export const POINTER_RETRIEVED_MAX_RANK = 8;

/** Revision (bn): where a pointer's window starts — the view's start, or a merged view's step boundary (its second step's burst). */
export type WindowStart = "view_start" | "step_boundary";
/** Where it ends — the view's freeze, or the view's end when no freeze follows the pointer. */
export type WindowEnd = "freeze" | "view_end";
/** The window's class, `start→end`: real and decoy pointers are compared only within one. */
export type WindowClass = `${WindowStart}→${WindowEnd}`;

export interface PointerSpec {
  readonly atomId: string;
  readonly to: string;
  readonly kind: "real" | "decoy";
  /** Real pointers: the items whose record it points to (analysis only). */
  readonly serves?: readonly string[];
  /** Revision (bn): where its window starts (from its step's place in the view). */
  readonly windowStart?: WindowStart;
}

/** The scenario's pointers (`pointers.ts`), each with where its window starts. */
export const POINTER_SPECS: readonly PointerSpec[] = POINTERS.map((p) => {
  const view = viewOfStep(p.step);
  return { atomId: p.id, to: p.to, kind: p.kind, serves: p.serves, windowStart: view !== null && view.steps[0] !== p.step ? "step_boundary" : "view_start" };
});

export type FollowUpTool = "haku" | "open_thinker" | "thinker" | "indexed_search";

export interface FollowUpQuery {
  readonly queryId: string;
  readonly tool: FollowUpTool;
  /** The pointed record's rank in what the question brought back (1 = shown). */
  readonly rank: number;
  /** Wall ms from the pointer's delivery to the question's submission. */
  readonly latencyMs: number;
  /** The same less the wall time spent in a freeze between them (the tools are locked there); equal to `latencyMs` within a window. */
  readonly latencyOutsideFreezeMs: number;
}

export interface PointerWindow {
  readonly start: WindowStart;
  readonly end: WindowEnd;
  readonly cls: WindowClass;
  /** Wall ms from the delivery to the window's end; null when the log ends inside the window. */
  readonly windowMs: number | null;
}

export interface PointerFollowUp {
  readonly pointerId: string;
  readonly to: string;
  readonly kind: "real" | "decoy";
  readonly serves: readonly string[];
  readonly view: number | null;
  /** Revision (bn): the pointer's available window. */
  readonly window: PointerWindow;
  /** Questions (Haku, Thinker) asked within the window, whatever they brought back. */
  readonly questionsInWindow: number;
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
function freezeSpans(records: readonly LogRecord[]): { readonly from: number; readonly to: number }[] {
  const spans: { from: number; to: number }[] = [];
  let open: LogRecord | null = null;
  for (const r of records) {
    if (r.kind === "freeze_started") open = r;
    else if (r.kind === "freeze_submitted" && open) { spans.push({ from: open.tWallOffsetMs, to: r.tWallOffsetMs }); open = null; }
  }
  return spans;
}
const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
/** A retrieving question's latency from a delivery at `fromMs`: wall, and with the freezes between taken out. */
function hitOf(q: Asked, rank: number, fromMs: number, freezes: readonly { readonly from: number; readonly to: number }[]): FollowUpQuery {
  const inFreeze = freezes.reduce((s, fz) => s + overlap(fromMs, q.wallMs, fz.from, fz.to), 0);
  return { queryId: q.queryId, tool: q.tool, rank, latencyMs: q.wallMs - fromMs, latencyOutsideFreezeMs: q.wallMs - fromMs - inFreeze };
}

/** The pointed record's rank (1-based) in what a question brought back, if it is retrieved (rank ≤ 8). */
const rankIn = (q: Asked, to: string): number | null => {
  const k = q.ranked.indexOf(to);
  return k >= 0 && k < POINTER_RETRIEVED_MAX_RANK ? k + 1 : null;
};

/** Each pointer received: its delivery record's index, its spec and its view (one entry per pointer, the first delivery). */
function deliveries(records: readonly LogRecord[], pointers: readonly PointerSpec[]): { readonly i: number; readonly spec: PointerSpec; readonly view: number | null }[] {
  const specOf = new Map(pointers.map((p) => [p.atomId, p] as const));
  const seen = new Set<string>();
  const out: { i: number; spec: PointerSpec; view: number | null }[] = [];
  let view: number | null = null;
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    if (r.kind === "cycle_start") view = (r.detail as CycleStartDetail).cycle as number;
    if (r.kind !== "bubble_available") continue;
    const spec = specOf.get((r.detail as BubbleAvailableDetail).atomId);
    if (!spec || seen.has(spec.atomId)) continue;
    seen.add(spec.atomId);
    out.push({ i, spec, view });
  }
  return out;
}

/**
 * The follow-up of every pointer delivered in `records` (one entry per pointer received, in delivery order), within its window. `pointers`
 * defaults to the scenario's.
 */
export function pointerFollowUps(records: readonly LogRecord[], pointers: readonly PointerSpec[] = POINTER_SPECS): PointerFollowUp[] {
  const asked = questionsOf(records);
  const freezes = freezeSpans(records);
  return deliveries(records, pointers).map(({ i, spec, view }) => {
    const r = records[i]!;
    const delivered = r.seq as number;
    // The window's end: the view's freeze if one follows the pointer within the view, else the view's end.
    const rest = records.slice(i + 1);
    const viewEnd = rest.find((x) => (x.kind === "cycle_end" && (x.detail as CycleEndDetail).cycle === view) || x.kind === "cycle_start");
    const viewEndSeq = viewEnd ? (viewEnd.seq as number) : Number.POSITIVE_INFINITY;
    const freeze = rest.find((x) => x.kind === "freeze_started" && (x.detail as FreezeStartedDetail).cycle === view && (x.seq as number) < viewEndSeq) ?? null;
    const endRecord = freeze ?? (viewEnd?.kind === "cycle_end" ? viewEnd : null);
    const endSeq = freeze ? (freeze.seq as number) : viewEndSeq;
    const start: WindowStart = spec.windowStart ?? "view_start", end: WindowEnd = freeze ? "freeze" : "view_end";
    const window: PointerWindow = { start, end, cls: `${start}→${end}`, windowMs: endRecord ? endRecord.tWallOffsetMs - r.tWallOffsetMs : null };
    const inWindow = asked.filter((q) => q.seq > delivered && q.seq < endSeq);
    let firstRetrieved: FollowUpQuery | null = null, firstShown: FollowUpQuery | null = null;
    for (const q of inWindow) {
      const rank = rankIn(q, spec.to);
      if (rank === null) continue;
      const hit = hitOf(q, rank, r.tWallOffsetMs, freezes);
      firstRetrieved ??= hit;
      if (rank === 1) { firstShown = hit; break; }
    }
    return {
      pointerId: spec.atomId, to: spec.to, kind: spec.kind, serves: spec.serves ?? [], view, window,
      questionsInWindow: inWindow.length, followed: firstRetrieved !== null, shown: firstShown !== null, firstRetrieved, firstShown,
    };
  });
}

export interface FollowUpRate {
  /** Pointers received. */
  readonly received: number;
  readonly followed: number;
  readonly shown: number;
  /** followed / received; null when none was received. */
  readonly followedRate: number | null;
  readonly shownRate: number | null;
  /** Median latency (wall ms) of the first retrieving question; null when none followed. */
  readonly medianLatencyMs: number | null;
}

const median = (xs: readonly number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const rateOf = (xs: readonly PointerFollowUp[]): FollowUpRate => {
  const followed = xs.filter((f) => f.followed);
  const shown = xs.filter((f) => f.shown).length;
  return {
    received: xs.length, followed: followed.length, shown,
    followedRate: xs.length ? followed.length / xs.length : null, shownRate: xs.length ? shown / xs.length : null,
    medianLatencyMs: median(followed.map((f) => f.firstRetrieved!.latencyMs)),
  };
};

/** The window classes in a fixed order (reports and tests list them so). */
export const WINDOW_CLASSES: readonly WindowClass[] = ["view_start→freeze", "step_boundary→freeze", "view_start→view_end", "step_boundary→view_end"];

/**
 * The participant's follow-up rates, real and decoy pointers apart (decoys are the baseline, never pooled with the real ones), overall
 * and per window class (revision (bn)); `comparable` lists the classes in which both kinds were received — the only ones in which the
 * real − decoy difference is read (SPEC/09 (bn) §2).
 */
export function pointerFollowUpRates(followUps: readonly PointerFollowUp[]): {
  readonly real: FollowUpRate; readonly decoy: FollowUpRate;
  readonly byWindow: Readonly<Partial<Record<WindowClass, { readonly real: FollowUpRate; readonly decoy: FollowUpRate }>>>;
  readonly comparable: readonly WindowClass[];
} {
  const of = (kind: "real" | "decoy", xs: readonly PointerFollowUp[]) => rateOf(xs.filter((f) => f.kind === kind));
  const byWindow: Partial<Record<WindowClass, { real: FollowUpRate; decoy: FollowUpRate }>> = {};
  const comparable: WindowClass[] = [];
  for (const cls of WINDOW_CLASSES) {
    const xs = followUps.filter((f) => f.window.cls === cls);
    if (xs.length === 0) continue;
    const entry = { real: of("real", xs), decoy: of("decoy", xs) };
    byWindow[cls] = entry;
    if (entry.real.received > 0 && entry.decoy.received > 0) comparable.push(cls);
  }
  return { real: of("real", followUps), decoy: of("decoy", followUps), byWindow, comparable };
}

/** Revision (bn): the class of a real pointer for an item it serves, before the item's moment (SPEC/09 (bn) §4). */
export type PointerItemClass = "followed" | "heard_not_followed" | "not_heard";

export interface PointerItemFollowUp {
  readonly pointerId: string;
  readonly itemId: string;
  /** What the item's moment is: its view's freeze, or its SPAM delivery's prompt. */
  readonly moment: "freeze" | "spam_prompt";
  /** The moment was reached in the log (else the class is read up to the log's end). */
  readonly momentReached: boolean;
  readonly cls: PointerItemClass;
  /** The first retrieving question before the moment, if any. */
  readonly firstRetrieved: FollowUpQuery | null;
}

/** The record that is an item's moment: `freeze.<view>.<slug>` its view's `freeze_started`; `probe.s.cycle_<n>[.b]` its delivery's prompt. */
function momentOf(records: readonly LogRecord[], itemId: string): { readonly kind: "freeze" | "spam_prompt"; readonly seq: number | null } {
  const fz = /^freeze\.(\d+)\./.exec(itemId);
  if (fz) {
    const view = Number(fz[1]);
    const r = records.find((x) => x.kind === "freeze_started" && (x.detail as FreezeStartedDetail).cycle === view);
    return { kind: "freeze", seq: r ? (r.seq as number) : null };
  }
  const probeId = itemId.replace(/\.b$/, "");
  const r = records.find((x) => x.kind === "spam_prompt_shown" && (x.detail as SpamPromptShownDetail).probeId === probeId);
  return { kind: "spam_prompt", seq: r ? (r.seq as number) : null };
}

/**
 * Per real pointer and item it serves: followed (a question between the delivery and the item's moment retrieved the record, rank ≤ 8),
 * heard, not followed (delivered before the moment, no such question), or not heard (not delivered before the moment). Questions are
 * counted across views up to the moment, so SPAM V3.b's runs from V2's step boundary to the V3 prompt (SPEC/09 (bm) §4).
 */
export function pointerItemClasses(records: readonly LogRecord[], pointers: readonly PointerSpec[] = POINTER_SPECS): PointerItemFollowUp[] {
  const asked = questionsOf(records);
  const freezes = freezeSpans(records);
  const delivered = new Map(deliveries(records, pointers).map((d) => [d.spec.atomId, records[d.i]!] as const));
  const out: PointerItemFollowUp[] = [];
  for (const p of pointers.filter((x) => x.kind === "real")) {
    for (const itemId of p.serves ?? []) {
      const m = momentOf(records, itemId);
      const until = m.seq ?? Number.POSITIVE_INFINITY;
      const d = delivered.get(p.atomId);
      if (!d || (d.seq as number) > until) {
        out.push({ pointerId: p.atomId, itemId, moment: m.kind, momentReached: m.seq !== null, cls: "not_heard", firstRetrieved: null });
        continue;
      }
      const q = asked.find((x) => x.seq > (d.seq as number) && x.seq < until && rankIn(x, p.to) !== null) ?? null;
      out.push({
        pointerId: p.atomId, itemId, moment: m.kind, momentReached: m.seq !== null, cls: q ? "followed" : "heard_not_followed",
        firstRetrieved: q ? hitOf(q, rankIn(q, p.to)!, d.tWallOffsetMs, freezes) : null,
      });
    }
  }
  return out;
}
