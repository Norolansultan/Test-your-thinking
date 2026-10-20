/**
 * SPEC/32 §7: the lowest-confidence share — the share of first freeze answers given at confidence 25, overall and over L2/L3.
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import type { FreezeItem } from "../../app/scenario/types.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { LOWEST_CONFIDENCE, lowestConfidenceShare, type FreezeContentLike } from "../../app/telemetry/freeze-measures.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";

const HEADER: LogHeader = {
  formatVersion: "0.12.0", sessionId: "lowest", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "radio", echelon: "command",
};

async function buildLog(events: readonly (readonly [number, TelemetryEvent])[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (const [t, e] of events) await appendTelemetryEvent(log, asVirtualTime(0), t, e);
  return log.readAll();
}

const item = (id: string, level: FreezeItem["level"]): FreezeItem => ({ id, level, promptFi: id, options: [{ id: "a", labelFi: "a", correct: true }] });
const FREEZES: readonly FreezeContentLike[] = [
  { cycle: 2, items: [item("a1", "L1"), item("a2", "L2"), item("a3", "L3")] },
  { cycle: 4, items: [item("b1", "L1"), item("b2", "L2")] },
];
const submitted = (cycle: number, answers: readonly (readonly [string, number])[]): TelemetryEvent =>
  ({ kind: "freeze_submitted", detail: { cycle: cycle as never, responses: answers.map(([itemId, confidence]) => ({ itemId, optionId: "a", confidence })) } });

describe("lowestConfidenceShare (SPEC/32 §7)", () => {
  it("counts the first answers at 25, overall and over the L2/L3 items", async () => {
    const records = await buildLog([
      [0, submitted(2, [["a1", 25], ["a2", 25], ["a3", 75]])],
      [1, submitted(2, [["a3", 25]])], // a second answer to a3: not the first, ignored
      [2, submitted(4, [["b1", 50], ["b2", 100]])],
    ]);
    expect(LOWEST_CONFIDENCE).toBe(25);
    expect(lowestConfidenceShare(records, FREEZES)).toEqual({
      all: { n: 5, lowest: 2, share: 0.4 },
      l2l3: { n: 3, lowest: 1, share: 1 / 3 },
    });
    expect(lowestConfidenceShare(records, FREEZES, { views: [4] }).all).toEqual({ n: 2, lowest: 0, share: 0 });
  });

  it("is null with no answer, and drops a replayed view unless asked", async () => {
    expect(lowestConfidenceShare(await buildLog([]), FREEZES)).toEqual({ all: { n: 0, lowest: 0, share: null }, l2l3: { n: 0, lowest: 0, share: null } });
    const records = await buildLog([
      [0, submitted(2, [["a2", 25]])],
      [1, { kind: "session_resumed", detail: { resumeCount: 1, intervalSinceInterruptionMs: 1, cycleReplayed: 2 as never, resumedAt: "view" } }],
    ]);
    expect(lowestConfidenceShare(records, FREEZES).all.n).toBe(0);
    expect(lowestConfidenceShare(records, FREEZES, { includeReplayed: true }).l2l3).toEqual({ n: 1, lowest: 1, share: 1 });
  });
});
