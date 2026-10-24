/**
 * `app/telemetry/freeze-measures.ts` over hand-built logs and a small fake freeze list (choice and
 * map_point items). The real item bank is not used: the measures must work on any FreezeSpec[].
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime, type LatLon } from "../../app/engine/primitives.js";
import type { FreezeItem } from "../../app/scenario/types.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import {
  answerRelaysAtom, atomExposure, calibrationPairs, freezeItemExposure, freezeItemScores, H2_PRIMARY_WINDOW, haversineMetres, plantedFalseValueHeld, plantedExposure, F7_GRID_ATOM_ID, F7_PLANTED_ATOM_ID, projectionReliance, replayedViews,
  type FreezeContentLike, type FreezeItemScore,
} from "../../app/telemetry/freeze-measures.js";
import { errorClassCounts, errorClasses, exposureConditionalScores } from "../../app/telemetry/error-classes.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { AiChatAnswerReceivedDetail, FreezeItemAnsweredDetail, TelemetryEvent } from "../../app/telemetry/record-kinds.js";

const HEADER: LogHeader = {
  formatVersion: "0.9.1", sessionId: "freeze-test", participantCode: "p", condition: "substitutive", scenarioId: "s",
  scenarioVersion: "0.1.0", seed: "1", bundleHash: "b", appVersion: "0.1.0", startedAtIso: "2026-01-01T00:00:00.000Z",
  userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 }, counterbalance: { expectationOrder: "A" }, cell: "radio", echelon: "command",
};

async function buildLog(events: readonly (readonly [number, TelemetryEvent])[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (const [tWallOffsetMs, event] of events) await appendTelemetryEvent(log, asVirtualTime(0), tWallOffsetMs, event);
  return log.readAll();
}

/** ~100 m north of KEY at this latitude (1° of latitude ≈ 111 195 m on the mean sphere). */
const KEY: LatLon = { lat: 61.0, lon: 25.0 };
const NORTH_100M: LatLon = { lat: 61.0 + 100 / 111_195.08, lon: 25.0 };
const NORTH_400M: LatLon = { lat: 61.0 + 400 / 111_195.08, lon: 25.0 };

const choice = (id: string, level: FreezeItem["level"], correctId: string, extra: Partial<FreezeItem> = {}): FreezeItem => ({
  id, level, promptFi: id,
  options: ["a", "b", "c", "d"].map((o) => ({ id: o, labelFi: o, correct: o === correctId })),
  ...extra,
});
const mapItem = (id: string, level: FreezeItem["level"], extra: Partial<FreezeItem> = {}): FreezeItem => ({
  id, level, promptFi: id, options: [], kind: "map_point", mapKey: { point: KEY, toleranceM: 250 }, ...extra,
});

const FREEZES: readonly FreezeContentLike[] = [
  {
    cycle: 2,
    items: [
      choice("v2.l1", "L1", "a", { keyAtomIds: ["atom.bubble", "atom.never"], goal: "safety" }),
      choice("v2.l2", "L2", "b", { keyAtomIds: ["atom.haku"] }),
      mapItem("v2.l3map", "L3", { keyAtomIds: ["atom.thinker-late"], goal: "containment" }),
    ],
  },
  { cycle: 3, items: [choice("v3.l2", "L2", "c")] },
  {
    cycle: 4,
    items: [mapItem("v4.l2map", "L2"), mapItem("v4.l1map", "L1"), choice("v4.l3", "L3", "d", { keyAtomIds: ["atom.thinker"] })],
  },
];

const answer = (itemId: string, optionId: string, confidence: number, more: Partial<FreezeItemAnsweredDetail> = {}): FreezeItemAnsweredDetail =>
  ({ itemId, optionId, confidence, ...more });

const thinkerAnswer = (view: number, ids: readonly string[]): AiChatAnswerReceivedDetail => ({
  queryId: `ai.${view}`, text: "q", view, virtualTimeS: 0, retrieved: ids.map((id) => ({ id, fusedScore: 0.5 })), retrievalMode: "hybrid",
  modelId: "m", promptHash: "h", answer: { vastaus: "", perusteet: "", varmuus: "", muuttaisi: "" }, latencyMs: 2500, fallback: false,
  fallbackReason: null, phase: "exploration", promptVariant: "standard",
});

const freezeStarted = (cycle: 2 | 3 | 4): TelemetryEvent => ({ kind: "freeze_started", detail: { cycle, atViewSeconds: 60, decisionCommittedBeforeFreeze: false, decisionStep: "exploration" } });

async function sessionLog(): Promise<readonly LogRecord[]> {
  return buildLog([
    [1_000, { kind: "bubble_available", detail: { atomId: "atom.bubble", mapPosition: null, tier: "T1_pushed", sourceId: "u1" } }],
    [5_000, { kind: "nav_query_submitted", detail: { queryId: "nav.1", category: "c", sourceId: null, window: "latest", resultAtomIds: ["atom.haku", "atom.bubble"], phase: "exploration" } }],
    [10_000, freezeStarted(2)],
    [11_000, { kind: "ai_chat_answer_received", detail: thinkerAnswer(2, ["atom.thinker-late"]) }], // asked before, answered during the freeze
    [20_000, {
      kind: "freeze_submitted",
      detail: {
        cycle: 2,
        responses: [
          answer("v2.l1", "a", 75),
          answer("v2.l2", "c", 100, { source: "search" }),
          answer("v2.l3map", "map_point", 50, { source: "own_inference", point: NORTH_100M }),
          answer("unknown.item", "a", 25),
        ],
      },
    }],
    [25_000, { kind: "freeze_submitted", detail: { cycle: 3, responses: [answer("v3.l2", "c", 25, { source: "map" })] } }], // no freeze_started logged
    [30_000, { kind: "ai_chat_answer_received", detail: thinkerAnswer(4, ["atom.thinker"]) }],
    [32_000, { kind: "bubble_available", detail: { atomId: "atom.thinker", mapPosition: null, tier: "T1_pushed", sourceId: "u2" } }],
    [40_000, freezeStarted(4)],
    [50_000, {
      kind: "freeze_submitted",
      detail: {
        cycle: 4,
        responses: [
          answer("v4.l2map", "map_point", 75, { source: "map", point: NORTH_400M }),
          answer("v4.l1map", "map_point", 50),
          answer("v4.l3", "d", 75, { source: "thinker" }),
        ],
      },
    }],
  ]);
}

describe("haversineMetres", () => {
  it("is ~100 m for a 100 m north offset, symmetric, and 0 for the same point", () => {
    expect(haversineMetres(KEY, NORTH_100M)).toBeCloseTo(100, 0);
    expect(haversineMetres(NORTH_100M, KEY)).toBeCloseTo(haversineMetres(KEY, NORTH_100M), 9);
    expect(haversineMetres(KEY, KEY)).toBe(0);
  });
});

describe("freezeItemScores", () => {
  it("scores choice items by the option's key and map items by distance to mapKey within toleranceM", async () => {
    const scores = freezeItemScores(await sessionLog(), FREEZES);
    const byId = new Map(scores.map((s) => [s.itemId, s]));
    expect(scores.map((s) => s.itemId)).toEqual(["v2.l1", "v2.l2", "v2.l3map", "v3.l2", "v4.l2map", "v4.l1map", "v4.l3"]);

    expect(byId.get("v2.l1")).toEqual({ view: 2, itemId: "v2.l1", level: "L1", goal: "safety", kind: "choice", correct: true, distanceM: null, confidence: 75, source: null });
    expect(byId.get("v2.l2")).toMatchObject({ correct: false, confidence: 100, source: "search", goal: null });
    expect(byId.get("v3.l2")).toMatchObject({ view: 3, correct: true, source: "map" });
    expect(byId.get("v4.l3")).toMatchObject({ correct: true, source: "thinker" });

    const near = byId.get("v2.l3map")!;
    expect(near).toMatchObject({ kind: "map_point", correct: true, goal: "containment", source: "own_inference" });
    expect(near.distanceM).toBeCloseTo(100, 0);
    const far = byId.get("v4.l2map")!;
    expect(far.correct).toBe(false);
    expect(far.distanceM).toBeCloseTo(400, 0);
    expect(byId.get("v4.l1map")).toMatchObject({ correct: false, distanceM: null }); // no point logged
  });

  it("skips answers whose item is not in the content passed for that view", async () => {
    const scores = freezeItemScores(await sessionLog(), FREEZES.filter((f) => f.cycle === 3));
    expect(scores.map((s) => s.itemId)).toEqual(["v3.l2"]);
  });

  it("throws on an unknown option id or a map item without mapKey", async () => {
    const records = await buildLog([[0, { kind: "freeze_submitted", detail: { cycle: 2, responses: [answer("v2.l1", "zz", 50)] } }]]);
    expect(() => freezeItemScores(records, FREEZES)).toThrow(/option zz/);
    const noKey: FreezeContentLike[] = [{ cycle: 2, items: [{ id: "m", level: "L1", promptFi: "m", options: [], kind: "map_point" }] }];
    const mapRecords = await buildLog([[0, { kind: "freeze_submitted", detail: { cycle: 2, responses: [answer("m", "map_point", 50, { point: KEY })] } }]]);
    expect(() => freezeItemScores(mapRecords, noKey)).toThrow(/no mapKey/);
  });
});

describe("freezeItemExposure", () => {
  it("reports per key atom whether, how and how long before freeze_started it arrived", async () => {
    const exposure = freezeItemExposure(await sessionLog(), FREEZES);
    expect(exposure.map((e) => e.itemId)).toEqual(["v2.l1", "v2.l2", "v2.l3map", "v4.l3"]); // items without keyAtomIds omitted

    const [l1, l2, l3map, v4l3] = exposure;
    expect(l1).toEqual({
      view: 2, itemId: "v2.l1", level: "L1", allReached: false,
      keyAtoms: [
        { atomId: "atom.bubble", reached: true, route: "bubble", routes: ["bubble", "haku"], msBeforeFreeze: 9_000 },
        { atomId: "atom.never", reached: false, route: null, routes: [], msBeforeFreeze: null },
      ],
    });
    expect(l2!.allReached).toBe(true);
    expect(l2!.keyAtoms[0]).toMatchObject({ route: "haku", msBeforeFreeze: 5_000 });
    // A Thinker answer that arrives during the freeze has not reached the participant before it.
    expect(l3map!.keyAtoms[0]).toMatchObject({ atomId: "atom.thinker-late", reached: false, route: null });
    expect(v4l3!.keyAtoms[0]).toEqual({ atomId: "atom.thinker", reached: true, route: "thinker", routes: ["thinker", "bubble"], msBeforeFreeze: 10_000 });
  });

  it("anchors on the submission when no freeze_started was logged for the view", async () => {
    const freezes: FreezeContentLike[] = [{ cycle: 3, items: [choice("x", "L1", "a", { keyAtomIds: ["atom.a"] })] }];
    const records = await buildLog([
      [2_000, { kind: "bubble_available", detail: { atomId: "atom.a", mapPosition: null, tier: "T1_pushed", sourceId: "u" } }],
      [7_000, { kind: "freeze_submitted", detail: { cycle: 3, responses: [answer("x", "a", 50)] } }],
    ]);
    expect(freezeItemExposure(records, freezes)[0]!.keyAtoms[0]).toMatchObject({ reached: true, msBeforeFreeze: 5_000 });
  });

  it("splits the chat routes by tool (8 Oct 2026): Haku's chat is haku_chat; the Open Thinker, and an answer with no tool (older logs), thinker", async () => {
    const freezes: FreezeContentLike[] = [{ cycle: 2, items: [choice("x", "L1", "a", { keyAtomIds: ["h", "o", "old"] })] }];
    const records = await buildLog([
      [1_000, { kind: "ai_chat_answer_received", detail: { ...thinkerAnswer(2, ["h"]), tool: "haku" } }],
      [1_500, { kind: "ai_chat_answer_received", detail: { ...thinkerAnswer(2, ["o"]), queryId: "ai_open.2", tool: "open_thinker" } }],
      [2_000, { kind: "ai_chat_answer_received", detail: thinkerAnswer(2, ["old"]) }],
      [3_000, freezeStarted(2)],
      [4_000, { kind: "freeze_submitted", detail: { cycle: 2, responses: [answer("x", "a", 50)] } }],
    ]);
    expect(freezeItemExposure(records, freezes)[0]!.keyAtoms.map((k) => k.route)).toEqual(["haku_chat", "thinker", "thinker"]);
  });

  it("reads the older traffic_returned and result_item_expanded routes", async () => {
    const freezes: FreezeContentLike[] = [{ cycle: 2, items: [choice("x", "L1", "a", { keyAtomIds: ["t", "r"] })] }];
    const records = await buildLog([
      [1_000, { kind: "traffic_returned", detail: { requestId: "q", selector: {}, entryIds: ["t"] } }],
      [2_000, { kind: "result_item_expanded", detail: { atomId: "r" } }],
      [3_000, freezeStarted(2)],
      [4_000, { kind: "freeze_submitted", detail: { cycle: 2, responses: [answer("x", "b", 50)] } }],
    ]);
    const [item] = freezeItemExposure(records, freezes);
    expect(item!.keyAtoms.map((k) => k.route)).toEqual(["traffic", "result_expanded"]);
    expect(item!.allReached).toBe(true);
  });
});

describe("calibrationPairs", () => {
  it("defaults to H2's primary window (L2/L3 in V2, V4, V5, V7) with Brier and the over/under-confidence gap", async () => {
    const summary = calibrationPairs(freezeItemScores(await sessionLog(), FREEZES));
    expect(H2_PRIMARY_WINDOW).toEqual({ levels: ["L2", "L3"], views: [2, 4, 5, 7] });
    // v2.l2 (100, wrong), v2.l3map (50, right), v4.l2map (75, wrong), v4.l3 (75, right); V3 and L1 excluded.
    expect(summary.pairs.map((p) => p.itemId)).toEqual(["v2.l2", "v2.l3map", "v4.l2map", "v4.l3"]);
    expect(summary.n).toBe(4);
    expect(summary.meanConfidence).toBeCloseTo(75, 9);
    expect(summary.proportionCorrect).toBeCloseTo(0.5, 9);
    expect(summary.brier).toBeCloseTo((1 + 0.25 + 0.5625 + 0.0625) / 4, 9);
    expect(summary.overUnderGap).toBeCloseTo(0.25, 9);
  });

  it("takes any level/view filter, and returns nulls on an empty window", async () => {
    const scores = freezeItemScores(await sessionLog(), FREEZES);
    const l1 = calibrationPairs(scores, { levels: ["L1"] });
    expect(l1.pairs.map((p) => p.itemId)).toEqual(["v2.l1", "v4.l1map"]);
    expect(l1.overUnderGap).toBeCloseTo((0.75 + 0.5) / 2 - 0.5, 9);
    expect(calibrationPairs(scores, { views: [3] }).n).toBe(1);
    expect(calibrationPairs(scores, {}).n).toBe(scores.length);
    const none: FreezeItemScore[] = [];
    expect(calibrationPairs(none)).toEqual({ pairs: [], n: 0, meanConfidence: null, proportionCorrect: null, brier: null, overUnderGap: null });
  });
});

describe("replayed freezes (final fix pass, 8 Oct 2026)", () => {
  const resumed = (cycleReplayed: number, resumedAt?: "view" | "hinge" | "briefing"): TelemetryEvent =>
    ({ kind: "session_resumed", detail: { resumeCount: 1, intervalSinceInterruptionMs: 1000, cycleReplayed: cycleReplayed as 2, ...(resumedAt ? { resumedAt } : {}) } });

  it("keeps the first answer to each (view, item): a second freeze_submitted of the same view does not count", async () => {
    const records = await buildLog([
      [1_000, { kind: "freeze_submitted", detail: { cycle: 3, responses: [answer("v3.l2", "c", 25)] } }],
      [2_000, { kind: "freeze_submitted", detail: { cycle: 3, responses: [answer("v3.l2", "a", 100)] } }],
    ]);
    const scores = freezeItemScores(records, FREEZES);
    expect(scores).toHaveLength(1);
    expect(scores[0]).toMatchObject({ correct: true, confidence: 25 });
  });

  it("drops a view replayed after session_resumed from the scores, the projection reliance, the calibration and the exposure; others stay", async () => {
    const freezes: FreezeContentLike[] = [
      { cycle: 2, items: [choice("a.2", "L2", "a", { keyAtomIds: ["atom.x"] })] },
      { cycle: 3, items: [choice("a.3", "L2", "a", { keyAtomIds: ["atom.x"] }), mapItem("m.3", "L3", { projectionPoint: NORTH_100M })] },
    ];
    const records = await buildLog([
      [1_000, { kind: "bubble_available", detail: { atomId: "atom.x", mapPosition: null, tier: "T1_pushed", sourceId: "u" } }],
      [2_000, { kind: "freeze_submitted", detail: { cycle: 2, responses: [answer("a.2", "a", 50)] } }],
      [3_000, resumed(3, "view")],
      [4_000, { kind: "freeze_submitted", detail: { cycle: 3, responses: [answer("a.3", "a", 75), answer("m.3", "map_point", 50, { point: NORTH_100M })] } }],
    ]);
    expect(freezeItemScores(records, freezes).map((s) => s.itemId)).toEqual(["a.2"]);
    expect(freezeItemExposure(records, freezes).map((e) => e.itemId)).toEqual(["a.2"]);
    expect(projectionReliance(records, freezes)).toEqual([]);
    expect(calibrationPairs(freezeItemScores(records, freezes), {}).n).toBe(1);
    // The sensitivity analysis can keep them.
    expect(freezeItemScores(records, freezes, { includeReplayed: true }).map((s) => s.itemId)).toEqual(["a.2", "a.3", "m.3"]);
    expect(projectionReliance(records, freezes, { includeReplayed: true })).toHaveLength(1);
    expect([...replayedViews(records)]).toEqual([3]);
  });

  it("a resume into the hinge or the briefing replays no view", async () => {
    const records = await buildLog([[1_000, resumed(8, "hinge")], [2_000, resumed(0, "briefing")]]);
    expect(replayedViews(records).size).toBe(0);
    expect([...replayedViews(await buildLog([[1_000, resumed(5)]]))]).toEqual([5]); // no resumedAt: older logs
  });

  it("calibrationPairs keeps one pair per (view, item) even from scores assembled elsewhere", () => {
    const s: FreezeItemScore = { view: 2, itemId: "x", level: "L2", goal: null, kind: "choice", correct: true, distanceM: null, confidence: 75, source: null };
    expect(calibrationPairs([s, { ...s, correct: false }], {}).n).toBe(1);
  });
});

describe("atomExposure (final fix pass, 8 Oct 2026)", () => {
  it("says, for any atoms, which routes had delivered them before a given record", async () => {
    const records = await sessionLog();
    const at = (ms: number) => records.find((r) => r.tWallOffsetMs === ms)!.seq as number;
    const e = atomExposure(records, ["atom.bubble", "atom.haku", "atom.thinker-late", "atom.none"], at(10_000));
    expect(e.map((x) => [x.atomId, x.reached, x.routes, x.msBeforeFreeze])).toEqual([
      ["atom.bubble", true, ["bubble", "haku"], 9_000], ["atom.haku", true, ["haku"], 5_000], ["atom.thinker-late", false, [], null], ["atom.none", false, [], null],
    ]);
    // Later, the Open Thinker's answer has delivered the late atom.
    expect(atomExposure(records, ["atom.thinker-late"], at(20_000))[0]).toMatchObject({ reached: true, route: "thinker" });
    expect(atomExposure(records, ["atom.bubble"], 999_999)[0]).toMatchObject({ reached: true, msBeforeFreeze: null }); // no such record: no anchor time
  });
});

describe("answerRelaysAtom — a screening aid, not a code", () => {
  const atom = "DR2 tiehavainto: tie R2 Rahkasuon itäpuolella, palo noin 380 m tiestä — tie ajettavissa, ei savua tiellä.";
  it("is true when the answer carries the atom's quantity and a name", () => {
    expect(answerRelaysAtom("DR2 raportoi, että palo on noin 380 m päässä R2-tiestä.", atom)).toMatchObject({ relays: true });
    expect(answerRelaysAtom("The fire is about 380 m from R2 according to DR2.", atom).relays).toBe(true);
  });
  it("is false when the quantity is missing or wrong, or no name appears", () => {
    expect(answerRelaysAtom("DR2 raportoi palon etenevän kohti R2:ta.", atom).relays).toBe(false);
    expect(answerRelaysAtom("DR2 raportoi, että palo on noin 800 m päässä R2-tiestä.", atom).relays).toBe(false);
    expect(answerRelaysAtom("Palo on 380 m päässä.", atom).relays).toBe(false);
  });
  it("normalises decimal commas and clock times, and handles an atom with names only", () => {
    expect(answerRelaysAtom("DR2 mukaan pinta-ala oli 0.8 ha klo 17:25", "DR2 lämpökuva klo 17.25: noin 0,8 ha, liekit 0,3–1 m.").relays).toBe(true);
    const names = "EK16 vetäytyy tielle R2 Rahkasuon kaakkoispuolelle (palo ylitti metsäautotien).";
    expect(answerRelaysAtom("EK16 withdrew to R2 after the fire crossed.", names).relays).toBe(true);
    expect(answerRelaysAtom("EK16 jäi paikalleen.", names).relays).toBe(false);
  });
  it("is deterministic and reports the phrases", () => {
    const a = answerRelaysAtom("380 m, R2, DR2", atom), b = answerRelaysAtom("380 m, R2, DR2", atom);
    expect(a).toEqual(b);
    expect(a.phrases).toEqual(expect.arrayContaining(["380m", "dr2", "r2"]));
  });
});

describe("plantedFalseValueHeld (F7, V12)", () => {
  it("reads the V12 F7 answer: held when the planted option was chosen, with the confidence; null when not answered or the view was replayed", async () => {
    const held = await buildLog([[1_000, { kind: "freeze_submitted", detail: { cycle: 12, responses: [answer("freeze.12.f7", "de_energised", 100)] } }]]);
    expect(plantedFalseValueHeld(held)).toEqual({ view: 12, itemId: "freeze.12.f7", held: true, confidence: 100 });
    const live = await buildLog([[1_000, { kind: "freeze_submitted", detail: { cycle: 12, responses: [answer("freeze.12.f7", "live", 50)] } }]]);
    expect(plantedFalseValueHeld(live)).toMatchObject({ held: false, confidence: 50 });
    expect(plantedFalseValueHeld(await buildLog([]))).toBeNull();
    const replayed = await buildLog([
      [1_000, { kind: "session_resumed", detail: { resumeCount: 1, intervalSinceInterruptionMs: 1, cycleReplayed: 12, resumedAt: "view" } }],
      [2_000, { kind: "freeze_submitted", detail: { cycle: 12, responses: [answer("freeze.12.f7", "de_energised", 100)] } }],
    ]);
    expect(plantedFalseValueHeld(replayed)).toBeNull();
  });

  it("is scored for H9 only (play-test D6, 24 Oct 2026): marked out of the SA composites, which calibrationPairs drops; H9 still reads it", async () => {
    const f7 = choice("freeze.12.f7", "L2", "live", { scoredFor: "h9_only" });
    const freezes: readonly FreezeContentLike[] = [{ cycle: 12, items: [{ ...f7, options: ["live", "de_energised"].map((o) => ({ id: o, labelFi: o, correct: o === "live" })) }, choice("v12.l2", "L2", "a")] }];
    const records = await buildLog([[1_000, { kind: "freeze_submitted", detail: { cycle: 12, responses: [answer("freeze.12.f7", "live", 100), answer("v12.l2", "b", 50)] } }]]);
    const scores = freezeItemScores(records, freezes);
    expect(scores.map((s) => [s.itemId, s.correct, s.inSaComposites])).toEqual([["freeze.12.f7", true, false], ["v12.l2", false, undefined]]);
    const all = calibrationPairs(scores, {});
    expect(all.pairs.map((p) => p.itemId)).toEqual(["v12.l2"]);
    expect(all.proportionCorrect).toBe(0);
    expect(plantedFalseValueHeld(records)).toMatchObject({ itemId: "freeze.12.f7", held: false, confidence: 100 });
  });
});

describe("plantedExposure (fix pass 6, H9): the planted record, and the grid operator's contradicting record, met before the V12 freeze", () => {
  const bubble = (atomId: string): TelemetryEvent => ({ kind: "bubble_available", detail: { atomId, mapPosition: null, tier: "T1_pushed", sourceId: "u" } });
  const freezeStarted = (cycle: number): TelemetryEvent => ({ kind: "freeze_started", detail: { cycle: cycle as 12, atViewSeconds: 100, decisionCommittedBeforeFreeze: false, decisionStep: "x" } });

  it("exports the atom ids of the two records", () => {
    expect(F7_PLANTED_ATOM_ID).toBe("f7.planted_record");
    expect(F7_GRID_ATOM_ID).toBe("f7.grid_record");
  });

  it("separates planted only, planted and grid, and what arrives after the freeze does not count", async () => {
    const both = await buildLog([[1_000, bubble(F7_GRID_ATOM_ID)], [2_000, bubble(F7_PLANTED_ATOM_ID)], [3_000, freezeStarted(12)]]);
    expect(plantedExposure(both)).toMatchObject({ view: 12, metPlanted: true, metGrid: true, exposure: "planted_and_grid" });
    const plantedOnly = await buildLog([[2_000, bubble(F7_PLANTED_ATOM_ID)], [3_000, freezeStarted(12)], [4_000, bubble(F7_GRID_ATOM_ID)]]);
    expect(plantedExposure(plantedOnly)).toMatchObject({ metPlanted: true, metGrid: false, exposure: "planted_only" });
    const gridOnly = await buildLog([[1_000, bubble(F7_GRID_ATOM_ID)], [3_000, freezeStarted(12)]]);
    expect(plantedExposure(gridOnly)).toMatchObject({ exposure: "grid_only" });
    const neither = await buildLog([[3_000, freezeStarted(12)]]);
    expect(plantedExposure(neither)).toMatchObject({ metPlanted: false, metGrid: false, exposure: "neither" });
  });

  it("is null when the V12 freeze was never shown", async () => {
    expect(plantedExposure(await buildLog([[1_000, bubble(F7_PLANTED_ATOM_ID)], [2_000, freezeStarted(10)]]))).toBeNull();
  });
});

describe("SPEC/31 §3.6 and §3.9: the model's context as exposure (format 0.11.0), and the error-class fold", () => {
  const digestAnswer = (withIds: boolean, fallback = false, digest: readonly string[] = ["atom.basis"], recent: readonly string[] = ["atom.recent"]): TelemetryEvent => ({
    kind: "ai_chat_answer_received",
    detail: {
      ...thinkerAnswer(5, ["atom.retrieved"]), queryId: fallback ? "ai_open.2" : "ai_open.1", tool: "open_thinker", fallback, fallbackReason: fallback ? "timeout" : null,
      answer: { vastaus: fallback ? "" : "Edessä on tiheä kuusikko. Mökit ovat suolla.", perusteet: "", varmuus: "", muuttaisi: "" },
      ...(withIds ? { digestAtomIds: digest, recentAtomIds: recent } : {}),
    },
  });
  const statedItem = choice("v5.l2.stated", "L2", "a", { keyStatements: { fi: ["kuusikko"], en: [] } });
  const lureItem = { ...choice("v5.l2.lure", "L2", "a"), lureStatements: [{ optionId: "b", fi: ["suolla"], en: [] }] };
  const V5: FreezeContentLike = {
    cycle: 5,
    items: [
      { ...choice("v5.l3.record", "L3", "a"), basisKind: "record", basisAtomIds: ["atom.basis"] },
      { ...choice("v5.l3.map", "L3", "a"), basisKind: "map" },
      { ...choice("v5.l3.knowledge", "L3", "a"), basisKind: "knowledge" },
      choice("v5.l3.none", "L3", "a"),
      choice("v5.l2.key", "L2", "a", { keyAtomIds: ["atom.recent"] }),
      choice("v5.l2.correct", "L2", "a"),
      statedItem, lureItem,
      { ...choice("v5.l3.fallback", "L3", "a"), basisKind: "record", basisAtomIds: ["atom.fallback"] },
    ],
  };
  const responses = V5.items.map((it) => answer(it.id, it.id === "v5.l2.correct" ? "a" : "b", 75));
  const session = (withIds: boolean) => buildLog([
    [1_000, { kind: "cycle_start", detail: { cycle: 5 as never, phase: "A", clockLabel: "x" } }],
    [2_000, digestAnswer(withIds)],
    [3_000, digestAnswer(withIds, true, ["atom.fallback"], ["atom.fallback"])], // a fallback: nothing reached a shown answer
    [4_000, { kind: "freeze_started", detail: { cycle: 5 as never, atViewSeconds: 60, decisionCommittedBeforeFreeze: false, decisionStep: "x" } }],
    [9_000, { kind: "freeze_submitted", detail: { cycle: 5 as never, responses } }],
  ]);

  it("counts the digest and the recent matches as routes (not on a fallback answer); `includeModelContext: false` is the retrieved-only sensitivity", async () => {
    const records = await session(true);
    const [basis, recent, fallback, retrieved] = atomExposure(records, ["atom.basis", "atom.recent", "atom.fallback", "atom.retrieved"], 4);
    expect([basis!.routes, recent!.routes, fallback!.reached, retrieved!.routes]).toEqual([["digest"], ["recent"], false, ["thinker"]]);
    expect(atomExposure(records, ["atom.basis"], 4, { includeModelContext: false })[0]!.reached).toBe(false);
    const key = (opts = {}) => freezeItemExposure(records, [V5], opts).find((e) => e.itemId === "v5.l2.key")!.allReached;
    expect([key(), key({ includeModelContext: false })]).toEqual([true, false]);
    const old = await session(false); // a log before 0.11.0: no ids; it still parses and scores
    expect(freezeItemExposure(old, [V5]).find((e) => e.itemId === "v5.l2.key")!.allReached).toBe(false);
    expect(freezeItemScores(old, [V5])).toHaveLength(V5.items.length);
  });

  it("H9's plantedExposure uses the same definition: the guide's digest carrying the planted record counts; retrieved-only does not", async () => {
    const records = await buildLog([
      [1_000, { kind: "ai_chat_answer_received", detail: { ...thinkerAnswer(12, []), tool: "open_thinker", digestAtomIds: [F7_PLANTED_ATOM_ID], recentAtomIds: [] } }],
      [2_000, { kind: "freeze_started", detail: { cycle: 12 as never, atViewSeconds: 100, decisionCommittedBeforeFreeze: false, decisionStep: "x" } }],
    ]);
    expect(plantedExposure(records)).toMatchObject({ exposure: "planted_only", planted: { routes: ["digest"] } });
    expect(plantedExposure(records, 12, { includeModelContext: false })).toMatchObject({ exposure: "neither" });
  });

  it("folds every scored item into one class, seq-anchored and route-aware: with the digest ids, and on an old log without them", async () => {
    const classes = async (withIds: boolean, opts = {}) => new Map(errorClasses(await session(withIds), [V5], opts).map((r) => [r.itemId, r.errorClass]));
    const withDigest = new Map([
      ["v5.l3.record", "EXPOSED_WRONG"], ["v5.l3.map", "EXPOSED_WRONG"], ["v5.l3.knowledge", "NOT_APPLICABLE"], ["v5.l3.none", "NOT_APPLICABLE"],
      ["v5.l2.key", "EXPOSED_WRONG"], ["v5.l2.correct", "CORRECT"], ["v5.l2.stated", "STATED_WRONG"], ["v5.l2.lure", "STATED_LURE"], ["v5.l3.fallback", "NOT_EXPOSED"],
    ]);
    expect(await classes(true)).toEqual(withDigest);
    const notExposed = new Map([...withDigest, ["v5.l3.record", "NOT_EXPOSED"], ["v5.l2.key", "NOT_EXPOSED"]]);
    expect(await classes(false)).toEqual(notExposed); // the old log undercounts the guide's exposure (parity P-2)
    expect(await classes(true, { includeModelContext: false })).toEqual(notExposed);
    const rows = errorClasses(await session(true), [V5]);
    expect(rows.find((r) => r.itemId === "v5.l3.record")).toMatchObject({ basisKind: "record", basisAtomIds: ["atom.basis"], exposed: true, routes: ["digest"] });
    expect(rows.find((r) => r.itemId === "v5.l2.lure")).toMatchObject({ stated: false, statedLure: true, optionId: "b" });
    expect(errorClassCounts(rows)).toEqual([
      { errorClass: "CORRECT", n: 1 }, { errorClass: "STATED_LURE", n: 1 }, { errorClass: "STATED_WRONG", n: 1 },
      { errorClass: "NOT_APPLICABLE", n: 2 }, { errorClass: "EXPOSED_WRONG", n: 3 }, { errorClass: "NOT_EXPOSED", n: 1 },
    ]);
  });

  it("reads items with key records conditional on exposure (sagat F30)", async () => {
    const rows = exposureConditionalScores(await session(true), [V5]);
    expect(rows.map((r) => [r.itemId, r.correct, r.allReached, r.routes])).toEqual([["v5.l2.key", false, true, ["recent"]]]);
    expect(exposureConditionalScores(await session(true), [V5], { includeModelContext: false })[0]!.allReached).toBe(false);
  });
});
