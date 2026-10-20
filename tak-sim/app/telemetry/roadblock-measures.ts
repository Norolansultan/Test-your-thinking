/**
 * Roadblock latency (SPEC/32 §7, 20 Oct 2026): how long after a deciding record reached the screen the participant first acted on
 * it. A pure fold over the log, the directive keys (passed in: TRUTH, as in `review-measures.ts`) and the deciding records; analysis
 * only, never called at runtime and never stored (SPEC/07 §1).
 *
 * Operational definitions (DRAFT until pilot 2's cued recall validates them, SPEC/32 §6):
 * - **The records.** Each no-fit view's deciding records are the atom ids of its `contradicted` premises in the premise-evidence table
 *   (`content/thinker/premise-evidence.json`: V9 SPOT 17.01; V10 the same with DR2's and DR3's records; V14 SPOT 19.23), one row per
 *   (view, atom); a record deciding in two views has a row in each. The planted false record (H9, `F7_PLANTED_ATOM_ID`) has one row,
 *   in the view where it first reached the screen. Both lists can be passed in (`decidingAtoms`, `plantedAtomId`).
 * - **The attempt.** A deciding row reads the last attempt of its view (its last `cycle_start`, as `directiveAdherence` codes a view
 *   replayed after a resume) up to the next `cycle_start`; the planted row reads the attempt in which it first arrived.
 * - **Arrival** is the earliest record in the attempt that shows the record on the screen:
 *   `carried_over` — pushed (`bubble_available`) before the attempt began, so it stands in the message log from the view's start: the
 *   arrival is the view clock's start (the attempt's `tour_completed` when the view ran a tour, else its `cycle_start`);
 *   `pushed` — `bubble_available` in the attempt; `haku_result` — listed in a Haku result (`nav_query_submitted` /
 *   `query_submitted.resultAtomIds`); `review_citation` — cited by a premise line of `plan_review_shown` (the guide group);
 *   `result_expanded` — `result_item_expanded` (older logs). A chat retrieval (`ai_chat_answer_received.retrieved`) is retrieved for the
 *   model, which does not show the record, so it counts only with `includeChatRetrieval` (route `chat_retrieval`, a sensitivity).
 * - **The act** is the first record after the arrival and before the view ended (`view_ended` of the view, else the attempt's end):
 *   `opened_from_review` — `plan_review_record_opened` of the atom; `opened` — `result_item_expanded` of the atom, or a `click` on a
 *   `bubble`, `result_item` or `rail_item` whose `targetId` is the atom (kept for logs and builds that emit them; the current build
 *   opens a cited record only from the review); `plan_c` — a plan (`allocation_submitted` / `allocation_revised` with a posture)
 *   coded C by the act coding (`codePosture(...).cellByAct`, H13's primary) against the view's key; deciding rows only, never the
 *   planted record. No act before the view ended: `actKind` and the latencies are null.
 * - **Latency.** `latencyWallMs` is the real time between the two records (`tWallOffsetMs`). `latencyViewSeconds` is the same time
 *   minus the spans in which the view's clock stood still (`freeze_started` → `freeze_submitted`, a visible probe's `probe_presented`
 *   → `probe_submitted` / `expectation_marked`, `plan_review_shown` → `plan_review_closed`), clipped to the interval: the view clock
 *   runs in real time otherwise, so this is the view-clock difference without a view-seconds field on every record. It is the
 *   preferred value; the wall time is kept beside it.
 */

import premiseEvidence from "../../content/thinker/premise-evidence.json" with { type: "json" };
import { codePosture, type DirectiveKeyLike } from "./derived-measures.js";
import { F7_PLANTED_ATOM_ID } from "./freeze-measures.js";
import type { LogRecord } from "./log.js";
import type {
  AiChatAnswerReceivedDetail, AllocationRevisedDetail, AllocationSubmittedDetail, BubbleAvailableDetail, ClickDetail, CycleStartDetail,
  NavQuerySubmittedDetail, PlanReviewRecordOpenedDetail, PlanReviewShownDetail, QuerySubmittedDetail, ResultItemDetail,
} from "./record-kinds.js";

export type ArrivalRoute = "carried_over" | "pushed" | "haku_result" | "review_citation" | "result_expanded" | "chat_retrieval";
export type RoadblockAct = "opened" | "opened_from_review" | "plan_c";

export interface RoadblockLatency {
  readonly record: "deciding" | "planted";
  readonly atomId: string;
  /** The view the row reads (null: the planted record never reached the screen). */
  readonly view: number | null;
  readonly arrivalRoute: ArrivalRoute | null;
  readonly arrivalSeq: number | null;
  readonly actKind: RoadblockAct | null;
  readonly actSeq: number | null;
  readonly latencyViewSeconds: number | null;
  readonly latencyWallMs: number | null;
}

export interface RoadblockOptions {
  /** No-fit view → its deciding atom ids; default the premise-evidence table's contradicted premises. */
  readonly decidingAtoms?: ReadonlyMap<number, readonly string[]>;
  readonly plantedAtomId?: string;
  /** Count a chat retrieval as an arrival (a sensitivity; default false). */
  readonly includeChatRetrieval?: boolean;
}

interface PremiseEntry { readonly status: string; readonly atomIds?: readonly string[] }

/** The premise-evidence table's deciding records per view: the atom ids of its contradicted premises, in premise order, without repeats. */
export function decidingAtomsFromTable(table: { readonly views: Readonly<Record<string, Readonly<Record<string, PremiseEntry>>>> } = premiseEvidence): Map<number, string[]> {
  const out = new Map<number, string[]>();
  // determinism-lint-allow: content keys sorted immediately with an explicit comparator (I1).
  const viewIds = Object.keys(table.views).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  for (const viewId of viewIds) {
    const premises = table.views[viewId]!;
    // determinism-lint-allow: content keys sorted immediately with an explicit comparator (I1).
    const premiseIds = Object.keys(premises).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const atoms: string[] = [];
    for (const p of premiseIds) {
      const e = premises[p]!;
      if (e.status !== "contradicted") continue;
      for (const id of e.atomIds ?? []) if (!atoms.includes(id)) atoms.push(id);
    }
    if (atoms.length > 0) out.set(Number(viewId.slice(1)), atoms);
  }
  return out;
}

/** The routes by which a record shows these atoms on the screen (`carried_over` is decided by the caller). */
function arrivalsIn(r: LogRecord, includeChat: boolean): readonly { atomId: string; route: ArrivalRoute }[] {
  switch (r.kind) {
    case "bubble_available": return [{ atomId: (r.detail as BubbleAvailableDetail).atomId, route: "pushed" }];
    case "nav_query_submitted": return (r.detail as NavQuerySubmittedDetail).resultAtomIds.map((atomId) => ({ atomId, route: "haku_result" as const }));
    case "query_submitted": return ((r.detail as QuerySubmittedDetail).resultAtomIds ?? []).map((atomId) => ({ atomId, route: "haku_result" as const }));
    case "plan_review_shown":
      return ((r.detail as PlanReviewShownDetail).premiseStatuses ?? []).flatMap((s) => s.atomIds.map((atomId) => ({ atomId, route: "review_citation" as const })));
    case "result_item_expanded": return [{ atomId: (r.detail as ResultItemDetail).atomId, route: "result_expanded" }];
    case "ai_chat_answer_received":
      return includeChat ? (r.detail as AiChatAnswerReceivedDetail).retrieved.map((x) => ({ atomId: x.id, route: "chat_retrieval" as const })) : [];
    default: return [];
  }
}

const OPEN_CLICK_TARGETS: readonly string[] = ["bubble", "result_item", "rail_item"];

function openingOf(r: LogRecord, atomId: string): RoadblockAct | null {
  if (r.kind === "plan_review_record_opened") return (r.detail as PlanReviewRecordOpenedDetail).atomId === atomId ? "opened_from_review" : null;
  if (r.kind === "result_item_expanded") return (r.detail as ResultItemDetail).atomId === atomId ? "opened" : null;
  if (r.kind === "click") { const d = r.detail as ClickDetail; return OPEN_CLICK_TARGETS.includes(d.targetKind) && d.targetId === atomId ? "opened" : null; }
  return null;
}

function isPlanC(r: LogRecord, key: DirectiveKeyLike | null | undefined): boolean {
  if (!key || (r.kind !== "allocation_submitted" && r.kind !== "allocation_revised")) return false;
  const plan = (r.detail as AllocationSubmittedDetail | AllocationRevisedDetail).plan;
  if (plan.posture === undefined) return false;
  return codePosture(r.seq as number, plan.posture, plan.mainEffort, key, plan.secondary ?? null).cellByAct === "C";
}

/** The real ms in [from, to] during which the view's clock stood still (freezes, visible probes, the review). */
function pausedMs(segment: readonly LogRecord[], from: number, to: number): number {
  let total = 0;
  let openedAt: number | null = null;
  const STARTS = ["freeze_started", "probe_presented", "plan_review_shown"];
  const ENDS = ["freeze_submitted", "probe_submitted", "expectation_marked", "plan_review_closed"];
  for (const r of segment) {
    if (STARTS.includes(r.kind) && openedAt === null) openedAt = r.tWallOffsetMs;
    else if (ENDS.includes(r.kind) && openedAt !== null) {
      total += Math.max(0, Math.min(r.tWallOffsetMs, to) - Math.max(openedAt, from));
      openedAt = null;
    }
  }
  if (openedAt !== null) total += Math.max(0, to - Math.max(openedAt, from));
  return total;
}

interface Attempt { readonly view: number; readonly start: LogRecord; readonly records: readonly LogRecord[] }

function attempts(records: readonly LogRecord[]): Attempt[] {
  const out: { view: number; start: LogRecord; records: LogRecord[] }[] = [];
  for (const r of records) {
    if (r.kind === "cycle_start") { out.push({ view: (r.detail as CycleStartDetail).cycle as number, start: r, records: [] }); continue; }
    out.at(-1)?.records.push(r);
  }
  return out;
}

function measure(
  kind: RoadblockLatency["record"], atomId: string, attempt: Attempt, records: readonly LogRecord[], key: DirectiveKeyLike | null | undefined,
  includeChat: boolean,
): RoadblockLatency {
  const empty = { record: kind, atomId, view: attempt.view, arrivalRoute: null, arrivalSeq: null, actKind: null, actSeq: null, latencyViewSeconds: null, latencyWallMs: null };
  const pushedBefore = records.some((r) => r.seq < attempt.start.seq && r.kind === "bubble_available" && (r.detail as BubbleAvailableDetail).atomId === atomId);
  const ended = attempt.records.find((r) => r.kind === "view_ended" && (r.detail as { readonly cycle: number }).cycle === attempt.view);
  const inView = attempt.records.filter((r) => ended === undefined || r.seq <= ended.seq);
  let arrival: { record: LogRecord; route: ArrivalRoute } | null = null;
  if (pushedBefore) arrival = { record: inView.find((r) => r.kind === "tour_completed") ?? attempt.start, route: "carried_over" };
  else {
    for (const r of inView) {
      const hit = arrivalsIn(r, includeChat).find((a) => a.atomId === atomId);
      if (hit) { arrival = { record: r, route: hit.route }; break; }
    }
  }
  if (!arrival) return empty;
  const from = arrival.record;
  let act: { record: LogRecord; kind: RoadblockAct } | null = null;
  for (const r of inView) {
    if (r.seq <= from.seq || r === ended) continue;
    const opened = openingOf(r, atomId);
    const k: RoadblockAct | null = opened ?? (kind === "deciding" && isPlanC(r, key) ? "plan_c" : null);
    if (k) { act = { record: r, kind: k }; break; }
  }
  const base = { ...empty, arrivalRoute: arrival.route, arrivalSeq: from.seq as number };
  if (!act) return base;
  const wall = act.record.tWallOffsetMs - from.tWallOffsetMs;
  const paused = pausedMs(attempt.records, from.tWallOffsetMs, act.record.tWallOffsetMs);
  return { ...base, actKind: act.kind, actSeq: act.record.seq as number, latencyWallMs: wall, latencyViewSeconds: Math.max(0, wall - paused) / 1000 };
}

/**
 * One row per (no-fit view, deciding record), in view and table order, then the planted record's row. A view the log never entered
 * gives rows with null arrival. `keys` are the directive keys (`DIRECTIVE_KEYS`) for the plan-C act.
 */
export function roadblockLatencies(
  records: readonly LogRecord[], keys: Readonly<Record<number, DirectiveKeyLike | null>>, opts: RoadblockOptions = {},
): RoadblockLatency[] {
  const includeChat = opts.includeChatRetrieval === true;
  const all = attempts(records);
  const deciding = opts.decidingAtoms ?? decidingAtomsFromTable();
  const views = [...deciding.keys()].sort((a, b) => a - b);
  const out: RoadblockLatency[] = [];
  for (const view of views) {
    const attempt = all.filter((a) => a.view === view).at(-1);
    for (const atomId of deciding.get(view)!) {
      out.push(attempt
        ? measure("deciding", atomId, attempt, records, keys[view], includeChat)
        : { record: "deciding", atomId, view, arrivalRoute: null, arrivalSeq: null, actKind: null, actSeq: null, latencyViewSeconds: null, latencyWallMs: null });
    }
  }
  const planted = opts.plantedAtomId ?? F7_PLANTED_ATOM_ID;
  const plantedRow = all.filter((a) => a.view >= 1).map((a) => measure("planted", planted, a, records, null, includeChat)).find((m) => m.arrivalRoute !== null);
  out.push(plantedRow
    ?? { record: "planted", atomId: planted, view: null, arrivalRoute: null, arrivalSeq: null, actKind: null, actSeq: null, latencyViewSeconds: null, latencyWallMs: null });
  return out;
}
