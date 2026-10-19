/**
 * SPAM revision (ag) (researcher, 9 Oct 2026) in the running session: the ready prompt does not expire;
 * a view end that falls due while it is still up FORCES the item — the view's clock paused (no cue, the
 * cap included, fires), the item a modal step with the 60 s answer window, Haku and the Thinker usable
 * (the step gate accepts the paused end-of-view state), `spam_ready` `forced` with the view moment and
 * the held end, the ready latency censored there — and the view ends, at that moment, when the probe
 * closes. Also: collapsing the prompt (logged, nothing cancelled), the demonstration skip during the
 * prompt (logged `skipped`), and a session interrupted during a forced item resuming into it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SPAM_ANSWER_TIMEOUT_MS, SPAM_OFFSET_MS } from "../../app/scenario/demo-probes.js";
import { SessionOrchestrator, type SessionOptions, type SessionSnapshot } from "../../app/session/orchestrator.js";
import type { ThinkerResponse } from "../../app/session/thinker-protocol.js";
import type { ThinkerTransport } from "../../app/session/thinker-transport.js";
import { InMemoryLogSink, type LogRecord } from "../../app/telemetry/log.js";
import { planSessionResume } from "../../app/telemetry/resume.js";
import { cycleScheduleOf } from "../../app/scenario/views.js";
import { spamKeysOf, spamMeasures } from "../../app/telemetry/spam-measures.js";
import { allocateAndConfirm, passHinge, PLAN, runOutView } from "./view-flow.js";
import { completeView as completeFast, newSession } from "./session-run.js";

const scenario = buildDemoScenario();
const keys = spamKeysOf(scenario.probeSchedule.probes, scenario.invariants);

const LIVE: ThinkerResponse = {
  answer: { vastaus: "Ei tietoa.", perusteet: "—", varmuus: "epävarma", muuttaisi: "—" },
  retrieved: [], modelId: "test-model", promptHash: "a".repeat(64), latencyMs: 3100, fallback: false, fallbackReason: null, retrievalMode: "hybrid", promptVariant: "standard",
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A session (study timing) with every view before `view` completed; `view` has just opened. */
async function at(view: number, options: SessionOptions = {}, condition: "directed" | "substitutive" = "substitutive") {
  const o = new SessionOrchestrator(scenario, condition, options);
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  const snap = () => box.snap!;
  await o.start();
  while (snap().currentCycle !== view) {
    await runOutView(o, snap);
    await allocateAndConfirm(o, snap);
    if (snap().step === "training") await o.completeTraining();
    if (snap().step === "hinge_pause") await passHinge(o);
  }
  return { o, snap };
}

const ofProbe = (records: readonly LogRecord[], kind: string, probeId: string) => records.filter((r) => r.kind === kind && (r.detail as { probeId?: string }).probeId === probeId);
const viewEnded = (records: readonly LogRecord[], view: number) => records.find((r) => r.kind === "view_ended" && (r.detail as { cycle: number }).cycle === view);

describe("the ready prompt left up is forced at the view's end", () => {
  it("on the participant's confirmation after the minimum: the clock paused, a modal item, the tools usable (the Thinker's step gate included), the end held until it closes", async () => {
    const transport = vi.fn<ThinkerTransport>().mockResolvedValue(LIVE);
    const { o, snap } = await at(3, { thinker: { transport } });
    const P = "probe.s.cycle_3";
    while (!snap().minimumReached) await vi.advanceTimersByTimeAsync(1_000);
    expect(snap().spam).toMatchObject({ phase: "ready" }); // waited far past the old 15 s
    const atConfirm = snap().minViewSeconds + 0; // the confirmation falls a moment after the minimum
    await o.submitAllocation(PLAN);

    expect(snap()).toMatchObject({ currentCycle: 3, step: "awaiting_view_end", decisionHeld: true, toolsLocked: false, spam: { phase: "item", forced: true, probeId: P } });
    let records = await o.logRecords();
    const forced = ofProbe(records, "spam_ready", P);
    expect(forced).toHaveLength(1);
    const detail = forced[0]!.detail as { atViewSeconds: number };
    expect(detail).toEqual({ probeId: P, timedOut: false, forced: true, atViewSeconds: detail.atViewSeconds, viewEndedBy: "participant_confirm" });
    expect(detail.atViewSeconds).toBeGreaterThanOrEqual(atConfirm);
    expect(viewEnded(records, 3)).toBeUndefined();

    // The clock stands still: the countdown does not move and the 150 s cap does not fire, however long the item is open.
    const left = snap().secondsLeft;
    await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS - 5_000);
    expect(snap()).toMatchObject({ currentCycle: 3, secondsLeft: left, spam: { forced: true } });
    expect(viewEnded(await o.logRecords(), 3)).toBeUndefined();

    // The tools at hand in the paused end-of-view state (revision (ag)): Haku and the Thinker's view-step gate accept it.
    await expect(o.searchAtoms("KY21")).resolves.toBeDefined();
    const asked = o.askAiChat("mitä alue pyysi?"); // Haku's chat
    const thought = o.askOpenThinker("mitä alue pyysi?"); // the Open Thinker (the AI cell's main views)
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(asked).resolves.toBeDefined();
    await expect(thought).resolves.toBeDefined();
    expect(transport).toHaveBeenCalled(); // (the Open Thinker logs its own question: `thinkerQueries` below)
    await expect(o.submitAllocation(PLAN)).rejects.toThrow(); // the decision strip is held

    await o.answerSpam("a");
    expect(snap().currentCycle).toBe(3); // the confidence is still asked
    await o.submitSpamConfidence(75);
    // SPEC/30 §5.2: V3's second item, forced too (modal, the clock still paused), holds the end until it closes.
    expect(snap()).toMatchObject({ currentCycle: 3, step: "awaiting_view_end", secondsLeft: left, spam: { phase: "item", forced: true, probeId: `${P}.b`, itemIndex: 2, itemCount: 2 } });
    expect(viewEnded(await o.logRecords(), 3)).toBeUndefined();
    await o.answerSpam("b");
    await o.submitSpamConfidence(50);
    expect(snap()).toMatchObject({ currentCycle: 3, step: "plan_confidence" }); // SPEC/30 §5.4: the view has ended; its plan's confidence
    await o.submitPlanConfidence(75);
    expect(snap().currentCycle).toBe(4);
    records = await o.logRecords();
    const closed = records.findIndex((r) => r.kind === "spam_closed" && (r.detail as { probeId: string }).probeId === P);
    const ended = records.findIndex((r) => r.kind === "view_ended" && (r.detail as { cycle: number }).cycle === 3);
    expect(ended).toBeGreaterThan(closed);
    expect(records[ended]!.detail).toEqual({ cycle: 3, viewSeconds: detail.atViewSeconds, endedBy: "participant_confirm" });

    const m = spamMeasures(records, keys).find((x) => x.probeId === P)!;
    const prompt = ofProbe(records, "spam_prompt_shown", P)[0]!;
    expect(m).toMatchObject({ forced: true, readyCensored: true, readyLatencyMs: forced[0]!.tWallOffsetMs - prompt.tWallOffsetMs, response: "a", confidence: 75, toolQueries: 3, hakuQueries: 2, thinkerQueries: 1, answeredAfterToolAnswer: true });
    expect(m.readyLatencyMs!).toBeGreaterThan(90_000);
  });

  it("at the 150 s cap with no plan: forced with the cap's end; no answer within 60 s is logged null; the view ends at 150 s with what was left", async () => {
    const { o, snap } = await at(6);
    const P = "probe.s.cycle_6";
    await vi.advanceTimersByTimeAsync(150_000);
    expect(snap()).toMatchObject({ currentCycle: 6, step: "allocation", spam: { phase: "item", forced: true } });
    expect(ofProbe(await o.logRecords(), "spam_ready", P).map((r) => r.detail)).toEqual([{ probeId: P, timedOut: false, forced: true, atViewSeconds: 150, viewEndedBy: "time_cap" }]);
    await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS - 1);
    expect(snap().currentCycle).toBe(6);
    await vi.advanceTimersByTimeAsync(1);
    // SPEC/30 §5.2: the first item's window out (logged null), V6's second item is forced too — its own 60 s window, the clock still paused.
    expect(snap()).toMatchObject({ currentCycle: 6, step: "allocation", spam: { phase: "item", forced: true, probeId: `${P}.b`, itemIndex: 2 } });
    expect(viewEnded(await o.logRecords(), 6)).toBeUndefined();
    await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS - 1);
    expect(snap().currentCycle).toBe(6);
    await vi.advanceTimersByTimeAsync(1);
    expect(snap()).toMatchObject({ currentCycle: 6, step: "plan_confidence" }); // SPEC/30 §5.4: after a cap's end too
    await o.submitPlanConfidence(25);
    expect(snap().currentCycle).toBe(7);
    const records = await o.logRecords();
    expect(ofProbe(records, "spam_answered", P).map((r) => r.detail)).toEqual([{ probeId: P, response: null, timedOut: true }]);
    expect(ofProbe(records, "spam_answered", `${P}.b`).map((r) => r.detail)).toEqual([{ probeId: `${P}.b`, response: null, timedOut: true }]);
    expect(viewEnded(records, 6)!.detail).toEqual({ cycle: 6, viewSeconds: 150, endedBy: "time_cap", stepAtEnd: "allocation" });
    expect(spamMeasures(records, keys).find((x) => x.probeId === P)).toMatchObject({ forced: true, readyCensored: true, answerTimedOut: true, response: null, correct: null });
  });

  it("a voluntary 'ready' is never forced, and an item open at the view's end still holds it (the clock not paused)", async () => {
    const { o, snap } = await at(8);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    await o.spamReady();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(snap().spam).toMatchObject({ forced: false });
    await o.answerSpam("b");
    await o.submitSpamConfidence(50);
    const ready = ofProbe(await o.logRecords(), "spam_ready", "probe.s.cycle_8");
    expect(ready.map((r) => r.detail)).toEqual([{ probeId: "probe.s.cycle_8", timedOut: false }]);
  });
});

describe("collapsing the ready prompt (revision (ag))", () => {
  it("collapses to the pill and expands again, logged; nothing is cancelled: the prompt stays pending and the ready latency runs on", async () => {
    const { o, snap } = await at(8);
    const P = "probe.s.cycle_8";
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    await o.collapseSpam();
    expect(snap().spam).toEqual({ phase: "ready", probeId: P, collapsed: true });
    await o.collapseSpam(); // already collapsed: nothing new logged
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snap().spam).toMatchObject({ phase: "ready", collapsed: true });
    await o.expandSpam();
    expect(snap().spam).toMatchObject({ collapsed: false });
    await o.collapseSpam();
    await vi.advanceTimersByTimeAsync(5_000);
    await o.spamReady(); // from the pill's state too
    expect(snap().spam).toMatchObject({ phase: "item", forced: false });
    await expect(o.collapseSpam()).rejects.toThrow(); // only the ready prompt collapses
    await o.answerSpam("a");
    await o.submitSpamConfidence(50);
    const records = await o.logRecords();
    const spam = records.filter((r) => /^spam_/.test(r.kind) && (r.detail as { probeId: string }).probeId === P);
    expect(spam.map((r) => r.kind)).toEqual(["spam_prompt_shown", "spam_collapsed", "spam_expanded", "spam_collapsed", "spam_ready", "spam_answered", "spam_closed"]);
    expect(spam[1]!.detail).toEqual({ probeId: P });
    expect(spam[2]!.tWallOffsetMs - spam[1]!.tWallOffsetMs).toBe(20_000);
    expect(spamMeasures(records, keys).find((x) => x.probeId === P)).toMatchObject({ collapses: 2, readyLatencyMs: 25_000, forced: false });
  });

  it("a collapsed prompt is still forced at the view's end", async () => {
    const { o, snap } = await at(11);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    await o.collapseSpam();
    while (!snap().minimumReached) await vi.advanceTimersByTimeAsync(1_000);
    await o.submitAllocation(PLAN);
    expect(snap().spam).toMatchObject({ phase: "item", forced: true });
  });
});

describe("the demonstration skip (revision (ag))", () => {
  it("during the ready prompt: the probe logged `skipped` and closed, no item, then the view ends as skipped; a prompt not yet due is not logged; no skip under an open item", async () => {
    const { o, snap } = await at(3, { allowViewSkip: true });
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    expect(snap()).toMatchObject({ spam: { phase: "ready" }, skipAvailable: true });
    await o.skipView();
    expect(snap()).toMatchObject({ currentCycle: 4, spam: null });
    let records = await o.logRecords();
    const P = "probe.s.cycle_3";
    expect(ofProbe(records, "spam_ready", P).map((r) => r.detail)).toEqual([{ probeId: P, timedOut: false, skipped: true }]);
    expect(ofProbe(records, "spam_closed", P)).toHaveLength(1);
    expect(ofProbe(records, "spam_answered", P)).toHaveLength(0);
    expect(viewEnded(records, 3)!.detail).toMatchObject({ endedBy: "skipped" });
    expect(spamMeasures(records, keys).find((x) => x.probeId === P)).toMatchObject({ skipped: true, readyLatencyMs: null, forced: false });

    // V6: skipped before its prompt is due — nothing of the probe is logged (as a freeze still to come).
    while (snap().currentCycle !== 6) {
      await runOutView(o, snap);
      await allocateAndConfirm(o, snap);
    }
    await o.skipView();
    records = await o.logRecords();
    expect(records.filter((r) => (r.detail as { probeId?: string }).probeId === "probe.s.cycle_6")).toEqual([]);

    // V8: an open item is not skipped.
    while (snap().currentCycle !== 8) {
      await runOutView(o, snap);
      await allocateAndConfirm(o, snap);
      if (snap().step === "hinge_pause") await passHinge(o);
    }
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    await o.spamReady();
    expect(snap().skipAvailable).toBe(false);
    await expect(o.skipView()).rejects.toThrow(/SPAM item is open/);
  });
});

describe("resume into a forced item (revision (ag))", () => {
  it("an interruption during the forced item resumes into it — no replay of the view — and the view ends with the end it held", async () => {
    vi.setSystemTime(0);
    const sink = new InMemoryLogSink();
    const first = newSession({ sink });
    await first.o.start();
    for (let v = 0; v <= 2; v++) await completeFast(first.o, first.snap);
    expect(first.snap().currentCycle).toBe(3);
    while (!first.snap().minimumReached) await vi.advanceTimersByTimeAsync(500);
    expect(first.snap().spam).toMatchObject({ phase: "ready" });
    await first.o.submitAllocation(PLAN);
    expect(first.snap().spam).toMatchObject({ forced: true });
    await vi.advanceTimersByTimeAsync(4_000);
    vi.clearAllTimers(); // the tab is closed
    const records = await sink.readAll();
    const forced = records.find((r) => r.kind === "spam_ready" && (r.detail as { forced?: boolean }).forced)!.detail as { atViewSeconds: number };

    const plan = planSessionResume(records, cycleScheduleOf(scenario));
    expect(plan.target).toEqual({ kind: "spam_forced", view: 3, probeId: "probe.s.cycle_3", atViewSeconds: forced.atViewSeconds, viewEndedBy: "participant_confirm", planRecorded: true, stepBoundaryReached: false });

    vi.setSystemTime(1_000_000);
    const header = records[0]!.detail as never;
    const second = newSession({ sink, resume: { header, records, interruptedForMs: 60_000 } });
    await second.o.start();
    expect(second.snap()).toMatchObject({ currentCycle: 3, step: "awaiting_view_end", spam: { phase: "item", forced: true, probeId: "probe.s.cycle_3" } });
    const added = (await sink.readAll()).slice(records.length);
    expect(added.map((r) => r.kind)).toEqual(["fault", "fault_resolved", "session_resumed", "spam_ready"]); // no cycle_start: not a replay
    expect(added[2]!.detail).toMatchObject({ resumedAt: "spam_forced", cycleReplayed: 3 });
    expect(added[3]!.detail).toMatchObject({ probeId: "probe.s.cycle_3", forced: true, resumed: true, atViewSeconds: forced.atViewSeconds });

    await vi.advanceTimersByTimeAsync(2_000);
    await second.o.answerSpam("a");
    await second.o.submitSpamConfidence(100);
    // SPEC/30 §5.2: V3's second item, forced too, follows in the resumed delivery; the view ends once it closes.
    expect(second.snap()).toMatchObject({ currentCycle: 3, step: "awaiting_view_end", spam: { phase: "item", forced: true, probeId: "probe.s.cycle_3.b", itemIndex: 2 } });
    await expect(second.o.submitPlanConfidence(100)).rejects.toThrow(/submitPlanConfidence in step awaiting_view_end/); // not before the view has ended
    await second.o.answerSpam("c");
    await second.o.submitSpamConfidence(75);
    expect(second.snap()).toMatchObject({ currentCycle: 3, step: "plan_confidence" });
    await second.o.submitPlanConfidence(100); // SPEC/30 §5.4: the view's end, then its plan's confidence
    expect(second.snap().currentCycle).toBe(4);
    const all = await sink.readAll();
    expect(viewEnded(all, 3)!.detail).toEqual({ cycle: 3, viewSeconds: forced.atViewSeconds, endedBy: (added[3]!.detail as { viewEndedBy: string }).viewEndedBy });
    expect(all.filter((r) => r.kind === "cycle_end" && (r.detail as { cycle: number }).cycle === 3)).toHaveLength(1);
    const m = spamMeasures(all, keys).find((x) => x.probeId === "probe.s.cycle_3")!;
    expect(m).toMatchObject({ forced: true, readyCensored: true, answerLatencyMs: 2_000, response: "a", confidence: 100 });
    expect(planSessionResume(all, cycleScheduleOf(scenario)).target).toEqual({ kind: "view", view: 4 });
  });
});
