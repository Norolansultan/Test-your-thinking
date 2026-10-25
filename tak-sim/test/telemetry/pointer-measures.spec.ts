/**
 * Revision (bm), 25 Oct 2026 (SPEC/09 (bm)): the pointer follow-up measure (`app/telemetry/pointer-measures.ts`) on synthetic logs —
 * a Haku or Thinker question after the pointer and before the view's end that brought back the pointed record (rank ≤ 8: retrieved;
 * rank 1: shown), its latency (with a freeze in between taken out), what came before the pointer, real and decoy pointers apart.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import * as derived from "../../app/telemetry/derived-measures.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { POINTER_RETRIEVED_MAX_RANK, POINTER_SPECS, pointerFollowUpRates, pointerFollowUps, type PointerSpec } from "../../app/telemetry/pointer-measures.js";

const REAL: PointerSpec = { atomId: "atom.ptr.3.0", to: "evt.c03.021", kind: "real", serves: ["freeze.2.south_flank"] };
const DECOY: PointerSpec = { atomId: "atom.ptr.2.0", to: "evt.c02.026", kind: "decoy" };
const SPECS = [REAL, DECOY];

/** A log builder: records in order, gapless seq, the wall offset given per record. */
function log(): { readonly add: (kind: string, wallMs: number, detail: unknown) => void; readonly records: LogRecord[] } {
  const records: LogRecord[] = [];
  return { records, add: (kind, wallMs, detail) => { records.push({ seq: records.length, tVirtual: 0, tWallOffsetMs: wallMs, kind, detail } as unknown as LogRecord); } };
}
const bubble = (atomId: string) => ({ atomId, mapPosition: null, tier: "T1_pushed", sourceId: "X" });
const ask = (queryId: string, tool = "haku") => ({ queryId, text: "?", view: 2, virtualTimeS: 0, phase: "exploration", tool });
const answer = (queryId: string, ids: readonly string[], tool = "haku") => ({ queryId, text: "?", view: 2, virtualTimeS: 0, retrieved: ids.map((id) => ({ id, fusedScore: 0.5 })), tool, fallback: false });
const filler = (n: number) => Array.from({ length: n }, (_, k) => `evt.other.${k}`);

describe("pointerFollowUps", () => {
  it("retrieved at rank 2, then shown at rank 1 after a freeze: latencies from the delivery, the freeze taken out", () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 2 });
    l.add("bubble_available", 1000, bubble(REAL.atomId));
    l.add("bubble_available", 1000, bubble(DECOY.atomId));
    l.add("ai_chat_query_submitted", 5000, ask("q1"));
    l.add("ai_chat_answer_received", 6000, answer("q1", ["evt.x", REAL.to]));
    l.add("freeze_started", 7000, { cycle: 2, atViewSeconds: 105, decisionCommittedBeforeFreeze: false, decisionStep: "plan_open" });
    l.add("freeze_submitted", 8000, { cycle: 2, responses: [] });
    l.add("ai_chat_query_submitted", 9000, ask("q2", "open_thinker"));
    l.add("ai_chat_answer_received", 9500, answer("q2", [REAL.to], "open_thinker"));
    l.add("cycle_end", 12000, { cycle: 2, totalRealDurationMs: 12000 });
    const [real, decoy] = pointerFollowUps(l.records, SPECS);
    expect(real).toMatchObject({ pointerId: REAL.atomId, kind: "real", view: 2, reachedBefore: false, questionsAfter: 2, followed: true, shown: true, serves: ["freeze.2.south_flank"] });
    expect(real!.firstRetrieved).toEqual({ queryId: "q1", tool: "haku", rank: 2, latencyMs: 4000, latencyOutsideFreezeMs: 4000, beforeFreeze: true });
    expect(real!.firstShown).toEqual({ queryId: "q2", tool: "open_thinker", rank: 1, latencyMs: 8000, latencyOutsideFreezeMs: 7000, beforeFreeze: false });
    // The decoy was delivered too; two questions were asked after it, neither brought its record back.
    expect(decoy).toMatchObject({ pointerId: DECOY.atomId, kind: "decoy", questionsAfter: 2, followed: false, shown: false, firstRetrieved: null, firstShown: null });
  });

  it("only questions asked after the pointer and before its view ended count; one before it is 'reached before'", () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 2 });
    l.add("ai_chat_query_submitted", 500, ask("q0"));
    l.add("ai_chat_answer_received", 700, answer("q0", [REAL.to]));
    l.add("bubble_available", 1000, bubble(REAL.atomId));
    l.add("cycle_end", 3000, { cycle: 2, totalRealDurationMs: 3000 });
    l.add("cycle_start", 3100, { cycle: 3 });
    l.add("ai_chat_query_submitted", 4000, ask("q1"));
    l.add("ai_chat_answer_received", 4500, answer("q1", [REAL.to]));
    const [f] = pointerFollowUps(l.records, SPECS);
    expect(f).toMatchObject({ reachedBefore: true, questionsAfter: 0, followed: false, shown: false });
  });

  it(`a rank beyond ${POINTER_RETRIEVED_MAX_RANK} is not retrieved; an answer's position, not its arrival, is the question's (the submission's time)`, () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 2 });
    l.add("bubble_available", 1000, bubble(REAL.atomId));
    l.add("ai_chat_query_submitted", 2000, ask("q1"));
    l.add("ai_chat_answer_received", 2600, answer("q1", [...filler(POINTER_RETRIEVED_MAX_RANK), REAL.to]));
    l.add("ai_chat_query_submitted", 3000, ask("q2"));
    l.add("ai_chat_answer_received", 3900, answer("q2", [...filler(POINTER_RETRIEVED_MAX_RANK - 1), REAL.to]));
    l.add("cycle_end", 5000, { cycle: 2, totalRealDurationMs: 5000 });
    const [f] = pointerFollowUps(l.records, SPECS);
    expect(f).toMatchObject({ followed: true, shown: false, questionsAfter: 2 });
    expect(f!.firstRetrieved).toMatchObject({ queryId: "q2", rank: POINTER_RETRIEVED_MAX_RANK, latencyMs: 2000, beforeFreeze: null });
  });

  it("a view delivered again on resume counts once, from its first delivery; the Indexed search counts by its result order", () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 2 });
    l.add("bubble_available", 1000, bubble(REAL.atomId));
    l.add("cycle_end", 2000, { cycle: 2, totalRealDurationMs: 2000 });
    l.add("cycle_start", 2500, { cycle: 2 });
    l.add("bubble_available", 2600, bubble(REAL.atomId));
    l.add("query_submitted", 3000, { text: "EK12", charCount: 4, queryId: "s1", reformulationChainIndex: 0, resultAtomIds: [REAL.to] });
    l.add("cycle_end", 4000, { cycle: 2, totalRealDurationMs: 1500 });
    const out = pointerFollowUps(l.records, SPECS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ followed: false, questionsAfter: 0 }); // the first delivery's view ended before the search
  });

  it("no pointer received: nothing to report; a pointer not in the specs is ignored", () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 2 });
    l.add("bubble_available", 1000, bubble("atom.demo.2.0"));
    expect(pointerFollowUps(l.records, SPECS)).toEqual([]);
  });
});

describe("pointerFollowUpRates", () => {
  it("real and decoy pointers apart: received, followed, shown, rates and the median latency", () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 2 });
    l.add("bubble_available", 1000, bubble(REAL.atomId));
    l.add("bubble_available", 1000, bubble(DECOY.atomId));
    l.add("ai_chat_query_submitted", 4000, ask("q1"));
    l.add("ai_chat_answer_received", 4200, answer("q1", [DECOY.to, REAL.to]));
    l.add("cycle_end", 6000, { cycle: 2, totalRealDurationMs: 6000 });
    const rates = pointerFollowUpRates(pointerFollowUps(l.records, SPECS));
    expect(rates.real).toEqual({ received: 1, followed: 1, shown: 0, followedRate: 1, shownRate: 0, medianLatencyOutsideFreezeMs: 3000 });
    expect(rates.decoy).toEqual({ received: 1, followed: 1, shown: 1, followedRate: 1, shownRate: 1, medianLatencyOutsideFreezeMs: 3000 });
    expect(pointerFollowUpRates([])).toEqual({
      real: { received: 0, followed: 0, shown: 0, followedRate: null, shownRate: null, medianLatencyOutsideFreezeMs: null },
      decoy: { received: 0, followed: 0, shown: 0, followedRate: null, shownRate: null, medianLatencyOutsideFreezeMs: null },
    });
  });
});

describe("the scenario's pointers as the default", () => {
  it("is among the telemetry's derived measures", () => {
    expect(derived.pointerFollowUps).toBe(pointerFollowUps);
    expect(derived.pointerFollowUpRates).toBe(pointerFollowUpRates);
  });

  it("POINTER_SPECS name the scenario's pointer atoms and their marks exactly", () => {
    const scenario = buildDemoScenario();
    const marked = scenario.atoms.filter((a) => a.pointer).map((a) => ({ atomId: a.id, to: a.pointer!.to, kind: a.pointer!.kind }));
    expect(POINTER_SPECS.map(({ atomId, to, kind }) => ({ atomId, to, kind }))).toEqual(marked);
  });
});
