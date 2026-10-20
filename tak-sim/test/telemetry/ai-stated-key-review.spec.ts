/**
 * SPEC/32 §3 (20 Oct 2026): the plan review's premise lines (the guide group's, on `plan_review_shown`) are AI-stated text for
 * the told split (`aiStatedKey`), shown at that record's seq, view and virtual time, as a Thinker answer. The Haku group's
 * review and a failed lookup carry no lines and count for nothing; lines shown after the freeze opened do not count.
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import type { FreezeItem } from "../../app/scenario/types.js";
import { aiStatedKey, shownAnswers } from "../../app/telemetry/ai-stated-key.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { PlanReviewShownDetail, TelemetryEvent } from "../../app/telemetry/record-kinds.js";

const HEADER: LogHeader = {
  formatVersion: "0.12.0", sessionId: "review-told", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "reasoning_intent", echelon: "command", language: "fi",
};

/** An L2 item whose key is stated by the authored pattern "uusi palo". */
const REKINDLE: FreezeItem = {
  id: "freeze.10.rekindle", level: "L2", promptFi: "Onko linjauksen jälkeen syttynyt uusi palo?",
  options: [{ id: "yes", labelFi: "Kyllä", correct: true }, { id: "no", labelFi: "Ei", correct: false }],
  keyStatements: { fi: ["ei enää päde"], en: ["no longer holds"] },
};
const V10 = { cycle: 10, items: [REKINDLE] };

const LINE = "P1 Linjauksen jälkeen ei ole syttynyt uutta paloa — ei enää päde: SPOT klo 17.01.";
const shown = (lines: readonly string[] | null, extra: Partial<PlanReviewShownDetail> = {}): TelemetryEvent => ({
  kind: "plan_review_shown",
  detail: { cycle: 10 as never, atViewSeconds: 120, trigger: "minimum_reached", premiseLines: lines, premiseStatuses: null, tableSha256: null, ...extra },
});
const start: TelemetryEvent = { kind: "cycle_start", detail: { cycle: 10 as never, phase: "B", clockLabel: "17:20" } };
const freezeStarted: TelemetryEvent = { kind: "freeze_started", detail: { cycle: 10 as never, atViewSeconds: 120, decisionCommittedBeforeFreeze: true, decisionStep: "view_ended" } };
const submitted: TelemetryEvent = { kind: "freeze_submitted", detail: { cycle: 10 as never, responses: [{ itemId: REKINDLE.id, optionId: "yes", confidence: 50 }] } };

async function buildLog(events: readonly TelemetryEvent[], virtualS = 14_400): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  let t = 0;
  for (const e of events) await appendTelemetryEvent(log, asVirtualTime(virtualS), (t += 1000), e);
  return log.readAll();
}

describe("the plan review's premise lines in the told split (SPEC/32 §3)", () => {
  it("are shown text at the review's record: its seq, view and virtual time, tool thinker", async () => {
    const records = await buildLog([{ kind: "session_started", detail: HEADER }, start, shown([LINE, "P2 …"])]);
    expect(shownAnswers(records)).toEqual([{ seq: 2, view: 10, virtualTimeS: 14_400, tool: "thinker", text: `${LINE}\nP2 …` }]);
  });

  it("a review before the view's (end-of-view) freeze states the key; the told class is ai_told", async () => {
    const records = await buildLog([{ kind: "session_started", detail: HEADER }, start, shown([LINE]), freezeStarted, submitted]);
    expect(aiStatedKey(records, [V10])[0]).toMatchObject({ stated: true, tool: "thinker", statedInView: 10, firstStatedSeq: 2, matchedBy: "key_statements", toldClass: "ai_told" });
  });

  it("no lines (the Haku group, or a failed lookup with premiseError) count for nothing", async () => {
    for (const review of [shown(null), shown(null, { premiseError: "client_timeout" }), shown([])]) {
      const records = await buildLog([{ kind: "session_started", detail: HEADER }, start, review, freezeStarted, submitted]);
      expect(shownAnswers(records)).toEqual([]);
      expect(aiStatedKey(records, [V10])[0]).toMatchObject({ stated: false, tool: null, toldClass: "neither" });
    }
  });

  it("lines shown after the freeze opened do not count", async () => {
    const records = await buildLog([{ kind: "session_started", detail: HEADER }, start, freezeStarted, shown([LINE]), submitted]);
    expect(aiStatedKey(records, [V10])[0]).toMatchObject({ stated: false });
  });
});
