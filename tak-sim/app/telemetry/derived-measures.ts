/**
 * Derived measures — SPEC/07_Telemetry_and_Logging.md §4: "Listed here so
 * the raw records above can be checked for sufficiency. If a measure
 * below cannot be computed from §2, a record is missing."
 *
 * Every function here is pure: `(records) => measure`, computed only from
 * already-logged records, never stored back into the log (SPEC/07 §1: "A
 * derived value stored at runtime makes an analysis bug permanent").
 *
 * Measures whose formula needs scenario content in addition to the log
 * (source-selection tracking against `SourceClass.reliability`, tier-4
 * discovery against the three named load-bearing atom ids, channel
 * attention's "whether any signal was opened") take that content as an
 * explicit second argument rather than reaching for a global — keeping
 * every function here a pure fold over its inputs.
 *
 * Fix pass 2 (7 Oct 2026, P1-11): the measures of the withdrawn containment
 * judgement (its latency, revision rate, doubt-action coherence, and the
 * latency in the fatigue trajectory) are removed; nothing used them.
 *
 * Final fix pass (8 Oct 2026, items5): the information-seeking acts are read from the
 * records the app emits (Haku's builder and free-text queries, the two chats' questions, the
 * tool-tab selections). The measures of record kinds with NO emitter (`drawer_*`,
 * `element_enter` / `element_leave`, `text_scrolled`, `traffic_returned`,
 * `result_item_expanded`, `channel_signal_emitted`) are marked @deprecated below: they return
 * empty or zero on every current log and are kept only so older logs and their tests still compute.
 */

import { ATTENTION_CHECK_CORRECT, ATTENTION_CHECK_ID } from "../session/questionnaire.js";
import type { LogRecord } from "./log.js";
import type {
  AiChatAnswerReceivedDetail,
  AiChatQuerySubmittedDetail,
  AllocationRevisedDetail,
  AllocationSubmittedDetail,
  ClickTargetKind,
  ConfidenceSliderMovedDetail,
  CycleEndDetail,
  CycleStartDetail,
  DroneTaskedDetail,
  FreezeStartedDetail,
  BubbleAvailableDetail,
  ElementEnterLeaveDetail,
  QuerySubmittedDetail,
  QuestionnaireSubmittedDetail,
  RecordKind,
  SessionResumedDetail,
  ResultItemDetail,
  TabSelectedDetail,
  TextScrolledDetail,
  NavQuerySubmittedDetail,
  TrafficReturnedDetail,
} from "./record-kinds.js";

function byKind(records: readonly LogRecord[], kind: RecordKind): LogRecord[] {
  return records.filter((r) => r.kind === kind);
}

// ---------------------------------------------------------------------------
// Time to first information-seeking act in a cycle: first
// nav_query_submitted | query_submitted | ai_chat_query_submitted | tab_selected
// (a tool tab opened, not closed) - cycle_start
// (SPEC/07 revision (j): radio requests are retired; final fix pass 8 Oct 2026:
// `drawer_opened` has no emitter and is gone from the list, the two chats' questions
// and the tool tabs are in)
// ---------------------------------------------------------------------------

// 11 Oct 2026 (SPEC/25 (aq)): the demonstration-only Indexed search emits nav_* / query_submitted and
// tab_selected "indexed_search" again; they are tolerated here and in the freeze and spam measures (exposure
// route "haku"), and never occur in study data (the tab is not rendered under ?tuotanto).
/** The record kinds that are information-seeking acts; a `tab_selected` counts only when it opens a tool (see `isInformationSeekingAct`). */
const INFORMATION_SEEKING_KINDS: readonly RecordKind[] = ["nav_query_submitted", "query_submitted", "ai_chat_query_submitted", "tab_selected"];

/** Whether a record is an information-seeking act: a query of Haku or a chat, or the selection of a tool tab (closing the panel, `none`, is not). */
export function isInformationSeekingAct(r: LogRecord): boolean {
  if (!INFORMATION_SEEKING_KINDS.includes(r.kind as RecordKind)) return false;
  return r.kind !== "tab_selected" || (r.detail as TabSelectedDetail).tool !== "none";
}

export function timeToFirstInformationSeekingActMs(records: readonly LogRecord[]): number | null {
  const cycleStart = records.find((r) => r.kind === "cycle_start");
  if (!cycleStart) return null;
  const candidates = records.filter((r) => isInformationSeekingAct(r) && r.seq > cycleStart.seq);
  if (candidates.length === 0) return null;
  const first = candidates.reduce((earliest, r) => (r.tWallOffsetMs < earliest.tWallOffsetMs ? r : earliest));
  return first.tWallOffsetMs - cycleStart.tWallOffsetMs;
}

// ---------------------------------------------------------------------------
// Dwell per element: paired element_enter / element_leave
// ---------------------------------------------------------------------------

export interface ElementDwell {
  readonly targetKind: ClickTargetKind;
  readonly targetId: string | null;
  readonly dwellMs: number;
}

/**
 * @deprecated No emitter: `element_enter` / `element_leave` are not logged by the app (final fix pass, 8 Oct 2026); returns [] on every
 * current log. Pairs each `element_enter` with the next `element_leave` for the same (targetKind, targetId). Unmatched enters (no closing leave logged) are omitted — an incomplete pair yields no dwell, not a guessed one. */
export function dwellPerElement(records: readonly LogRecord[]): ElementDwell[] {
  const dwells: ElementDwell[] = [];
  const openEnters = new Map<string, LogRecord[]>();
  const key = (d: ElementEnterLeaveDetail) => `${d.targetKind}::${d.targetId ?? ""}`;

  for (const record of records) {
    if (record.kind === "element_enter") {
      const detail = record.detail as ElementEnterLeaveDetail;
      const k = key(detail);
      const queue = openEnters.get(k) ?? [];
      queue.push(record);
      openEnters.set(k, queue);
    } else if (record.kind === "element_leave") {
      const detail = record.detail as ElementEnterLeaveDetail;
      const k = key(detail);
      const queue = openEnters.get(k);
      const enter = queue?.shift();
      if (enter) {
        dwells.push({ targetKind: detail.targetKind, targetId: detail.targetId, dwellMs: record.tWallOffsetMs - enter.tWallOffsetMs });
      }
    }
  }
  return dwells;
}

// ---------------------------------------------------------------------------
// Report read-through: text_scrolled.maxFraction per element
// ---------------------------------------------------------------------------

/**
 * @deprecated No emitter: `text_scrolled` is not logged by the app (8 Oct 2026); returns an empty map on every current log.
 * The maximum scroll fraction ever reached per element — the only evidence a long report was read to the end (SPEC/07 §2.3). Later (larger) fractions win; scroll fraction never decreases in meaning even if the raw event stream is unordered by element. */
export function reportReadThrough(records: readonly LogRecord[]): Map<string, number> {
  const maxByElement = new Map<string, number>();
  for (const record of byKind(records, "text_scrolled")) {
    const detail = record.detail as TextScrolledDetail;
    const current = maxByElement.get(detail.elementId) ?? 0;
    maxByElement.set(detail.elementId, Math.max(current, detail.maxScrollFraction));
  }
  return maxByElement;
}

// ---------------------------------------------------------------------------
// Reformulation chain length: query_submitted records sharing a cycle, by
// chain index — the count of reformulations is the highest chain index
// reached, per query id "family" sharing a chain.
// ---------------------------------------------------------------------------

export function reformulationChainLength(records: readonly LogRecord[]): number {
  const submitted = byKind(records, "query_submitted").map((r) => r.detail as QuerySubmittedDetail);
  if (submitted.length === 0) return 0;
  return Math.max(...submitted.map((d) => d.reformulationChainIndex)) + 1;
}

// ---------------------------------------------------------------------------
// Abandonment rate: query_cleared / (query_cleared + query_submitted)
// ---------------------------------------------------------------------------

export function abandonmentRate(records: readonly LogRecord[]): number {
  const cleared = byKind(records, "query_cleared").length;
  const submitted = byKind(records, "query_submitted").length;
  const total = cleared + submitted;
  return total === 0 ? 0 : cleared / total;
}

// ---------------------------------------------------------------------------
// Confidence reversal count: direction changes within a
// confidence_slider_moved run for one probe.
// ---------------------------------------------------------------------------

export function confidenceReversalCount(records: readonly LogRecord[], probeId: string): number {
  const moves = byKind(records, "confidence_slider_moved")
    .map((r) => r.detail as ConfidenceSliderMovedDetail)
    .filter((d) => d.probeId === probeId);
  let reversals = 0;
  let lastDirection: -1 | 0 | 1 = 0;
  for (let i = 1; i < moves.length; i++) {
    const delta = moves[i]!.value - moves[i - 1]!.value;
    const direction: -1 | 0 | 1 = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    if (direction !== 0 && lastDirection !== 0 && direction !== lastDirection) {
      reversals += 1;
    }
    if (direction !== 0) lastDirection = direction;
  }
  return reversals;
}

// ---------------------------------------------------------------------------
// Drawer reliance: drawer-open fraction of the working period, per cycle.
// ---------------------------------------------------------------------------

/** @deprecated No emitter: `drawer_opened` / `drawer_closed` are not logged by the app (8 Oct 2026); always 0 on a current log. */
export function drawerOpenFraction(records: readonly LogRecord[]): number {
  const cycleStart = records.find((r) => r.kind === "cycle_start");
  const cycleEnd = records.find((r) => r.kind === "cycle_end");
  if (!cycleStart || !cycleEnd) return 0;
  const cycleEndDetail = cycleEnd.detail as CycleEndDetail;
  const workingPeriodMs = cycleEndDetail.totalRealDurationMs;
  if (workingPeriodMs <= 0) return 0;

  let openMs = 0;
  let openedAt: number | null = null;
  for (const record of records) {
    if (record.seq < cycleStart.seq) continue;
    if (record.kind === "drawer_opened") {
      openedAt = record.tWallOffsetMs;
    } else if (record.kind === "drawer_closed" && openedAt !== null) {
      openMs += record.tWallOffsetMs - openedAt;
      openedAt = null;
    }
  }
  return Math.min(1, openMs / workingPeriodMs);
}

/** @deprecated No emitter (`drawer_opened`, 8 Oct 2026): every cycle of a current log counts as "no drawer opened". Cycles in which no drawer was opened at all (SPEC/07 §2.4: "derived in analysis, never at runtime"). */
export function cyclesWithNoDrawerOpened(records: readonly LogRecord[]): Set<number> {
  const cycles = new Set<number>();
  const opened = new Set<number>();
  for (const record of records) {
    if (record.kind === "cycle_start") {
      cycles.add((record.detail as CycleStartDetail).cycle as number);
    }
  }
  let currentCycle: number | null = null;
  for (const record of records) {
    if (record.kind === "cycle_start") {
      currentCycle = (record.detail as CycleStartDetail).cycle as number;
    } else if (record.kind === "drawer_opened" && currentCycle !== null) {
      opened.add(currentCycle);
    }
  }
  return new Set([...cycles].filter((c) => !opened.has(c)));
}

// ---------------------------------------------------------------------------
// Channel attention (substitutive): element_enter on channel_signal
// targets, dwell, and whether any signal was opened.
// ---------------------------------------------------------------------------

export interface ChannelAttention {
  readonly anySignalOpened: boolean;
  readonly dwells: readonly ElementDwell[];
}

/** @deprecated No emitter: it reads `element_enter` on channel signals (8 Oct 2026); `anySignalOpened` is false on every current log. */
export function channelAttention(records: readonly LogRecord[]): ChannelAttention {
  const dwells = dwellPerElement(records).filter((d) => d.targetKind === "channel_signal");
  return { anySignalOpened: dwells.length > 0, dwells };
}

// ---------------------------------------------------------------------------
// Source-selection tracking: the KUKA source of each nav_query_submitted
// against authored SourceClass.reliability (SPEC/07 revision (j), which
// replaces radio_request_submitted.addressee). A query with no KUKA source
// selected chose no source and is skipped.
// ---------------------------------------------------------------------------

export interface SourceSelectionEntry {
  readonly sourceId: string;
  readonly reliability: "known-good" | "unproven" | "degraded" | "unknown_source";
}

export function sourceSelectionTracking(
  records: readonly LogRecord[],
  reliabilityByUnitId: ReadonlyMap<string, "known-good" | "unproven" | "degraded">,
): SourceSelectionEntry[] {
  return byKind(records, "nav_query_submitted").flatMap((r) => {
    const { sourceId } = r.detail as NavQuerySubmittedDetail;
    return sourceId === null ? [] : [{ sourceId, reliability: reliabilityByUnitId.get(sourceId) ?? "unknown_source" }];
  });
}

// ---------------------------------------------------------------------------
// Tier-4 discovery (SPEC/07 §2.7): whether each authored load-bearing atom reached the
// participant, read from the records the app emits — pushed (`bubble_available`) or
// retrieved for a chat answer (`ai_chat_answer_received.retrieved`, either chat). Final
// fix pass (8 Oct 2026): it read `traffic_returned` and `result_item_expanded`, which
// nothing emits, so it found nothing; those two routes stay for older logs.
// No new record kind — this is purely a derived cross-reference.
// ---------------------------------------------------------------------------

export interface Tier4Discovery {
  readonly atomId: string;
  readonly reached: boolean;
  readonly route: "bubble_available" | "ai_chat_answer_received" | "traffic_returned" | "result_item_expanded" | null;
  readonly atSeq: number | null;
}

export function tier4Discovery(records: readonly LogRecord[], loadBearingAtomIds: readonly string[]): Tier4Discovery[] {
  const discovered = new Map<string, { route: Tier4Discovery["route"]; atSeq: number }>();
  const note = (atomId: string, route: Tier4Discovery["route"], atSeq: number) => { if (!discovered.has(atomId)) discovered.set(atomId, { route, atSeq }); };

  for (const r of records) {
    switch (r.kind) {
      case "bubble_available": note((r.detail as BubbleAvailableDetail).atomId, "bubble_available", r.seq); break;
      case "ai_chat_answer_received": for (const x of (r.detail as AiChatAnswerReceivedDetail).retrieved) note(x.id, "ai_chat_answer_received", r.seq); break;
      case "traffic_returned": for (const atomId of (r.detail as TrafficReturnedDetail).entryIds) note(atomId, "traffic_returned", r.seq); break;
      case "result_item_expanded": note((r.detail as ResultItemDetail).atomId, "result_item_expanded", r.seq); break;
      default: break;
    }
  }

  return loadBearingAtomIds.map((atomId) => {
    const hit = discovered.get(atomId);
    return { atomId, reached: hit !== undefined, route: hit?.route ?? null, atSeq: hit?.atSeq ?? null };
  });
}

// ---------------------------------------------------------------------------
// Fatigue trajectory: per-cycle information-seeking counts against cycle index.
// ---------------------------------------------------------------------------

export interface FatigueTrajectoryPoint {
  readonly cycle: number;
  readonly informationSeekingActCount: number;
}

export function fatigueTrajectory(recordsByCycle: ReadonlyMap<number, readonly LogRecord[]>): FatigueTrajectoryPoint[] {
  return [...recordsByCycle.entries()]
    .sort(([a], [b]) => a - b)
    .map(([cycle, records]) => ({ cycle, informationSeekingActCount: records.filter(isInformationSeekingAct).length }));
}

// ---------------------------------------------------------------------------
// Drone survey of a sector in a view window (SPEC/16 revision 1 Oct 2026),
// from drone_tasked records only. Generic: the target sector, the survey
// tasks and the window are a declared spec; the rekindle check is one.
// ---------------------------------------------------------------------------

export interface DroneSurveyWindowSpec {
  readonly targetSectorId: string;
  readonly taskIds: readonly string[];
  /** First view of the window, inclusive. */
  readonly fromView: number;
  /** The view the window closes at, exclusive: the view in which the anticipated event is reported. */
  readonly beforeView: number;
}

/** The observation-drone tasks that survey a sector (`app/scenario/allocation.ts` ALLOCATION_TASKS). */
export const DRONE_SURVEY_TASK_IDS: readonly string[] = ["task.thermal-survey", "task.perimeter-map", "task.watch"];

/**
 * The rekindle arc (SPEC/26 §5): VPK's objection is on record in V7 ("check it with the thermal
 * camera"); the fire resurfaces in L3, and is reported, in V9. A drone survey of L3 ordered in V7
 * or V8 anticipates it.
 */
export const REKINDLE_DRONE_SURVEY: DroneSurveyWindowSpec = {
  targetSectorId: "L3",
  taskIds: DRONE_SURVEY_TASK_IDS,
  fromView: 7,
  beforeView: 9,
};

export interface DroneSurveyOrder {
  readonly seq: number;
  readonly view: number;
  /**
   * Whether the order was logged after the view's freeze was shown (`freeze_started`; fix pass 6, H10: an order after the freeze's L3 items
   * may be anticipation the freeze itself prompted); null in a view with no freeze.
   */
  readonly afterFreeze: boolean | null;
  readonly assetId: string;
  readonly taskId: string;
  readonly clockLabel: string;
  readonly tVirtual: number;
  readonly tWallOffsetMs: number;
}

export interface DroneSurveyTiming {
  /** `in_window` wins over `before_window` (surveyed only earlier) and `late` (only at or after `beforeView`). */
  readonly outcome: "in_window" | "before_window" | "late" | "never";
  /** The first qualifying order inside the window, or null. */
  readonly firstInWindow: DroneSurveyOrder | null;
  /** Every qualifying order (target sector and a survey task) in the main views, in log order. */
  readonly orders: readonly DroneSurveyOrder[];
}

/** The `seq` of the first `freeze_started` of each view. */
function firstFreezeSeqByView(records: readonly LogRecord[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of records) if (r.kind === "freeze_started") { const v = (r.detail as FreezeStartedDetail).cycle as number; if (!out.has(v)) out.set(v, r.seq as number); }
  return out;
}

export function droneSurveyTiming(records: readonly LogRecord[], spec: DroneSurveyWindowSpec): DroneSurveyTiming {
  const freezeSeq = firstFreezeSeqByView(records);
  const orders: DroneSurveyOrder[] = byKind(records, "drone_tasked").flatMap((r) => {
    const d = r.detail as DroneTaskedDetail;
    if (d.view < 1 || d.targetSectorId !== spec.targetSectorId || !spec.taskIds.includes(d.taskId)) return [];
    return [{ seq: r.seq, view: d.view, afterFreeze: freezeSeq.has(d.view) ? (r.seq as number) > freezeSeq.get(d.view)! : null, assetId: d.assetId, taskId: d.taskId, clockLabel: d.clockLabel, tVirtual: r.tVirtual, tWallOffsetMs: r.tWallOffsetMs }];
  });
  const firstInWindow = orders.find((o) => o.view >= spec.fromView && o.view < spec.beforeView) ?? null;
  const outcome: DroneSurveyTiming["outcome"] = firstInWindow
    ? "in_window"
    : orders.some((o) => o.view < spec.fromView) ? "before_window" : orders.length > 0 ? "late" : "never";
  return { outcome, firstInWindow, orders };
}

// ---------------------------------------------------------------------------
// Sector anticipation (SPEC/26 §5, H10, read from the sector plan): a plan in
// the window that puts the crews' main effort or secondary sector on the
// target sector. Every plan version counts (`allocation_revised` too).
// ---------------------------------------------------------------------------

export interface SectorAnticipationSpec {
  readonly sectorId: string;
  /** First view of the window, inclusive; the view it closes at, exclusive. */
  readonly fromView: number;
  readonly beforeView: number;
}

/** The rekindle arc: crews on L3 in V7 or V8, before the fire resurfaces there (reported in V9). */
export const REKINDLE_CREW_ANTICIPATION: SectorAnticipationSpec = { sectorId: "L3", fromView: 7, beforeView: 9 };

export interface SectorAnticipation {
  readonly anticipated: boolean;
  /** The first qualifying plan in the window, and whether it was the view's first submission or a revision. */
  readonly first: {
    readonly view: number; readonly seq: number; readonly as: "main_effort" | "secondary"; readonly revision: boolean;
    /** Whether that plan was logged after the view's freeze was shown (fix pass 6, H10); null in a view with no freeze. */
    readonly afterFreeze: boolean | null;
  } | null;
}

export function sectorAnticipation(records: readonly LogRecord[], spec: SectorAnticipationSpec): SectorAnticipation {
  const freezeSeq = firstFreezeSeqByView(records);
  let view = -1;
  for (const r of records) {
    if (r.kind === "cycle_start") view = (r.detail as CycleStartDetail).cycle;
    if (r.kind !== "allocation_submitted" && r.kind !== "allocation_revised") continue;
    if (view < spec.fromView || view >= spec.beforeView) continue;
    const plan = (r.detail as AllocationSubmittedDetail | AllocationRevisedDetail).plan;
    const as = plan.mainEffort === spec.sectorId ? "main_effort" : plan.secondary?.sectorId === spec.sectorId ? "secondary" : null;
    if (as) return { anticipated: true, first: { view, seq: r.seq, as, revision: r.kind === "allocation_revised", afterFreeze: freezeSeq.has(view) ? (r.seq as number) > freezeSeq.get(view)! : null } };
  }
  return { anticipated: false, first: null };
}

// ---------------------------------------------------------------------------
// Directive adherence (phase-B directive, researcher decision 4 Oct 2026;
// Paper 2): each view's main-effort posture against its key
// (`app/scenario/demo-directive.ts`, passed in). Aligned = within the
// directive; sound = within the key's sound postures (and, where the key
// restricts a posture to sectors, the plan's main effort in one of them), or
// (V14, 6 Oct 2026) the key's sound secondary task in its sector beside a
// main effort it names (`soundSecondary`).
// A aligned+sound, B aligned+unsound (blind compliance), C against+sound
// (justified deviation), D against+unsound; null where either is not coded
// (phase A: aligned null, its intent is conditional; V8: sound null).
// Review round 2 (4 Oct 2026, DEFAULT): the plan in force at view end is the
// coded one and the first submission is kept; a merged view reports whether
// that plan came after its step boundary (`step_boundary_reached`); every
// keyed view the log entered has an entry, with null codings when no plan was
// submitted (SPEC/07's "missing row").
// Fix pass 2 (7 Oct 2026, researcher-approved): alignment reads the whole plan
// (`againstSecondaryTaskId`: in phase B a secondary direct attack is against the
// directive), and each entry reports whether the coded plan came after the
// view's freeze (`afterFreeze`), as for the step boundary.
// Fix pass 3 (7 Oct 2026, researcher decision): H14 is coded on alignment
// (`h14Aligned`: A∪B = 1, C∪D = 0); the cell and soundness stay descriptive.
// A secondary direct attack the key does not list as sound makes a plan whose
// main posture is within the directive unsound (fix pass 4: only then); `viaBoundarySector` flags a plan sound
// only through a sector the key accepts across a boundary (sensitivity).
// ---------------------------------------------------------------------------

export interface DirectiveKeyLike {
  /** Null: not coded (phase A, reported descriptively). */
  readonly aligned: readonly string[] | null;
  /** A plan whose secondary sector carries this task is against the directive, whatever its main posture. */
  readonly againstSecondaryTaskId?: string;
  readonly sound: readonly string[] | null;
  /** A sound posture listed here is sound only when the main effort is one of its sectors. */
  readonly soundSectors?: Readonly<Partial<Record<string, readonly string[]>>>;
  /** Also sound: this secondary task in one of `sectors`, the main effort in one of `mainEffortSectors` with one of `mainEffortPostures`. */
  readonly soundSecondary?: { readonly taskId: string; readonly sectors: readonly string[]; readonly mainEffortSectors: readonly string[]; readonly mainEffortPostures: readonly string[] };
  /** Sectors accepted only across a sector boundary (`viaBoundarySector`). */
  readonly boundarySectors?: readonly string[];
}

export type DirectiveCell = "A" | "B" | "C" | "D";

export interface DirectivePostureCoding {
  readonly seq: number;
  readonly posture: string;
  readonly mainEffort: string;
  /** Null where the key codes no alignment (phase A). */
  readonly aligned: boolean | null;
  /**
   * The main posture alone is within the directive, whatever the secondary sector (final fix pass, 8 Oct 2026); `aligned` also reads the
   * secondary. Null where the key codes no alignment.
   */
  readonly mainAligned: boolean | null;
  /** PRIMARY coding, on the core sectors only (the key's `boundarySectors` are not accepted). Null where the key scores no sound posture. */
  readonly sound: boolean | null;
  /** What made the plan sound: its main effort's posture, or its secondary sector (`soundSecondary`); null when not sound. */
  readonly soundVia: "main_effort" | "secondary" | null;
  readonly cell: DirectiveCell | null;
  /** H14's coded outcome (fix pass 3): 1 aligned (A or B), 0 against (C or D); null where alignment is not coded. */
  readonly h14Aligned: 0 | 1 | null;
  /** SENSITIVITY coding: the same plan with the boundary-accepted sectors (a front straddling a sector boundary) counted as sound. */
  readonly soundWithBoundary: boolean | null;
  readonly soundViaWithBoundary: "main_effort" | "secondary" | null;
  readonly cellWithBoundary: DirectiveCell | null;
  /**
   * Whether accepting the boundary sectors changes this plan's coding (its soundness, hence its cell), for every outcome: true for a plan
   * unsound in the primary coding but sound across a boundary (the reverse cannot happen), false where the coding does not change; null
   * where the key scores no sound posture.
   */
  readonly viaBoundarySector: boolean | null;
  /** The plan carried the departure note (fix pass 6, D5: from V8 a checkbox "I am departing from the command directive"); false where absent. */
  readonly departureNoted: boolean;
}

export interface DirectiveAdherence {
  readonly view: number;
  /** The `cycle_start` of the attempt these entries come from: the last one, when the view was replayed after a `session_resumed` (fix pass 6, M2). */
  readonly attemptStartSeq: number;
  /** The departure note on the plan in force at view end (the coded one); null with no plan. */
  readonly departureNoted: boolean | null;
  /** Null: no plan with a posture was submitted in the view (the missing row). */
  readonly first: DirectivePostureCoding | null;
  /** The plan in force when the view ended (the coded one): its last revision, else the first submission. */
  readonly atViewEnd: DirectivePostureCoding | null;
  readonly revised: boolean;
  /**
   * Whether the plan in force at view end was submitted or revised after the merged view's step
   * boundary; null in a view with no `step_boundary_reached` (a single-step view) or with no plan.
   */
  readonly afterBoundary: boolean | null;
  /**
   * Whether the plan in force at view end was submitted or revised after the view's freeze was shown
   * (`freeze_started`); null in a view with no freeze or with no plan.
   */
  readonly afterFreeze: boolean | null;
  /** The first plan (a submission or a revision) after the view's freeze was shown; null with no freeze or no such plan (final fix pass, 8 Oct 2026). */
  readonly firstAfterFreeze: DirectivePostureCoding | null;
  /** The first plan after a merged view's step boundary; null in a single-step view or with no such plan. */
  readonly firstAfterBoundary: DirectivePostureCoding | null;
}

/** A plan's soundness against a key, the sectors the key lists as sound counted with or without its boundary-accepted ones. */
function soundness(
  posture: string, mainEffort: string, key: DirectiveKeyLike, secondary: { readonly sectorId: string; readonly taskId: string } | null, acceptBoundary: boolean,
): { sound: boolean | null; soundVia: "main_effort" | "secondary" | null } {
  if (key.sound === null) return { sound: null, soundVia: null };
  const boundary = acceptBoundary ? [] : key.boundarySectors ?? [];
  const core = (sectors: readonly string[]) => sectors.filter((x) => !boundary.includes(x));
  const againstBySecondary = key.againstSecondaryTaskId !== undefined && secondary !== null && secondary.taskId === key.againstSecondaryTaskId;
  const sectors = key.soundSectors?.[posture];
  const alt = key.soundSecondary;
  const secondaryListed = alt !== undefined && secondary !== null && secondary.taskId === alt.taskId && core(alt.sectors).includes(secondary.sectorId);
  // Fix pass 3: a secondary direct attack the key does not list makes the plan unsound (V11–V13: D), even with a sound main effort;
  // fix pass 4: only when the main posture is within the directive (a main-effort direct attack at V9 with a second attack stays C).
  // "Listed" is the key's whole listing, boundary sectors included: an attack on a boundary-only sector is listed, so the primary coding
  // calls the plan unsound for its sector, not for being a second attack of an unlisted kind.
  const secondaryAnyListed = alt !== undefined && secondary !== null && secondary.taskId === alt.taskId && alt.sectors.includes(secondary.sectorId);
  const mainAligned = key.aligned !== null && key.aligned.includes(posture);
  const byMain = key.sound.includes(posture) && (sectors === undefined || core(sectors).includes(mainEffort)) && !(mainAligned && againstBySecondary && !secondaryAnyListed);
  const bySecondary = secondaryListed && alt.mainEffortSectors.includes(mainEffort) && alt.mainEffortPostures.includes(posture);
  return { sound: byMain || bySecondary, soundVia: byMain ? "main_effort" : bySecondary ? "secondary" : null };
}

const cellOf = (aligned: boolean | null, sound: boolean | null): DirectiveCell | null =>
  sound === null || aligned === null ? null : aligned ? (sound ? "A" : "B") : sound ? "C" : "D";

/**
 * One plan against one key; `mainEffort` is the plan's main-effort sector (`soundSectors`), `secondary` its secondary sector (`soundSecondary`).
 * Final fix pass (8 Oct 2026, researcher-approved): the primary cell is coded on the core sectors only; the coding that also accepts the sectors
 * a front touches across a boundary is kept beside it (`soundWithBoundary`, `cellWithBoundary`, `viaBoundarySector`) as the sensitivity.
 */
export function codePosture(
  seq: number, posture: string, mainEffort: string, key: DirectiveKeyLike, secondary: { readonly sectorId: string; readonly taskId: string } | null = null,
  departureNoted = false,
): DirectivePostureCoding {
  const againstBySecondary = key.againstSecondaryTaskId !== undefined && secondary !== null && secondary.taskId === key.againstSecondaryTaskId;
  const mainAligned = key.aligned === null ? null : key.aligned.includes(posture);
  const aligned = key.aligned === null ? null : key.aligned.includes(posture) && !againstBySecondary;
  const primary = soundness(posture, mainEffort, key, secondary, false);
  const wide = soundness(posture, mainEffort, key, secondary, true);
  const h14Aligned = aligned === null ? null : aligned ? 1 : 0;
  return {
    seq, posture, mainEffort, aligned, mainAligned, sound: primary.sound, soundVia: primary.soundVia, cell: cellOf(aligned, primary.sound), h14Aligned,
    soundWithBoundary: wide.sound, soundViaWithBoundary: wide.soundVia, cellWithBoundary: cellOf(aligned, wide.sound),
    viaBoundarySector: primary.sound === null ? null : primary.sound !== wide.sound,
    departureNoted,
  };
}

/**
 * One entry per keyed view the log entered (`cycle_start`), in view order. A view with no submitted
 * plan (e.g. ended by the 150 s cap before a confirmation; its `view_ended` says how) has null
 * codings. Plans without a posture (logs before 0.9.4) are not coded. Records are taken in log
 * order, which is `seq` order (I5). Resume-aware (fix pass 6, M2): a view replayed after a `session_resumed`
 * (`cycleReplayed`, as `replayedViews` in `freeze-measures.ts`: the session re-entered at the view's start) is
 * entered again by a second `cycle_start`; that resets the view's entry, so the coding is the last attempt's (the
 * one that ends in a `cycle_end`) and `attemptStartSeq` is its `cycle_start`. A repeated `cycle_start` with no
 * resume before it does not reset.
 */
export function directiveAdherence(records: readonly LogRecord[], keys: Readonly<Record<number, DirectiveKeyLike | null>>): DirectiveAdherence[] {
  interface Entry {
    first: DirectivePostureCoding | null; last: DirectivePostureCoding | null; revised: boolean; boundarySeq: number | null; freezeSeq: number | null;
    plans: DirectivePostureCoding[];
  }
  const byView = new Map<number, Entry & { startSeq: number }>();
  const resumedViews = new Set<number>(); // views a `session_resumed` has re-entered since their last `cycle_start`
  let view = -1;
  for (const r of records) {
    if (r.kind === "session_resumed") {
      const d = r.detail as SessionResumedDetail;
      if (d.resumedAt === undefined || d.resumedAt === "view") resumedViews.add(d.cycleReplayed as number);
      continue;
    }
    if (r.kind === "cycle_start") {
      view = (r.detail as CycleStartDetail).cycle;
      const replay = resumedViews.delete(view);
      if (keys[view] && (replay || !byView.has(view))) byView.set(view, { first: null, last: null, revised: false, boundarySeq: null, freezeSeq: null, plans: [], startSeq: r.seq });
      continue;
    }
    const entry = byView.get(view);
    if (!entry) continue;
    if (r.kind === "step_boundary_reached") { entry.boundarySeq = r.seq; continue; }
    if (r.kind === "freeze_started") { if (entry.freezeSeq === null) entry.freezeSeq = r.seq; continue; }
    if (r.kind !== "allocation_submitted" && r.kind !== "allocation_revised") continue;
    const plan = (r.detail as AllocationSubmittedDetail | AllocationRevisedDetail).plan;
    const posture = plan.posture as string | undefined;
    if (posture === undefined) continue;
    const coding = codePosture(r.seq, posture, plan.mainEffort, keys[view]!, plan.secondary ?? null, plan.departureNoted === true);
    if (r.kind === "allocation_submitted" && entry.first === null) { entry.first = coding; entry.last = coding; entry.plans.push(coding); }
    else if (r.kind === "allocation_revised" && entry.first !== null) { entry.last = coding; entry.revised = true; entry.plans.push(coding); }
  }
  return [...byView.entries()].sort(([a], [b]) => a - b).map(([v, e]) => ({
    view: v, attemptStartSeq: e.startSeq, departureNoted: e.last === null ? null : e.last.departureNoted, first: e.first, atViewEnd: e.last, revised: e.revised,
    afterBoundary: e.boundarySeq === null || e.last === null ? null : e.last.seq > e.boundarySeq,
    afterFreeze: e.freezeSeq === null || e.last === null ? null : e.last.seq > e.freezeSeq,
    firstAfterFreeze: e.freezeSeq === null ? null : e.plans.find((p) => p.seq > e.freezeSeq!) ?? null,
    firstAfterBoundary: e.boundarySeq === null ? null : e.plans.find((p) => p.seq > e.boundarySeq!) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// The final plan per view (fix pass 6, H5): the plan in force when each main view ended (its last
// submission or revision), as the plan itself: the material for H5's divergence of plans (main effort,
// secondary sector, drone tasking) between participants, per view. Resume-aware as `directiveAdherence`:
// a view replayed after a `session_resumed` counts its last attempt. A view with no plan is omitted.
// ---------------------------------------------------------------------------

export interface FinalPlanOfView {
  readonly view: number;
  readonly seq: number;
  readonly mainEffort: string;
  readonly posture: string | null;
  readonly secondary: { readonly sectorId: string; readonly taskId: string } | null;
  readonly drones: { readonly sectorId: string; readonly taskId: string } | null;
  /** The plan was revised after its first submission. */
  readonly revised: boolean;
}

export function finalPlanPerView(records: readonly LogRecord[]): FinalPlanOfView[] {
  const byView = new Map<number, FinalPlanOfView>();
  const resumedViews = new Set<number>();
  let view = -1;
  for (const r of records) {
    if (r.kind === "session_resumed") {
      const d = r.detail as SessionResumedDetail;
      if (d.resumedAt === undefined || d.resumedAt === "view") resumedViews.add(d.cycleReplayed as number);
      continue;
    }
    if (r.kind === "cycle_start") {
      view = (r.detail as CycleStartDetail).cycle;
      if (resumedViews.delete(view)) byView.delete(view);
      continue;
    }
    if ((r.kind !== "allocation_submitted" && r.kind !== "allocation_revised") || view < 1) continue;
    const plan = (r.detail as AllocationSubmittedDetail | AllocationRevisedDetail).plan;
    byView.set(view, {
      view, seq: r.seq, mainEffort: plan.mainEffort, posture: (plan.posture as string | undefined) ?? null,
      secondary: plan.secondary ? { sectorId: plan.secondary.sectorId, taskId: plan.secondary.taskId } : null,
      drones: plan.drones ? { sectorId: plan.drones.sectorId, taskId: plan.drones.taskId } : null,
      revised: r.kind === "allocation_revised" || (byView.get(view)?.revised ?? false),
    });
  }
  return [...byView.values()].sort((a, b) => a.view - b.view);
}

// ---------------------------------------------------------------------------
// Accountable deviation (fix pass 6, D5): of the plans coded C (an aligned posture is not required; the
// plan is against the directive yet sound for the situation), how many carried the departure note. It
// tells a deliberate, reported departure from one that went unreported; it codes nothing about the
// reason's text. Views V8 on only (the note is not offered before); a plan with no cell is left out.
// ---------------------------------------------------------------------------

export interface AccountableDeviation {
  /** The C views in order, with whether the plan in force at view end carried the note. */
  readonly cViews: readonly { readonly view: number; readonly departureNoted: boolean }[];
  readonly cWithNote: number;
  readonly cWithoutNote: number;
  /** cWithNote / (cWithNote + cWithoutNote); null with no C view. */
  readonly noteShareOfC: number | null;
}

export function accountableDeviation(records: readonly LogRecord[], keys: Readonly<Record<number, DirectiveKeyLike | null>>): AccountableDeviation {
  const cViews = directiveAdherence(records, keys)
    .filter((a) => a.atViewEnd !== null && a.atViewEnd.cell === "C")
    .map((a) => ({ view: a.view, departureNoted: a.atViewEnd!.departureNoted }));
  const cWithNote = cViews.filter((v) => v.departureNoted).length;
  return { cViews, cWithNote, cWithoutNote: cViews.length - cWithNote, noteShareOfC: cViews.length === 0 ? null : cWithNote / cViews.length };
}

// ---------------------------------------------------------------------------
// Baseline compliance (fix pass 6, D6): the participant's tendency to follow the phase-A intent ("direct
// attack where intensity allows") BEFORE ANY ORDER-BEARING CONTACT (revision (an), 10 Oct 2026; it said "any
// treatment contact" until the Thinker cells met the Thinker in VP, revision (am)), from the practice view and
// V1 only. Order-bearing contact is a Thinker answer that may relate the plan's options to an order: the
// directive's assessment from V8 (STRATEGY_FROM_VIEW, where verdict coding starts). VP's Thinker carries no
// order (the reasoning_once prompt, no order block, in both cells); in V1 the reasoning_intent cell's
// instruction carries P2's opening intent, but its rule 5 forbids saying an option is in line with it or
// departs from it, and every participant reads the same intent in the message log. The phase-A share over
// V1-V7 (SPEC/27) is not a covariate (the Open Thinker is on offer through phase A, so later plans may be
// shaped by it); this is. The share of `direct_attack` among the plans in force at the end of those views
// (a view with no plan is missing).
// ---------------------------------------------------------------------------

export const BASELINE_VIEWS = [0, 1] as const;

export interface BaselineCompliance {
  /** The plan in force at the end of each baseline view that had one, in view order. */
  readonly plans: readonly { readonly view: number; readonly posture: string }[];
  readonly directAttackShare: number | null;
}

export function baselineCompliance(records: readonly LogRecord[]): BaselineCompliance {
  const last = new Map<number, string>();
  let view = -1;
  for (const r of records) {
    if (r.kind === "cycle_start") { view = (r.detail as CycleStartDetail).cycle; last.delete(view); continue; }
    if (r.kind !== "allocation_submitted" && r.kind !== "allocation_revised") continue;
    if (!(BASELINE_VIEWS as readonly number[]).includes(view)) continue;
    const posture = (r.detail as AllocationSubmittedDetail | AllocationRevisedDetail).plan.posture as string | undefined;
    if (posture !== undefined) last.set(view, posture);
  }
  const plans = BASELINE_VIEWS.filter((v) => last.has(v)).map((v) => ({ view: v as number, posture: last.get(v)! }));
  return { plans, directAttackShare: plans.length === 0 ? null : plans.filter((p) => p.posture === "direct_attack").length / plans.length };
}

// ---------------------------------------------------------------------------
// Strategy-notice exposure (phase B round 2, D2): per view, how many Thinker answers carried each
// `linjaus` status — the exposure ("received ei_sovi at V10") that Paper 2's analysis conditions on.
// Logs before 8 Oct 2026 only: since the Haku / Open Thinker redesign no answer carries `linjausTila`
// (neither Haku's chat nor the Open Thinker shows a line), so both measures below return [] for newer logs.
// ---------------------------------------------------------------------------

export interface StrategyNoticeExposure {
  readonly view: number;
  readonly sopii: number;
  readonly ei_sovi: number;
  readonly ei_liity: number;
  /** Fallback answers (no model): the line was shown as not assessed. */
  readonly ei_arvioitu: number;
}

/**
 * One entry per view in which at least one `ai_chat_answer_received` carried `linjausTila`, in view
 * order; views with no strategy-guided answer have no entry (the standard variant shows no line).
 * Keyed by the view the question was asked in (`detail.view`).
 */
export function strategyNoticeExposure(records: readonly LogRecord[]): StrategyNoticeExposure[] {
  const byView = new Map<number, { sopii: number; ei_sovi: number; ei_liity: number; ei_arvioitu: number }>();
  for (const r of byKind(records, "ai_chat_answer_received")) {
    const d = r.detail as AiChatAnswerReceivedDetail;
    if (d.linjausTila === undefined) continue;
    const counts = byView.get(d.view) ?? { sopii: 0, ei_sovi: 0, ei_liity: 0, ei_arvioitu: 0 };
    counts[d.linjausTila] += 1;
    byView.set(d.view, counts);
  }
  return [...byView.entries()].sort(([a], [b]) => a - b).map(([view, c]) => ({ view, ...c }));
}

/**
 * Exposure before the plan (SPEC/27 §3.4, its primary exposure indicator; reconciled 5 Oct 2026):
 * per keyed view with a coded plan (`directiveAdherence(...).atViewEnd`), the `sopii` / `ei_sovi`
 * notices whose `seq` precedes that plan's `seq`. Views with no plan in force at view end have no
 * entry (missing, as in the primary model). `ei_liity` and `ei_arvioitu` do not count as exposure.
 */
export interface StrategyExposureBeforePlan {
  readonly view: number;
  /** At least one `sopii` or `ei_sovi` notice before the coded plan. */
  readonly exposedBeforePlan: boolean;
  /** The status of the last such notice; null when none. */
  readonly lastStatusBeforePlan: "sopii" | "ei_sovi" | null;
  /** Both statuses were received before the plan. */
  readonly mixedBeforePlan: boolean;
  readonly noticesBeforePlan: number;
}

export function strategyExposureBeforePlan(
  records: readonly LogRecord[], keys: Readonly<Record<number, DirectiveKeyLike | null>>,
): StrategyExposureBeforePlan[] {
  const notices = byKind(records, "ai_chat_answer_received")
    .map((r) => ({ seq: r.seq, d: r.detail as AiChatAnswerReceivedDetail }))
    .filter((n) => n.d.linjausTila === "sopii" || n.d.linjausTila === "ei_sovi");
  const out: StrategyExposureBeforePlan[] = [];
  for (const a of directiveAdherence(records, keys)) {
    if (a.atViewEnd === null) continue;
    const planSeq = a.atViewEnd.seq;
    const before = notices.filter((n) => n.d.view === a.view && n.seq < planSeq);
    const statuses = new Set(before.map((n) => n.d.linjausTila));
    out.push({
      view: a.view,
      exposedBeforePlan: before.length > 0,
      lastStatusBeforePlan: before.length > 0 ? (before[before.length - 1]!.d.linjausTila as "sopii" | "ei_sovi") : null,
      mixedBeforePlan: statuses.size > 1,
      noticesBeforePlan: before.length,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Open Thinker answers before the plan in force (final fix pass, 8 Oct 2026; Paper 2 (d)): the
// material for the pre-registered BLIND coding of advice-following. Per keyed view with a plan in
// force at view end, the Open Thinker answers (`tool` "open_thinker") received in that view before
// that plan, each with its question, its text and its times. A view where the participant asked
// nothing has an entry with no answers (the analysis joins the cell from the header: only the AI
// cells have an Open Thinker). The coder reads the answers and codes, without seeing the key,
// whether the plan follows the advice; this measure extracts, it codes nothing. A view replayed after
// a resume counts its last attempt only: the answers are those after that attempt's `cycle_start`.
// ---------------------------------------------------------------------------

export interface OpenThinkerAnswerBeforePlan {
  readonly queryId: string;
  /** The question's text (`ai_chat_query_submitted`), null when its record is missing. */
  readonly question: string | null;
  /** The answer's text (`answer.vastaus`: the Open Thinker's plain text). */
  readonly text: string;
  readonly seq: number;
  /** The answer's virtual time in the session (seconds, as logged) and wall time (ms since the session started). */
  readonly virtualTimeS: number;
  readonly tWallOffsetMs: number;
  /** The phase the question was asked in. */
  readonly phase: "exploration" | "decision";
  /** Whether the answer came from the fallback (no model answered). */
  readonly fallback: boolean;
  /** The answer's fit verdict on the directive, extracted from its text (D6, fix pass 6): a covariate; null when it states none or the log has none. */
  readonly aiVerdict: "in_line" | "departs" | "not_covered" | null;
  /** Revision (al): the per-option verdicts (the analysis value; `aiVerdict` is the earliest phrase, kept for older logs); null when the log has none. */
  readonly aiVerdicts: readonly { readonly line: number; readonly verdict: "in_line" | "departs" | "not_covered" }[] | null;
}

export interface OpenThinkerBeforePlan {
  readonly view: number;
  /** The coded plan (the one in force at view end): its seq and wall time. */
  readonly planSeq: number;
  readonly planTWallOffsetMs: number;
  readonly answers: readonly OpenThinkerAnswerBeforePlan[];
}

export function openThinkerAnswersBeforePlan(
  records: readonly LogRecord[], keys: Readonly<Record<number, DirectiveKeyLike | null>>,
): OpenThinkerBeforePlan[] {
  const questions = new Map<string, string>();
  for (const r of byKind(records, "ai_chat_query_submitted")) {
    const d = r.detail as AiChatQuerySubmittedDetail;
    if (!questions.has(d.queryId)) questions.set(d.queryId, d.text);
  }
  const answers = byKind(records, "ai_chat_answer_received").filter((r) => (r.detail as AiChatAnswerReceivedDetail).tool === "open_thinker");
  const bySeq = new Map(records.map((r) => [r.seq as number, r]));
  const out: OpenThinkerBeforePlan[] = [];
  for (const a of directiveAdherence(records, keys)) {
    if (a.atViewEnd === null) continue;
    const planSeq = a.atViewEnd.seq;
    out.push({
      view: a.view,
      planSeq,
      planTWallOffsetMs: bySeq.get(planSeq)!.tWallOffsetMs,
      answers: answers
        .filter((r) => (r.detail as AiChatAnswerReceivedDetail).view === a.view && r.seq > a.attemptStartSeq && r.seq < planSeq)
        .map((r) => {
          const d = r.detail as AiChatAnswerReceivedDetail;
          return {
            queryId: d.queryId, question: questions.get(d.queryId) ?? null, text: d.answer.vastaus, seq: r.seq, virtualTimeS: d.virtualTimeS,
            tWallOffsetMs: r.tWallOffsetMs, phase: d.phase, fallback: d.fallback, aiVerdict: d.aiVerdict ?? null,
            aiVerdicts: d.aiVerdicts ?? null,
          };
        }),
    });
  }
  return out;
}

/**
 * The instructed-response attention check (SPEC/09 §6.2, 8 Oct 2026): true when the post-session
 * questionnaire's `attention.check` was answered with the instructed value, false when answered
 * otherwise or left blank, null when the questionnaire was never submitted (a partial session).
 * The first submission counts.
 */
export function attentionCheckPassed(records: readonly LogRecord[]): boolean | null {
  for (const r of byKind(records, "questionnaire_submitted")) {
    const d = r.detail as QuestionnaireSubmittedDetail;
    if (d.questionnaireId !== "post") continue;
    return d.answers.find((a) => a.itemId === ATTENTION_CHECK_ID)?.value === ATTENTION_CHECK_CORRECT;
  }
  return null;
}
