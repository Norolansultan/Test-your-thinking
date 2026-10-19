/**
 * The plan-confidence item (SPEC/30 §5.4; `plan-confidence.ts`): after each main view's plan is final — the view ended by
 * the participant's confirmation, its minimum length or its time cap; never after a demonstration skip, never in the
 * practice view — one item on the study's 25/50/75/100 scale, before the next view starts. `plan_confidence_presented`
 * is durable before the item shows (I5); `plan_confidence_submitted { cycle, value }`. The tools are closed meanwhile.
 * A session interrupted during the item replays the view from its start (SPEC/05 §9) and asks it again after its end.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cycleScheduleOf } from "../../app/scenario/views.js";
import { planSessionResume } from "../../app/telemetry/resume.js";
import { InMemoryLogSink } from "../../app/telemetry/log.js";
import { INTERRUPTION_FAULT_CLASS } from "../../app/session/orchestrator.js";
import { completeView as completeFast, newSession } from "./session-run.js";
import { PLAN, runOutView } from "./view-flow.js";
import { atView, HeldSink, indexOfKind, ofKind, scenario, settle, startSession } from "./spec30-helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the plan's confidence after a main view (SPEC/30 §5.4)", () => {
  it("follows the view's end (participant_confirm), shown once its record is durable (I5); rated, the next view starts", async () => {
    const sink = new HeldSink();
    const { o, snap } = await atView(1, "radio", { sink });
    await vi.advanceTimersByTimeAsync(125_000);
    sink.hold();
    const submitted = o.submitAllocation(PLAN);
    await settle();
    sink.release();
    await submitted;
    // Shown only now: `plan_confidence_presented` is durable.
    expect(snap()).toMatchObject({ currentCycle: 1, step: "plan_confidence", planConfidence: { cycle: 1 }, toolsLocked: true, decisionHeld: false });
    let records = await o.logRecords();
    expect(ofKind(records, "plan_confidence_presented").map((r) => r.detail)).toEqual([{ cycle: 1 }]);
    expect(indexOfKind(records, "view_ended", 1)).toBeLessThan(indexOfKind(records, "plan_confidence_presented", 1));
    expect(ofKind(records, "cycle_end", 1)).toEqual([]); // the view is not left yet

    await expect(o.submitPlanConfidence(60)).rejects.toThrow(RangeError); // the one scale
    await expect(o.askAiChat("where?")).rejects.toThrow(/Haku and Thinker work only inside a view/);
    await expect(o.submitAllocation(PLAN)).rejects.toThrow(/submitAllocation in step plan_confidence/);
    await o.submitPlanConfidence(75);
    expect(snap()).toMatchObject({ currentCycle: 2, step: "exploration", planConfidence: null, toolsLocked: false });
    await expect(o.submitPlanConfidence(75)).rejects.toThrow(/submitPlanConfidence in step exploration/);
    records = await o.logRecords();
    expect(ofKind(records, "plan_confidence_submitted").map((r) => r.detail)).toEqual([{ cycle: 1, value: 75 }]);
    expect(indexOfKind(records, "plan_confidence_submitted", 1)).toBeLessThan(indexOfKind(records, "cycle_end", 1));
    expect(indexOfKind(records, "cycle_end", 1)).toBeLessThan(indexOfKind(records, "cycle_start", 2));
  });

  it("the screen does not show the item before plan_confidence_presented is durable", async () => {
    const sink = new HeldSink();
    const { o, snap } = await atView(1, "radio", { sink });
    await vi.advanceTimersByTimeAsync(20_000);
    await o.submitAllocation(PLAN); // confirmed early: the view ends at its minimum
    sink.hold();
    await vi.advanceTimersByTimeAsync(100_000);
    expect(snap().planConfidence).toBeNull();
    await expect(o.submitPlanConfidence(50)).rejects.toThrow();
    sink.release();
    await settle();
    expect(snap()).toMatchObject({ step: "plan_confidence", planConfidence: { cycle: 1 } });
    expect(ofKind(await o.logRecords(), "view_ended", 1).map((r) => r.detail)).toEqual([{ cycle: 1, viewSeconds: 120, endedBy: "minimum_length" }]);
  });

  it("after a time cap with no plan too; a second click is refused while the first is written", async () => {
    const sink = new HeldSink();
    const { o, snap } = await atView(1, "reasoning_intent", { sink });
    await vi.advanceTimersByTimeAsync(150_000);
    expect(snap()).toMatchObject({ step: "plan_confidence", planConfidence: { cycle: 1 } });
    expect(ofKind(await o.logRecords(), "view_ended", 1).map((r) => r.detail)).toEqual([{ cycle: 1, viewSeconds: 150, endedBy: "time_cap", stepAtEnd: "allocation" }]);
    sink.hold();
    const first = o.submitPlanConfidence(25);
    await expect(o.submitPlanConfidence(50)).rejects.toThrow(/already submitting/);
    sink.release();
    await first;
    expect(snap()).toMatchObject({ currentCycle: 2, step: "exploration", previousViewTimedOutWithoutPlan: true });
    expect(ofKind(await o.logRecords(), "plan_confidence_submitted").map((r) => r.detail)).toEqual([{ cycle: 1, value: 25 }]);
  });

  it("is never asked in the practice view, nor after a demonstration skip; the hinge follows V7's", async () => {
    const r = await startSession("radio", { allowViewSkip: true });
    await completeVP(r.o, r.snap);
    expect(r.snap().step).toBe("training");
    expect(ofKind(await r.o.logRecords(), "plan_confidence_presented")).toEqual([]);
    await r.o.completeTraining();
    await vi.advanceTimersByTimeAsync(5_000);
    await r.o.skipView();
    expect(r.snap()).toMatchObject({ currentCycle: 2, step: "exploration" });
    expect(ofKind(await r.o.logRecords(), "plan_confidence_presented")).toEqual([]);

    const v7 = await atView(7);
    await runOutView(v7.o, v7.snap);
    await v7.o.submitAllocation(PLAN);
    expect(v7.snap()).toMatchObject({ currentCycle: 7, step: "plan_confidence" });
    await v7.o.submitPlanConfidence(100);
    expect(v7.snap().step).toBe("hinge_pause");
    const records = await v7.o.logRecords();
    expect(ofKind(records, "plan_confidence_submitted").map((x) => (x.detail as { cycle: number }).cycle)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(indexOfKind(records, "plan_confidence_submitted", 7)).toBeLessThan(records.findIndex((x) => x.kind === "hinge_pause_start"));
  });

  it("an interruption during the item: the view is replayed from its start, and the item is asked again after its end", async () => {
    vi.setSystemTime(0);
    const sink = new InMemoryLogSink();
    const first = newSession({ sink });
    await first.o.start();
    for (let v = 0; v <= 2; v++) await completeFast(first.o, first.snap);
    expect(first.snap().currentCycle).toBe(3);
    await runOutView(first.o, first.snap);
    await first.o.submitAllocation(PLAN);
    expect(first.snap()).toMatchObject({ currentCycle: 3, step: "plan_confidence", planConfidence: { cycle: 3 } });
    vi.clearAllTimers(); // the tab is closed with the item on screen
    const records = await sink.readAll();
    expect(planSessionResume(records, cycleScheduleOf(scenario)).target).toEqual({ kind: "view", view: 3 });

    vi.setSystemTime(1_000_000);
    const second = newSession({ sink, resume: { header: records[0]!.detail as never, records, interruptedForMs: 30_000 } });
    await second.o.start();
    const resumed = (await sink.readAll()).slice(records.length);
    expect(resumed.map((r) => r.kind).slice(0, 4)).toEqual(["fault", "fault_resolved", "session_resumed", "cycle_start"]);
    expect(resumed[0]!.detail).toEqual({ faultClass: INTERRUPTION_FAULT_CLASS });
    expect(resumed[2]!.detail).toMatchObject({ resumedAt: "view", cycleReplayed: 3 });
    expect(second.snap()).toMatchObject({ currentCycle: 3, step: "exploration", planConfidence: null });
    await runOutView(second.o, second.snap);
    await second.o.submitAllocation(PLAN);
    expect(second.snap()).toMatchObject({ currentCycle: 3, step: "plan_confidence" });
    await second.o.submitPlanConfidence(50);
    expect(second.snap().currentCycle).toBe(4);
    const all = await sink.readAll();
    expect(ofKind(all, "plan_confidence_presented", 3)).toHaveLength(2); // the interrupted one stays in the log
    expect(ofKind(all, "plan_confidence_submitted", 3).map((r) => r.detail)).toEqual([{ cycle: 3, value: 50 }]);
    expect(ofKind(all, "cycle_end", 3)).toHaveLength(1);
    expect(planSessionResume(all, cycleScheduleOf(scenario)).target).toEqual({ kind: "view", view: 4 });
  });
});

/** The practice view run out and its plan confirmed (the practice SPAM forced and answered if still up). */
async function completeVP(o: Awaited<ReturnType<typeof startSession>>["o"], snap: () => import("../../app/session/orchestrator.js").SessionSnapshot): Promise<void> {
  await runOutView(o, snap);
  await o.submitAllocation(PLAN);
  while (snap().step !== "training") {
    const spam = snap().spam;
    if (spam?.phase === "ready") await o.spamReady();
    else if (spam?.phase === "item") await o.answerSpam(spam.options[0]!.id);
    else if (spam?.phase === "confidence") await o.submitSpamConfidence(50);
    else await vi.advanceTimersByTimeAsync(1_000);
  }
}
