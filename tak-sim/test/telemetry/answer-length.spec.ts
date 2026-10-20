/**
 * SPEC/32 §7: AI answer length — per view, the number and characters of the AI answers shown (Haku's chat, the Thinker) and of the
 * review's premise lines (guide group).
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { AiChatAnswerReceivedDetail, TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import { aiAnswerLength } from "../../app/telemetry/teaming-measures.js";

const HEADER: LogHeader = {
  formatVersion: "0.12.0", sessionId: "length", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "reasoning_intent", echelon: "command",
};

async function buildLog(events: readonly TelemetryEvent[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (const [i, e] of events.entries()) await appendTelemetryEvent(log, asVirtualTime(0), i, e);
  return log.readAll();
}

const answer = (view: number, tool: "haku" | "open_thinker", parts: Partial<AiChatAnswerReceivedDetail["answer"]>, fallback = false): TelemetryEvent => ({
  kind: "ai_chat_answer_received",
  detail: {
    queryId: `q${view}`, text: "q", view, virtualTimeS: 0, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
    answer: { vastaus: "", perusteet: "", varmuus: "", muuttaisi: "", ...parts }, latencyMs: 1, fallback, fallbackReason: null, phase: "exploration",
    promptVariant: "standard", tool,
  },
});

describe("aiAnswerLength (SPEC/32 §7)", () => {
  it("counts the answers shown and their characters by tool and view, and the review's premise lines apart", async () => {
    const records = await buildLog([
      answer(9, "haku", { vastaus: "abcd", perusteet: "ef" }), // "abcd\nef": 7 characters
      answer(9, "open_thinker", { vastaus: "Thinker says ten" }), // 16
      answer(9, "open_thinker", { vastaus: "unavailable" }, true), // a fallback shows no text: not counted
      answer(10, "open_thinker", { vastaus: "äöå" }), // 3
      { kind: "plan_review_shown", detail: { cycle: 10 as never, atViewSeconds: 90, trigger: "plan_after_minimum", premiseLines: ["P1 line", "P2"], premiseStatuses: [], tableSha256: "t" } },
      { kind: "plan_review_shown", detail: { cycle: 11 as never, atViewSeconds: 90, trigger: "minimum_reached", premiseLines: null, premiseStatuses: null, tableSha256: null } },
    ]);
    expect(aiAnswerLength(records)).toEqual([
      { view: 9, haku: { count: 1, chars: 7 }, thinker: { count: 1, chars: 16 }, reviewPremise: { count: 0, chars: 0 } },
      { view: 10, haku: { count: 0, chars: 0 }, thinker: { count: 1, chars: 3 }, reviewPremise: { count: 2, chars: 9 } },
    ]);
    expect(aiAnswerLength(await buildLog([]))).toEqual([]);
  });
});
