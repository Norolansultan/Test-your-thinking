/**
 * Revision (bm), 25 Oct 2026 (SPEC/09 (bm)): the pointer follow-up measure (`app/telemetry/pointer-measures.ts`) on synthetic logs —
 * a Haku or Thinker question that brought back the pointed record (rank ≤ 8: retrieved; rank 1: shown), its latency, real and decoy
 * pointers apart.
 *
 * Revision (bn), 25 Oct 2026 (review S3; SPEC/09 (bn) §2): the follow-up counts within the pointer's WINDOW — its delivery to the view's
 * freeze if one follows, else to the view's end — whose class and length are recorded; rates per window class, real against decoy only
 * within a class; no "reached before" (the pointer and its record arrive in one burst); the item classes run to the item's moment,
 * SPAM V3.b's to its prompt in the next view.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import * as derived from "../../app/telemetry/derived-measures.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { POINTER_RETRIEVED_MAX_RANK, POINTER_SPECS, pointerFollowUpRates, pointerFollowUps, pointerItemClasses, WINDOW_CLASSES, type PointerSpec } from "../../app/telemetry/pointer-measures.js";

const REAL: PointerSpec = { atomId: "atom.ptr.3.0", to: "evt.c03.021", kind: "real", serves: ["freeze.2.south_flank"], windowStart: "step_boundary" };
const DECOY: PointerSpec = { atomId: "atom.ptr.2.0", to: "evt.c02.026", kind: "decoy", windowStart: "view_start" };
const SPAM_REAL: PointerSpec = { atomId: "atom.ptr.3.1", to: "evt.c03.035", kind: "real", serves: ["freeze.2.area_40", "probe.s.cycle_3.b"], windowStart: "step_boundary" };
const SPECS = [REAL, DECOY];

/** A log builder: records in order, gapless seq, the wall offset given per record. */
function log(): { readonly add: (kind: string, wallMs: number, detail: unknown) => void; readonly records: LogRecord[] } {
  const records: LogRecord[] = [];
  return { records, add: (kind, wallMs, detail) => { records.push({ seq: records.length, tVirtual: 0, tWallOffsetMs: wallMs, kind, detail } as unknown as LogRecord); } };
}
const bubble = (atomId: string) => ({ atomId, mapPosition: null, tier: "T1_pushed", sourceId: "JOKE" });
const ask = (queryId: string, tool = "haku") => ({ queryId, text: "?", view: 2, virtualTimeS: 0, phase: "exploration", tool });
const answer = (queryId: string, ids: readonly string[], tool = "haku") => ({ queryId, text: "?", view: 2, virtualTimeS: 0, retrieved: ids.map((id) => ({ id, fusedScore: 0.5 })), tool, fallback: false });
const filler = (n: number) => Array.from({ length: n }, (_, k) => `evt.other.${k}`);
const freezeStarted = (cycle: number) => ({ cycle, atViewSeconds: 105, decisionCommittedBeforeFreeze: false, decisionStep: "plan_open" });

describe("pointerFollowUps", () => {
  it("counts within the window (delivery to the freeze): retrieved at rank 2, shown at rank 1, a question after the freeze not counted", () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 2 });
    l.add("bubble_available", 1000, bubble(REAL.atomId));
    l.add("bubble_available", 1000, bubble(DECOY.atomId));
    l.add("ai_chat_query_submitted", 5000, ask("q1"));
    l.add("ai_chat_answer_received", 6000, answer("q1", ["evt.x", REAL.to]));
    l.add("ai_chat_query_submitted", 6500, ask("q2", "open_thinker"));
    l.add("ai_chat_answer_received", 6900, answer("q2", [REAL.to], "open_thinker"));
    l.add("freeze_started", 7000, freezeStarted(2));
    l.add("freeze_submitted", 8000, { cycle: 2, responses: [] });
    l.add("ai_chat_query_submitted", 9000, ask("q3"));
    l.add("ai_chat_answer_received", 9500, answer("q3", [DECOY.to]));
    l.add("cycle_end", 12000, { cycle: 2, totalRealDurationMs: 12000 });
    const [real, decoy] = pointerFollowUps(l.records, SPECS);
    expect(real).toMatchObject({ pointerId: REAL.atomId, kind: "real", view: 2, questionsInWindow: 2, followed: true, shown: true, serves: ["freeze.2.south_flank"] });
    expect(real!.window).toEqual({ start: "step_boundary", end: "freeze", cls: "step_boundary→freeze", windowMs: 6000 });
    expect(real!.firstRetrieved).toEqual({ queryId: "q1", tool: "haku", rank: 2, latencyMs: 4000, latencyOutsideFreezeMs: 4000 });
    expect(real!.firstShown).toEqual({ queryId: "q2", tool: "open_thinker", rank: 1, latencyMs: 5500, latencyOutsideFreezeMs: 5500 });
    // The decoy's record came back only after the freeze, outside its window.
    expect(decoy).toMatchObject({ pointerId: DECOY.atomId, kind: "decoy", questionsInWindow: 2, followed: false, shown: false, firstRetrieved: null, firstShown: null });
    expect(decoy!.window.cls).toBe("view_start→freeze");
    expect(Object.keys(real!)).not.toContain("reachedBefore"); // withdrawn: the pointer and its record arrive in one burst
  });

  it("a view without a freeze: the window runs to the view's end; a question in the next view does not count", () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 9 });
    l.add("bubble_available", 1000, bubble(DECOY.atomId));
    l.add("ai_chat_query_submitted", 2000, ask("q0"));
    l.add("ai_chat_answer_received", 2400, answer("q0", ["evt.x"]));
    l.add("cycle_end", 3000, { cycle: 9, totalRealDurationMs: 3000 });
    l.add("cycle_start", 3100, { cycle: 10 });
    l.add("ai_chat_query_submitted", 4000, ask("q1"));
    l.add("ai_chat_answer_received", 4500, answer("q1", [DECOY.to]));
    const [f] = pointerFollowUps(l.records, SPECS);
    expect(f).toMatchObject({ view: 9, questionsInWindow: 1, followed: false, shown: false });
    expect(f!.window).toEqual({ start: "view_start", end: "view_end", cls: "view_start→view_end", windowMs: 2000 });
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
    expect(f).toMatchObject({ followed: true, shown: false, questionsInWindow: 2 });
    expect(f!.firstRetrieved).toMatchObject({ queryId: "q2", rank: POINTER_RETRIEVED_MAX_RANK, latencyMs: 2000 });
    expect(f!.window.end).toBe("view_end");
  });

  it("a view delivered again on resume counts once, from its first delivery; the Indexed search counts by its result order; an unclosed window has no length", () => {
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
    expect(out[0]).toMatchObject({ followed: false, questionsInWindow: 0 }); // the first delivery's view ended before the search
    const open = log();
    open.add("cycle_start", 0, { cycle: 2 });
    open.add("bubble_available", 1000, bubble(REAL.atomId));
    open.add("query_submitted", 3000, { text: "EK12", charCount: 4, queryId: "s1", reformulationChainIndex: 0, resultAtomIds: [REAL.to] });
    expect(pointerFollowUps(open.records, SPECS)[0]).toMatchObject({ followed: true, shown: true, window: { end: "view_end", windowMs: null } });
  });

  it("no pointer received: nothing to report; a pointer not in the specs is ignored", () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 2 });
    l.add("bubble_available", 1000, bubble("atom.demo.2.0"));
    expect(pointerFollowUps(l.records, SPECS)).toEqual([]);
  });
});

describe("pointerFollowUpRates", () => {
  it("real and decoy pointers apart, overall and per window class; the real − decoy contrast only where both kinds were received", () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 2 });
    l.add("bubble_available", 1000, bubble(REAL.atomId));
    l.add("bubble_available", 1000, bubble(DECOY.atomId));
    l.add("ai_chat_query_submitted", 4000, ask("q1"));
    l.add("ai_chat_answer_received", 4200, answer("q1", [DECOY.to, REAL.to]));
    l.add("freeze_started", 6000, freezeStarted(2));
    l.add("freeze_submitted", 7000, { cycle: 2, responses: [] });
    l.add("cycle_end", 8000, { cycle: 2, totalRealDurationMs: 8000 });
    const rates = pointerFollowUpRates(pointerFollowUps(l.records, SPECS));
    expect(rates.real).toEqual({ received: 1, followed: 1, shown: 0, followedRate: 1, shownRate: 0, medianLatencyMs: 3000 });
    expect(rates.decoy).toEqual({ received: 1, followed: 1, shown: 1, followedRate: 1, shownRate: 1, medianLatencyMs: 3000 });
    // The real pointer's window starts at the step boundary, the decoy's at the view's start: different classes, no comparable one.
    expect(Object.keys(rates.byWindow).sort()).toEqual(["step_boundary→freeze", "view_start→freeze"]);
    expect(rates.byWindow["step_boundary→freeze"]!.decoy.received).toBe(0);
    expect(rates.comparable).toEqual([]);
    // With both kinds in one class, that class is comparable.
    const same = pointerFollowUpRates(pointerFollowUps(l.records, [REAL, { ...DECOY, windowStart: "step_boundary" }]));
    expect(same.comparable).toEqual(["step_boundary→freeze"]);
    const none = { received: 0, followed: 0, shown: 0, followedRate: null, shownRate: null, medianLatencyMs: null };
    expect(pointerFollowUpRates([])).toEqual({ real: none, decoy: none, byWindow: {}, comparable: [] });
    expect(WINDOW_CLASSES).toEqual(["view_start→freeze", "step_boundary→freeze", "view_start→view_end", "step_boundary→view_end"]);
  });
});

describe("pointerItemClasses (revision (bn))", () => {
  it("per real pointer and item: followed before the item's moment, heard and not followed, or not heard; SPAM V3.b runs to its prompt in V3, the freeze taken out", () => {
    const l = log();
    l.add("cycle_start", 0, { cycle: 2 });
    l.add("bubble_available", 1000, bubble(SPAM_REAL.atomId));
    l.add("freeze_started", 3000, freezeStarted(2)); // V2's freeze: area_40's moment, no retrieving question before it
    l.add("freeze_submitted", 5000, { cycle: 2, responses: [] });
    l.add("cycle_end", 5500, { cycle: 2, totalRealDurationMs: 5500 });
    l.add("cycle_start", 6000, { cycle: 3 });
    l.add("ai_chat_query_submitted", 7000, ask("q1"));
    l.add("ai_chat_answer_received", 7300, answer("q1", [SPAM_REAL.to]));
    l.add("spam_prompt_shown", 9000, { probeId: "probe.s.cycle_3", cycle: 3, atViewSeconds: 40 });
    const out = pointerItemClasses(l.records, [SPAM_REAL, REAL]);
    expect(out.map((o) => [o.itemId, o.moment, o.cls])).toEqual([
      ["freeze.2.area_40", "freeze", "heard_not_followed"],
      ["probe.s.cycle_3.b", "spam_prompt", "followed"],
      ["freeze.2.south_flank", "freeze", "not_heard"],
    ]);
    expect(out[1]!.firstRetrieved).toEqual({ queryId: "q1", tool: "haku", rank: 1, latencyMs: 6000, latencyOutsideFreezeMs: 4000 });
    expect(out.every((o) => o.momentReached)).toBe(true);
    // Decoys have no items.
    expect(pointerItemClasses(l.records, [DECOY])).toEqual([]);
  });
});

describe("the scenario's pointers as the default", () => {
  it("is among the telemetry's derived measures", () => {
    expect(derived.pointerFollowUps).toBe(pointerFollowUps);
    expect(derived.pointerFollowUpRates).toBe(pointerFollowUpRates);
    expect(derived.pointerItemClasses).toBe(pointerItemClasses);
  });

  it("POINTER_SPECS name the scenario's pointer atoms and their marks exactly, each with its window's start", () => {
    const scenario = buildDemoScenario();
    const marked = scenario.atoms.filter((a) => a.pointer).map((a) => ({ atomId: a.id, to: a.pointer!.to, kind: a.pointer!.kind }));
    expect(POINTER_SPECS.map(({ atomId, to, kind }) => ({ atomId, to, kind }))).toEqual(marked);
    expect(POINTER_SPECS.filter((p) => p.windowStart === "step_boundary").map((p) => p.atomId)).toEqual(["atom.ptr.3.0", "atom.ptr.3.1", "atom.ptr.15.0", "atom.ptr.17.0", "atom.ptr.17.1"]);
  });
});
