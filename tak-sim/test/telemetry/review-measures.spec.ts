/**
 * SPEC/32 §3–§4: the plan before and after the review at commitment, and the departure (SDT) coding, over synthetic logs with the
 * real directive keys (V9, V10, V14 no-fit; V11–V13 fit).
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { DIRECTIVE_KEYS } from "../../app/scenario/demo-directive.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import { reviewMeasures, reviewSignalDetection } from "../../app/telemetry/review-measures.js";

const HEADER: LogHeader = {
  formatVersion: "0.12.0", sessionId: "review", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "reasoning_intent", echelon: "command",
};

async function buildLog(events: readonly (readonly [number, TelemetryEvent])[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (const [t, e] of events) await appendTelemetryEvent(log, asVirtualTime(0), t, e);
  return log.readAll();
}

type Posture = "direct_attack" | "barrier_line" | "protect_values";
const start = (cycle: number): TelemetryEvent => ({ kind: "cycle_start", detail: { cycle: cycle as never, phase: cycle <= 7 ? "A" : "B", clockLabel: "x" } });
const submit = (posture: Posture, mainEffort = "L3"): TelemetryEvent => ({ kind: "allocation_submitted", detail: { plan: { mainEffort, posture, secondary: null, drones: null }, rationaleAsked: false, rationaleFi: null } });
const revise = (cycle: number, posture: Posture, mainEffort = "L3"): TelemetryEvent => ({ kind: "allocation_revised", detail: { cycle: cycle as never, revision: 1, plan: { mainEffort, posture, secondary: null, drones: null } } });
const shown = (cycle: number, contradicted: boolean): TelemetryEvent => ({
  kind: "plan_review_shown",
  detail: {
    cycle: cycle as never, atViewSeconds: 90, trigger: "minimum_reached", premiseLines: ["line"], tableSha256: "t",
    premiseStatuses: [{ premiseId: "P1", status: contradicted ? "contradicted" : "not_contradicted", atomIds: contradicted ? ["atom.x"] : [] }],
  },
});
const opened = (cycle: number): TelemetryEvent => ({ kind: "plan_review_record_opened", detail: { cycle: cycle as never, atomId: "atom.x" } });
const closed = (cycle: number, choice: "keep" | "revise" | "time_cap", dwellMs: number): TelemetryEvent => ({ kind: "plan_review_closed", detail: { cycle: cycle as never, choice, dwellMs } });

describe("reviewMeasures (SPEC/32 §3)", () => {
  it("codes the plan before and after the review: keep, revise to C, no review, and a fit-view departure", async () => {
    const records = await buildLog([
      [0, start(8)], [1, submit("barrier_line")], // V8: not keyed for Paper 2
      // V9 keep: B before and after, the cited record not opened
      [10, start(9)], [11, submit("barrier_line")], [12, shown(9, true)], [13, closed(9, "keep", 4_000)],
      // V10 revise to C: B → C, the cited record opened before the revision
      [20, start(10)], [21, submit("barrier_line")], [22, shown(10, true)], [23, opened(10)], [24, closed(10, "revise", 6_000)], [25, revise(10, "direct_attack")],
      // V11 (fit): a direct attack, no review shown → D, a false alarm
      [30, start(11)], [31, submit("direct_attack")],
      // V14 (no fit), no review: B, not departed
      [40, start(14)], [41, submit("barrier_line")],
    ]);
    const m = reviewMeasures(records, DIRECTIVE_KEYS);
    expect(m.map((v) => v.view)).toEqual([9, 10, 11, 14]);
    const [v9, v10, v11, v14] = m as [typeof m[0], typeof m[0], typeof m[0], typeof m[0]];

    expect(v9).toMatchObject({
      fit: false, reviewShown: true, trigger: "minimum_reached", reviewChoice: "keep", reviewDwellMs: 4_000, revisedAtReview: false,
      citedRecordOpened: false, premiseFlagShown: true, cellBefore: "B", cellFinal: "B", alignedBefore: 1, alignedFinal: 1, departed: false, movedToCAtReview: false,
    });
    expect(v10).toMatchObject({
      fit: false, reviewShown: true, reviewChoice: "revise", reviewDwellMs: 6_000, revisedAtReview: true, citedRecordOpened: true,
      cellBefore: "B", cellFinal: "C", alignedBefore: 1, alignedFinal: 0, departed: true, movedToCAtReview: true,
    });
    expect(v10.beforeReview!.seq).toBeLessThan(v10.final!.seq);
    expect(v11).toMatchObject({ fit: true, reviewShown: false, beforeReview: null, cellBefore: null, cellFinal: "D", alignedFinal: 0, departed: true, citedRecordOpened: false, reviewDwellMs: null });
    expect(v14).toMatchObject({ fit: false, reviewShown: false, cellFinal: "B", departed: false });

    expect(reviewSignalDetection(m)).toEqual({ noFitCoded: 3, hits: 1, hitRate: 1 / 3, fitCoded: 1, falseAlarms: 1, falseAlarmRate: 1 });
  });

  it("a revise choice with no revision recorded is not revisedAtReview; a view with no plan has null codings and is not counted", async () => {
    const records = await buildLog([
      [0, start(12)], [1, submit("barrier_line")], [2, shown(12, false)], [3, closed(12, "revise", 2_000)],
      [10, start(13)],
    ]);
    const [v12, v13] = reviewMeasures(records, DIRECTIVE_KEYS);
    expect(v12).toMatchObject({ view: 12, fit: true, revisedAtReview: false, premiseFlagShown: false, reviewChoice: "revise" });
    expect(v13).toMatchObject({ view: 13, final: null, departed: null, reviewShown: false });
    const sdt = reviewSignalDetection([v12!, v13!]);
    expect(sdt.fitCoded).toBe(1);
    expect(sdt.noFitCoded).toBe(0);
    expect(sdt.hitRate).toBeNull();
  });

  it("reads a replayed view's last attempt and a review record of another view does not count", async () => {
    const records = await buildLog([
      [0, start(9)], [1, submit("barrier_line")], [2, shown(9, true)], [3, closed(9, "keep", 1_000)],
      [4, { kind: "session_resumed", detail: { resumeCount: 1, intervalSinceInterruptionMs: 1000, cycleReplayed: 9 as never, resumedAt: "view" } }],
      [5, start(9)], [6, submit("direct_attack")], [7, opened(8)],
    ]);
    const [v9] = reviewMeasures(records, DIRECTIVE_KEYS);
    expect(v9).toMatchObject({ reviewShown: false, citedRecordOpened: false, cellFinal: "C", departed: true, reviewChoice: null });
  });

  it("departed is null when the key carries no fit", async () => {
    const records = await buildLog([[0, start(9)], [1, submit("direct_attack")]]);
    const { fit: _fit, ...noFit } = DIRECTIVE_KEYS[9]!;
    const [v9] = reviewMeasures(records, { 9: noFit });
    expect(v9).toMatchObject({ fit: null, cellFinal: "C", departed: null, alignedFinal: null });
  });
});
