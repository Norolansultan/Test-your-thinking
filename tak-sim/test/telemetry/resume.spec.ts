/**
 * SPEC/10_Build_Plan_and_Acceptance.md, M4: "`test/telemetry/resume.spec`
 * interrupts at each cycle boundary and asserts correct resume." SPEC/26: the cycles are the
 * fourteen main views; the practice view (view 0) is never resumed into.
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { InMemoryLogSink, SessionLog, type LogHeader } from "../../app/telemetry/log.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { planResume, resumeSession } from "../../app/telemetry/resume.js";
import type { CycleIndex } from "../../app/engine/primitives.js";
import { MAIN_VIEW_SCHEDULE as S } from "../../app/scenario/views.js";

const HEADER: LogHeader = {
  formatVersion: "0.1.0", sessionId: "resume-test", participantCode: "p", condition: "directed", scenarioId: "s",
  scenarioVersion: "0.1.0", seed: "1", bundleHash: "b", appVersion: "0.1.0", startedAtIso: "2026-01-01T00:00:00.000Z",
  userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 }, counterbalance: { expectationOrder: "A" }, cell: "radio", echelon: "command",
};

const view = (n: number) => n as CycleIndex;

async function makeLogThroughCycles(completedCycles: number): Promise<SessionLog> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (let c = 1; c <= completedCycles; c++) {
    await appendTelemetryEvent(log, S.startOf(view(c)), 0, { kind: "cycle_start", detail: { cycle: view(c), phase: c <= 7 ? "A" : "B", clockLabel: "13:20" } });
    await appendTelemetryEvent(log, S.endOf(view(c)), 0, { kind: "cycle_end", detail: { cycle: view(c), totalRealDurationMs: 180000 } });
  }
  return log;
}

describe("planResume — interrupted cleanly at a view boundary, for every view 1..13", () => {
  it.each(Array.from({ length: 13 }, (_, i) => i + 1))("after view %i completes cleanly, resume targets the next view", async (n) => {
    const log = await makeLogThroughCycles(n);
    const plan = planResume(await log.readAll());
    expect(plan.resumeFromCycle).toBe(n + 1);
    expect(plan.cycleWasInterruptedMidway).toBe(false);
  });
});

describe("planResume — interrupted mid-view (cycle_start logged, no matching cycle_end), for every view 1..14", () => {
  it.each(Array.from({ length: 14 }, (_, i) => i + 1))("mid-view %i must be replayed from its start, not resumed in place", async (n) => {
    const log = await makeLogThroughCycles(n - 1);
    await appendTelemetryEvent(log, S.startOf(view(n)), 0, { kind: "cycle_start", detail: { cycle: view(n), phase: n <= 7 ? "A" : "B", clockLabel: "13:20" } });
    // Interruption happens here — some interaction records logged, but no cycle_end.
    await appendTelemetryEvent(log, asVirtualTime(S.startOf(view(n)) + 30), 0, { kind: "bubble_available", detail: { atomId: "atom.1", mapPosition: null, tier: "T1_pushed", sourceId: "EK11" } });

    const plan = planResume(await log.readAll());
    expect(plan.resumeFromCycle).toBe(n);
    expect(plan.cycleWasInterruptedMidway).toBe(true);
  });
});

describe("planResume — before any view has started", () => {
  it("resumes at view 1", async () => {
    const log = new SessionLog(HEADER, new InMemoryLogSink());
    await appendTelemetryEvent(log, asVirtualTime(0), 0, { kind: "session_started", detail: HEADER });
    const plan = planResume(await log.readAll());
    expect(plan.resumeFromCycle).toBe(1);
    expect(plan.cycleWasInterruptedMidway).toBe(false);
  });

  it("ignores the practice view: interrupted during VP, or cleanly after it, resumes at V1", async () => {
    const log = new SessionLog(HEADER, new InMemoryLogSink());
    await appendTelemetryEvent(log, asVirtualTime(0), 0, { kind: "cycle_start", detail: { cycle: 0, phase: "practice", clockLabel: "13:00" } });
    expect(planResume(await log.readAll())).toMatchObject({ resumeFromCycle: 1, cycleWasInterruptedMidway: false });

    await appendTelemetryEvent(log, asVirtualTime(0), 0, { kind: "cycle_end", detail: { cycle: 0, totalRealDurationMs: 1 } });
    expect(planResume(await log.readAll())).toMatchObject({ resumeFromCycle: 1, cycleWasInterruptedMidway: false });
  });

  it("resumes at view 1 with an entirely empty log", () => {
    const plan = planResume([]);
    expect(plan.resumeFromCycle).toBe(1);
    expect(plan.cycleWasInterruptedMidway).toBe(false);
    expect(plan.lastRecordSeq).toBeNull();
  });
});

describe("planResume — the documented edge case: interrupted cleanly right after V14", () => {
  it("resumeFromCycle is 15 (past the last real view) and is not itself a view", async () => {
    const log = await makeLogThroughCycles(14);
    const plan = planResume(await log.readAll());
    expect(plan.resumeFromCycle).toBe(15);
    expect(plan.cycleWasInterruptedMidway).toBe(false);
  });
});

describe("resumeSession — logs session_resumed and reflects the plan", () => {
  it("records resumeCount, intervalSinceInterruptionMs and cycleReplayed, at the replayed view's start", async () => {
    const log = await makeLogThroughCycles(3);
    await appendTelemetryEvent(log, S.startOf(4), 0, { kind: "cycle_start", detail: { cycle: 4, phase: "A", clockLabel: "14:40" } });

    const { plan, resumedRecord } = await resumeSession(log, S, 1, 45000);
    expect(plan.resumeFromCycle).toBe(4);
    expect(plan.cycleWasInterruptedMidway).toBe(true);
    expect(resumedRecord.kind).toBe("session_resumed");
    expect(resumedRecord.detail).toEqual({ resumeCount: 1, intervalSinceInterruptionMs: 45000, cycleReplayed: 4 });
    expect(resumedRecord.tVirtual).toBe(4 * 1200); // V4 starts at step 5 (14:40), not at (4 - 1) x 1200
  });

  it("clamps cycleReplayed to 14 for the past-V14 edge case rather than throwing", async () => {
    const log = await makeLogThroughCycles(14);
    const { resumedRecord } = await resumeSession(log, S, 1, 1000);
    expect(resumedRecord.detail).toMatchObject({ cycleReplayed: 14 });
  });

  it("multiple resumes increment resumeCount and each is a distinct, gapless log record", async () => {
    const log = await makeLogThroughCycles(5);
    const first = await resumeSession(log, S, 1, 1000);
    const second = await resumeSession(log, S, 2, 2000);
    expect(first.resumedRecord.seq).toBeLessThan(second.resumedRecord.seq);
    expect((second.resumedRecord.detail as { resumeCount: number }).resumeCount).toBe(2);
  });

  it("does not mutate or remove the interrupted view's partial records — append-only, per I5", async () => {
    const log = await makeLogThroughCycles(3);
    await appendTelemetryEvent(log, S.startOf(4), 0, { kind: "cycle_start", detail: { cycle: 4, phase: "A", clockLabel: "14:40" } });
    await appendTelemetryEvent(log, asVirtualTime(S.startOf(4) + 10), 0, { kind: "bubble_available", detail: { atomId: "a1", mapPosition: null, tier: "T1_pushed", sourceId: "EK11" } });
    const beforeCount = (await log.readAll()).length;

    await resumeSession(log, S, 1, 1000);

    const after = await log.readAll();
    expect(after.length).toBe(beforeCount + 1); // only the new session_resumed record was added
    expect(after.some((r) => r.kind === "bubble_available")).toBe(true); // the interrupted view's partial record is still there, untouched
  });
});
