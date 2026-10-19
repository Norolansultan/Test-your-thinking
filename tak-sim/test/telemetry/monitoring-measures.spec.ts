/**
 * SPEC/30 §4, §5.4, §6: H18's plan-confidence pairs (the value against the plan's Paper 2 coding, the keys passed in)
 * and their calibration; the consult notice's exposure per view (shown, opened, the delay, the queries after it).
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { DIRECTIVE_KEYS } from "../../app/scenario/demo-directive.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import { consultExposure, planCalibration, planConfidencePairs } from "../../app/telemetry/monitoring-measures.js";

const HEADER: LogHeader = {
  formatVersion: "0.10.0", sessionId: "monitoring", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "reasoning_intent", echelon: "command",
};

/** Each event at its own wall time (ms). */
async function buildLog(events: readonly (readonly [number, TelemetryEvent])[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (const [t, e] of events) await appendTelemetryEvent(log, asVirtualTime(0), t, e);
  return log.readAll();
}
type Posture = "direct_attack" | "barrier_line" | "protect_values";
const start = (cycle: number): TelemetryEvent => ({ kind: "cycle_start", detail: { cycle: cycle as never, phase: cycle <= 7 ? "A" : "B", clockLabel: "x" } });
const submit = (posture: Posture, mainEffort = "L3"): TelemetryEvent => ({ kind: "allocation_submitted", detail: { plan: { mainEffort, posture, secondary: null, drones: null }, rationaleAsked: false, rationaleFi: null } });
const rate = (cycle: number, value: number): TelemetryEvent => ({ kind: "plan_confidence_submitted", detail: { cycle: cycle as never, value } });

describe("H18: plan confidence against the plan's correctness", () => {
  it("pairs each keyed view's confidence with its plan's soundness (A and C correct, B and D not); V8 and phase A are not keyed", async () => {
    const records = await buildLog([
      [0, start(7)], [1, submit("direct_attack")], [2, rate(7, 100)],
      [10, start(8)], [11, submit("barrier_line")], [12, rate(8, 50)],
      [20, start(9)], [21, submit("direct_attack")], [22, rate(9, 75)], // C
      [30, start(10)], [31, submit("barrier_line")], [32, rate(10, 100)], // B
      [40, start(11)], [41, submit("barrier_line")], [42, rate(11, 50)], // A
      [50, start(12)], [51, submit("direct_attack")], // D, no confidence given
      [60, start(13)], [61, rate(13, 25)], // no plan
    ]);
    const pairs = planConfidencePairs(records, DIRECTIVE_KEYS);
    expect(pairs.map((p) => [p.view, p.confidence, p.cell, p.correct])).toEqual([
      [9, 75, "C", true], [10, 100, "B", false], [11, 50, "A", true], [12, null, "D", false], [13, 25, null, null],
    ]);
    const c = planCalibration(pairs);
    expect(c.n).toBe(3);
    expect(c.meanConfidence).toBeCloseTo(75, 10);
    expect(c.proportionCorrect).toBeCloseTo(2 / 3, 10);
    expect(c.gap).toBeCloseTo(0.75 - 2 / 3, 10);
    expect(c.brier).toBeCloseTo((0.25 ** 2 + 1 + 0.5 ** 2) / 3, 10);
    expect(planCalibration([])).toEqual({ n: 0, meanConfidence: null, proportionCorrect: null, brier: null, gap: null });
  });

  it("takes a replayed view's last attempt and the confidence given in it", async () => {
    const records = await buildLog([
      [0, start(9)], [1, submit("barrier_line")], [2, rate(9, 100)],
      [3, { kind: "session_resumed", detail: { resumeCount: 1, intervalSinceInterruptionMs: 1000, cycleReplayed: 9 as never, resumedAt: "view" } }],
      [4, start(9)], [5, submit("direct_attack")], [6, rate(9, 50)],
    ]);
    expect(planConfidencePairs(records, DIRECTIVE_KEYS).map((p) => [p.view, p.confidence, p.cell])).toEqual([[9, 50, "C"]]);
  });
});

describe("the consult notice's exposure", () => {
  const shown = (cycle: number, tool: "haku" | "thinker", at = 60): TelemetryEvent => ({ kind: "consult_prompt_shown", detail: { cycle: cycle as never, atViewSeconds: at, tool } });
  const opened = (cycle: number, tool: "haku" | "thinker"): TelemetryEvent => ({ kind: "consult_prompt_opened", detail: { cycle: cycle as never, tool } });
  const dismissed = (cycle: number, cause: "participant" | "view_end"): TelemetryEvent => ({ kind: "consult_prompt_dismissed", detail: { cycle: cycle as never, tool: "thinker", cause } });
  const ask = (view: number, tool: "haku" | "open_thinker"): TelemetryEvent => ({ kind: "ai_chat_query_submitted", detail: { queryId: `${tool}.${view}`, text: "q", view, virtualTimeS: 0, phase: "decision", tool } });

  it("per main view: shown, opened and how soon, dismissed, and the queries before and after it", async () => {
    const records = await buildLog([
      [0, start(0)], [500, shown(0, "thinker")], // the practice view is not a main view
      [1_000, start(1)], [2_000, ask(1, "haku")], [61_000, shown(1, "thinker")], [64_500, opened(1, "thinker")], [70_000, ask(1, "open_thinker")], [80_000, ask(1, "haku")],
      [200_000, start(2)], [260_000, shown(2, "thinker", 75)], [300_000, ask(2, "haku")], [330_000, dismissed(2, "view_end")],
      [400_000, start(3)], [410_000, ask(3, "haku")],
    ]);
    expect(consultExposure(records)).toEqual([
      { view: 1, shown: true, tool: "thinker", atViewSeconds: 60, opened: true, openDelayMs: 3_500, dismissed: null,
        queriesBefore: 1, queriesAfter: 2, queriedAfter: true, firstQueryAfterMs: 9_000, firstQueryAfterTool: "thinker", queriedNamedTool: true },
      { view: 2, shown: true, tool: "thinker", atViewSeconds: 75, opened: false, openDelayMs: null, dismissed: "view_end",
        queriesBefore: 0, queriesAfter: 1, queriedAfter: true, firstQueryAfterMs: 40_000, firstQueryAfterTool: "haku", queriedNamedTool: false },
      { view: 3, shown: false, tool: null, atViewSeconds: null, opened: false, openDelayMs: null, dismissed: null,
        queriesBefore: 1, queriesAfter: 0, queriedAfter: false, firstQueryAfterMs: null, firstQueryAfterTool: null, queriedNamedTool: false },
    ]);
  });

  it("counts Haku's builder and free text as Haku, and a replayed view's last attempt", async () => {
    const records = await buildLog([
      [0, start(4)], [10, shown(4, "haku")], [20, opened(4, "haku")],
      [30, { kind: "session_resumed", detail: { resumeCount: 1, intervalSinceInterruptionMs: 1000, cycleReplayed: 4 as never, resumedAt: "view" } }],
      [40, start(4)], [50, shown(4, "haku")], [60, { kind: "nav_query_submitted", detail: { queryId: "nav.1", category: "c", sourceId: null, window: "latest", resultAtomIds: [], phase: "decision" } }],
    ]);
    expect(consultExposure(records)).toMatchObject([{ view: 4, shown: true, opened: false, queriesAfter: 1, firstQueryAfterMs: 10, queriedNamedTool: true }]);
  });
});
