/**
 * Resume in the browser (SPEC/05 §9; 5 Oct 2026): from the durable log, `planSessionResume` finds
 * where to re-enter; a new orchestrator over the same sink logs the interruption as a fault span and
 * `session_resumed`, then restarts the interrupted view from its start (never mid-view, never
 * mid-plan), continuing the log's seq and time base. The engine is at the view's start.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLogSink, type LogRecord } from "../../app/telemetry/log.js";
import { planSessionResume } from "../../app/telemetry/resume.js";
import { cycleScheduleOf } from "../../app/scenario/views.js";
import { INTERRUPTION_FAULT_CLASS } from "../../app/session/orchestrator.js";
import { completeView, newSession, runThrough, scenario } from "./session-run.js";
import { allocateAndConfirm, runOutView } from "./view-flow.js";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

const schedule = cycleScheduleOf(scenario);
const kinds = (records: readonly LogRecord[]) => records.map((r) => r.kind);

/** Runs a session in `sink` to the given point and "closes the tab": the orchestrator is dropped, timers cleared. */
async function interruptedAt(point: "briefing" | "vp" | "training" | { view: number; mid: boolean } | "hinge" | "end"): Promise<{ sink: InMemoryLogSink; records: readonly LogRecord[] }> {
  const sink = new InMemoryLogSink();
  const { o, snap } = newSession({ sink });
  await o.start();
  if (point !== "briefing") {
    if (point === "vp") await vi.advanceTimersByTimeAsync(2_000);
    else {
      await runOutView(o, snap);
      await allocateAndConfirm(o, snap);
      if (point !== "training") {
        await o.completeTraining();
        const lastFull = point === "hinge" ? 6 : point === "end" ? 13 : point.view - 1;
        for (let v = 1; v <= lastFull; v++) await completeView(o, snap);
        if (point === "hinge" || point === "end") {
          await runOutView(o, snap);
              await allocateAndConfirm(o, snap);
          if (point === "hinge") { expect(snap().step).toBe("hinge_pause"); await o.showHingeCheck(); }
          else expect(snap().step).toBe("complete");
        } else if (point.mid) {
          await runOutView(o, snap);
          // mid-view: the plan is never given
        }
      }
    }
  }
  vi.clearAllTimers();
  return { sink, records: await sink.readAll() };
}

describe("planSessionResume — where the session re-enters", () => {
  it.each([
    ["right after the start (the briefing is passed at once, revision (ae))", "briefing" as const, { kind: "view", view: 0 }],
    ["in the practice view", "vp" as const, { kind: "view", view: 0 }],
    ["in the training", "training" as const, { kind: "training" }],
    ["at a clean boundary before V3", { view: 3, mid: false }, { kind: "view", view: 3 }],
    ["mid-view in V3", { view: 3, mid: true }, { kind: "view", view: 3 }],
    ["on the hinge screen", "hinge" as const, { kind: "hinge" }],
    ["after V14", "end" as const, { kind: "complete" }],
  ])("interrupted %s", async (_name, point, target) => {
    const { records } = await interruptedAt(point);
    expect(planSessionResume(records, schedule)).toMatchObject({ target, resumeCount: 1, alreadyCompleted: false });
  });
});

describe("the orchestrator resumes", () => {
  it("mid-view in V3: the fault span and session_resumed, then V3 from its start; seq gapless, time base continued", async () => {
    const { sink, records } = await interruptedAt({ view: 3, mid: true });
    const header = (records[0]!.detail) as never;
    const last = records.at(-1)!;
    vi.setSystemTime(1_000_000); // the participant comes back later
    const { o, snap } = newSession({ sink, resume: { header, records, interruptedForMs: 90_000 } });
    await o.start();

    const all = await sink.readAll();
    const added = all.slice(records.length);
    expect(added.map((r) => r.seq)).toEqual(added.map((_, i) => records.length + i));
    expect(kinds(added).slice(0, 4)).toEqual(["fault", "fault_resolved", "session_resumed", "cycle_start"]);
    expect(added[0]!.detail).toEqual({ faultClass: INTERRUPTION_FAULT_CLASS });
    expect(added[1]!.detail).toEqual({ faultClass: INTERRUPTION_FAULT_CLASS, elapsedWallClockGapMs: 90_000 });
    expect(added[2]!.detail).toEqual({ resumeCount: 1, intervalSinceInterruptionMs: 90_000, cycleReplayed: 3, resumedAt: "view" });
    expect(added[3]!.detail).toMatchObject({ cycle: 3 });
    expect(added[0]!.tWallOffsetMs).toBe(last.tWallOffsetMs + 90_000);
    expect(added[3]!.tVirtual).toBe(schedule.startOf(3));
    expect(o.engineState).toBe("RUNNING");
    expect(snap()).toMatchObject({ currentCycle: 3, step: "exploration" });
    // The message log holds what VP, V1 and V2 delivered, as before the interruption.
    expect(snap().radioLog.length).toBeGreaterThan(0);
    expect(o.logHeader).toBe(header);

    // The replayed view runs normally to its end and on into V4.
    await completeView(o, snap);
    expect(snap().currentCycle).toBe(4);
  });

  it("a second interruption counts as resume 2", async () => {
    const { sink, records } = await interruptedAt({ view: 2, mid: false });
    const header = records[0]!.detail as never;
    const first = newSession({ sink, resume: { header, records, interruptedForMs: 1000 } });
    await first.o.start();
    vi.clearAllTimers();
    const again = await sink.readAll();
    const second = newSession({ sink, resume: { header, records: again, interruptedForMs: 2000 } });
    await second.o.start();
    const resumed = (await sink.readAll()).filter((r) => r.kind === "session_resumed").map((r) => r.detail);
    expect(resumed).toEqual([
      { resumeCount: 1, intervalSinceInterruptionMs: 1000, cycleReplayed: 2, resumedAt: "view" },
      { resumeCount: 2, intervalSinceInterruptionMs: 2000, cycleReplayed: 2, resumedAt: "view" },
    ]);
  });

  it("on the hinge screen: the hinge again (directive and check), then V8 in phase B", async () => {
    const { sink, records } = await interruptedAt("hinge");
    const { o, snap } = newSession({ sink, resume: { header: records[0]!.detail as never, records, interruptedForMs: 0 } });
    await o.start();
    expect(o.engineState).toBe("HINGE_PAUSE");
    expect(snap().step).toBe("hinge_pause");
    await o.showHingeCheck();
    await o.answerHingeCheck("a");
    await o.dismissHinge();
    expect(snap()).toMatchObject({ currentCycle: 8, phase: "B" });
  });

  it("in the practice view: VP from its start; a log that stops in the briefing (before revision (ae)): VP as well", async () => {
    for (const point of ["vp", "briefing"] as const) {
      const { records: full } = await interruptedAt(point);
      // An older log stopped on the briefing page: cut before its briefing_advanced.
      const records = point === "briefing" ? full.slice(0, full.findIndex((r) => r.kind === "briefing_advanced")) : full;
      if (point === "briefing") expect(planSessionResume(records, schedule)).toMatchObject({ target: { kind: "briefing" } });
      const sink = new InMemoryLogSink();
      for (const r of records) await sink.append(r);
      const { o, snap } = newSession({ sink, resume: { header: records[0]!.detail as never, records, interruptedForMs: 0 } });
      await o.start();
      expect(snap()).toMatchObject({ step: "exploration", currentCycle: 0, practice: true });
      vi.clearAllTimers();
    }
  });

  it("after V14: the end of the session, then COMPLETE and session_completed exactly once", async () => {
    const { sink, records } = await interruptedAt("end");
    const { o, snap } = newSession({ sink, resume: { header: records[0]!.detail as never, records, interruptedForMs: 0 } });
    await o.start();
    expect(snap().step).toBe("complete");
    expect(o.engineState).toBe("DEBRIEF_HANDOFF");
    await o.completeSession();
    await o.completeSession();
    expect(o.engineState).toBe("COMPLETE");
    expect(kinds(await sink.readAll()).filter((k) => k === "session_completed")).toHaveLength(1);
  });
});

describe("completeSession", () => {
  it("only at the end of the session", async () => {
    const { o } = await runThrough(0);
    await expect(o.completeSession()).rejects.toThrow(/completeSession in step/);
    vi.clearAllTimers();
  });
});
