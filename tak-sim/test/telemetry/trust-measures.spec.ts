/**
 * SPEC/32 §5: the projection's actual correct share against the stated reliability (the trust gap), reliance on the projection
 * when it was wrong vs right, and the S-TIAS means. Synthetic logs and a small fake freeze list.
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime, type LatLon } from "../../app/engine/primitives.js";
import { CANONICAL_FLAG_SEQUENCE, type FreezeItem } from "../../app/scenario/types.js";
import { DEBRIEF_PROJECTION_HELD, DEBRIEF_VIEW_COUNT } from "../../app/i18n/study-texts.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import type { FreezeContentLike } from "../../app/telemetry/freeze-measures.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import { projectionCorrectShare, projectionTrustGap, relianceByProjectionCorrectness, stiasMean } from "../../app/telemetry/trust-measures.js";

const HEADER: LogHeader = {
  formatVersion: "0.12.0", sessionId: "trust", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "reasoning_intent", echelon: "command",
};

async function buildLog(events: readonly (readonly [number, TelemetryEvent])[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (const [t, e] of events) await appendTelemetryEvent(log, asVirtualTime(0), t, e);
  return log.readAll();
}

const post = (answers: { itemId: string; value: string | number | null; notShown?: true }[]): TelemetryEvent =>
  ({ kind: "questionnaire_submitted", detail: { questionnaireId: "post", answers, dwellMs: 1 } });

const TRUTH: LatLon = { lat: 61.0, lon: 25.0 };
const PROJ: LatLon = { lat: 61.0 + 800 / 111_195.08, lon: 25.0 };
const mapItem = (id: string): FreezeItem => ({ id, level: "L3", promptFi: id, options: [], kind: "map_point", mapKey: { point: TRUTH, toleranceM: 300 }, projectionPoint: PROJ });
const FREEZES: readonly FreezeContentLike[] = [{ cycle: 4, items: [mapItem("v4.head")] }, { cycle: 5, items: [mapItem("v5.head")] }, { cycle: 14, items: [mapItem("v14.head")] }];
const tap = (cycle: number, itemId: string, point: LatLon, confidence: number): TelemetryEvent =>
  ({ kind: "freeze_submitted", detail: { cycle: cycle as never, responses: [{ itemId, optionId: "map_point", confidence, point }] } });

describe("the trust gap (SPEC/32 §5)", () => {
  it("the schedule's correct share is the debrief's 7 of 14; partly-correct views count half only in the lenient share", () => {
    const s = projectionCorrectShare();
    expect(s).toEqual({ views: 14, holds: 7, partly: 3, correctShare: 0.5, correctShareLenient: 8.5 / 14 });
    expect(s.holds).toBe(DEBRIEF_PROJECTION_HELD);
    expect(s.views).toBe(DEBRIEF_VIEW_COUNT);
    expect(CANONICAL_FLAG_SEQUENCE).toHaveLength(14);
  });

  it("maps the stated reliability to its quarter's midpoint and signs the gap (stated − actual)", async () => {
    expect(projectionTrustGap(await buildLog([[0, post([{ itemId: "reliability.projection", value: "mostly" }])]])))
      .toEqual({ statedOption: "mostly", stated: 0.625, actual: 0.5, gap: 0.125 });
    expect(projectionTrustGap(await buildLog([[0, post([{ itemId: "reliability.projection", value: "rarely" }])]])).gap).toBeCloseTo(-0.375, 10);
    expect(projectionTrustGap(await buildLog([[0, post([{ itemId: "reliability.projection", value: "always" }])]]), ["holds", "holds"]).gap).toBeCloseTo(-0.125, 10);
    expect(projectionTrustGap(await buildLog([[0, post([{ itemId: "reliability.projection", value: null }])]]))).toEqual({ statedOption: null, stated: null, actual: 0.5, gap: null });
    expect(projectionTrustGap(await buildLog([[0, post([{ itemId: "reliability.projection", value: "often" }])]])).gap).toBeNull();
    expect(projectionTrustGap(await buildLog([])).gap).toBeNull();
  });

  it("splits projection reliance by whether the view's projection held (V4, V14 breach; V5 holds)", async () => {
    const records = await buildLog([
      [0, tap(4, "v4.head", PROJ, 100)], // wrong projection, relied on
      [1, tap(5, "v5.head", TRUTH, 50)], // right projection, not relied on
      [2, tap(14, "v14.head", TRUTH, 75)], // wrong projection, not relied on
    ]);
    const r = relianceByProjectionCorrectness(records, FREEZES);
    expect(r.answers.map((a) => [a.view, a.flag, a.anchored])).toEqual([[4, "breach_categorical", true], [5, "holds", false], [14, "breach_quantitative", false]]);
    expect(r.right).toEqual({ n: 1, anchored: 0, reliance: 0, meanConfidence: 50 });
    expect(r.wrong).toEqual({ n: 2, anchored: 1, reliance: 0.5, meanConfidence: 87.5 });
    expect(r.discrimination).toBeCloseTo(-0.5, 10);
    expect(relianceByProjectionCorrectness(await buildLog([]), FREEZES).discrimination).toBeNull();
  });
});

describe("S-TIAS means (SPEC/32 §5)", () => {
  it("averages the answered items of each scale, 1–7; absent, not shown or out of range is unanswered", async () => {
    const records = await buildLog([[0, post([
      { itemId: "stias.tools.1", value: 5 }, { itemId: "stias.tools.2", value: "6" }, { itemId: "stias.tools.3", value: 9 },
      { itemId: "stias.thinker.1", value: 3, notShown: true },
    ])]]);
    expect(stiasMean(records, "tools")).toEqual({ answered: 2, mean: 5.5 });
    expect(stiasMean(records, "thinker")).toEqual({ answered: 0, mean: null });
  });
});
