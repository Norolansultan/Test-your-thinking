/**
 * The smaller analysis additions of the skills review (SPEC/31, WP-3): V13's area item as hits against false alarms (sagat F21), the
 * crossed keys scored per half (F32) on the hinge check's and V8's real options, the lure-acceptance index (proposal (b)), H18's plan
 * calibration under the act coding (§3.1), and the review packet's per-view `soundVia` (§3.2). Hand-built logs.
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { buildHingeCheck, SPAM_ITEMS, HINGE_CHECK_INVARIANT } from "../../app/scenario/demo-probes.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { CROSSED_ELEMENTS, crossedHalfScore, crossedKeyScores, crossedSpecOf } from "../../app/telemetry/crossed-keys.js";
import { lureAcceptance } from "../../app/telemetry/error-classes.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import { planCalibration, type PlanConfidencePair } from "../../app/telemetry/monitoring-measures.js";
import { uncertaintyMeasures } from "../../app/telemetry/probe-measures.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import { collectKeys } from "../../tools/review/export.js";

const HEADER: LogHeader = {
  formatVersion: "0.11.0", sessionId: "review", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "reasoning_intent", echelon: "command",
};

async function buildLog(events: readonly TelemetryEvent[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  let t = 0;
  for (const e of events) await appendTelemetryEvent(log, asVirtualTime(0), (t += 1000), e);
  return log.readAll();
}

describe("sagat F21: V13's area item as hits against false alarms", () => {
  const KEYS = { contradictionArea: { probeId: "probe.u.cycle_13", key: "north_edge" }, contradictionPair: null, coverage: null };
  const ORDER = ["weather", "north_edge", "units", "west", "south", "east", "other"];
  const area = async (response: unknown) => uncertaintyMeasures(await buildLog([
    { kind: "probe_presented", detail: { probeId: "probe.u.cycle_13", type: "U", mode: "PROBING_VISIBLE", optionIds: ORDER, cycle: 13, atViewSeconds: 100, decisionStep: null } },
    ...(response === undefined ? [] : [{ kind: "probe_submitted", detail: { probeId: "probe.u.cycle_13", response } } as TelemetryEvent]),
  ]), KEYS).area!;

  it("subtracts the share of noise parts chosen from the hit: choosing every part scores 0, the north edge alone 1, 'no' 0", async () => {
    expect(await area({ unsure: true, areas: ORDER, optionOrder: ORDER })).toMatchObject({ areaHit: true, falseAlarms: 6, falseAlarmRate: 1, hitMinusFalseAlarm: 0 });
    expect(await area({ unsure: true, areas: ["north_edge"], optionOrder: ORDER })).toMatchObject({ areaHit: true, falseAlarms: 0, hitMinusFalseAlarm: 1 });
    const two = await area({ unsure: true, areas: ["north_edge", "west"], optionOrder: ORDER });
    expect(two.hitMinusFalseAlarm).toBeCloseTo(1 - 1 / 6, 10);
    expect((await area({ unsure: true, areas: ["west", "east", "units"], optionOrder: ORDER })).hitMinusFalseAlarm).toBeCloseTo(-0.5, 10);
    expect(await area({ unsure: false, areas: [], optionOrder: ORDER })).toMatchObject({ areaHit: false, falseAlarms: 0, hitMinusFalseAlarm: 0 });
    expect(await area(undefined)).toMatchObject({ falseAlarms: null, falseAlarmRate: null, hitMinusFalseAlarm: null });
  });
});

describe("sagat F32: the crossed keys scored per half (the hinge check and V8's SPAM item, as built)", () => {
  const scenario = buildDemoScenario();
  const hinge = buildHingeCheck().item;
  const hingeKey = scenario.invariants.find((i) => i.name === HINGE_CHECK_INVARIANT)!.expected as string;
  const v8 = SPAM_ITEMS[8]!;
  const HINGE = crossedSpecOf("hinge", hinge.id, hinge.options, hingeKey, CROSSED_ELEMENTS.hinge);
  const V8 = crossedSpecOf("spam", "probe.s.cycle_8", v8.options.map((labelFi, i) => ({ id: "abcd"[i]!, labelFi })), v8.correct, CROSSED_ELEMENTS.spam_v8);

  it("covers every option of the two items as built, and the key holds both halves", () => {
    expect(crossedHalfScore(HINGE, hingeKey)).toMatchObject({ halves: ["line", "aim"], halfCorrect: [true, true], bothCorrect: true });
    expect(crossedHalfScore(V8, v8.correct)).toMatchObject({ halves: ["known", "requested"], halfCorrect: [true, true] });
    // Each half is right in exactly two of the four hinge options (the distractors cross the two).
    expect([0, 1].map((h) => HINGE.options.filter((o) => crossedHalfScore(HINGE, o.id)!.halfCorrect[h]).length)).toEqual([2, 2]);
    expect(() => crossedSpecOf("spam", "x", [{ id: "a", labelFi: "Uusi vaihtoehto" }], "a", CROSSED_ELEMENTS.spam_v8)).toThrow(/no elements/);
  });

  it("scores the first answers from the log; no answer or a timeout is null", async () => {
    const idOf = (spec: typeof HINGE, elements: readonly [string, string]) => spec.options.find((o) => o.elements[0] === elements[0] && o.elements[1] === elements[1])!.id;
    const records = await buildLog([
      { kind: "hinge_check_answered", detail: { itemId: hinge.id, optionId: idOf(HINGE, ["direct_attack", "villages"]) } },
      { kind: "spam_answered", detail: { probeId: "probe.s.cycle_8", response: idOf(V8, ["checked", "requested"]), timedOut: false } },
    ]);
    const [h, s] = crossedKeyScores(records, [HINGE, V8]);
    expect(h).toMatchObject({ halfCorrect: [false, true], bothCorrect: false }); // the right aim, the wrong line
    expect(s).toMatchObject({ halfCorrect: [false, true] }); // knew the check was asked for, thought it was done
    const none = await buildLog([{ kind: "spam_answered", detail: { probeId: "probe.s.cycle_8", response: null, timedOut: true } }]);
    expect(crossedKeyScores(none, [HINGE, V8])).toEqual([null, null]);
  });
});

describe("sagat proposal (b): the lure-acceptance index", () => {
  it("is the share of lure items answered with their lure: freeze items and SPAM probes, first answers, timeouts missing", async () => {
    const records = await buildLog([
      { kind: "cycle_start", detail: { cycle: 2 as never, phase: "A", clockLabel: "x" } },
      { kind: "freeze_submitted", detail: { cycle: 2 as never, responses: [{ itemId: "freeze.2.junction_hour", optionId: "m700_1000", confidence: 75 }, { itemId: "freeze.2.other", optionId: "a", confidence: 50 }] } },
      { kind: "cycle_start", detail: { cycle: 3 as never, phase: "A", clockLabel: "x" } },
      { kind: "spam_answered", detail: { probeId: "probe.s.cycle_3", response: "c", timedOut: false } },
      { kind: "spam_answered", detail: { probeId: "probe.s.cycle_3", response: "a", timedOut: false } }, // a second answer: not counted
      { kind: "cycle_start", detail: { cycle: 6 as never, phase: "A", clockLabel: "x" } },
      { kind: "spam_answered", detail: { probeId: "probe.s.cycle_6.b", response: null, timedOut: true } },
    ]);
    const out = lureAcceptance(records, [
      { probe: "freeze", view: 2, itemId: "freeze.2.junction_hour", lureOptionIds: ["m700_1000"] },
      { probe: "spam", view: null, itemId: "probe.s.cycle_3", lureOptionIds: ["a"] },
      { probe: "spam", view: null, itemId: "probe.s.cycle_6.b", lureOptionIds: ["b"] },
    ]);
    expect(out.items.map((i) => [i.itemId, i.view, i.acceptedLure])).toEqual([["freeze.2.junction_hour", 2, true], ["probe.s.cycle_3", 3, false]]);
    expect([out.n, out.accepted, out.index]).toEqual([2, 1, 0.5]);
    expect(lureAcceptance([], []).index).toBeNull();
  });
});

describe("SPEC/31 §3.1: H18's plan calibration can read the act coding", () => {
  it("uses `correctByAct` with `byAct`", () => {
    const pair = (correct: boolean, correctByAct: boolean): PlanConfidencePair => ({ view: 9, confidence: 100, confidenceSeq: 1, planSeq: 0, cell: correct ? "C" : "B", correct, correctWithBoundary: correct, correctByAct });
    const pairs = [pair(false, true), pair(true, true)];
    expect([planCalibration(pairs).proportionCorrect, planCalibration(pairs, { byAct: true }).proportionCorrect]).toEqual([0.5, 1]);
  });
});

describe("SPEC/31 §3.2: the review packet lists each view's soundVia", () => {
  it("names the routes in the directive rows: V9–V10 main effort and secondary, V11 main effort, phase A none", () => {
    const row = (v: number) => collectKeys().find((r) => r.id === `directive.${v}`)!;
    expect(row(9).keyFi).toMatch(/soundVia=main_effort\|secondary$/);
    expect(row(9).keyEn).toMatch(/^soundVia: main_effort \(direct_attack in L3\) \| secondary \(task\.direct-attack in L3, .*act coding: any of task\.direct-attack\/task\.mopup\/task\.hold-line on L3/);
    expect(row(11).keyFi).toMatch(/soundVia=main_effort$/);
    expect(row(3).keyFi).toMatch(/soundVia=—$/);
    expect(row(14).keyFi).toMatch(/soundVia=(main_effort\|)?secondary$/); // secondary alone once WP-1 empties V14's `sound` (§3.2)
  });
});
