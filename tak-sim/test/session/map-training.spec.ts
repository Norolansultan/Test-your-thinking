/**
 * The map training in the session (researcher decision 25 Oct 2026; `app/session/map-training.ts`, SPEC/08 (bj), SPEC/15 (bj)): in the
 * map-reading pretest's step — after the pre-session item in an expert session (after the primer in a public one: `public-flow.spec.ts`),
 * before the intro video; one task at a time in a fixed order, answered once, its FIRST answer logged before its feedback shows (the
 * choice, or the point with its error in metres), the feedback left with its dwell; the memory task's unit shown for 8 s, then the
 * blank map; the 5-minute cap; a resume at the first task not finished; nothing without the option; the same in both groups.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLogSink, type LogHeader } from "../../app/telemetry/log.js";
import { MAP_TRAINING } from "../../app/session/map-training.js";
import { shellResumeStep } from "../../app/session/shell-resume.js";
import { APP_OPTIONS, driveSession, kinds, newStudySession, passPretest, trainingStep } from "../public/public-run.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const TASKS = MAP_TRAINING.tasks.map((t) => t.id);
const place = MAP_TRAINING.tasks.find((t) => t.kind === "place")!;
const memoryAt = MAP_TRAINING.tasks.findIndex((t) => t.kind === "memory");

describe("the map training in the session (25 Oct 2026)", () => {
  for (const cell of ["radio", "reasoning_intent"] as const) {
    it(`${cell}: after the pre-session item, before the intro video; answered once, logged before the feedback; the feedback left`, async () => {
      vi.setSystemTime(0);
      const { o, snap } = newStudySession({ cell });
      await o.start();
      await driveSession(o, snap, ["map_pretest"]);
      expect(o.engineState).toBe("BRIEFING");
      expect(snap().mapPretest).toMatchObject({ taskId: TASKS[0], position: 1, taskCount: 7, phase: "answer", answer: null, errorM: null, timeLimitMs: 300_000 });
      await expect(o.answerMapPretest(TASKS[1]!, { choiceId: "m300" })).rejects.toThrow(/not on the screen/);
      await expect(o.answerMapPretest(TASKS[0]!, { choiceId: "x" })).rejects.toThrow(RangeError); // a point task
      await expect(o.answerMapPretest(TASKS[0]!, { point: { x: -1, y: 10 } })).rejects.toThrow(RangeError);
      await expect(o.leaveMapPretestFeedback(TASKS[0]!)).rejects.toThrow(/no feedback/);
      await vi.advanceTimersByTimeAsync(4_000);
      const key = (place as { key: { x: number; y: number } }).key;
      await o.answerMapPretest(TASKS[0]!, { point: { x: key.x + 30, y: key.y + 40 } }, [512.4, 88]);
      // The feedback: the first answer and its error (50 px = 200 m); a second answer is refused.
      expect(snap().mapPretest).toMatchObject({ taskId: TASKS[0], phase: "feedback", answer: { point: { x: key.x + 30, y: key.y + 40 } }, errorM: 200 });
      await expect(o.answerMapPretest(TASKS[0]!, { point: key })).rejects.toThrow(/not asked now/);
      await vi.advanceTimersByTimeAsync(6_000);
      await o.leaveMapPretestFeedback(TASKS[0]!);
      expect(snap().mapPretest).toMatchObject({ taskId: TASKS[1], position: 2, phase: "answer" });
      await o.answerMapPretest(TASKS[1]!, { choiceId: "m600" });
      expect(snap().mapPretest).toMatchObject({ phase: "feedback", answer: { choiceId: "m600" }, errorM: null });
      await passPretest(o, snap);
      expect(snap().step).toBe("briefing");
      const records = await o.logRecords();
      const pre = records.findIndex((r) => r.kind === "questionnaire_submitted");
      const mine = records.slice(pre + 1, pre + 3 + 2 * TASKS.length);
      expect(kinds(mine)).toEqual(["map_pretest_started", ...TASKS.flatMap(() => ["map_pretest_answer", "map_pretest_feedback_left"]), "map_pretest_completed"]);
      expect(mine[0]!.detail).toEqual({ version: MAP_TRAINING.version, itemIds: TASKS, timeLimitMs: 300_000, remainingMs: 300_000, resumed: false, keptItemIds: [] });
      expect(mine[1]!.detail).toEqual({ itemId: TASKS[0], position: 1, rtMs: 4_000, measures: [512, 88], point: { x: key.x + 30, y: key.y + 40 }, errorM: 200 });
      expect(mine[2]!.detail).toEqual({ itemId: TASKS[0], position: 1, dwellMs: 6_000 });
      expect(mine[3]!.detail).toEqual({ itemId: TASKS[1], position: 2, rtMs: 0, measures: [], choiceId: "m600" });
      const memory = mine[1 + 2 * memoryAt]!.detail as Record<string, unknown>;
      expect(memory).toMatchObject({ itemId: TASKS[memoryAt], memoryMs: 8_000, rtMs: 0 });
      expect(typeof memory.errorM).toBe("number");
      expect(mine.at(-1)!.detail).toEqual({ endReason: "completed", answeredCount: 7, missingItemIds: [], durationMs: 18_000 });
      expect(o.logHeader).toMatchObject({ mapPretest: true, formatVersion: "0.17.0" });
    });
  }

  it("the memory task shows the unit for 8 s (no answer meanwhile), then the blank map takes the answer", async () => {
    vi.setSystemTime(0);
    const { o, snap } = newStudySession({});
    await o.start();
    await driveSession(o, snap, ["map_pretest"]);
    while (snap().mapPretest!.position < memoryAt + 1) await trainingStep(o, snap);
    expect(snap().mapPretest).toMatchObject({ taskId: TASKS[memoryAt], phase: "study" });
    expect(o.mapPretestStudySecondsLeft()).toBe(8);
    await expect(o.answerMapPretest(TASKS[memoryAt]!, { point: { x: 100, y: 100 } })).rejects.toThrow(/not asked now \(study\)/);
    await vi.advanceTimersByTimeAsync(7_999);
    expect(snap().mapPretest!.phase).toBe("study");
    await vi.advanceTimersByTimeAsync(1);
    expect(snap().mapPretest!.phase).toBe("answer");
    expect(o.mapPretestStudySecondsLeft()).toBe(0);
  });

  it("the cap ends it after 5 minutes: the tasks not answered are missing, and the session goes on", async () => {
    vi.setSystemTime(0);
    const { o, snap } = newStudySession({});
    await o.start();
    await driveSession(o, snap, ["map_pretest"]);
    await trainingStep(o, snap); // task 1 answered
    await vi.advanceTimersByTimeAsync(300_000);
    expect(snap().step).toBe("briefing");
    const end = (await o.logRecords()).find((r) => r.kind === "map_pretest_completed")!;
    expect(end.detail).toMatchObject({ endReason: "timeout", answeredCount: 1, missingItemIds: TASKS.slice(1) });
  });

  it("without the option there is no training (the default): the pre-session item leads to the intro video", async () => {
    vi.setSystemTime(0);
    const { mapPretest: _off, ...none } = APP_OPTIONS;
    const { o, snap } = newStudySession({}, none);
    await o.start();
    await driveSession(o, snap, ["briefing"]);
    expect(kinds(await o.logRecords()).some((k) => k.startsWith("map_pretest"))).toBe(false);
    expect(o.logHeader).not.toHaveProperty("mapPretest");
  });

  it("resumes at the first task not finished — its feedback again when its answer is logged — with the time left", async () => {
    vi.setSystemTime(0);
    const sink = new InMemoryLogSink();
    const first = newStudySession({ sink });
    await first.o.start();
    await driveSession(first.o, first.snap, ["map_pretest"]);
    await vi.advanceTimersByTimeAsync(10_000);
    await trainingStep(first.o, first.snap); // task 1 answered after 10 s
    await vi.advanceTimersByTimeAsync(5_000);
    await trainingStep(first.o, first.snap); // its feedback left after 5 s
    await trainingStep(first.o, first.snap); // task 2 answered at once, its feedback not left
    vi.clearAllTimers();
    const records = await sink.readAll();
    expect(shellResumeStep({ kind: "briefing" }, records, { aiLiteracyOn: true, isPublic: false, mapPretestOn: true })).toBe("map_pretest");
    const resumed = newStudySession({ sink, resume: { header: records[0]!.detail as LogHeader, records, interruptedForMs: 5_000 } });
    await resumed.o.start();
    expect(resumed.snap().mapPretest).toMatchObject({ taskId: TASKS[1], position: 2, phase: "feedback", answer: { choiceId: expect.any(String) } });
    expect(resumed.o.engineState).toBe("BRIEFING");
    const after = await sink.readAll();
    expect(after.at(-2)!.detail).toMatchObject({ resumedAt: "map_pretest" });
    expect(after.at(-1)!.detail).toMatchObject({ resumed: true, keptItemIds: TASKS.slice(0, 1), remainingMs: 285_000 });
    await passPretest(resumed.o, resumed.snap);
    expect(resumed.snap().step).toBe("briefing");
    const all = await sink.readAll();
    expect(all.filter((r) => r.kind === "map_pretest_answer").map((r) => (r.detail as { itemId: string }).itemId)).toEqual(TASKS);
    expect(all.filter((r) => r.kind === "map_pretest_feedback_left")).toHaveLength(TASKS.length);
  });
});
