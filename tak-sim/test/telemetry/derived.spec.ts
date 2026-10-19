/**
 * SPEC/10_Build_Plan_and_Acceptance.md, M4: "`test/telemetry/derived.spec`
 * computes every measure in `07` §4 from a golden log — a measure that
 * cannot be computed from a real pilot log is a missing record and fails
 * the build."
 *
 * Builds a small, hand-composed "golden log" exercising the specific
 * record sequences each SPEC/07 §4 row names, then computes every
 * derived measure from it and checks the result against a hand-computed
 * expectation — proving both that the records needed exist (coverage.spec
 * already proves each kind CAN be emitted) and that the formula over them
 * is actually correct.
 */

import { describe, expect, it } from "vitest";
// Static, not dynamic, so loading the scenario is not timed against a test (a 5 s timeout under load, 4 Oct 2026).
import { DIRECTIVE_KEYS, NEW_FRONT } from "../../app/scenario/demo-directive.js";
import { directiveAdherence, REKINDLE_CREW_ANTICIPATION, sectorAnticipation, type DirectiveKeyLike } from "../../app/telemetry/derived-measures.js";
import { keyedFrontSectors, secondaryAttacks, soundRoutes } from "../../app/telemetry/directive-act-coding.js";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import { STRATEGY_FROM_VIEW } from "../../app/session/thinker-protocol.js";
import {
  abandonmentRate,
  accountableDeviation,
  baselineCompliance,
  BASELINE_VIEWS,
  finalPlanPerView,
  channelAttention,
  confidenceReversalCount,
  drawerOpenFraction,
  dwellPerElement,
  fatigueTrajectory,
  openThinkerAnswersBeforePlan,
  reformulationChainLength,
  reportReadThrough,
  sourceSelectionTracking,
  tier4Discovery,
  timeToFirstInformationSeekingActMs,
} from "../../app/telemetry/derived-measures.js";

const HEADER: LogHeader = {
  formatVersion: "0.1.0", sessionId: "derived-test", participantCode: "p", condition: "directed", scenarioId: "s",
  scenarioVersion: "0.1.0", seed: "1", bundleHash: "b", appVersion: "0.1.0", startedAtIso: "2026-01-01T00:00:00.000Z",
  userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 }, counterbalance: { expectationOrder: "A" }, cell: "radio", echelon: "command",
};

async function buildLog(events: readonly (readonly [number, TelemetryEvent])[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (const [tWallOffsetMs, event] of events) {
    await appendTelemetryEvent(log, asVirtualTime(0), tWallOffsetMs, event);
  }
  return log.readAll();
}

describe("timeToFirstInformationSeekingActMs — first nav_query_submitted|query_submitted|ai_chat_query_submitted|tab_selected - cycle_start", () => {
  it("picks the earliest of the kinds, not just the first record; closing the panel (tab none) is no act", async () => {
    const records = await buildLog([
      [0, { kind: "cycle_start", detail: { cycle: 1, phase: "A", clockLabel: "13:20" } }],
      [9000, { kind: "query_submitted", detail: { text: "x", charCount: 1, compositionDurationMs: 100, queryId: "q1", reformulationChainIndex: 0 } }],
      [5000, { kind: "tab_selected", detail: { tool: "haku", view: 1, phase: "exploration" } }],
      [2000, { kind: "tab_selected", detail: { tool: "none", view: 1, phase: "exploration" } }],
    ]);
    expect(timeToFirstInformationSeekingActMs(records)).toBe(5000);
    const chat = await buildLog([
      [0, { kind: "cycle_start", detail: { cycle: 1, phase: "A", clockLabel: "13:20" } }],
      [7000, { kind: "ai_chat_query_submitted", detail: { queryId: "q", text: "x", view: 1, virtualTimeS: 3, phase: "exploration", tool: "open_thinker" } }],
    ]);
    expect(timeToFirstInformationSeekingActMs(chat)).toBe(7000);
  });

  it("returns null when no information-seeking act occurred", async () => {
    const records = await buildLog([[0, { kind: "cycle_start", detail: { cycle: 1, phase: "A", clockLabel: "13:20" } }]]);
    expect(timeToFirstInformationSeekingActMs(records)).toBeNull();
  });
});

describe("dwellPerElement — paired element_enter/element_leave", () => {
  it("pairs enter/leave for the same target and computes the gap", async () => {
    const records = await buildLog([
      [1000, { kind: "element_enter", detail: { targetKind: "rail_item", targetId: "atom.1" } }],
      [4200, { kind: "element_leave", detail: { targetKind: "rail_item", targetId: "atom.1" } }],
    ]);
    expect(dwellPerElement(records)).toEqual([{ targetKind: "rail_item", targetId: "atom.1", dwellMs: 3200 }]);
  });

  it("omits an unmatched enter (no closing leave)", async () => {
    const records = await buildLog([[1000, { kind: "element_enter", detail: { targetKind: "rail_item", targetId: "atom.1" } }]]);
    expect(dwellPerElement(records)).toEqual([]);
  });

  it("distinguishes different targets sharing the same targetKind", async () => {
    const records = await buildLog([
      [0, { kind: "element_enter", detail: { targetKind: "unit", targetId: "EK11" } }],
      [0, { kind: "element_enter", detail: { targetKind: "unit", targetId: "EK12" } }],
      [1000, { kind: "element_leave", detail: { targetKind: "unit", targetId: "EK11" } }],
      [2000, { kind: "element_leave", detail: { targetKind: "unit", targetId: "EK12" } }],
    ]);
    const dwells = dwellPerElement(records);
    expect(dwells.find((d) => d.targetId === "EK11")?.dwellMs).toBe(1000);
    expect(dwells.find((d) => d.targetId === "EK12")?.dwellMs).toBe(2000);
  });
});

describe("reportReadThrough — max text_scrolled.maxFraction per element", () => {
  it("keeps the maximum fraction across repeated scroll events for the same element", async () => {
    const records = await buildLog([
      [0, { kind: "text_scrolled", detail: { elementId: "report.1", maxScrollFraction: 0.4 } }],
      [1000, { kind: "text_scrolled", detail: { elementId: "report.1", maxScrollFraction: 0.9 } }],
      [2000, { kind: "text_scrolled", detail: { elementId: "report.1", maxScrollFraction: 0.6 } }],
    ]);
    expect(reportReadThrough(records).get("report.1")).toBe(0.9);
  });
});

describe("reformulationChainLength — highest chain index + 1", () => {
  it("counts the number of reformulations in a query chain", async () => {
    const records = await buildLog([
      [0, { kind: "query_submitted", detail: { text: "a", charCount: 1, compositionDurationMs: 1, queryId: "q1", reformulationChainIndex: 0 } }],
      [1000, { kind: "query_submitted", detail: { text: "b", charCount: 1, compositionDurationMs: 1, queryId: "q2", reformulationChainIndex: 1 } }],
      [2000, { kind: "query_submitted", detail: { text: "c", charCount: 1, compositionDurationMs: 1, queryId: "q3", reformulationChainIndex: 2 } }],
    ]);
    expect(reformulationChainLength(records)).toBe(3);
  });
});

describe("abandonmentRate — query_cleared / (query_cleared + query_submitted)", () => {
  it("computes the exact rate", async () => {
    const records = await buildLog([
      [0, { kind: "query_submitted", detail: { text: "a", charCount: 1, compositionDurationMs: 1, queryId: "q1", reformulationChainIndex: 0 } }],
      [1000, { kind: "query_cleared", detail: { text: "b" } }],
      [2000, { kind: "query_cleared", detail: { text: "c" } }],
    ]);
    expect(abandonmentRate(records)).toBeCloseTo(2 / 3);
  });

  it("is zero with no query activity at all", async () => {
    expect(abandonmentRate([])).toBe(0);
  });
});

describe("confidenceReversalCount — direction changes within a slider run", () => {
  it("counts up-down-up as two reversals", async () => {
    const records = await buildLog([
      [0, { kind: "confidence_slider_moved", detail: { probeId: "p1", value: 10, settle: false } }],
      [100, { kind: "confidence_slider_moved", detail: { probeId: "p1", value: 40, settle: false } }], // up
      [200, { kind: "confidence_slider_moved", detail: { probeId: "p1", value: 20, settle: false } }], // down: reversal 1
      [300, { kind: "confidence_slider_moved", detail: { probeId: "p1", value: 60, settle: true } }], // up: reversal 2
    ]);
    expect(confidenceReversalCount(records, "p1")).toBe(2);
  });

  it("a monotonic slide has zero reversals", async () => {
    const records = await buildLog([
      [0, { kind: "confidence_slider_moved", detail: { probeId: "p1", value: 10, settle: false } }],
      [100, { kind: "confidence_slider_moved", detail: { probeId: "p1", value: 40, settle: false } }],
      [200, { kind: "confidence_slider_moved", detail: { probeId: "p1", value: 70, settle: true } }],
    ]);
    expect(confidenceReversalCount(records, "p1")).toBe(0);
  });
});

describe("drawerOpenFraction — drawer-open time / working period", () => {
  it("computes the exact fraction", async () => {
    const records = await buildLog([
      [0, { kind: "cycle_start", detail: { cycle: 1, phase: "A", clockLabel: "13:20" } }],
      [1000, { kind: "drawer_opened", detail: { drawer: "haku", cycle: 1, latencyFromCycleStartMs: 1000, openingRoute: "button" } }],
      [3000, { kind: "drawer_closed", detail: { drawer: "haku", dwellMs: 2000, closingRoute: "escape" } }],
      [10000, { kind: "cycle_end", detail: { cycle: 1, totalRealDurationMs: 10000 } }],
    ]);
    expect(drawerOpenFraction(records)).toBeCloseTo(0.2); // 2000ms open / 10000ms working period
  });
});

describe("channelAttention — element_enter on channel_signal targets, and whether any was opened", () => {
  it("reports anySignalOpened=false when nothing was ever entered", () => {
    expect(channelAttention([]).anySignalOpened).toBe(false);
  });

  it("reports anySignalOpened=true and the dwell when a channel signal was entered/left", async () => {
    const records = await buildLog([
      [0, { kind: "element_enter", detail: { targetKind: "channel_signal", targetId: "sig.1" } }],
      [2500, { kind: "element_leave", detail: { targetKind: "channel_signal", targetId: "sig.1" } }],
    ]);
    const attention = channelAttention(records);
    expect(attention.anySignalOpened).toBe(true);
    expect(attention.dwells).toEqual([{ targetKind: "channel_signal", targetId: "sig.1", dwellMs: 2500 }]);
  });
});

describe("sourceSelectionTracking — the KUKA source of each builder query against authored SourceClass.reliability (SPEC/07 revision (j))", () => {
  const nav = (queryId: string, sourceId: string | null): TelemetryEvent => ({
    kind: "nav_query_submitted",
    detail: { queryId, category: "palo", sourceId, window: "latest", resultAtomIds: [], phase: "exploration" },
  });

  it("looks up each chosen source's authored reliability, skipping queries with no source chosen", async () => {
    const records = await buildLog([[0, nav("nav.1", "EK11")], [500, nav("nav.2", null)], [1000, nav("nav.3", "VPK")]]);
    const reliability = new Map<string, "known-good" | "unproven" | "degraded">([["EK11", "known-good"], ["VPK", "unproven"]]);
    expect(sourceSelectionTracking(records, reliability)).toEqual([
      { sourceId: "EK11", reliability: "known-good" },
      { sourceId: "VPK", reliability: "unproven" },
    ]);
  });

  it("marks a source with no authored source class as unknown_source rather than throwing", async () => {
    const records = await buildLog([[0, nav("nav.1", "MYSTERY")]]);
    expect(sourceSelectionTracking(records, new Map())[0]!.reliability).toBe("unknown_source");
  });
});

describe("tier4Discovery — bubble_available | ai_chat_answer_received.retrieved (and the older traffic_returned | result_item_expanded) against authored ids (SPEC/07 §2.7)", () => {
  it("reads the routes the app emits: a pushed bubble, an atom retrieved for a chat answer (8 Oct 2026)", async () => {
    const answer = {
      queryId: "q", text: "x", view: 3, virtualTimeS: 0, retrieved: [{ id: "t4.water_state", fusedScore: 0.4 }], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
      answer: { vastaus: "", perusteet: "", varmuus: "", muuttaisi: "" }, latencyMs: 1, fallback: false, fallbackReason: null, phase: "exploration", promptVariant: "standard",
    } as const;
    const records = await buildLog([
      [0, { kind: "bubble_available", detail: { atomId: "t4.ember_warning", mapPosition: null, tier: "T1_pushed", sourceId: "u" } }],
      [1000, { kind: "ai_chat_answer_received", detail: answer }],
    ]);
    const discovery = tier4Discovery(records, ["t4.ember_warning", "t4.private_doubt", "t4.water_state"]);
    expect(discovery.map((d) => [d.atomId, d.reached, d.route])).toEqual([
      ["t4.ember_warning", true, "bubble_available"], ["t4.private_doubt", false, null], ["t4.water_state", true, "ai_chat_answer_received"],
    ]);
  });

  it("finds the earliest route by which each load-bearing item was reached (older logs: traffic_returned, result_item_expanded)", async () => {
    const records = await buildLog([
      [0, { kind: "traffic_returned", detail: { requestId: "r1", selector: {}, entryIds: ["t4.ember_warning"] } }],
      [1000, { kind: "result_item_expanded", detail: { atomId: "t4.water_state" } }],
    ]);
    const discovery = tier4Discovery(records, ["t4.ember_warning", "t4.private_doubt", "t4.water_state"]);
    expect(discovery.find((d) => d.atomId === "t4.ember_warning")).toMatchObject({ reached: true, route: "traffic_returned" });
    expect(discovery.find((d) => d.atomId === "t4.water_state")).toMatchObject({ reached: true, route: "result_item_expanded" });
    expect(discovery.find((d) => d.atomId === "t4.private_doubt")).toMatchObject({ reached: false, route: null });
  });
});

describe("fatigueTrajectory — per-cycle information-seeking counts against cycle index (fix pass 2: the judgement latency is gone)", () => {
  it("orders points by cycle and computes per-cycle values independently", async () => {
    const cycle1 = await buildLog([
      [500, { kind: "ai_chat_query_submitted", detail: { queryId: "q", text: "x", view: 1, virtualTimeS: 0, phase: "exploration", tool: "haku" } }],
    ]);
    const cycle2 = await buildLog([
      [0, { kind: "envelope_revealed", detail: { cycle: 2, envelopeId: "e2" } }],
    ]);
    const byCycle = new Map<number, readonly LogRecord[]>([[2, cycle2], [1, cycle1]]); // deliberately out of order
    expect(fatigueTrajectory(byCycle)).toEqual([{ cycle: 1, informationSeekingActCount: 1 }, { cycle: 2, informationSeekingActCount: 0 }]);
  });
});

describe("sectorAnticipation (SPEC/16 revision (s))", () => {
  it("finds crews on L3 in V7–V8 as main effort or secondary, in a first plan or a revision, and nothing outside the window", async () => {
    const plan = (mainEffort: string, secondary: string | null) => ({ mainEffort, posture: "direct_attack" as const, secondary: secondary ? { sectorId: secondary, taskId: "task.mopup" as const } : null, drones: null });
    const view = (cycle: number): [number, TelemetryEvent] => [cycle * 10, { kind: "cycle_start", detail: { cycle: cycle as never, phase: "A", clockLabel: "x" } }];
    const early = await buildLog([view(6), [61, { kind: "allocation_submitted", detail: { plan: plan("L3", null), rationaleAsked: false, rationaleFi: null } }], view(7), [71, { kind: "allocation_submitted", detail: { plan: plan("L2", null), rationaleAsked: false, rationaleFi: null } }]]);
    expect(sectorAnticipation(early, REKINDLE_CREW_ANTICIPATION)).toEqual({ anticipated: false, first: null });
    const revised = await buildLog([view(8), [81, { kind: "allocation_submitted", detail: { plan: plan("L2", null), rationaleAsked: false, rationaleFi: null } }], [82, { kind: "allocation_revised", detail: { cycle: 8 as never, revision: 1, plan: plan("L2", "L3") } }]]);
    expect(sectorAnticipation(revised, REKINDLE_CREW_ANTICIPATION)).toMatchObject({ anticipated: true, first: { view: 8, as: "secondary", revision: true } });
  });
});

describe("directiveAdherence (the phase-B directive, 4 Oct 2026; review round 2)", () => {
  type Posture = "direct_attack" | "barrier_line" | "protect_values";
  const plan = (posture: Posture, mainEffort = "L3") => ({ mainEffort, posture, secondary: null, drones: null });
  const view = (cycle: number): [number, TelemetryEvent] => [cycle * 10, { kind: "cycle_start", detail: { cycle: cycle as never, phase: cycle <= 7 ? "A" : "B", clockLabel: "x" } }];
  const submit = (cycle: number, posture: Posture, mainEffort?: string): [number, TelemetryEvent] => [cycle * 10 + 1, { kind: "allocation_submitted", detail: { plan: plan(posture, mainEffort), rationaleAsked: false, rationaleFi: null } }];
  const revise = (cycle: number, revision: number, posture: Posture): [number, TelemetryEvent] => [cycle * 10 + 1 + revision, { kind: "allocation_revised", detail: { cycle: cycle as never, revision, plan: plan(posture) } }];
  const boundary = (cycle: number, at = 1.5): [number, TelemetryEvent] => [cycle * 10 + at, { kind: "step_boundary_reached", detail: { cycle: cycle as never, atViewSeconds: 65 } }];

  it("codes each cell: A aligned+sound, B aligned+unsound (blind compliance), C against+sound (justified deviation), D against+unsound", async () => {
    const records = await buildLog([
      view(9), submit(9, "direct_attack"), // C: against the directive, the situation calls for it (main effort on the new front, L3)
      view(10), submit(10, "barrier_line"), // B: compliant, unsound
      view(11), submit(11, "barrier_line"), // A
      view(12), submit(12, "direct_attack"), // D
    ]);
    const coded = directiveAdherence(records, DIRECTIVE_KEYS);
    expect(coded.map((c) => [c.view, c.atViewEnd!.posture, c.atViewEnd!.aligned, c.atViewEnd!.sound, c.atViewEnd!.cell])).toEqual([
      [9, "direct_attack", false, true, "C"],
      [10, "barrier_line", true, false, "B"],
      [11, "barrier_line", true, true, "A"],
      [12, "direct_attack", false, false, "D"],
    ]);
  });

  it("is sector-aware at V9–V10: a direct attack is sound only with the main effort on the new front's sectors (L3, and L2 across the boundary it touches; fix pass 2)", async () => {
    expect(NEW_FRONT.sector).toBe("L3");
    expect(NEW_FRONT.sectors).toEqual(["L3"]); // review fixes (ah), 9 Oct 2026: the new front no longer touches L2
    const records = await buildLog([view(9), submit(9, "direct_attack", "L1"), view(10), submit(10, "direct_attack", "L3")]);
    expect(directiveAdherence(records, DIRECTIVE_KEYS).map((c) => [c.view, c.atViewEnd!.mainEffort, c.atViewEnd!.sound, c.atViewEnd!.cell])).toEqual([
      [9, "L1", false, "D"], // attacking the north edge instead: against and unsound
      [10, "L3", true, "C"],
    ]);
    const l2 = await buildLog([view(10), submit(10, "direct_attack", "L2")]);
    // Final fix pass (8 Oct 2026): the primary cell is coded on the core sector (L3) only; L2, across the boundary, is the sensitivity.
    // `31` coa F13 (19 Oct 2026): L2 is accepted across the boundary again, in the boundary sensitivity only (the sectors are not drawn
    // and the front runs east towards L2); the primary stays the computed sector (L3).
    expect(directiveAdherence(l2, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ sound: false, cell: "D", soundWithBoundary: true, cellWithBoundary: "C" });
  });

  it("V11–V13 (fix pass 2): a barrier line or protection is sound only in the observed head's sectors (L3, and L2 where the head is within 50 m of the line)", async () => {
    const records = await buildLog([view(11), submit(11, "barrier_line", "L1"), view(12), submit(12, "protect_values", "L4"), view(13), submit(13, "barrier_line", "L3")]);
    expect(directiveAdherence(records, DIRECTIVE_KEYS).map((c) => [c.view, c.atViewEnd!.sound, c.atViewEnd!.cell])).toEqual([[11, false, "B"], [12, false, "B"], [13, true, "A"]]);
  });

  it("H14 is coded on alignment (A∪B = 1, C∪D = 0; null where not coded); the primary cell reads the core sectors, the boundary-accepted coding is the sensitivity for every outcome (8 Oct 2026)", async () => {
    const records = await buildLog([
      view(3), submit(3, "direct_attack"), // phase A: not coded
      view(9), submit(9, "direct_attack", "L2"), // D primary (L2 is across the boundary), C with it
      view(10), submit(10, "direct_attack", "L3"), // C via the front's own sector
      view(11), submit(11, "barrier_line", "L2"), // B primary: the head is within 50 m of the L2/L3 line (8 Oct 2026 fire retune), L3 alone is core; A with the boundary
      view(12), submit(12, "protect_values", "L3"), // A in the head's sector
      // D primary; C with L1, the flare-up's L1 side, attacked as the secondary (SPEC/31 §3.2: V14 is sound only through that route)
      view(14), [141, { kind: "allocation_submitted", detail: { plan: { mainEffort: "L3", posture: "barrier_line", secondary: { sectorId: "L1", taskId: "task.direct-attack" }, drones: null }, rationaleAsked: false, rationaleFi: null } }],
    ]);
    const coded = directiveAdherence(records, DIRECTIVE_KEYS);
    expect(coded.map((c) => [c.view, c.atViewEnd!.cell, c.atViewEnd!.cellWithBoundary, c.atViewEnd!.h14Aligned, c.atViewEnd!.viaBoundarySector])).toEqual([
      // Review fixes (ah): the head stays in L3 alone at V11–V12; `31` coa F13: V9–V10 accept L2 in the boundary sensitivity only.
      [3, null, null, null, null], [9, "D", "C", 0, true], [10, "C", "C", 0, false], [11, "B", "B", 1, false], [12, "A", "A", 1, false], [14, "D", "C", 0, true],
    ]);
    // mainAligned: the main posture alone (null in phase A).
    expect(coded.map((c) => c.atViewEnd!.mainAligned)).toEqual([null, false, false, true, true, true]);
    const unsound = await buildLog([view(14), submit(14, "protect_values", "L3")]);
    expect(directiveAdherence(unsound, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ cell: "B", cellWithBoundary: "B", h14Aligned: 1, viaBoundarySector: false });
    const v8 = await buildLog([view(8), submit(8, "barrier_line")]);
    expect(directiveAdherence(v8, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ sound: null, cell: null, cellWithBoundary: null, viaBoundarySector: null });
  });

  it("mainAligned reads the main posture alone: a secondary direct attack makes the plan against the directive but not the main posture", async () => {
    const records = await buildLog([view(11), [111, { kind: "allocation_submitted", detail: { plan: { mainEffort: "L3", posture: "barrier_line", secondary: { sectorId: "L4", taskId: "task.direct-attack" }, drones: null } as never, rationaleAsked: false, rationaleFi: null } }]]);
    expect(directiveAdherence(records, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ aligned: false, mainAligned: true });
  });

  it("firstAfterFreeze and firstAfterBoundary: the first plan after each, beside the plan at view end", async () => {
    const freeze = (cycle: number, at: number): [number, TelemetryEvent] => [cycle * 10 + at, { kind: "freeze_started", detail: { cycle: cycle as never, atViewSeconds: 55, decisionCommittedBeforeFreeze: false, decisionStep: "x" } }];
    const records = await buildLog([
      view(11), submit(11, "direct_attack"), boundary(11, 1.5), revise(11, 1, "barrier_line"), freeze(11, 1.7), revise(11, 2, "protect_values"), revise(11, 3, "barrier_line"),
      view(12), submit(12, "barrier_line"), // no boundary, no freeze in the log
    ]);
    const [v11, v12] = directiveAdherence(records, DIRECTIVE_KEYS);
    expect(v11!.firstAfterBoundary).toMatchObject({ posture: "barrier_line" }); // the first revision, after the boundary
    expect(v11!.firstAfterFreeze).toMatchObject({ posture: "protect_values" }); // the second revision, after the freeze
    expect(v11!.atViewEnd).toMatchObject({ posture: "barrier_line" });
    expect(v12).toMatchObject({ firstAfterBoundary: null, firstAfterFreeze: null });
    const late = await buildLog([view(9), freeze(9, 5), submit(9, "barrier_line")]);
    const early = await buildLog([view(9), submit(9, "barrier_line"), freeze(9, 5)]);
    expect(directiveAdherence(late, DIRECTIVE_KEYS)[0]!.firstAfterFreeze).toMatchObject({ posture: "barrier_line" });
    expect(directiveAdherence(early, DIRECTIVE_KEYS)[0]!.firstAfterFreeze).toBeNull();
  });

  it("reports whether the coded plan came after the view's freeze (fix pass 2, P2-4)", async () => {
    const freeze = (cycle: number, at: number): [number, TelemetryEvent] => [cycle * 10 + at, { kind: "freeze_started", detail: { cycle: cycle as never, atViewSeconds: 55, decisionCommittedBeforeFreeze: false, decisionStep: "x" } }];
    const records = await buildLog([
      view(9), freeze(9, 0.5), submit(9, "direct_attack"), // after the freeze
      view(10), submit(10, "barrier_line"), freeze(10, 5), // before it
      view(11), submit(11, "barrier_line"), // no freeze in the log
    ]);
    expect(directiveAdherence(records, DIRECTIVE_KEYS).map((c) => [c.view, c.afterFreeze])).toEqual([[9, true], [10, false], [11, null]]);
  });

  it("codes no cell where alignment or soundness is not coded (phase A, V8), and skips the practice view", async () => {
    const records = await buildLog([view(0), submit(0, "barrier_line"), view(3), submit(3, "direct_attack"), view(8), submit(8, "direct_attack")]);
    expect(directiveAdherence(records, DIRECTIVE_KEYS).map((c) => [c.view, c.first!.posture, c.first!.aligned, c.first!.sound, c.first!.cell])).toEqual([
      [3, "direct_attack", null, null, null], // phase A: reported descriptively
      [8, "direct_attack", false, null, null],
    ]);
  });

  it("codes the plan in force at the view's end, keeps the first submission, and places it against a merged view's step boundary", async () => {
    const records = await buildLog([
      view(11), submit(11, "direct_attack"), boundary(11, 1.5), revise(11, 1, "barrier_line"), // revised after the boundary
      view(12), boundary(12, 0.5), submit(12, "protect_values"), // first submitted after the boundary
      view(13), submit(13, "direct_attack"), revise(13, 1, "barrier_line"), revise(13, 2, "protect_values"), // single step
      view(14), submit(14, "protect_values"), boundary(14, 5), // submitted before the boundary, not revised
    ]);
    const [v11, v12, v13, v14] = directiveAdherence(records, DIRECTIVE_KEYS);
    expect(v11).toMatchObject({ view: 11, revised: true, afterBoundary: true, first: { posture: "direct_attack", cell: "D" }, atViewEnd: { posture: "barrier_line", cell: "A" } });
    expect(v12).toMatchObject({ view: 12, revised: false, afterBoundary: true, atViewEnd: { cell: "A" } });
    expect(v13).toMatchObject({ view: 13, revised: true, afterBoundary: null, first: { cell: "D" }, atViewEnd: { posture: "protect_values", cell: "A" } });
    // V14 is a no-fit view since the phase-B rebuild round 2 (5 Oct 2026, the second rekindle): protecting the village is compliant and unsound.
    expect(v14).toMatchObject({ view: 14, revised: false, afterBoundary: false, first: { cell: "B" }, atViewEnd: { cell: "B" } });
  });

  it("alignment reads the whole plan in phase B (fix pass 2): a secondary direct attack is against the directive", async () => {
    const withSecondary = (cycle: number, posture: Posture, mainEffort: string, secondary: { sectorId: string; taskId: string }): [number, TelemetryEvent] =>
      [cycle * 10 + 1, { kind: "allocation_submitted", detail: { plan: { mainEffort, posture, secondary, drones: null } as never, rationaleAsked: false, rationaleFi: null } }];
    // Fix pass 3: and a secondary direct attack the key does not list makes it unsound, the main effort notwithstanding (D).
    const v11 = await buildLog([view(11), withSecondary(11, "barrier_line", "L3", { sectorId: "L4", taskId: "task.direct-attack" })]);
    expect(directiveAdherence(v11, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ aligned: false, sound: false, cell: "D", h14Aligned: 0 });
    const v13 = await buildLog([view(13), withSecondary(13, "protect_values", "L3", { sectorId: "L2", taskId: "task.direct-attack" })]);
    expect(directiveAdherence(v13, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ aligned: false, sound: false, cell: "D", h14Aligned: 0 });
    const v11head = await buildLog([view(11), withSecondary(11, "barrier_line", "L2", { sectorId: "L3", taskId: "task.direct-attack" })]); // the attack in the head's sector
    expect(directiveAdherence(v11head, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ sound: false, cell: "D" });
    // Fix pass 4: the rule applies only to a main posture within the directive; a main-effort direct attack on the new front with a
    // second attack elsewhere stays sound by its main effort (C), at V9 and V10.
    for (const v of [9, 10]) {
      const elsewhere = await buildLog([view(v), withSecondary(v, "direct_attack", "L3", { sectorId: "L1", taskId: "task.direct-attack" })]);
      expect(directiveAdherence(elsewhere, DIRECTIVE_KEYS)[0]!.atViewEnd, `V${v}`).toMatchObject({ sound: true, soundVia: "main_effort", cell: "C" });
    }
    const hold = await buildLog([view(11), withSecondary(11, "barrier_line", "L3", { sectorId: "L4", taskId: "task.hold-line" })]);
    expect(directiveAdherence(hold, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ aligned: true, cell: "A", h14Aligned: 1, viaBoundarySector: false });
    // V9–V10 (fix pass 2): the new front attacked directly as the secondary sector, the main effort elsewhere within the directive, is sound.
    const v9 = await buildLog([view(9), withSecondary(9, "barrier_line", "L1", { sectorId: "L3", taskId: "task.direct-attack" })]);
    expect(directiveAdherence(v9, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ aligned: false, sound: true, soundVia: "secondary", cell: "C" });
    const v10 = await buildLog([view(10), withSecondary(10, "protect_values", "L1", { sectorId: "L3", taskId: "task.direct-attack" })]);
    expect(directiveAdherence(v10, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ sound: true, soundVia: "secondary", cell: "C" });
    // ...but not on L2 in the primary coding (8 Oct 2026); `31` coa F13: the boundary sensitivity accepts L2 again.
    const v10across = await buildLog([view(10), withSecondary(10, "protect_values", "L1", { sectorId: "L2", taskId: "task.direct-attack" })]);
    expect(directiveAdherence(v10across, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ sound: false, cell: "D", soundWithBoundary: true, cellWithBoundary: "C" });
    const v10hold = await buildLog([view(10), withSecondary(10, "protect_values", "L1", { sectorId: "L3", taskId: "task.hold-line" })]);
    expect(directiveAdherence(v10hold, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ sound: false, cell: "B" });
  });

  it("V14 (6 Oct 2026): sound also with the flare-up (L4, or L1 across the boundary; fix pass 2) attacked directly as the secondary sector while the main effort protects Lahdenkylä (L3) — against the directive, so C", async () => {
    const withSecondary = (cycle: number, posture: Posture, mainEffort: string, secondary: { sectorId: string; taskId: string }): [number, TelemetryEvent] =>
      [cycle * 10 + 1, { kind: "allocation_submitted", detail: { plan: { mainEffort, posture, secondary, drones: null } as never, rationaleAsked: false, rationaleFi: null } }];
    const cases = [
      withSecondary(14, "protect_values", "L3", { sectorId: "L4", taskId: "task.direct-attack" }), // C: sound via the secondary, against by it (fix pass 2; was A)
      withSecondary(14, "barrier_line", "L3", { sectorId: "L1", taskId: "task.direct-attack" }), // D primary (L1 is across the boundary), C in the sensitivity: the flare-up's L1 side
      withSecondary(14, "protect_values", "L3", { sectorId: "L4", taskId: "task.hold-line" }), // B: holding the flare-up gives it the night
      withSecondary(14, "protect_values", "L2", { sectorId: "L4", taskId: "task.direct-attack" }), // D: the main effort is not on Lahdenkylä's front, the secondary against (was B)
      withSecondary(14, "direct_attack", "L3", { sectorId: "L4", taskId: "task.direct-attack" }), // D: the main effort attacks the south-east front
      // SPEC/31 §3.2: a main effort on the flare-up codes D once WP-1 empties V14's `sound` (was C); its coding is in the §3.1 block below.
    ];
    const coded = [];
    for (const c of cases) coded.push(directiveAdherence(await buildLog([view(14), c]), DIRECTIVE_KEYS)[0]!.atViewEnd!);
    expect(coded.map((c) => [c.sound, c.soundVia, c.cell])).toEqual([
      [true, "secondary", "C"], [false, null, "D"], [false, null, "B"], [false, null, "D"], [false, null, "D"],
    ]);
    expect(coded.map((c) => [c.soundWithBoundary, c.cellWithBoundary, c.viaBoundarySector])).toEqual([
      [true, "C", false], [true, "C", true], [false, "B", false], [false, "D", false], [false, "D", false],
    ]);
    // Elsewhere a secondary direct attack scores nothing: V11's key names none.
    const v11 = await buildLog([view(11), withSecondary(11, "direct_attack", "L2", { sectorId: "L4", taskId: "task.direct-attack" })]);
    expect(directiveAdherence(v11, DIRECTIVE_KEYS)[0]!.atViewEnd).toMatchObject({ sound: false, soundVia: null, cell: "D" });
  });

  it("returns an entry for every keyed view the log entered, with null codings where no plan was submitted (the missing row)", async () => {
    const old = { mainEffort: "L3", secondary: null, drones: null } as never;
    const records = await buildLog([
      view(0), // practice: not keyed
      view(9), [91, { kind: "allocation_submitted", detail: { plan: old, rationaleAsked: false, rationaleFi: null } }], // a log before 0.9.4: not coded
      view(10), // ended by the cap, no plan
      view(11), submit(11, "barrier_line"),
    ]);
    expect(directiveAdherence(records, DIRECTIVE_KEYS)).toEqual([
      { view: 9, attemptStartSeq: 1, departureNoted: null, first: null, atViewEnd: null, revised: false, afterBoundary: null, afterFreeze: null, firstAfterFreeze: null, firstAfterBoundary: null },
      { view: 10, attemptStartSeq: 3, departureNoted: null, first: null, atViewEnd: null, revised: false, afterBoundary: null, afterFreeze: null, firstAfterFreeze: null, firstAfterBoundary: null },
      expect.objectContaining({ view: 11, first: expect.objectContaining({ cell: "A" }) }),
    ]);
  });
});

/**
 * SPEC/31 §3.2 (WP-1's key change): V14 is sound only through the secondary route — `sound` emptied, `soundSectors` gone; `soundSecondary`
 * and `boundarySectors` unchanged. Built from the build's key so its sectors stay computed; identical to it once WP-1's change is merged.
 */
const { soundSectors: _v14Sectors, ...V14_REST } = DIRECTIVE_KEYS[14]!;
const V14_31: DirectiveKeyLike = { ...V14_REST, sound: [] };
const KEYS_31: Readonly<Record<number, DirectiveKeyLike | null>> = { ...DIRECTIVE_KEYS, 14: V14_31 };
const V14_KEY_CHANGED = DIRECTIVE_KEYS[14]!.soundSectors === undefined;

describe("SPEC/31 §3.1 (RC): H13 codes the act — the panel's probe plans under both codings (coa_option_key.csv)", () => {
  type Plan = readonly [string, string, string | null, string | null]; // main sector, posture, secondary sector, secondary task
  const coded = async (v: number, p: Plan, keys: Readonly<Record<number, DirectiveKeyLike | null>> = KEYS_31) => {
    const plan = { mainEffort: p[0], posture: p[1], secondary: p[2] ? { sectorId: p[2], taskId: p[3]! } : null, drones: null } as never;
    const records = await buildLog([[v * 10, { kind: "cycle_start", detail: { cycle: v as never, phase: "B", clockLabel: "x" } }], [v * 10 + 1, { kind: "allocation_submitted", detail: { plan, rationaleAsked: false, rationaleFi: null } }]]);
    return directiveAdherence(records, keys)[0]!.atViewEnd!;
  };
  // [draft id, plan, label cell (the sensitivity), act cell (the primary)]
  const PROBES: readonly (readonly [string, number, Plan, string, string])[] = [
    ["V9-a", 9, ["L3", "direct_attack", "L1", "task.mopup"], "C", "C"],
    ["V9-b", 9, ["L2", "barrier_line", "L3", "task.direct-attack"], "C", "C"],
    ["V9-c", 9, ["L3", "barrier_line", null, null], "B", "B"],
    ["V9-d", 9, ["L1", "protect_values", null, null], "B", "B"],
    ["V9-e", 9, ["L2", "direct_attack", null, null], "D", "D"],
    ["V9-f", 9, ["L1", "barrier_line", "L3", "task.mopup"], "B", "C"], // the probe: mop-up on the new front attends it
    ["V10-a", 10, ["L3", "direct_attack", null, null], "C", "C"],
    ["V10-b", 10, ["L2", "barrier_line", "L3", "task.direct-attack"], "C", "C"],
    ["V10-c", 10, ["L3", "barrier_line", null, null], "B", "B"],
    ["V10-d", 10, ["L3", "protect_values", null, null], "B", "B"],
    ["V10-e", 10, ["L2", "direct_attack", null, null], "D", "D"],
    ["V10-f", 10, ["L1", "barrier_line", "L3", "task.hold-line"], "B", "C"], // the probe: a held hose line on the new front
    ["V14-a", 14, ["L3", "barrier_line", "L4", "task.direct-attack"], "C", "C"],
    ["V14-b", 14, ["L4", "direct_attack", "L3", "task.hold-line"], "D", "D"], // §3.2: the main effort on the 0.3 ha flare-up (was C)
    ["V14-c", 14, ["L3", "barrier_line", null, null], "B", "B"],
    ["V14-d", 14, ["L3", "barrier_line", "L4", "task.mopup"], "B", "C"], // the probe: mop-up on the flare-up, the main effort on Lahdenkylä's front
    ["V14-e", 14, ["L3", "direct_attack", null, null], "D", "D"],
    ["V14-f", 14, ["L1", "barrier_line", null, null], "B", "B"],
  ];

  it.each(PROBES)("%s: label cell %s, act cell %s", async (_id, v, plan, label, act) => {
    const c = await coded(v, plan);
    expect([c.cell, c.cellByAct]).toEqual([label, act]);
    expect(c.attended).toBe(act === "C" || (plan[1] === "direct_attack" && (v === 14 ? plan[0] === "L4" : plan[0] === "L3")));
  });

  it("an attending secondary task is against the directive whatever its label; the act's soundness goes through the key's secondary route", async () => {
    expect(await coded(9, ["L1", "barrier_line", "L3", "task.mopup"])).toMatchObject({
      aligned: true, cell: "B", attended: true, attendedVia: "secondary", alignedByAct: false, soundByAct: true, soundViaByAct: "secondary", cellByAct: "C", secondary: { sectorId: "L3", taskId: "task.mopup" },
    });
    expect(await coded(14, ["L4", "direct_attack", null, null])).toMatchObject({ attended: true, attendedVia: "main_effort", cell: "D", cellByAct: "D", soundViaByAct: null });
    // V14: the secondary route needs the main effort aligned in Lahdenkylä's sector; elsewhere the attending plan codes D.
    expect(await coded(14, ["L2", "protect_values", "L4", "task.hold-line"])).toMatchObject({ cell: "B", cellByAct: "D" });
    // A boundary sector is the front in the sensitivity only, for the act as for the label (integration, 19 Oct 2026): a mop-up on the
    // flare-up's L1 side (V14) or on L2 (V9–V10, `31` coa F13) does not attend the core front, so B on the primary act coding, C on its
    // boundary sensitivity; the boundary never changes a primary cell.
    expect(await coded(14, ["L3", "barrier_line", "L1", "task.mopup"])).toMatchObject({ attended: false, cellByAct: "B", cellByActWithBoundary: "C", cell: "B", cellWithBoundary: "B" });
    expect(await coded(9, ["L1", "barrier_line", "L2", "task.mopup"])).toMatchObject({ attended: false, cellByAct: "B", cellByActWithBoundary: "C", cell: "B", cellWithBoundary: "B" });
    expect(await coded(10, ["L2", "direct_attack", null, null])).toMatchObject({ attended: false, cellByAct: "D", cellByActWithBoundary: "C", cell: "D", cellWithBoundary: "C" });
  });

  it("H15 reads the act's alignment (integration, 19 Oct 2026, RC with §3.1); the label's is its sensitivity", async () => {
    // The probe plan V9-f: a mop-up on the new front attends it, so it is against the directive for H15 as it is a departure for H13.
    expect(await coded(9, ["L1", "barrier_line", "L3", "task.mopup"])).toMatchObject({ cellByAct: "C", h15Aligned: 0, h14Aligned: 1, cell: "B" });
    // Not attending (a mop-up on the boundary sector L2): aligned on both.
    expect(await coded(9, ["L1", "barrier_line", "L2", "task.mopup"])).toMatchObject({ h15Aligned: 1, h14Aligned: 1 });
    // A fit view: the act coding is the label coding.
    const fit = await coded(11, ["L3", "barrier_line", "L1", "task.mopup"]);
    expect(fit.h15Aligned).toBe(fit.h14Aligned);
  });

  it("names no keyed front in the fit views, V8 and phase A: there the act coding is the label coding", async () => {
    for (const v of [8, 11, 12, 13]) {
      const c = await coded(v, ["L3", "barrier_line", "L1", "task.mopup"]);
      expect([c.attended, c.attendedVia, c.cellByAct, c.cellByActWithBoundary], `V${v}`).toEqual([null, null, c.cell, c.cellWithBoundary]);
    }
    const a = await coded(3, ["L3", "direct_attack", null, null]);
    expect([a.attended, a.cellByAct]).toEqual([null, null]);
  });

  it("V13's secondary direct attacks are reported apart (coa F6), and the routes of each key are listed for the review packet (§3.2 soundVia)", async () => {
    const adherence = [await coded(13, ["L3", "barrier_line", "L1", "task.direct-attack"]), await coded(14, ["L3", "protect_values", "L4", "task.direct-attack"]), await coded(12, ["L3", "barrier_line", null, null])]
      .map((atViewEnd, i) => ({ view: [13, 14, 12][i]!, atViewEnd }));
    expect(secondaryAttacks(adherence)).toEqual([{ view: 13, sectorId: "L1", cell: "D", cellByAct: "D" }, { view: 14, sectorId: "L4", cell: "C", cellByAct: "C" }]);
    expect(secondaryAttacks(adherence, [13])).toHaveLength(1);
    expect(soundRoutes(V14_31).routes).toEqual(["secondary"]);
    expect(soundRoutes(KEYS_31[9]!).routes).toEqual(["main_effort", "secondary"]);
    expect(soundRoutes(KEYS_31[11]!)).toMatchObject({ routes: ["main_effort"], keyedFront: [] });
    expect(soundRoutes(KEYS_31[3]!).routes).toEqual([]);
    expect(keyedFrontSectors(V14_31)).toEqual(["L1", "L4"]);
  });

  // Runs once WP-1's §3.2 change is merged (V14 without `soundSectors`): the build's V14 key must then code exactly as the fixture.
  it.runIf(V14_KEY_CHANGED)("the build's V14 key has the §3.2 shape: sound only through the secondary route", async () => {
    expect(DIRECTIVE_KEYS[14]!.sound).toEqual([]);
    for (const [, v, plan] of PROBES.filter((p) => p[1] === 14)) {
      const [real, fixture] = [await coded(v, plan, DIRECTIVE_KEYS), await coded(v, plan)];
      expect([real.cell, real.cellByAct, real.cellWithBoundary, real.cellByActWithBoundary]).toEqual([fixture.cell, fixture.cellByAct, fixture.cellWithBoundary, fixture.cellByActWithBoundary]);
    }
  });
});

describe("openThinkerAnswersBeforePlan (Paper 2 (d), the material for the blind coding of advice-following; 8 Oct 2026)", () => {
  const ask = (queryId: string, text: string, view: number, tool: "haku" | "open_thinker" = "open_thinker"): TelemetryEvent =>
    ({ kind: "ai_chat_query_submitted", detail: { queryId, text, view, virtualTimeS: 10, phase: "exploration", tool } });
  const reply = (queryId: string, vastaus: string, view: number, tool: "haku" | "open_thinker" = "open_thinker"): TelemetryEvent => ({
    kind: "ai_chat_answer_received",
    detail: {
      queryId, text: "q", view, virtualTimeS: 12, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h", answer: { vastaus, perusteet: "", varmuus: "", muuttaisi: "" },
      latencyMs: 900, fallback: false, fallbackReason: null, phase: "exploration", promptVariant: "standard", tool,
    },
  });
  const alloc = (posture: "barrier_line" | "direct_attack"): TelemetryEvent =>
    ({ kind: "allocation_submitted", detail: { plan: { mainEffort: "L3", posture, secondary: null, drones: null }, rationaleAsked: false, rationaleFi: null } });
  const cycle = (c: number): TelemetryEvent => ({ kind: "cycle_start", detail: { cycle: c as never, phase: "B", clockLabel: "x" } });

  it("lists, per keyed view with a plan, the Open Thinker answers received in that view before the plan in force, with question, text and times", async () => {
    const records = await buildLog([
      [0, cycle(11)],
      [1_000, ask("o1", "Mitä tehdään?", 11)], [2_000, reply("o1", "Linjaus sopii: pidä tie R2.", 11)],
      [2_500, ask("h1", "Missä EK11 on?", 11, "haku")], [2_600, reply("h1", "EK11 on tiellä.", 11, "haku")], // Haku's chat is not the Open Thinker
      [3_000, alloc("barrier_line")],
      [4_000, ask("o2", "Entä nyt?", 11)], [5_000, reply("o2", "Myöhäinen vastaus.", 11)], // after the plan: not before it
      [6_000, cycle(12)],
      [7_000, alloc("barrier_line")], // a view without questions: an entry with no answers
      [8_000, cycle(3)], [9_000, alloc("direct_attack")], // phase A: keyed (descriptive), so it has an entry too
    ]);
    const out = openThinkerAnswersBeforePlan(records, DIRECTIVE_KEYS);
    expect(out.map((e) => [e.view, e.answers.length])).toEqual([[3, 0], [11, 1], [12, 0]]);
    expect(out[1]!.answers[0]).toMatchObject({ queryId: "o1", question: "Mitä tehdään?", text: "Linjaus sopii: pidä tie R2.", virtualTimeS: 12, phase: "exploration", fallback: false });
    expect(out[1]!.planTWallOffsetMs).toBe(3_000);
    expect(out[1]!.answers[0]!.tWallOffsetMs).toBe(2_000);
  });

  it("reads the plan in force at view end: a revision moves the cut-off, and a view without a plan has no entry", async () => {
    const revised: TelemetryEvent = { kind: "allocation_revised", detail: { cycle: 11 as never, revision: 1, plan: { mainEffort: "L3", posture: "barrier_line", secondary: null, drones: null } } };
    const records = await buildLog([
      [0, cycle(11)], [1_000, alloc("barrier_line")], [2_000, ask("o1", "?", 11)], [3_000, reply("o1", "Vastaus.", 11)], [4_000, revised],
      [5_000, cycle(12)], // no plan
    ]);
    const out = openThinkerAnswersBeforePlan(records, DIRECTIVE_KEYS);
    expect(out.map((e) => e.view)).toEqual([11]);
    expect(out[0]!.answers.map((a) => a.queryId)).toEqual(["o1"]); // before the revision, the plan in force
  });
});

describe("fix pass 6: the departure note, resume-aware coding, accountable deviation, baseline compliance", () => {
  type Posture = "direct_attack" | "barrier_line" | "protect_values";
  const view = (cycle: number): [number, TelemetryEvent] => [cycle * 10, { kind: "cycle_start", detail: { cycle: cycle as never, phase: cycle <= 7 ? "A" : "B", clockLabel: "x" } }];
  const alloc = (cycle: number, posture: Posture, mainEffort: string, extra: Record<string, unknown> = {}): [number, TelemetryEvent] =>
    [cycle * 10 + 1, { kind: "allocation_submitted", detail: { plan: { mainEffort, posture, secondary: null, drones: null, ...extra } as never, rationaleAsked: false, rationaleFi: null } }];
  const resumed = (cycleReplayed: number): [number, TelemetryEvent] =>
    [cycleReplayed * 10 + 2, { kind: "session_resumed", detail: { resumeCount: 1, intervalSinceInterruptionMs: 1_000, cycleReplayed: cycleReplayed as never, resumedAt: "view" } }];
  const ask = (queryId: string, view: number): TelemetryEvent => ({ kind: "ai_chat_query_submitted", detail: { queryId, text: "?", view, virtualTimeS: 10, phase: "exploration", tool: "open_thinker" } });
  const reply = (queryId: string, view: number): TelemetryEvent => ({
    kind: "ai_chat_answer_received",
    detail: {
      queryId, text: "q", view, virtualTimeS: 12, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h", answer: { vastaus: "a", perusteet: "", varmuus: "", muuttaisi: "" },
      latencyMs: 900, fallback: false, fallbackReason: null, phase: "exploration", promptVariant: "standard", tool: "open_thinker",
    },
  });

  it("the entry carries the departure note of the plan in force; a plan without the field has none", async () => {
    const records = await buildLog([
      view(9), alloc(9, "direct_attack", "L3", { departureNoted: true, departureReason: "liekit alle metrin" }),
      view(10), alloc(10, "direct_attack", "L3"),
    ]);
    const out = directiveAdherence(records, DIRECTIVE_KEYS);
    expect(out.map((e) => [e.view, e.departureNoted, e.atViewEnd!.departureNoted])).toEqual([[9, true, true], [10, false, false]]);
  });

  it("accountableDeviation counts the C views with and without the note", async () => {
    const records = await buildLog([
      view(9), alloc(9, "direct_attack", "L3", { departureNoted: true }), // C, noted
      view(10), alloc(10, "direct_attack", "L3", { departureNoted: false }), // C, not noted
      view(11), alloc(11, "barrier_line", "L3"), // not C
      view(12), alloc(12, "direct_attack", "L2", { departureNoted: true }), // not C (D, or B): the note does not make it C
    ]);
    expect(accountableDeviation(records, DIRECTIVE_KEYS)).toEqual({
      cViews: [{ view: 9, departureNoted: true }, { view: 10, departureNoted: false }], cWithNote: 1, cWithoutNote: 1, noteShareOfC: 0.5,
    });
    expect(accountableDeviation([], DIRECTIVE_KEYS)).toEqual({ cViews: [], cWithNote: 0, cWithoutNote: 0, noteShareOfC: null });
  });

  it("a view replayed after session_resumed counts its last attempt; a repeated cycle_start without a resume keeps the first", async () => {
    const records = await buildLog([
      view(9), alloc(9, "barrier_line", "L3"), // first attempt: interrupted
      resumed(9),
      view(9), alloc(9, "direct_attack", "L3"), // the replay
      view(10), alloc(10, "direct_attack", "L3"),
      view(10), alloc(10, "barrier_line", "L3"), // a stray repeat with no resume: not a reset
    ]);
    const out = directiveAdherence(records, DIRECTIVE_KEYS);
    expect(out.map((e) => [e.view, e.first!.posture, e.atViewEnd!.posture, e.revised])).toEqual([[9, "direct_attack", "direct_attack", false], [10, "direct_attack", "direct_attack", false]]);
    expect(out[0]!.attemptStartSeq).toBe(records.filter((r) => r.kind === "cycle_start")[1]!.seq);
  });

  it("openThinkerAnswersBeforePlan keeps only the answers after the last attempt's cycle_start", async () => {
    const records = await buildLog([
      view(11), [111, ask("o1", 11)], [112, reply("o1", 11)], // the first attempt
      resumed(11),
      view(11), [115, ask("o2", 11)], [116, reply("o2", 11)], alloc(11, "barrier_line", "L3"),
    ]);
    const out = openThinkerAnswersBeforePlan(records, DIRECTIVE_KEYS);
    expect(out).toHaveLength(1);
    expect(out[0]!.answers.map((a) => a.queryId)).toEqual(["o2"]);
  });

  it("baselineCompliance reads the practice view and V1 only: the share of direct attack in the plans in force", async () => {
    const records = await buildLog([
      view(0), alloc(0, "direct_attack", "L2"),
      view(1), alloc(1, "barrier_line", "L2"), [12, { kind: "allocation_revised", detail: { cycle: 1 as never, revision: 1, plan: { mainEffort: "L2", posture: "direct_attack", secondary: null, drones: null } } }],
      view(2), alloc(2, "protect_values", "L2"), // not a baseline view
    ]);
    expect(baselineCompliance(records)).toEqual({ plans: [{ view: 0, posture: "direct_attack" }, { view: 1, posture: "direct_attack" }], directAttackShare: 1 });
    const half = await buildLog([view(0), alloc(0, "direct_attack", "L2"), view(1), alloc(1, "protect_values", "L2")]);
    expect(baselineCompliance(half).directAttackShare).toBe(0.5);
    expect(baselineCompliance(await buildLog([view(0)]))).toEqual({ plans: [], directAttackShare: null });
  });

  it("revision (an): the baseline views come before any order-bearing contact (the directive's assessment from STRATEGY_FROM_VIEW)", () => {
    expect([...BASELINE_VIEWS]).toEqual([0, 1]);
    for (const v of BASELINE_VIEWS) expect(v).toBeLessThan(STRATEGY_FROM_VIEW);
  });
});

describe("fix pass 6: afterFreeze on the H10 anticipation, the final plan per view, the Open Thinker's verdict", () => {
  const view = (cycle: number): [number, TelemetryEvent] => [cycle * 10, { kind: "cycle_start", detail: { cycle: cycle as never, phase: "A", clockLabel: "x" } }];
  const freeze = (cycle: number, at: number): [number, TelemetryEvent] => [cycle * 10 + at, { kind: "freeze_started", detail: { cycle: cycle as never, atViewSeconds: 55, decisionCommittedBeforeFreeze: false, decisionStep: "x" } }];
  const plan = (cycle: number, at: number, mainEffort: string, extra: Record<string, unknown> = {}): [number, TelemetryEvent] =>
    [cycle * 10 + at, { kind: "allocation_submitted", detail: { plan: { mainEffort, posture: "direct_attack", secondary: null, drones: null, ...extra } as never, rationaleAsked: false, rationaleFi: null } }];

  it("sectorAnticipation says whether the first qualifying plan came after the view's freeze (null with no freeze)", async () => {
    const after = await buildLog([view(7), freeze(7, 1), plan(7, 2, "L3")]);
    expect(sectorAnticipation(after, REKINDLE_CREW_ANTICIPATION).first).toMatchObject({ view: 7, afterFreeze: true });
    const before = await buildLog([view(7), plan(7, 1, "L3"), freeze(7, 2)]);
    expect(sectorAnticipation(before, REKINDLE_CREW_ANTICIPATION).first).toMatchObject({ afterFreeze: false });
    const none = await buildLog([view(8), plan(8, 1, "L3")]);
    expect(sectorAnticipation(none, REKINDLE_CREW_ANTICIPATION).first).toMatchObject({ afterFreeze: null });
  });

  it("finalPlanPerView: the plan in force at each main view's end, the last attempt of a replayed view, the practice view left out", async () => {
    const replay: [number, TelemetryEvent] = [31, { kind: "session_resumed", detail: { resumeCount: 1, intervalSinceInterruptionMs: 1, cycleReplayed: 3 as never, resumedAt: "view" } }];
    const records = await buildLog([
      view(0), plan(0, 1, "L2"),
      view(2), plan(2, 1, "L1"), [22, { kind: "allocation_revised", detail: { cycle: 2 as never, revision: 1, plan: { mainEffort: "L2", posture: "barrier_line", secondary: { sectorId: "L3", taskId: "task.mopup" }, drones: null } } }],
      view(3), plan(3, 1, "L1"), replay, view(3), plan(3, 3, "L4", { drones: { sectorId: "L3", taskId: "task.watch" } }),
      view(4),
    ]);
    const out = finalPlanPerView(records);
    expect(out.map((p) => [p.view, p.mainEffort, p.posture, p.secondary?.sectorId ?? null, p.drones?.taskId ?? null, p.revised])).toEqual([
      [2, "L2", "barrier_line", "L3", null, true], [3, "L4", "direct_attack", null, "task.watch", false],
    ]);
  });

  it("the Open Thinker answers carry the answer's verdict, null where the log has none", async () => {
    const cyc: [number, TelemetryEvent] = [110, { kind: "cycle_start", detail: { cycle: 11 as never, phase: "B", clockLabel: "x" } }];
    const reply = (queryId: string, extra: Record<string, unknown>): TelemetryEvent => ({
      kind: "ai_chat_answer_received",
      detail: {
        queryId, text: "q", view: 11, virtualTimeS: 12, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h", answer: { vastaus: "a", perusteet: "", varmuus: "", muuttaisi: "" },
        latencyMs: 900, fallback: false, fallbackReason: null, phase: "exploration", promptVariant: "standard", tool: "open_thinker", ...extra,
      } as never,
    });
    const records = await buildLog([cyc, [111, reply("o1", { aiVerdict: "in_line" })], [112, reply("o2", {})], [113, plan(11, 3, "L3")[1]]]);
    expect(openThinkerAnswersBeforePlan(records, DIRECTIVE_KEYS)[0]!.answers.map((a) => a.aiVerdict)).toEqual(["in_line", null]);
  });
});
