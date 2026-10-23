/**
 * The session flow over SPEC/26's views: the briefing, the practice view (no AI, practice freeze,
 * tagged telemetry), the training, the fourteen main views with the hinge after V7, the step
 * boundary inside a merged view (SPEC/26 §2), the real view timings and the preview override.
 * Condition-specific rules (SPEC/02 revision (o)) are in `conditions.spec.ts`; the view's own flow
 * (decision panel, freeze, minimum length, revisions) in `view-flow.spec.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario, DIRECTIVE_FI } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { parsePreviewOverride } from "../../app/session/preview.js";
import { STEP_SECONDS } from "../../app/scenario/views.js";
import { clockAtVirtual } from "../../app/render/projection-validity.js";
import { allocateAndConfirm, answerForcedSpam, passHinge, PLAN, runOutView } from "./view-flow.js";

const scenario = buildDemoScenario();
const practiceFreezeAt = scenario.practice.cycle.freezeAtSeconds!;
const practiceMin = scenario.practice.cycle.minViewSeconds; // 180 s since 11 Oct 2026 (PRACTICE_VIEW_MIN_SECONDS)

function start(options: ConstructorParameters<typeof SessionOrchestrator>[2] = {}, condition: "directed" | "substitutive" = "substitutive") {
  const o = new SessionOrchestrator(scenario, condition, options);
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}

/** Starts the session and reads the briefing: the practice view is running. */
async function begin(o: SessionOrchestrator): Promise<void> {
  await o.start();
}

/**
 * Runs the view's time out (answering any freeze), then completes the decision panel — and,
 * after the practice view, the training.
 */
async function completeView(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  await runOutView(o, snap);
  await allocateAndConfirm(o, snap);
  if (snap().step === "training") await o.completeTraining();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the practice view VP (SPEC/26 D3)", () => {
  it("opens the session: 'Harjoitus', the AI group's Thinker practice (revision (am)), the real 180 s, a 4-item freeze, the normal decision panel", async () => {
    const { o, snap } = start();
    await begin(o);
    // Revision (am), 10 Oct 2026: the AI group has its Open Thinker in VP too (the Thinker practice; `thinker-practice-am.spec.ts`).
    expect(snap()).toMatchObject({ currentCycle: 0, practice: true, viewLabel: "Harjoitus", aiAvailable: true, minViewSeconds: practiceMin, decisionOpensAtSeconds: 20, step: "exploration" });

    await vi.advanceTimersByTimeAsync(20_000);
    expect(snap().step).toBe("allocation");
    await vi.advanceTimersByTimeAsync((practiceFreezeAt - 20) * 1000);
    expect(snap().step).toBe("freeze");
    expect(snap().freeze!.items).toHaveLength(5); // difficulty audit (23 Oct 2026): the Haku-only forecast item added
    await o.submitFreeze([]);
    expect(snap().step).toBe("allocation");
    await o.submitAllocation(PLAN);
    expect(snap().step).toBe("awaiting_view_end"); // the plan confirms the period, before the minimum length
    await vi.advanceTimersByTimeAsync((practiceMin - practiceFreezeAt) * 1000);
    expect(await answerForcedSpam(o)).toBe(true); // the practice SPAM prompt, left up, is forced at the view's end (revision (ag))

    expect(snap().step).toBe("training"); // the training follows the practice view (SPEC/15 §2)
    await o.completeTraining();
    expect(snap()).toMatchObject({ currentCycle: 1, practice: false, viewLabel: "Jakso 1 / 14", aiAvailable: true, phase: "A" });
  });

  it("logs the real dwell on the training text, and the briefing passed at once (fix pass 2, 7 Oct 2026; revision (ae))", async () => {
    const { o, snap } = start({ realClockMs: () => Date.now() });
    await o.start();
    await vi.advanceTimersByTimeAsync(7_000);
    await runOutView(o, snap);
    await allocateAndConfirm(o, snap);
    expect(snap().step).toBe("training");
    await vi.advanceTimersByTimeAsync(3_000);
    await o.completeTraining();
    const dwell = (await o.logRecords()).filter((r) => r.kind === "briefing_advanced").map((r) => r.detail);
    expect(dwell).toEqual([{ screenId: "briefing.setting", dwellMs: 0, auto: true, screenRemoved: true }, { screenId: "training.substitutive", dwellMs: 3_000 }]);
  });

  it("tags its telemetry as practice, and the engine leaves WARMUP only after it", async () => {
    const { o, snap } = start();
    await begin(o);
    await completeView(o, snap);
    const records = await o.logRecords();
    const kinds = records.map((r) => [r.kind, r.detail] as const);

    expect(kinds).toContainEqual(["phase_entered", { phase: "practice" }]);
    expect(kinds).toContainEqual(["cycle_start", { cycle: 0, phase: "practice", clockLabel: scenario.practice.cycle.clockLabel, minViewSeconds: scenario.practice.cycle.minViewSeconds, freezeAtSeconds: scenario.practice.cycle.freezeAtSeconds, navSources: expect.any(Array) }]);
    expect(kinds).toContainEqual(["cycle_end", { cycle: 0, totalRealDurationMs: practiceMin * 1000 }]); // the real time since VP opened: its 180 s (the freeze answered at once)
    expect(records.some((r) => r.kind === "containment_judgement_submitted")).toBe(false); // revision (x): no Type J, not even in VP
    expect(records.find((r) => r.kind === "freeze_submitted")!.detail).toMatchObject({ cycle: 0 });

    const seqOf = (pred: (r: (typeof records)[number]) => boolean) => records.findIndex(pred);
    const vpEnd = seqOf((r) => r.kind === "cycle_end");
    const warmupDone = seqOf((r) => r.kind === "state_transition" && (r.detail as { trigger: string }).trigger === "warmup_complete");
    const training = seqOf((r) => r.kind === "briefing_advanced" && (r.detail as { screenId: string }).screenId === "training.substitutive");
    const phaseA = seqOf((r) => r.kind === "phase_entered" && (r.detail as { phase: string }).phase === "phase_a");
    const v1 = seqOf((r) => r.kind === "cycle_start" && (r.detail as { cycle: number }).cycle === 1);
    expect(vpEnd).toBeLessThan(warmupDone);
    expect(warmupDone).toBeLessThan(training);
    expect(training).toBeLessThan(phaseA);
    expect(phaseA).toBeLessThan(v1);
    // The main timeline starts at V1, 13:20 = virtual 0; VP never moves the engine clock.
    expect(records[v1]!.tVirtual).toBe(0);
  });
});

describe("the main views (SPEC/26 §3)", () => {
  it("reaches a merged view's second step halfway through its minimum length: clock, units, aircraft and items move on", async () => {
    const { o, snap } = start();
    await begin(o);
    await completeView(o, snap); // VP, then the training
    await completeView(o, snap); // V1
    const v2 = scenario.cycles[1]!;
    expect(snap()).toMatchObject({ currentCycle: 2, minViewSeconds: 130 });
    expect(snap().renderTree.cycleInfo).toMatchObject({ steps: 2, stepShown: 1, clockLabel: v2.clockLabel });
    const bubblesBefore = snap().renderTree.bubbles.length;
    expect((await o.searchAtoms("harjulla")).some((a) => a.id === "atom.demo.3.0")).toBe(false); // step 3 not reached

    // V2 carries a freeze; the view's time stands still in it, so the boundary is 65 view seconds in.
    const freezeAt = v2.freezeAtSeconds!;
    if (freezeAt < 65) {
      await vi.advanceTimersByTimeAsync(freezeAt * 1000);
      expect(snap().step).toBe("freeze");
      await o.submitFreeze([]);
      await vi.advanceTimersByTimeAsync((65 - freezeAt) * 1000 - 1);
    } else {
      await vi.advanceTimersByTimeAsync(65_000 - 1);
    }
    expect(snap().renderTree.cycleInfo!.stepShown).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    const info = snap().renderTree.cycleInfo!;
    expect(info.stepShown).toBe(2);
    expect(info.clockLabel).toBe(v2.stepBoundary!.clockLabel);
    expect(snap().clockLabel).toBe(v2.stepBoundary!.clockLabel);
    expect(info.unitPositions).toEqual(v2.stepBoundary!.unitPositions);
    expect(info.aircraft).toEqual(v2.stepBoundary!.aircraft);
    expect(info.perimeter).toEqual(v2.perimeter); // the fire stays the view's
    const secondStepPushed = v2.deliveryOffsetsSeconds.filter((t) => t >= STEP_SECONDS).length;
    expect(snap().renderTree.bubbles.length).toBe(bubblesBefore + secondStepPushed);
    expect((await o.searchAtoms("harjulla")).some((a) => a.id === "atom.demo.3.0")).toBe(true);

    const records = await o.logRecords();
    const secondStepBubble = records.find((r) => r.kind === "bubble_available" && (r.detail as { atomId: string }).atomId === "atom.demo.3.0")!;
    expect(secondStepBubble.tVirtual).toBe(v2.stepBoundary!.atVirtual);
  });

  it("labels each pushed record in the message log with its own traffic time, in the unchanged delivery order (systems review F2)", async () => {
    const { o, snap } = start();
    await begin(o);
    await completeView(o, snap); // VP, then the training: V1 has opened
    const v1 = scenario.cycles[0]!;
    const firstStep = v1.pushedAtomIds.filter((_, k) => v1.deliveryOffsetsSeconds[k]! < (v1.stepBoundary ? STEP_SECONDS : Infinity));
    const pushed = [...scenario.practice.cycle.pushedAtomIds, ...firstStep];
    const records = snap().radioLog.filter((e) => e.id !== undefined);
    expect(records.map((e) => e.id)).toEqual(pushed);
    for (const e of records) {
      const { deliveredAt, observedAt } = scenario.atoms.find((a) => a.id === e.id)!.provenance;
      expect(e.clockLabel).toBe(clockAtVirtual(deliveredAt ?? observedAt));
    }
    expect(records.some((e) => e.clockLabel !== v1.clockLabel && e.clockLabel !== scenario.practice.cycle.clockLabel)).toBe(true);
  });

  it("pauses at the hinge after V7, continues at V8 in phase B, and completes after V14", async () => {
    const { o, snap } = start();
    await begin(o);
    for (let i = 0; i <= 7; i++) await completeView(o, snap); // VP, V1..V7
    expect(snap().step).toBe("hinge_pause");
    await passHinge(o);
    expect(snap()).toMatchObject({ currentCycle: 8, phase: "B", viewLabel: "Jakso 8 / 14" });
    for (let i = 8; i <= 14; i++) await completeView(o, snap);
    expect(snap().step).toBe("complete");
    const ends = (await o.logRecords()).filter((r) => r.kind === "cycle_end");
    expect(ends.at(-1)!.tVirtual).toBe(20 * STEP_SECONDS); // 20:00, the end of step 20
  });

  it("logs the hinge pause and delivers the strategic guidance on leaving it, at the start of V8 (SPEC/15 §2)", async () => {
    const { o, snap } = start();
    await begin(o);
    for (let i = 0; i <= 7; i++) await completeView(o, snap); // VP, V1..V7
    const guidance = scenario.dutyOfficerMessages.find((m) => m.isStrategicGuidance)!;
    expect(snap().radioLog.some((e) => e.text === guidance.text)).toBe(false);
    // 4 Oct 2026: the directive is on the hinge pause screen, and still opens V8's message log, from P2.
    expect(guidance.text).toBe(DIRECTIVE_FI);
    expect(snap().hingeDirective).toBe(DIRECTIVE_FI);
    await passHinge(o);
    expect(snap().hingeDirective).toBeNull();
    expect(snap().radioLog).toContainEqual({ clockLabel: scenario.cycles[7]!.clockLabel, from: "P2", text: guidance.text });
    expect(snap().radioLog.filter((e) => e.id === undefined).map((e) => e.from)).toEqual(["P2", "P2"]); // V1's intent and the directive

    const kinds = (await o.logRecords()).map((r) => [r.kind, r.detail] as const);
    const at = (kind: string, detail?: object) => kinds.findIndex(([k, d]) => k === kind && (!detail || JSON.stringify(d) === JSON.stringify(detail)));
    expect(at("hinge_pause_start", { pauseSeconds: scenario.hinge.pauseSeconds })).toBeGreaterThan(kinds.findIndex(([k, d]) => k === "cycle_end" && (d as { cycle: number }).cycle === 7));
    const delivered = at("duty_officer_message_delivered", { messageId: scenario.hinge.guidanceMessageId, isStrategicGuidance: true });
    expect(delivered).toBeGreaterThan(at("hinge_pause_end"));
    expect(delivered).toBeGreaterThan(at("cycle_start", { cycle: 8, phase: "B", clockLabel: scenario.cycles[7]!.clockLabel, minViewSeconds: scenario.cycles[7]!.minViewSeconds, freezeAtSeconds: scenario.cycles[7]!.freezeAtSeconds, navSources: expect.any(Array) }));
    expect(kinds.filter(([k]) => k === "duty_officer_message_delivered")).toHaveLength(scenario.dutyOfficerMessages.length);
  });

  it("logs the real dwell on the hinge screen, and whether it was dismissed before the pause's length (review round 2)", async () => {
    let extra = 0;
    for (const [dwellMs, early] of [[42_000, true], [scenario.hinge.pauseSeconds * 1000, false]] as const) {
      const { o, snap } = start({ realClockMs: () => performance.now() + extra });
      await begin(o);
      for (let i = 0; i <= 7; i++) await completeView(o, snap); // VP, V1..V7
      expect(snap().step).toBe("hinge_pause");
      extra += dwellMs; // the participant reads the directive
      await passHinge(o);
      const end = (await o.logRecords()).find((r) => r.kind === "hinge_pause_end")!;
      expect(end.detail).toEqual({ realDurationMs: dwellMs, dismissedEarly: early });
    }
  });

  it("the directive expects no reply (the participant cannot transmit)", () => {
    expect(scenario.dutyOfficerMessages.every((m) => m.expectsReply === false)).toBe(true);
  });

  it("gives the directed (Haku) condition the same practice view, without Thinker, and the same plan step", async () => {
    const { o, snap } = start({}, "directed");
    await begin(o);
    expect(snap()).toMatchObject({ practice: true, aiAvailable: false });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snap().step).toBe("allocation"); // revision (x): the plan only
  });
});

describe("the preview override (app/session/preview.ts)", () => {
  it("is off by default: the header carries no override and the real timings run", async () => {
    const { o, snap } = start({ participantCode: "P-1" });
    await begin(o);
    const header = (await o.logRecords())[0]!;
    expect(header.kind).toBe("session_started");
    expect(header.detail).not.toHaveProperty("previewOverride");
    expect(snap()).toMatchObject({ minViewSeconds: practiceMin, decisionOpensAtSeconds: 20 });
  });

  it("scales every view time by override / 120 and is logged in the session header", async () => {
    const { o, snap } = start({ previewOverride: { minViewSeconds: 12 } });
    await begin(o);
    expect(snap()).toMatchObject({ minViewSeconds: practiceMin / 10, decisionOpensAtSeconds: 2, previewOverride: { minViewSeconds: 12 } });
    expect((await o.logRecords())[0]!.detail).toMatchObject({ previewOverride: { minViewSeconds: 12 } });
    await vi.advanceTimersByTimeAsync(1_999);
    expect(snap().step).toBe("exploration");
    await vi.advanceTimersByTimeAsync(1);
    expect(snap().step).toBe("allocation");
    await vi.advanceTimersByTimeAsync(practiceFreezeAt * 100 - 2_000); // the freeze at a tenth of its real moment
    expect(snap().step).toBe("freeze");
    const started = (await o.logRecords()).find((r) => r.kind === "freeze_started")!;
    expect(started.detail).toMatchObject({ atViewSeconds: practiceFreezeAt / 10 });
    await o.submitFreeze([]);
    await o.submitAllocation(PLAN);
    // The practice SPAM prompt (85 s, scaled to 8.5 s) does not expire (revision (ag)): it is forced at the scaled minimum.
    await vi.advanceTimersByTimeAsync(practiceMin * 100 - practiceFreezeAt * 100);
    expect(await answerForcedSpam(o)).toBe(true);
    expect(snap().step).toBe("training");
    await o.completeTraining();
    await completeView(o, snap); // V1
    expect(snap()).toMatchObject({ currentCycle: 2, minViewSeconds: 13 }); // a merged view: 130 s scaled
  });

  it("parses ?esikatselu=<seconds> and rejects malformed or out-of-range values", () => {
    expect(parsePreviewOverride("")).toBeNull();
    expect(parsePreviewOverride("?foo=1")).toBeNull();
    expect(parsePreviewOverride("?esikatselu=12")).toEqual({ minViewSeconds: 12 });
    for (const bad of ["?esikatselu=", "?esikatselu=0", "?esikatselu=1.5", "?esikatselu=abc", "?esikatselu=121"]) {
      expect(() => parsePreviewOverride(bad)).toThrow(RangeError);
    }
  });
});

describe("one confidence scale (researcher decision 1 Oct 2026)", () => {
  it("accepts only 25, 50, 75 or 100 for every freeze item (the only in-view confidence since revision (x))", async () => {
    const { o, snap } = start();
    await begin(o);
    await vi.advanceTimersByTimeAsync(practiceFreezeAt * 1000);
    const item = snap().freeze!.items[0]!;
    await expect(o.submitFreeze([{ itemId: item.id, optionId: "a", confidence: 60 } as never])).rejects.toThrow(/scale/);
    await o.submitFreeze([]);
    expect(snap().step).toBe("allocation");
    await o.submitAllocation(PLAN);
    expect(snap().step).toBe("awaiting_view_end");
  });
});

describe("the view's real duration (cycle_end.totalRealDurationMs, the drawer-open fraction's denominator)", () => {
  it("is the real time since the view opened, the time the freeze was open included", async () => {
    const { o, snap } = start();
    await begin(o);
    await vi.advanceTimersByTimeAsync(practiceFreezeAt * 1000);
    expect(snap().step).toBe("freeze");
    await vi.advanceTimersByTimeAsync(7_000); // the view's clock stands still, the real clock runs on
    await o.submitFreeze([]);
    await o.submitAllocation(PLAN);
    await vi.advanceTimersByTimeAsync((practiceMin - practiceFreezeAt) * 1000);
    await answerForcedSpam(o); // at once: no real time passes
    const end = (await o.logRecords()).find((r) => r.kind === "cycle_end")!;
    expect(end.detail).toEqual({ cycle: 0, totalRealDurationMs: practiceMin * 1000 + 7_000 });
  });
});

describe("Haku and Thinker only inside a view (6 Oct 2026)", () => {
  it("are refused during a freeze and at the training, and work in the view's own steps (no briefing page since revision (ae))", async () => {
    const { o, snap } = start();
    await o.start();
    expect(snap().step).toBe("exploration");
    await expect(o.searchAtoms("EK11")).resolves.toBeDefined();
    await vi.advanceTimersByTimeAsync(practiceFreezeAt * 1000);
    expect(snap().step).toBe("freeze");
    expect(() => o.searchAtoms("EK11")).toThrow(/step freeze/);
    expect(() => o.logNavSlot("category", null)).toThrow(/step freeze/);
    expect(() => o.navigateQuery({ category: "fire", sourceId: null, window: "last_cycle" } as never)).toThrow(/step freeze/);
    await expect(o.askAiChat("missä kärki on?")).rejects.toThrow(/step freeze/);
    await o.submitFreeze([]);
    expect(snap().step).toBe("allocation");
    await expect(o.searchAtoms("EK11")).resolves.toBeDefined();
    await o.submitAllocation(PLAN);
    await vi.advanceTimersByTimeAsync((practiceMin - practiceFreezeAt) * 1000);
    await expect(o.searchAtoms("EK11")).resolves.toBeDefined(); // the forced practice SPAM item (revision (ag)): the tools stay usable
    await answerForcedSpam(o);
    expect(snap().step).toBe("training");
    expect(() => o.searchAtoms("EK11")).toThrow(/step training/);
  });

  it("are refused on the hinge screen", async () => {
    const { o, snap } = start();
    await begin(o);
    for (let i = 0; i <= 7; i++) await completeView(o, snap); // VP, V1..V7
    expect(snap().step).toBe("hinge_pause");
    await expect(o.askAiChat("missä kärki on?")).rejects.toThrow(/step hinge_pause/);
    expect(() => o.searchAtoms("EK11")).toThrow(/step hinge_pause/);
  });
});
