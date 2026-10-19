/**
 * Paper 1's teaming measures (SPEC/30 §6): H2's per-participant overconfidence gap over the window the content defines
 * (no count assumed), H2t's split by `aiStatedKey`, and H-T's hand-over index (team SPAM L2/L3 accuracy − own freeze
 * L2/L3 accuracy, phase A). Hand-built logs and content.
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import type { FreezeItem } from "../../app/scenario/types.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { freezeItemScores, H2_PRIMARY_WINDOW, type FreezeContentLike, type FreezeItemScore } from "../../app/telemetry/freeze-measures.js";
import type { AiStatedKey } from "../../app/telemetry/ai-stated-key.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import { h2tSplit, handOverIndex, isSecondSpamItem, overconfidenceGap } from "../../app/telemetry/teaming-measures.js";

const HEADER: LogHeader = {
  formatVersion: "0.10.0", sessionId: "teaming", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "radio", echelon: "command",
};

async function buildLog(events: readonly TelemetryEvent[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  let t = 0;
  for (const e of events) await appendTelemetryEvent(log, asVirtualTime(0), (t += 1000), e);
  return log.readAll();
}

const score = (view: number, itemId: string, level: FreezeItem["level"], confidence: number, correct: boolean): FreezeItemScore =>
  ({ view, itemId, level, goal: null, kind: "choice", correct, distanceM: null, confidence, source: null });

/** A phase-A window as SPEC/30 §5.1 builds it: 6 L2/L3 items in each of V2, V4, V5, V7 (and L1 items, left out). */
function phaseAScores(): FreezeItemScore[] {
  const out: FreezeItemScore[] = [];
  for (const view of [2, 4, 5, 7]) {
    out.push(score(view, `v${view}.l1a`, "L1", 100, true), score(view, `v${view}.l1b`, "L1", 100, true));
    for (let i = 0; i < 6; i++) out.push(score(view, `v${view}.x${i}`, i < 2 ? "L2" : "L3", 75, i % 2 === 0)); // half right at 75
  }
  out.push(score(3, "v3.l2", "L2", 25, false), score(10, "v10.l3", "L3", 25, false)); // outside the window
  return out;
}

const stated = (view: number, itemId: string, s: boolean, rules: AiStatedKey["rules"] = ["band"]): AiStatedKey => ({
  view, itemId, level: "L3", stated: s, firstStatedSeq: s ? 1 : null, statedInView: s ? view : null, tool: s ? "thinker" : null,
  matchedBy: s ? rules[0] ?? null : null, matchedText: s ? "x" : null, rules, freezeStartedSeq: 2,
});

describe("H2: the overconfidence gap", () => {
  it("is mean confidence − proportion correct over every L2/L3 item of the V2, V4, V5, V7 freezes the content has (24 here)", () => {
    expect(H2_PRIMARY_WINDOW).toEqual({ levels: ["L2", "L3"], views: [2, 4, 5, 7] });
    expect(overconfidenceGap(phaseAScores())).toEqual({ n: 24, meanConfidence: 75, proportionCorrect: 0.5, gap: 0.25 });
    expect(overconfidenceGap(phaseAScores().filter((s) => s.view !== 7)).n).toBe(18); // counted, not assumed
    expect(overconfidenceGap([])).toEqual({ n: 0, meanConfidence: null, proportionCorrect: null, gap: null });
  });
});

describe("H2t: own versus borrowed", () => {
  it("splits the window's pairs and gap by aiStatedKey; out-of-window and unmatched items are not in either", () => {
    const scores = phaseAScores();
    const keys = scores.filter((s) => s.level !== "L1" && [2, 4, 5, 7].includes(s.view))
      .map((s) => stated(s.view, s.itemId, s.view === 2 && s.correct)); // the AI stated V2's three right answers
    keys.pop(); // V7's last item has no row
    const split = h2tSplit(scores, keys);
    expect(split.stated.n).toBe(3);
    expect(split.statedGap).toEqual({ n: 3, meanConfidence: 75, proportionCorrect: 1, gap: -0.25 });
    expect(split.notStated.n).toBe(20);
    expect(split.notStatedGap.proportionCorrect).toBeCloseTo(9 / 20, 10);
    expect(split.unscreened).toEqual([{ view: 7, itemId: "v7.x5" }]);
  });

  it("counts an unscreenable item as not stated, or drops it as a sensitivity", () => {
    const scores = [score(2, "map", "L3", 100, false), score(2, "choice", "L3", 50, true)];
    const keys = [stated(2, "map", false, []), stated(2, "choice", false)];
    expect(h2tSplit(scores, keys).notStated.n).toBe(2);
    const dropped = h2tSplit(scores, keys, { dropUnscreenable: true });
    expect([dropped.notStated.n, dropped.unscreened]).toEqual([1, [{ view: 2, itemId: "map" }]]);
  });
});

describe("H-T: the hand-over index", () => {
  const start = (cycle: number, phase: "A" | "B"): TelemetryEvent => ({ kind: "cycle_start", detail: { cycle: cycle as never, phase, clockLabel: "x" } });
  const spam = (probeId: string, response: string | null): TelemetryEvent => ({ kind: "spam_answered", detail: { probeId, response, timedOut: response === null } });
  const choice = (id: string, level: FreezeItem["level"]): FreezeItem => ({ id, level, promptFi: id, options: [{ id: "a", labelFi: "a", correct: true }, { id: "b", labelFi: "b", correct: false }] });
  const FREEZES: readonly FreezeContentLike[] = [
    { cycle: 2, items: [choice("f2.l1", "L1"), choice("f2.l2", "L2"), choice("f2.l3", "L3")] },
    { cycle: 4, items: [choice("f4.l3", "L3")] },
  ];
  const KEYS = new Map([["probe.s.cycle_3", "a"], ["probe.s.cycle_3.b", "c"], ["probe.s.cycle_6.b", "d"], ["probe.s.cycle_8.b", "a"]]);

  it("is team accuracy on phase A's second SPAM items minus own accuracy on phase A's freeze L2/L3 items", async () => {
    const records = await buildLog([
      start(2, "A"),
      { kind: "freeze_submitted", detail: { cycle: 2, responses: [{ itemId: "f2.l1", optionId: "b", confidence: 50 }, { itemId: "f2.l2", optionId: "a", confidence: 50 }, { itemId: "f2.l3", optionId: "b", confidence: 50 }] } },
      start(3, "A"), spam("probe.s.cycle_3", "a"), spam("probe.s.cycle_3.b", "c"),
      start(4, "A"), { kind: "freeze_submitted", detail: { cycle: 4, responses: [{ itemId: "f4.l3", optionId: "a", confidence: 75 }] } },
      start(6, "A"), spam("probe.s.cycle_6", "a"), spam("probe.s.cycle_6.b", null), // timed out: missing, not wrong
      start(8, "B"), spam("probe.s.cycle_8.b", "b"), // phase B: not a team item
    ]);
    const h = handOverIndex(records, FREEZES, KEYS);
    expect(h.team).toEqual([
      { probeId: "probe.s.cycle_3.b", view: 3, response: "c", correct: true },
      { probeId: "probe.s.cycle_6.b", view: 6, response: null, correct: null },
    ]);
    expect([h.teamN, h.teamAccuracy, h.ownN, h.ownAccuracy]).toEqual([1, 1, 3, 2 / 3]);
    expect(h.index).toBeCloseTo(1 / 3, 10);
    expect(freezeItemScores(records, FREEZES)).toHaveLength(4); // L1 scored, left out of the own window
  });

  it("is null without a team answer; the team items can be named by the analysis", async () => {
    const records = await buildLog([start(3, "A"), spam("probe.s.cycle_3", "a")]);
    expect(handOverIndex(records, FREEZES, KEYS).index).toBeNull();
    const named = handOverIndex(records, FREEZES, KEYS, { isTeamItem: (id) => id === "probe.s.cycle_3" });
    expect([named.teamN, named.teamAccuracy, named.ownN, named.index]).toEqual([1, 1, 0, null]);
    expect(isSecondSpamItem("probe.s.cycle_6.b", "A")).toBe(true);
    expect(isSecondSpamItem("probe.s.cycle_6", "A")).toBe(false);
    expect(isSecondSpamItem("probe.s.cycle_8.b", "B")).toBe(false);
  });
});
