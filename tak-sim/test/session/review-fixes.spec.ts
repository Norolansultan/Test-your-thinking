/**
 * Regression tests for the review of the session-flow redesign (2 Oct 2026): a merged view's
 * freeze falls after its second step (so the SA keys are the last step's), every submission is
 * accepted once and only in its own step, a course-of-action answer must belong to this view's
 * item, and every record carries a real time base for the commitment measures.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { FREEZE_AFTER_BOUNDARY_S, freezeWindowFor, PRACTICE_VIEW_MAX_SECONDS } from "../../app/scenario/views.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { answerForcedSpam, PLAN } from "./view-flow.js";

const scenario = buildDemoScenario();

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function inPractice() {
  const o = new SessionOrchestrator(scenario, "directed", { participantCode: "P-3" });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  await o.start();
  return { o, snap: () => box.snap! };
}

describe("a merged view's freeze falls after its second step", () => {
  it("every merged freeze view freezes at least 10 s after the step boundary, inside the window", () => {
    const merged = scenario.cycles.filter((c) => c.steps === 2 && c.hasFreeze && c.freezeAtViewEnd !== true); // SPEC/30 §5.1: V14's is at its end
    expect(merged.length).toBeGreaterThan(0);
    for (const c of merged) {
      const [earliest, latest] = freezeWindowFor(c.minViewSeconds, true);
      expect(earliest).toBe(c.minViewSeconds / 2 + FREEZE_AFTER_BOUNDARY_S);
      expect(c.freezeAtSeconds!, `V${c.index}`).toBeGreaterThanOrEqual(earliest);
      expect(c.freezeAtSeconds!, `V${c.index}`).toBeLessThanOrEqual(latest);
    }
  });
});

describe("each submission once, and only in its own step", () => {
  it("a double click on the freeze's submit is refused and the participant continues where they were", async () => {
    const { o, snap } = await inPractice();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snap().step).toBe("allocation");
    await vi.advanceTimersByTimeAsync((scenario.practice.cycle.freezeAtSeconds! - 20) * 1000);
    expect(snap().step).toBe("freeze");
    const first = o.submitFreeze([]);
    await expect(o.submitFreeze([])).rejects.toThrow(/already submitting|step/);
    await first;
    expect(snap().step).toBe("allocation");
    expect((await o.logRecords()).filter((r) => r.kind === "freeze_submitted")).toHaveLength(1);
  });

  it("a double plan gives one allocation record", async () => {
    const { o } = await inPractice();
    await vi.advanceTimersByTimeAsync(20_000);
    const first = o.submitAllocation(PLAN);
    await expect(o.submitAllocation(PLAN)).rejects.toThrow();
    await first;
    expect((await o.logRecords()).filter((r) => r.kind === "allocation_submitted")).toHaveLength(1);
  });

  it("a plan is validated at the boundary", async () => {
    const { o, snap } = await inPractice();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snap().step).toBe("allocation");
    await expect(o.submitAllocation({ ...PLAN, mainEffort: "L9" })).rejects.toThrow(/main-effort/);
    await expect(o.submitAllocation({ ...PLAN, secondary: { sectorId: "L2", taskId: "task.mopup" } })).rejects.toThrow(/main effort/);
    await expect(o.submitAllocation({ ...PLAN, secondary: { sectorId: "L3", taskId: "task.thermal-survey" } as never })).rejects.toThrow(/secondary task/);
    await expect(o.submitAllocation({ ...PLAN, drones: { sectorId: "L3", taskId: "task.mopup" } as never })).rejects.toThrow(/drone task/);
    expect(snap().step).toBe("allocation");
    await o.submitAllocation({ ...PLAN, drones: { sectorId: "L3", taskId: "task.thermal-survey" } });
    expect(snap().step).toBe("awaiting_view_end");
    const tasked = (await o.logRecords()).filter((r) => r.kind === "drone_tasked").map((r) => r.detail as { assetId: string; targetSectorId: string });
    expect(tasked.map((d) => d.assetId)).toEqual(snap().allocation.droneTeams);
    expect(tasked.every((d) => d.targetSectorId === "L3")).toBe(true);
  });
});

describe("the time base of the commitment measures", () => {
  it("every record carries real milliseconds since the session start, rising with the view's time", async () => {
    const { o } = await inPractice();
    await vi.advanceTimersByTimeAsync(20_000);
    await vi.advanceTimersByTimeAsync(3_000);
    await o.submitAllocation(PLAN);
    const records = await o.logRecords();
    const opened = records.find((r) => r.kind === "decision_panel_opened")!;
    const planned = records.find((r) => r.kind === "allocation_submitted")!;
    expect(opened.tWallOffsetMs).toBeGreaterThanOrEqual(20_000);
    expect(planned.tWallOffsetMs - opened.tWallOffsetMs).toBeGreaterThanOrEqual(3_000);
    for (let i = 1; i < records.length; i++) expect(records[i]!.tWallOffsetMs).toBeGreaterThanOrEqual(records[i - 1]!.tWallOffsetMs);
  });
});

describe("the SA level tag: shown for demonstration, hidden in the study (2 Oct 2026)", () => {
  it("logs which in the header: shown by default, hidden with showProbeLevels false (`?tuotanto`)", async () => {
    const demo = new SessionOrchestrator(scenario, "directed", {});
    const study = new SessionOrchestrator(scenario, "directed", { showProbeLevels: false });
    let d: SessionSnapshot | null = null, s: SessionSnapshot | null = null;
    demo.subscribe((x) => (d = x));
    study.subscribe((x) => (s = x));
    expect(d!.showProbeLevels).toBe(true);
    expect(s!.showProbeLevels).toBe(false);
    await demo.start();
    await study.start();
    const header = async (o: SessionOrchestrator) => ((await o.logRecords()).find((r) => r.kind === "session_started")!.detail as { probeLevelsShown?: boolean }).probeLevelsShown;
    expect(await header(demo)).toBe(true);
    expect(await header(study)).toBe(false);
  });
});

describe("the final countdown and the demonstration timing (2 Oct 2026)", () => {
  it("counts down to the cap on the view's time (the practice view's: 180 s); once confirmed, to the minimum on the view's own clock; never in the study's freeze window", async () => {
    const { o, snap } = await inPractice();
    const cap = PRACTICE_VIEW_MAX_SECONDS;
    const freezeAt = scenario.practice.cycle.freezeAtSeconds!;
    expect(snap().secondsLeft).toBeNull();
    await vi.advanceTimersByTimeAsync(20_000);
    await vi.advanceTimersByTimeAsync((freezeAt - 20) * 1000);
    expect(snap().step).toBe("freeze");
    await o.submitFreeze([]);
    // not confirmed: nothing before the last 20 s; the practice view's cap equals its minimum (180 s since 11 Oct 2026)
    await vi.advanceTimersByTimeAsync((cap - 21 - freezeAt) * 1000);
    expect(snap().secondsLeft).toBeNull();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(snap().secondsLeft).toBe(20);
    for (const c of [scenario.practice.cycle, ...scenario.cycles]) if (c.freezeAtSeconds !== null) expect(c.freezeAtSeconds).toBeLessThanOrEqual(c.minViewSeconds - 20);
  });

  it("once the period is confirmed, counts the last 20 s before the minimum", async () => {
    const { o, snap } = await inPractice();
    const min = scenario.practice.cycle.minViewSeconds;
    const freezeAt = scenario.practice.cycle.freezeAtSeconds!;
    await vi.advanceTimersByTimeAsync(20_000);
    await o.submitAllocation(PLAN);
    expect(snap().step).toBe("awaiting_view_end");
    await vi.advanceTimersByTimeAsync((freezeAt - 20) * 1000);
    await o.submitFreeze([]);
    await vi.advanceTimersByTimeAsync((min - 20 - freezeAt) * 1000);
    expect(snap().secondsLeft).toBe(20);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(snap().secondsLeft).toBe(15);
  });

  it("ends the view at the cap (the practice view's 180 s) with what was left unanswered; a long freeze no longer brings the cap closer (r.12)", async () => {
    const { o, snap } = await inPractice();
    const freezeAt = scenario.practice.cycle.freezeAtSeconds!;
    const cap = PRACTICE_VIEW_MAX_SECONDS;
    await vi.advanceTimersByTimeAsync(freezeAt * 1000);
    expect(snap().step).toBe("freeze");
    await vi.advanceTimersByTimeAsync(170_000); // longer than the view's cap, inside the freeze (under its own 180 s cap, fix pass 7): nothing ends
    expect(snap().step).toBe("freeze");
    await o.submitFreeze([]);
    expect(snap().step).toBe("allocation");
    await vi.advanceTimersByTimeAsync((cap - freezeAt) * 1000 - 1);
    expect(snap().step).toBe("allocation");
    await vi.advanceTimersByTimeAsync(1);
    await answerForcedSpam(o); // the practice SPAM prompt, left up, is forced at the view's end (revision (ag))
    expect(snap().step).toBe("training");
    const records = await o.logRecords();
    const ended = records.filter((r) => r.kind === "view_ended");
    expect(ended.map((r) => r.detail)).toEqual([expect.objectContaining({ cycle: 0, viewSeconds: cap, endedBy: "time_cap", stepAtEnd: "allocation" })]);
    expect(ended[0]!.tWallOffsetMs).toBeGreaterThanOrEqual((cap + 170) * 1000); // the cap's task time + the 170 s freeze
  });

  it("pauses the cap and its countdown in a freeze and resumes them after it (r.12)", async () => {
    const { o, snap } = await inPractice();
    const freezeAt = scenario.practice.cycle.freezeAtSeconds!;
    await vi.advanceTimersByTimeAsync(freezeAt * 1000);
    await vi.advanceTimersByTimeAsync(75_000); // a six-item freeze
    await o.submitFreeze([]);
    await vi.advanceTimersByTimeAsync((PRACTICE_VIEW_MAX_SECONDS - 20 - freezeAt) * 1000 - 1);
    expect(snap().secondsLeft).toBeNull(); // the countdown has shifted by the freeze's 75 s
    await vi.advanceTimersByTimeAsync(1);
    expect(snap().secondsLeft).toBe(20);
    await vi.advanceTimersByTimeAsync(19_000);
    expect(snap().secondsLeft).toBe(1);
    expect(snap().currentCycle).toBe(0);
    await vi.advanceTimersByTimeAsync(1_000);
    await answerForcedSpam(o);
    expect(snap().step).toBe("training");
  });

  it("the guided tour still holds the cap: it starts when the tour is finished", async () => {
    const o = new SessionOrchestrator(scenario, "directed", { guidedTour: true });
    let snap: SessionSnapshot | null = null;
    o.subscribe((s) => (snap = s));
    await o.start();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(snap!.tour).toBe("practice");
    expect(snap!.step).toBe("exploration");
    await o.completeTour(13);
    await vi.advanceTimersByTimeAsync(scenario.practice.cycle.freezeAtSeconds! * 1000);
    expect(snap!.step).toBe("freeze");
    await o.submitFreeze([]);
    await vi.advanceTimersByTimeAsync((PRACTICE_VIEW_MAX_SECONDS - scenario.practice.cycle.freezeAtSeconds!) * 1000);
    await answerForcedSpam(o);
    expect(snap!.step).toBe("training");
  });

  it("ends a view in the panel at the cap", async () => {
    const { o, snap } = await inPractice();
    await vi.advanceTimersByTimeAsync(scenario.practice.cycle.freezeAtSeconds! * 1000);
    await o.submitFreeze([]);
    const elapsed = scenario.practice.cycle.freezeAtSeconds!;
    await vi.advanceTimersByTimeAsync((PRACTICE_VIEW_MAX_SECONDS - elapsed) * 1000 - 1);
    expect(snap().step).toBe("allocation");
    await vi.advanceTimersByTimeAsync(1);
    await answerForcedSpam(o); // the practice SPAM prompt, left up, is forced at the view's end (revision (ag))
    expect(snap().step).toBe("training");
    const ended = (await o.logRecords()).filter((r) => r.kind === "view_ended").map((r) => r.detail);
    expect(ended).toEqual([expect.objectContaining({ endedBy: "time_cap", stepAtEnd: "allocation" })]);
  });

  it("runs the demonstration on the real view times, like the study (6 Oct 2026); only ?esikatselu shortens them", async () => {
    const { sessionOverrideFromUrl } = await import("../../app/session/preview.js");
    expect(sessionOverrideFromUrl("")).toBeNull();
    expect(sessionOverrideFromUrl("?tuotanto")).toBeNull();
    expect(sessionOverrideFromUrl("?esikatselu=12&tuotanto")).toEqual({ minViewSeconds: 12 });
  });
});

describe("the KUKA list grows view by view (2 Oct 2026)", () => {
  it("names only sources known by the end of the view, logs the list at the view's start, and never shrinks", async () => {
    const { o } = await inPractice();
    const practice = o.navigationSources();
    expect(practice).not.toContain("HELI1");
    expect(practice).not.toContain("VERKKOYHTIÖ");
    expect(practice).not.toContain("OUT1");
    expect(practice).toContain("EK11");
    const start = (await o.logRecords()).find((r) => r.kind === "cycle_start")!;
    expect((start.detail as { navSources?: readonly string[] }).navSources).toEqual(practice);
    const { navigationSources } = await import("../../app/retrieval/navigation.js");
    const whole = navigationSources(scenario.atoms);
    let previous: readonly string[] = [];
    for (const c of scenario.cycles) {
      const known = navigationSources(scenario.atoms, c.startsAtVirtual + c.steps * 1200);
      for (const s of previous) expect(known, `V${c.index}`).toContain(s);
      previous = known;
    }
    expect(previous).toEqual(whole);
  });
});
