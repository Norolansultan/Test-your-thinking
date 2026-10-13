/**
 * `spam-measures.ts` over hand-built raw records (round 2, 4 Oct 2026): every latency is a
 * difference of two records' `tWallOffsetMs`, never a stored value; the keys come from the
 * scenario's invariants (TRUTH), passed in.
 */

import { describe, expect, it } from "vitest";
import type { LogRecord } from "../../app/telemetry/log.js";
import { hingeCheckMeasure, spamKeysOf, spamMeasures } from "../../app/telemetry/spam-measures.js";

let seq = 0;
const rec = (tWallOffsetMs: number, kind: string, detail: object): LogRecord => ({ seq: seq++ as never, tVirtual: 0 as never, tWallOffsetMs, kind, detail });

describe("spamMeasures", () => {
  const records: LogRecord[] = [
    rec(1_000, "ai_chat_query_submitted", { queryId: "q1", text: "x", view: 3, virtualTimeS: 0, phase: "decision" }),
    rec(10_000, "spam_prompt_shown", { probeId: "probe.s.cycle_3", cycle: 3, atViewSeconds: 25 }),
    rec(12_500, "spam_ready", { probeId: "probe.s.cycle_3", timedOut: false }),
    rec(13_000, "ai_chat_answer_received", { queryId: "q1" }),
    rec(18_500, "spam_answered", { probeId: "probe.s.cycle_3", response: "b", timedOut: false }),
    rec(20_000, "recall_confidence_submitted", { probeId: "probe.s.cycle_3", value: 75 }),
    rec(20_000, "spam_closed", { probeId: "probe.s.cycle_3", cycle: 3 }),
    rec(100_000, "spam_prompt_shown", { probeId: "probe.s.cycle_6", cycle: 6, atViewSeconds: 25 }),
    rec(115_000, "spam_ready", { probeId: "probe.s.cycle_6", timedOut: true }),
    rec(115_000, "spam_closed", { probeId: "probe.s.cycle_6", cycle: 6 }),
    rec(200_000, "spam_prompt_shown", { probeId: "probe.s.cycle_8", cycle: 8, atViewSeconds: 25 }),
    rec(201_000, "spam_ready", { probeId: "probe.s.cycle_8", timedOut: false }),
    rec(221_000, "spam_answered", { probeId: "probe.s.cycle_8", response: null, timedOut: true }),
    rec(221_000, "spam_closed", { probeId: "probe.s.cycle_8", cycle: 8 }),
  ];
  const keys = spamKeysOf(
    [{ id: "probe.s.cycle_3", type: "S", invariantName: "spam.cycle_3" }, { id: "probe.s.cycle_6", type: "S", invariantName: "spam.cycle_6" }, { id: "probe.s.cycle_8", type: "S", invariantName: "spam.cycle_8" }, { id: "probe.j.cycle_3", type: "J", invariantName: "containment.cycle_3" }],
    [{ name: "spam.cycle_3", expected: "b" }, { name: "spam.cycle_6", expected: "d" }, { name: "spam.cycle_8", expected: "a" }, { name: "containment.cycle_3", expected: "holds" }],
  );

  it("reads the keys from the invariants, SPAM probes only", () => {
    expect([...keys]).toEqual([["probe.s.cycle_3", "b"], ["probe.s.cycle_6", "d"], ["probe.s.cycle_8", "a"]]);
  });

  it("an answered probe: ready and answer latency, correct, confidence, the item's open time, a Thinker answer pending at the prompt", () => {
    expect(spamMeasures(records, keys)[0]).toEqual({
      probeId: "probe.s.cycle_3", view: 3, readyLatencyMs: 2_500, readyCensored: false, forced: false, skipped: false, readyTimedOut: false, collapses: 0,
      answerLatencyMs: 6_000, answerTimedOut: false, response: "b", correct: true, confidence: 75, itemOpenMs: 7_500,
      toolQueries: 0, hakuQueries: 0, thinkerQueries: 0, toolQueryIds: [], answeredAfterToolAnswer: true, thinkerPendingAtPrompt: true,
    });
  });

  it("a ready timeout (logs before revision (ag)): no item, no latency, no correctness; an answer timeout: the ready latency only", () => {
    const [, v6, v8] = spamMeasures(records, keys);
    expect(v6).toMatchObject({ readyTimedOut: true, readyLatencyMs: null, readyCensored: false, answerLatencyMs: null, response: null, correct: null, confidence: null, itemOpenMs: null, thinkerPendingAtPrompt: false });
    expect(v8).toMatchObject({ readyLatencyMs: 1_000, answerTimedOut: true, answerLatencyMs: null, response: null, correct: null, itemOpenMs: 20_000, answeredAfterToolAnswer: null });
  });

  it("without a key the answer is reported, not scored", () => {
    expect(spamMeasures(records, new Map())[0]).toMatchObject({ response: "b", correct: null });
  });
});

describe("spamMeasures, revision (ag): forced, censored, collapsed, skipped; tool use inside the item", () => {
  const P = "probe.s.cycle_11";
  const keys11 = new Map([[P, "c"]]);

  it("a forced item: the ready latency censored at the view's end; collapses counted; the answer latency from the forced display", () => {
    const m = spamMeasures([
      rec(1_000, "spam_prompt_shown", { probeId: P, cycle: 11, atViewSeconds: 25 }),
      rec(5_000, "spam_collapsed", { probeId: P }),
      rec(9_000, "spam_expanded", { probeId: P }),
      rec(10_000, "spam_collapsed", { probeId: P }),
      rec(106_000, "spam_ready", { probeId: P, timedOut: false, forced: true, atViewSeconds: 130, viewEndedBy: "participant_confirm" }),
      rec(115_000, "spam_answered", { probeId: P, response: "c", timedOut: false }),
      rec(117_000, "recall_confidence_submitted", { probeId: P, value: 50 }),
      rec(117_000, "spam_closed", { probeId: P, cycle: 11 }),
    ], keys11)[0]!;
    expect(m).toMatchObject({ forced: true, readyCensored: true, readyLatencyMs: 105_000, collapses: 2, answerLatencyMs: 9_000, correct: true, itemOpenMs: 11_000, skipped: false });
  });

  it("a forced item resumed after an interruption: the censoring time is the first forced display, the answer latency from the re-display", () => {
    const m = spamMeasures([
      rec(1_000, "spam_prompt_shown", { probeId: P, cycle: 11, atViewSeconds: 25 }),
      rec(106_000, "spam_ready", { probeId: P, timedOut: false, forced: true, atViewSeconds: 130, viewEndedBy: "time_cap" }),
      rec(400_000, "session_resumed", { resumeCount: 1, intervalSinceInterruptionMs: 250_000, cycleReplayed: 11, resumedAt: "spam_forced" }),
      rec(400_100, "spam_ready", { probeId: P, timedOut: false, forced: true, atViewSeconds: 130, viewEndedBy: "time_cap", resumed: true }),
      rec(404_100, "spam_answered", { probeId: P, response: "a", timedOut: false }),
      rec(405_000, "spam_closed", { probeId: P, cycle: 11 }),
    ], keys11)[0]!;
    expect(m).toMatchObject({ forced: true, readyCensored: true, readyLatencyMs: 105_000, answerLatencyMs: 4_000, correct: false, confidence: null });
  });

  it("a demonstration skip: no item, no latency", () => {
    const m = spamMeasures([
      rec(1_000, "spam_prompt_shown", { probeId: P, cycle: 11, atViewSeconds: 25 }),
      rec(3_000, "spam_ready", { probeId: P, timedOut: false, skipped: true }),
      rec(3_000, "spam_closed", { probeId: P, cycle: 11 }),
    ], keys11)[0]!;
    expect(m).toMatchObject({ skipped: true, forced: false, readyCensored: false, readyLatencyMs: null, answerLatencyMs: null, response: null, itemOpenMs: null });
  });

  it("tool use inside the item's window: Haku (free text, navigation, chat) and the Thinker counted with their query ids; before the display and after the close not", () => {
    const m = spamMeasures([
      rec(500, "query_submitted", { queryId: "q.before", text: "x", charCount: 1, reformulationChainIndex: 0 }),
      rec(1_000, "spam_prompt_shown", { probeId: P, cycle: 11, atViewSeconds: 25 }),
      rec(2_000, "query_submitted", { queryId: "q.ready", text: "x", charCount: 1, reformulationChainIndex: 0 }), // during the ready prompt: not the item's
      rec(3_000, "spam_ready", { probeId: P, timedOut: false }),
      rec(4_000, "ai_chat_query_submitted", { queryId: "ai_open.1", text: "?", view: 11, virtualTimeS: 0, phase: "decision", tool: "open_thinker" }),
      rec(5_000, "query_submitted", { queryId: "q.1", text: "KY21", charCount: 4, reformulationChainIndex: 0 }),
      rec(6_000, "nav_query_submitted", { queryId: "nav.1", category: "fire", sourceId: null, window: "latest", resultAtomIds: [], phase: "decision" }),
      rec(7_000, "ai_chat_query_submitted", { queryId: "ai.2", text: "?", view: 11, virtualTimeS: 0, phase: "decision", tool: "haku" }),
      rec(9_000, "spam_answered", { probeId: P, response: "c", timedOut: false }),
      rec(12_000, "ai_chat_answer_received", { queryId: "ai_open.1" }),
      rec(13_000, "spam_closed", { probeId: P, cycle: 11 }),
      rec(14_000, "query_submitted", { queryId: "q.after", text: "x", charCount: 1, reformulationChainIndex: 0 }),
    ], keys11)[0]!;
    expect(m).toMatchObject({ toolQueries: 4, hakuQueries: 3, thinkerQueries: 1, answeredAfterToolAnswer: true, answerLatencyMs: 6_000 });
    expect([...m.toolQueryIds].sort()).toEqual(["ai.2", "ai_open.1", "nav.1", "q.1"]);
  });

  it("a Thinker answer arriving only after the option: not answered after a tool answer", () => {
    const m = spamMeasures([
      rec(1_000, "spam_prompt_shown", { probeId: P, cycle: 11, atViewSeconds: 25 }),
      rec(3_000, "spam_ready", { probeId: P, timedOut: false }),
      rec(4_000, "ai_chat_query_submitted", { queryId: "ai_open.1", text: "?", view: 11, virtualTimeS: 0, phase: "decision", tool: "open_thinker" }),
      rec(6_000, "spam_answered", { probeId: P, response: "c", timedOut: false }),
      rec(9_000, "ai_chat_answer_received", { queryId: "ai_open.1" }),
      rec(9_500, "spam_closed", { probeId: P, cycle: 11 }),
    ], keys11)[0]!;
    expect(m).toMatchObject({ thinkerQueries: 1, toolQueries: 1, answeredAfterToolAnswer: false });
  });

  it("a replayed view's second prompt is measured on its own records", () => {
    const [first, second] = spamMeasures([
      rec(1_000, "spam_prompt_shown", { probeId: P, cycle: 11, atViewSeconds: 25 }),
      rec(50_000, "spam_prompt_shown", { probeId: P, cycle: 11, atViewSeconds: 25 }),
      rec(52_000, "spam_ready", { probeId: P, timedOut: false }),
      rec(55_000, "spam_answered", { probeId: P, response: "c", timedOut: false }),
      rec(55_000, "spam_closed", { probeId: P, cycle: 11 }),
    ], keys11);
    expect(first).toMatchObject({ readyLatencyMs: null, response: null });
    expect(second).toMatchObject({ readyLatencyMs: 2_000, answerLatencyMs: 3_000, correct: true });
  });
});

describe("hingeCheckMeasure", () => {
  it("reading time, answer latency and correctness; null before the check", () => {
    const records = [
      rec(500_000, "hinge_pause_start", { pauseSeconds: 300 }),
      rec(530_000, "hinge_check_presented", { itemId: "hinge.manipulation_check" }),
      rec(538_000, "hinge_check_answered", { itemId: "hinge.manipulation_check", optionId: "b" }),
      rec(540_000, "hinge_pause_end", { realDurationMs: 40_000, dismissedEarly: true }),
    ];
    expect(hingeCheckMeasure(records, "b")).toEqual({ itemId: "hinge.manipulation_check", readingMs: 30_000, answerLatencyMs: 8_000, optionId: "b", correct: true });
    expect(hingeCheckMeasure(records, "d")).toMatchObject({ correct: false });
    expect(hingeCheckMeasure(records.slice(0, 1), "b")).toBeNull();
  });
});
