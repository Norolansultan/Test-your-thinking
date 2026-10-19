/**
 * The view's flow (researcher decision 1 Oct 2026): no locked exploration phase — the decision
 * panel opens 20 s into the view with the sector plan only (revision (x), 6 Oct 2026: Type J, its
 * follow-ups and the outlook withdrawn), whose submission confirms the period; the view lasts at least its minimum length and ends at
 * the later of that and the confirmation, the allocation revisable meanwhile; the SAGAT freeze
 * interrupts at its pre-planned moment, whatever the participant is doing, and they continue
 * where they were, the view's time standing still in the freeze.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { allocateAndConfirm, answerForcedSpam, passHinge, PLAN, runOutView } from "./view-flow.js";

const scenario = buildDemoScenario();
const practiceFreezeAt = scenario.practice.cycle.freezeAtSeconds!;
const practiceMin = scenario.practice.cycle.minViewSeconds; // 180 s since 11 Oct 2026

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function inPractice() {
  const o = new SessionOrchestrator(scenario, "directed", { participantCode: "P-3" });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  await o.start();
  return { o, snap: () => box.snap! };
}

/** V1, which has no freeze: just entered, view time 0. */
async function inV1() {
  const { o, snap } = await inPractice();
  await runOutView(o, snap);
  await allocateAndConfirm(o, snap);
  await o.completeTraining();
  expect(snap()).toMatchObject({ currentCycle: 1, step: "exploration", freeze: null });
  return { o, snap };
}

const detailsOf = <T>(records: readonly LogRecord[], kind: string) => records.filter((r) => r.kind === kind).map((r) => r.detail as T);

/** SPEC/30 §5.4: the view has ended and its plan's confidence is asked (the view still on screen); rated, the next view starts. */
async function rateThePlan(o: SessionOrchestrator, snap: () => SessionSnapshot, view: number): Promise<void> {
  expect(snap()).toMatchObject({ currentCycle: view, step: "plan_confidence", planConfidence: { cycle: view } });
  await o.submitPlanConfidence(50);
}

describe("the decision panel opens 20 s into the view", () => {
  it("not before: the map, its messages and the projection come first, with only the hint", async () => {
    const { o, snap } = await inPractice();
    expect(snap()).toMatchObject({ step: "exploration", cyclePhase: "exploration" });
    expect(snap().currentEnvelope).not.toBeNull();
    await vi.advanceTimersByTimeAsync(19_999);
    expect(snap().step).toBe("exploration");
    await vi.advanceTimersByTimeAsync(1);
    expect(snap()).toMatchObject({ step: "allocation", cyclePhase: "decision" });
    const records = await o.logRecords();
    expect(detailsOf(records, "exploration_phase_start")).toEqual([{ cycle: 0, explorationSeconds: 20 }]);
    expect(detailsOf(records, "decision_panel_opened")).toEqual([{ cycle: 0, atViewSeconds: 20 }]);
    expect(records.some((r) => r.kind === "decision_phase_start")).toBe(false); // superseded
  });
});

describe("the plan is the only response, and it confirms the period (revision (x), 6 Oct 2026)", () => {
  it("the panel opens on the plan; no judgement, no outlook and no course-of-action item are asked or logged", async () => {
    const { o, snap } = await inV1();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snap().step).toBe("allocation");
    await vi.advanceTimersByTimeAsync(110_000);
    await o.submitAllocation(PLAN);
    await rateThePlan(o, snap, 1);
    expect(snap()).toMatchObject({ currentCycle: 2, step: "exploration" });
    const kinds = (await o.logRecords()).map((r) => r.kind);
    for (const k of ["containment_judgement_submitted", "outlook_submitted", "branch_list_presented", "decision_presented"]) expect(kinds, k).not.toContain(k);
    expect(detailsOf(await o.logRecords(), "allocation_submitted").at(-1)).toMatchObject({ rationaleAsked: false, rationaleFi: null });
    expect(detailsOf(await o.logRecords(), "view_ended").at(-1)).toEqual({ cycle: 1, viewSeconds: 130, endedBy: "participant_confirm" });
  });
});

describe("the minimum length", () => {
  it("confirmed early: the view stays open until 120 s, then ends ('minimum_length')", async () => {
    const { o, snap } = await inV1();
    await vi.advanceTimersByTimeAsync(20_000);
    await allocateAndConfirm(o, snap);
    expect(snap()).toMatchObject({ currentCycle: 1, step: "awaiting_view_end", minimumReached: false });
    await vi.advanceTimersByTimeAsync(99_999);
    expect(snap().currentCycle).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await rateThePlan(o, snap, 1);
    expect(snap()).toMatchObject({ currentCycle: 2, step: "exploration" });
    expect(detailsOf(await o.logRecords(), "view_ended").at(-1)).toEqual({ cycle: 1, viewSeconds: 120, endedBy: "minimum_length" });
  });

  it("confirmed late: the view ends at the confirmation ('participant_confirm'), and the next starts at once", async () => {
    const { o, snap } = await inV1();
    await vi.advanceTimersByTimeAsync(130_000);
    expect(snap()).toMatchObject({ currentCycle: 1, step: "allocation", minimumReached: true });
    await vi.advanceTimersByTimeAsync(5_000);
    await o.submitAllocation(PLAN);
    await rateThePlan(o, snap, 1);
    expect(snap()).toMatchObject({ currentCycle: 2, step: "exploration" });
    expect(detailsOf(await o.logRecords(), "view_ended").at(-1)).toEqual({ cycle: 1, viewSeconds: 135, endedBy: "participant_confirm" });
  });
});

describe("revising the allocation while the confirmed view waits", () => {
  it("every resubmission is logged as a numbered revision with its orders", async () => {
    const { o, snap } = await inV1();
    expect(() => o.reviseAllocation()).toThrow(/reviseAllocation in step exploration/);
    await vi.advanceTimersByTimeAsync(20_000);
    await o.submitAllocation(PLAN);

    await o.reviseAllocation();
    expect(snap()).toMatchObject({ step: "allocation", revisingAllocation: true });
    await o.submitAllocation({ mainEffort: "L1", posture: "direct_attack", secondary: { sectorId: "L3", taskId: "task.mopup" }, drones: null });
    expect(snap()).toMatchObject({ step: "awaiting_view_end", revisingAllocation: false });
    await o.reviseAllocation();
    await o.submitAllocation({ mainEffort: "L2", posture: "direct_attack", secondary: null, drones: null });

    const all = await o.logRecords();
    const records = all.slice(all.findIndex((r) => r.kind === "cycle_start" && (r.detail as { cycle: number }).cycle === 1)); // V1's
    expect(detailsOf(records, "allocation_submitted")).toHaveLength(1);
    expect(detailsOf(records, "allocation_revised")).toEqual([
      { cycle: 1, revision: 1, plan: { mainEffort: "L1", posture: "direct_attack", secondary: { sectorId: "L3", taskId: "task.mopup" }, drones: null } },
      { cycle: 1, revision: 2, plan: { mainEffort: "L2", posture: "direct_attack", secondary: null, drones: null } },
    ]);
    await vi.advanceTimersByTimeAsync(100_000);
    await rateThePlan(o, snap, 1);
    expect(snap().currentCycle).toBe(2);
    expect(detailsOf(await o.logRecords(), "view_ended").at(-1)).toMatchObject({ cycle: 1, endedBy: "minimum_length" });
  });

  it("a revision still open when the minimum length passes is dropped: the view ends on the last submitted orders", async () => {
    const { o, snap } = await inV1();
    await vi.advanceTimersByTimeAsync(20_000);
    await allocateAndConfirm(o, snap);
    await o.reviseAllocation();
    await vi.advanceTimersByTimeAsync(100_000);
    await rateThePlan(o, snap, 1);
    expect(snap()).toMatchObject({ currentCycle: 2, step: "exploration", revisingAllocation: false });
    expect(detailsOf(await o.logRecords(), "allocation_revised")).toHaveLength(0);
  });
});

describe("the SAGAT freeze at its pre-planned moment", () => {
  it("interrupts exploration of the open panel at freezeAtSeconds, and the participant continues there", async () => {
    const { o, snap } = await inPractice();
    await vi.advanceTimersByTimeAsync(practiceFreezeAt * 1000 - 1);
    expect(snap().step).toBe("allocation");
    await vi.advanceTimersByTimeAsync(1);
    expect(snap().step).toBe("freeze");
    expect(detailsOf(await o.logRecords(), "freeze_started")).toEqual([
      { cycle: 0, atViewSeconds: practiceFreezeAt, decisionCommittedBeforeFreeze: false, decisionStep: "allocation" },
    ]);
    await o.submitFreeze([]);
    expect(snap().step).toBe("allocation");
  });

  it("logs a decision already committed, and holds the view's time still while the picture is hidden", async () => {
    const { o, snap } = await inPractice();
    await vi.advanceTimersByTimeAsync(20_000);
    await o.submitAllocation(PLAN); // the plan confirms the period; the practice view ends at its minimum
    await vi.advanceTimersByTimeAsync((practiceFreezeAt - 20) * 1000);
    expect(snap().step).toBe("freeze");
    expect(detailsOf(await o.logRecords(), "freeze_started")[0]).toMatchObject({ decisionCommittedBeforeFreeze: true, decisionStep: "awaiting_view_end" });
    await vi.advanceTimersByTimeAsync(30_000); // the view's time does not run in the freeze (a freeze past the cap: review-fixes.spec)
    expect(snap().step).toBe("freeze");
    await o.submitFreeze([]);
    expect(snap().step).toBe("awaiting_view_end");
    await vi.advanceTimersByTimeAsync((practiceMin - practiceFreezeAt) * 1000 - 1);
    expect(snap().step).toBe("awaiting_view_end");
    await vi.advanceTimersByTimeAsync(1);
    await answerForcedSpam(o); // the practice SPAM prompt, left up, is forced at the view's end (revision (ag))
    expect(snap().step).toBe("training");
    expect(detailsOf(await o.logRecords(), "view_ended")).toEqual([{ cycle: 0, viewSeconds: practiceMin, endedBy: "minimum_length" }]);
  });

  it("happens in every freeze view at that view's own moment — V10, V12 and V14 at the view's end (SPEC/30 §5.1, `31` §3.8) — identically on every run", async () => {
    const run = async () => {
      const { o, snap } = await inPractice();
      for (let view = 0; view <= 14; view++) {
        await runOutView(o, snap);
        await allocateAndConfirm(o, snap);
        if (snap().step === "training") await o.completeTraining();
        if (snap().step === "hinge_pause") await passHinge(o);
      }
      const records = await o.logRecords();
      return { starts: detailsOf<{ cycle: number; atViewSeconds: number; decisionStep: string }>(records, "freeze_started"), ends: detailsOf<{ cycle: number; viewSeconds: number }>(records, "view_ended") };
    };
    const first = await run();
    const endOf = (view: number) => first.ends.find((e) => e.cycle === view)!.viewSeconds;
    const expected = [scenario.practice.cycle, ...scenario.cycles].filter((c) => c.hasFreeze)
      .map((c) => ({ cycle: c.index, atViewSeconds: c.freezeAtViewEnd ? endOf(c.index) : c.freezeAtSeconds }));
    expect(first.starts.map(({ cycle, atViewSeconds }) => ({ cycle, atViewSeconds }))).toEqual(expected);
    expect(first.starts.filter((f) => f.decisionStep === "view_ended").map((f) => f.cycle)).toEqual([10, 12, 14]);
    expect(await run()).toEqual(first);
  });
});

describe("the demonstration's skip (6 Oct 2026)", () => {
  async function demo(allowViewSkip: boolean) {
    const o = new SessionOrchestrator(scenario, "directed", { participantCode: "P-3", allowViewSkip });
    const box: { snap: SessionSnapshot | null } = { snap: null };
    o.subscribe((s) => (box.snap = s));
    await o.start();
    return { o, snap: () => box.snap! };
  }

  it("is not offered without the option (the study), and refuses there", async () => {
    const { o, snap } = await demo(false);
    expect(snap()).toMatchObject({ skipAllowed: false, skipAvailable: false });
    await expect(o.skipView()).rejects.toThrow(/demonstration only/);
    expect((await o.logRecords())[0]!.detail).not.toHaveProperty("viewSkipAllowed");
  });

  it("ends the view at once, on the real times, logged as skipped with the step left; what follows comes as usual", async () => {
    const { o, snap } = await demo(true);
    expect((await o.logRecords())[0]!.detail).toMatchObject({ viewSkipAllowed: true });
    expect(snap()).toMatchObject({ currentCycle: 0, minViewSeconds: practiceMin, skipAllowed: true, skipAvailable: true, step: "exploration" });
    await vi.advanceTimersByTimeAsync(5_000);
    await o.skipView();
    expect(snap().step).toBe("training"); // the practice view's freeze (not reached) and plan are not asked
    expect(detailsOf(await o.logRecords(), "view_ended").at(-1)).toEqual({ cycle: 0, viewSeconds: 5, endedBy: "skipped", stepAtEnd: "exploration" });
    expect(snap().skipAvailable).toBe(false); // not on the training screen
    await o.completeTraining();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snap()).toMatchObject({ currentCycle: 1, step: "allocation", skipAvailable: true });
    await o.skipView();
    expect(snap()).toMatchObject({ currentCycle: 2, step: "exploration" });
    expect(detailsOf(await o.logRecords(), "view_ended").at(-1)).toMatchObject({ cycle: 1, endedBy: "skipped", stepAtEnd: "allocation" });
  });

  it("skipping V14 opens its after-view probes (was a hang: the probes were held for the skip's own write), then the session ends", async () => {
    const o = new SessionOrchestrator(scenario, "directed", { participantCode: "P-3", allowViewSkip: true, visibleProbes: true });
    const box: { snap: SessionSnapshot | null } = { snap: null };
    o.subscribe((s) => (box.snap = s));
    const snap = () => box.snap!;
    await o.start();
    while (snap().currentCycle !== 14 || snap().step !== "exploration") {
      if (snap().step === "training") await o.completeTraining();
      else if (snap().step === "hinge_pause") await passHinge(o);
      else await o.skipView(); // at each view's start: before its freeze, SPAM or probe
    }
    await o.skipView();
    expect(snap().step).toBe("probe");
    expect(snap().visibleProbe).not.toBeNull();
    while (snap().step === "probe") {
      const p = snap().visibleProbe!;
      if (p.kind === "choice") await o.submitProbeChoice(p.options[0]!.id, p.collectsConfidence ? 50 : undefined);
      else if (p.kind === "scale") await o.submitProbeScale(50);
      else await o.submitProbeArea(false, []);
    }
    expect(snap().step).toBe("complete");
    const records = await o.logRecords();
    expect(detailsOf(records, "view_ended").at(-1)).toMatchObject({ cycle: 14, endedBy: "skipped" });
    expect(records.filter((r) => r.kind === "probe_submitted")).toHaveLength(2);
  });

  it("is not offered while a freeze is open (the freeze screen has its own skip: a submission with what is answered)", async () => {
    const { o, snap } = await demo(true);
    await vi.advanceTimersByTimeAsync(scenario.practice.cycle.freezeAtSeconds! * 1000);
    expect(snap()).toMatchObject({ step: "freeze", skipAvailable: false, skipAllowed: true });
    await expect(o.skipView()).rejects.toThrow(/skipView in step freeze/);
    await o.submitFreeze([]);
    expect(snap().skipAvailable).toBe(true);
  });
});

describe("the plan recorded, and the time-out notice (review 6 Oct 2026)", () => {
  it("the snapshot carries the plan last recorded in the view (submitted, then revised); the next view starts with none", async () => {
    const { o, snap } = await inPractice();
    expect(snap().recordedPlan).toBeNull();
    await vi.advanceTimersByTimeAsync(20_000);
    await o.submitAllocation(PLAN);
    expect(snap()).toMatchObject({ step: "awaiting_view_end", recordedPlan: PLAN });
    await o.reviseAllocation();
    expect(snap()).toMatchObject({ step: "allocation", revisingAllocation: true, recordedPlan: PLAN }); // the form's prefill
    const revised = { ...PLAN, mainEffort: "L3", secondary: { sectorId: "L2", taskId: "task.hold-line" as const } };
    await o.submitAllocation(revised);
    expect(snap().recordedPlan).toEqual(revised);
    expect(JSON.stringify(snap().recordedPlan)).not.toMatch(/correct|key|invariant/i);
    await runOutView(o, snap);
    expect(snap().step).toBe("training");
    await o.completeTraining();
    expect(snap()).toMatchObject({ currentCycle: 1, recordedPlan: null, previousViewTimedOutWithoutPlan: false });
  });

  it("a view ended by its cap with no plan: the next view's exploration says so, and only its exploration", async () => {
    const { o, snap } = await inV1();
    expect(snap().previousViewTimedOutWithoutPlan).toBe(false); // VP ended on a confirmed plan
    while (snap().currentCycle === 1) {
      await vi.advanceTimersByTimeAsync(1_000);
      if (snap().step === "freeze") await o.submitFreeze([]);
      if (snap().planConfidence) await o.submitPlanConfidence(25); // SPEC/30 §5.4: after the view's end, a cap's too
    }
    expect(detailsOf(await o.logRecords(), "view_ended").at(-1)).toMatchObject({ cycle: 1, endedBy: "time_cap" });
    expect(snap()).toMatchObject({ currentCycle: 2, step: "exploration", previousViewTimedOutWithoutPlan: true });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snap()).toMatchObject({ step: "allocation", previousViewTimedOutWithoutPlan: false });
  });

  it("a view whose plan was recorded gives no notice, even with a revision left open at its end", async () => {
    const { o, snap } = await inV1();
    await vi.advanceTimersByTimeAsync(20_000);
    await o.submitAllocation(PLAN);
    await o.reviseAllocation(); // left open: the confirmed period still ends the view at its minimum
    while (snap().currentCycle === 1) {
      await vi.advanceTimersByTimeAsync(1_000);
      if (snap().step === "freeze") await o.submitFreeze([]);
      if (snap().planConfidence) await o.submitPlanConfidence(25); // SPEC/30 §5.4: after the view's end, a cap's too
    }
    expect(detailsOf(await o.logRecords(), "view_ended").at(-1)).toMatchObject({ cycle: 1, endedBy: "minimum_length" });
    expect(snap()).toMatchObject({ currentCycle: 2, step: "exploration", previousViewTimedOutWithoutPlan: false });
  });
});
