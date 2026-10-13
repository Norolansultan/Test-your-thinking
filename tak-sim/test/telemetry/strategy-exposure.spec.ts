/**
 * `strategyNoticeExposure` (phase B round 2, D2): per view, how many Thinker answers carried each
 * `linjaus` status — computed only from `ai_chat_answer_received.linjausTila`.
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { strategyExposureBeforePlan, strategyNoticeExposure } from "../../app/telemetry/derived-measures.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import type { AiChatAnswerReceivedDetail } from "../../app/telemetry/record-kinds.js";

let seq = 0;
function answer(view: number, tila?: AiChatAnswerReceivedDetail["linjausTila"]): LogRecord {
  const detail: AiChatAnswerReceivedDetail = {
    queryId: `ai.${seq}`, text: "q", view, virtualTimeS: 0, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
    answer: { vastaus: "", perusteet: "", varmuus: "", muuttaisi: "" }, latencyMs: 2500, fallback: tila === "ei_arvioitu", fallbackReason: null,
    phase: "exploration", promptVariant: tila ? "intent" : "standard",
    ...(tila ? { linjaus: { tila, perustelu: "x" }, linjausTila: tila } : {}),
  };
  return { seq: seq++, tVirtual: asVirtualTime(0), tWallOffsetMs: 0, kind: "ai_chat_answer_received", detail } as LogRecord;
}

describe("strategyNoticeExposure", () => {
  it("counts each status per view, in view order; standard answers and other records are not counted", () => {
    const records = [
      answer(5), // phase A: standard, no line
      answer(10, "ei_sovi"), answer(8, "ei_liity"), answer(10, "ei_sovi"), answer(10, "sopii"), answer(12, "ei_arvioitu"),
      { seq: seq++, tVirtual: asVirtualTime(0), tWallOffsetMs: 0, kind: "nav_query_submitted", detail: {} } as LogRecord,
    ];
    expect(strategyNoticeExposure(records)).toEqual([
      { view: 8, sopii: 0, ei_sovi: 0, ei_liity: 1, ei_arvioitu: 0 },
      { view: 10, sopii: 1, ei_sovi: 2, ei_liity: 0, ei_arvioitu: 0 },
      { view: 12, sopii: 0, ei_sovi: 0, ei_liity: 0, ei_arvioitu: 1 },
    ]);
  });

  it("is empty for a session without strategy-guided answers (Haku, or reasoning_once)", () => {
    expect(strategyNoticeExposure([answer(9), answer(11)])).toEqual([]);
    expect(strategyNoticeExposure([])).toEqual([]);
  });
});

describe("strategyExposureBeforePlan (SPEC/27 §3.4)", () => {
  const rec = (kind: string, detail: unknown): LogRecord => ({ seq: seq++, tVirtual: asVirtualTime(0), tWallOffsetMs: 0, kind, detail }) as LogRecord;
  const plan = (posture: string) => ({ plan: { mainEffort: "L3", posture, secondary: null, drones: null }, rationaleAsked: false, rationaleFi: null });
  const key = { aligned: ["barrier_line", "protect_values"], sound: ["direct_attack"] };

  it("counts sopii / ei_sovi notices before the plan in force at view end, not after it, not ei_liity", () => {
    const records = [
      rec("cycle_start", { cycle: 9 }),
      answer(9, "ei_liity"), answer(9, "sopii"),
      rec("allocation_submitted", plan("barrier_line")),
      answer(9, "ei_sovi"),
      rec("allocation_revised", plan("direct_attack")), // the plan in force: both notices precede it
      answer(9, "sopii"), // after the plan: not exposure
      rec("cycle_start", { cycle: 10 }),
      answer(10, "ei_liity"),
      rec("allocation_submitted", plan("direct_attack")),
      rec("cycle_start", { cycle: 11 }), // no plan: no entry
      answer(11, "sopii"),
    ];
    expect(strategyExposureBeforePlan(records, { 9: key, 10: key, 11: key })).toEqual([
      { view: 9, exposedBeforePlan: true, lastStatusBeforePlan: "ei_sovi", mixedBeforePlan: true, noticesBeforePlan: 2 },
      { view: 10, exposedBeforePlan: false, lastStatusBeforePlan: null, mixedBeforePlan: false, noticesBeforePlan: 0 },
    ]);
  });
});
