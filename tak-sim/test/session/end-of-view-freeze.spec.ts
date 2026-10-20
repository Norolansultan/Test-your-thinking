/**
 * The freeze at the view's end in V10 and V14 (SPEC/30 §5.1): no freeze cue inside the view; after the view has ended
 * and its plan's confidence is given, the freeze runs exactly as freezes run mid-view — the same records
 * (`freeze_started` / `freeze_item_completed` / `freeze_submitted`), the blanked screen, the same items, the freeze's own
 * cap — then the next view (V14: its after-view probes, then the end). `freeze_started` carries the view's end moment and
 * `decisionStep: "view_ended"`. Not after a demonstration skip. An interruption during it replays the view (SPEC/05 §9).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cycleScheduleOf, FREEZE_MAX_SECONDS } from "../../app/scenario/views.js";
import { planSessionResume } from "../../app/telemetry/resume.js";
import { InMemoryLogSink } from "../../app/telemetry/log.js";
import { completeView as completeFast, newSession } from "./session-run.js";
import { keepReview, PLAN, runOutView } from "./view-flow.js";
import { atView, HeldSink, indexOfKind, ofKind, scenario, settle } from "./spec30-helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const v10Items = scenario.freezes.find((f) => f.cycle === 10)!.items;

describe("the freeze at the view's end (SPEC/30 §5.1)", () => {
  it("V10: none during the view; after the plan's confidence the freeze opens at the end moment, blanked, its items; then V11", async () => {
    const sink = new HeldSink();
    const { o, snap } = await atView(10, "radio", { sink });
    const steps = new Set<string>();
    while (!snap().minimumReached) { await vi.advanceTimersByTimeAsync(1_000); steps.add(snap().step); }
    expect(steps.has("freeze")).toBe(false); // no pre-planned moment inside the view
    await vi.advanceTimersByTimeAsync(4_000);
    await o.submitAllocation(PLAN);
    expect(await keepReview(o)).toBe(true); // SPEC/32 §3: phase B, the plan review first
    expect(snap()).toMatchObject({ currentCycle: 10, step: "plan_confidence" });
    expect(ofKind(await o.logRecords(), "freeze_started", 10)).toEqual([]); // the freeze comes after the plan's confidence

    sink.hold();
    const rated = o.submitPlanConfidence(50);
    await settle();
    expect(snap().step).not.toBe("freeze"); // shown once freeze_started is durable (I5)
    sink.release();
    await rated;
    expect(snap()).toMatchObject({ currentCycle: 10, step: "freeze", planConfidence: null, consultPrompt: null, waitingOnSession: true });
    expect(snap().freeze!.items.map((i) => i.id)).toEqual(v10Items.map((i) => i.id));
    let records = await o.logRecords();
    const ended = ofKind(records, "view_ended", 10)[0]!.detail as { viewSeconds: number };
    expect(ended.viewSeconds).toBe(124); // 120 s, then 4 s more before the plan
    expect(ofKind(records, "freeze_started", 10).map((r) => r.detail)).toEqual([{ cycle: 10, atViewSeconds: 124, decisionCommittedBeforeFreeze: true, decisionStep: "view_ended" }]);
    expect(indexOfKind(records, "plan_confidence_submitted", 10)).toBeLessThan(indexOfKind(records, "freeze_started", 10));

    await o.markFreezeItemAnswered(v10Items[0]!.id);
    await o.submitFreeze([]);
    expect(snap()).toMatchObject({ currentCycle: 11, step: "exploration" });
    records = await o.logRecords();
    expect(ofKind(records, "freeze_item_completed", 10).map((r) => (r.detail as { itemId: string }).itemId)).toEqual([v10Items[0]!.id]);
    expect(ofKind(records, "freeze_submitted", 10)[0]!.detail).toMatchObject({ cycle: 10, responses: [], missing: v10Items.map((i) => i.id) });
    const order = ["view_ended", "plan_confidence_presented", "plan_confidence_submitted", "freeze_started", "freeze_submitted", "cycle_end"].map((k) => indexOfKind(records, k, 10));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(indexOfKind(records, "cycle_end", 10)).toBeLessThan(indexOfKind(records, "cycle_start", 11));
  });

  it("closes at the freeze's own cap like any freeze (timedOut, the items missing), then the next view", async () => {
    const { o, snap } = await atView(10);
    await vi.advanceTimersByTimeAsync(150_000); // the cap, no plan: the plan's confidence is still asked, then the freeze
    expect(snap().step).toBe("plan_confidence");
    await o.submitPlanConfidence(25);
    expect(snap().step).toBe("freeze");
    expect(ofKind(await o.logRecords(), "freeze_started", 10)[0]!.detail).toMatchObject({ atViewSeconds: 150, decisionCommittedBeforeFreeze: false, decisionStep: "view_ended" });
    await vi.advanceTimersByTimeAsync(FREEZE_MAX_SECONDS * 1000);
    expect(snap()).toMatchObject({ currentCycle: 11, step: "exploration" });
    expect(ofKind(await o.logRecords(), "freeze_submitted", 10)[0]!.detail).toMatchObject({ timedOut: true, missing: v10Items.map((i) => i.id) });
  });

  it("V14: the plan's confidence, the freeze, then the after-view probes on V14's map, then the end", async () => {
    const { o, snap } = await atView(14, "radio", { visibleProbes: true });
    await runOutView(o, snap);
    await o.submitAllocation(PLAN);
    await keepReview(o);
    await o.submitPlanConfidence(75);
    expect(snap()).toMatchObject({ currentCycle: 14, step: "freeze" });
    await o.submitFreeze([]);
    expect(snap()).toMatchObject({ currentCycle: 14, step: "probe" });
    while (snap().step === "probe") {
      const p = snap().visibleProbe!;
      if (p.kind === "choice") await o.submitProbeChoice(p.options[0]!.id, p.collectsConfidence ? 50 : undefined);
      else await o.submitProbeScale(50);
    }
    expect(snap().step).toBe("complete");
    const records = await o.logRecords();
    const at = (k: string) => indexOfKind(records, k, 14);
    expect(at("plan_confidence_submitted")).toBeLessThan(at("freeze_started"));
    expect(at("freeze_submitted")).toBeLessThan(records.findIndex((r) => r.kind === "probe_presented" && (r.detail as { probeId: string }).probeId === "probe.u.cycle_14"));
    expect(ofKind(records, "freeze_started").map((r) => (r.detail as { cycle: number }).cycle)).toEqual([0, 2, 4, 5, 7, 10, 12, 14]);
  });

  it("not after a demonstration skip (what was left is not asked)", async () => {
    const { o, snap } = await atView(10, "radio", { allowViewSkip: true });
    await vi.advanceTimersByTimeAsync(30_000);
    await o.skipView();
    expect(snap()).toMatchObject({ currentCycle: 11, step: "exploration" });
    const records = await o.logRecords();
    expect(ofKind(records, "freeze_started", 10)).toEqual([]);
    expect(ofKind(records, "plan_confidence_presented", 10)).toEqual([]);
  });

  it("an interruption during it: the view is replayed from its start; after its end the plan's confidence and the freeze again", async () => {
    vi.setSystemTime(0);
    const sink = new InMemoryLogSink();
    const first = newSession({ sink });
    await first.o.start();
    while (first.snap().currentCycle !== 10) await completeFast(first.o, first.snap);
    await runOutView(first.o, first.snap);
    await first.o.submitAllocation(PLAN);
    await keepReview(first.o);
    await first.o.submitPlanConfidence(50);
    expect(first.snap()).toMatchObject({ currentCycle: 10, step: "freeze" });
    await first.o.markFreezeItemAnswered(v10Items[0]!.id);
    vi.clearAllTimers(); // the tab is closed in the freeze
    const records = await sink.readAll();
    expect(planSessionResume(records, cycleScheduleOf(scenario)).target).toEqual({ kind: "view", view: 10 });

    vi.setSystemTime(2_000_000);
    const second = newSession({ sink, resume: { header: records[0]!.detail as never, records, interruptedForMs: 45_000 } });
    await second.o.start();
    expect(second.snap()).toMatchObject({ currentCycle: 10, step: "exploration" });
    await runOutView(second.o, second.snap);
    expect(second.snap().step).not.toBe("freeze");
    await second.o.submitAllocation(PLAN);
    await keepReview(second.o);
    await second.o.submitPlanConfidence(75);
    expect(second.snap()).toMatchObject({ currentCycle: 10, step: "freeze" });
    await second.o.submitFreeze([]);
    expect(second.snap().currentCycle).toBe(11);
    const all = await sink.readAll();
    expect(ofKind(all, "freeze_started", 10)).toHaveLength(2);
    expect(ofKind(all, "freeze_submitted", 10)).toHaveLength(1);
    expect(ofKind(all, "freeze_item_completed", 10)).toHaveLength(1); // the first attempt's, kept
    expect(ofKind(all, "cycle_end", 10)).toHaveLength(1);
  });
});
