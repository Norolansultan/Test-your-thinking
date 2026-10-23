/**
 * The map-reading pretest in the session (difficulty audit, 23 Oct 2026; `app/session/map-pretest.ts`, `proposal-map.md` c.2): after
 * the pre-session item in an expert session (after the primer in a public one: `public-flow.spec.ts`), before the intro video; one item
 * at a time, final, fixed order; its records; the 4-minute cap; a resume at the first unanswered item; nothing without the option; no
 * key and no feedback on screen; the same in both groups.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLogSink, type LogHeader } from "../../app/telemetry/log.js";
import { MAP_PRETEST } from "../../app/session/map-pretest.js";
import { shellResumeStep } from "../../app/session/shell-resume.js";
import { APP_OPTIONS, driveSession, kinds, newStudySession, passPretest } from "../public/public-run.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const ITEMS = MAP_PRETEST.items.map((i) => i.id);

describe("the map-reading pretest in the session (difficulty audit c.2)", () => {
  for (const cell of ["radio", "reasoning_intent"] as const) {
    it(`${cell}: after the pre-session item, before the intro video; one item at a time, final; logged; no key on screen`, async () => {
      vi.setSystemTime(0);
      const { o, snap } = newStudySession({ cell });
      await o.start();
      await driveSession(o, snap, ["map_pretest"]);
      expect(o.engineState).toBe("BRIEFING");
      const first = snap().mapPretest!;
      expect(first).toMatchObject({ itemId: ITEMS[0], position: 1, itemCount: ITEMS.length, timeLimitMs: 240_000 });
      expect(JSON.stringify(snap().mapPretest)).not.toMatch(/key|correct/);
      await expect(o.answerMapPretest(ITEMS[1]!, "x")).rejects.toThrow(/not on the screen/);
      await expect(o.answerMapPretest(ITEMS[0]!, "nope")).rejects.toThrow(RangeError);
      await vi.advanceTimersByTimeAsync(3_000);
      await o.answerMapPretest(first.itemId, first.options[1]!.id);
      expect(snap().mapPretest).toMatchObject({ itemId: ITEMS[1], position: 2 });
      await passPretest(o, snap);
      expect(snap().step).toBe("briefing");
      const records = await o.logRecords();
      const pre = records.findIndex((r) => r.kind === "questionnaire_submitted");
      expect(kinds(records.slice(pre + 1, pre + 3 + ITEMS.length))).toEqual(["map_pretest_started", ...ITEMS.map(() => "map_pretest_answer"), "map_pretest_completed"]);
      expect(records[pre + 1]!.detail).toEqual({ version: MAP_PRETEST.version, itemIds: ITEMS, timeLimitMs: 240_000, remainingMs: 240_000, resumed: false, keptItemIds: [] });
      expect(records[pre + 2]!.detail).toEqual({ itemId: ITEMS[0], choiceId: first.options[1]!.id, position: 1, rtMs: 3_000 });
      expect(records[pre + 2 + ITEMS.length]!.detail).toEqual({ endReason: "completed", answeredCount: ITEMS.length, missingItemIds: [], durationMs: 3_000 });
      expect(o.logHeader).toMatchObject({ mapPretest: true });
    });
  }

  it("the cap ends it after 4 minutes: the items not answered are missing, and the session goes on", async () => {
    vi.setSystemTime(0);
    const { o, snap } = newStudySession({});
    await o.start();
    await driveSession(o, snap, ["map_pretest"]);
    await o.answerMapPretest(ITEMS[0]!, snap().mapPretest!.options[0]!.id);
    await vi.advanceTimersByTimeAsync(240_000);
    expect(snap().step).toBe("briefing");
    const end = (await o.logRecords()).find((r) => r.kind === "map_pretest_completed")!;
    expect(end.detail).toMatchObject({ endReason: "timeout", answeredCount: 1, missingItemIds: ITEMS.slice(1) });
  });

  it("without the option there is no pretest (the default): the pre-session item leads to the intro video", async () => {
    vi.setSystemTime(0);
    const { mapPretest: _off, ...noPretest } = APP_OPTIONS;
    const { o, snap } = newStudySession({}, noPretest);
    await o.start();
    await driveSession(o, snap, ["briefing"]);
    expect(kinds(await o.logRecords()).some((k) => k.startsWith("map_pretest"))).toBe(false);
    expect(o.logHeader).not.toHaveProperty("mapPretest");
  });

  it("resumes at the first unanswered item with the time left; the answers logged stand", async () => {
    vi.setSystemTime(0);
    const sink = new InMemoryLogSink();
    const first = newStudySession({ sink });
    await first.o.start();
    await driveSession(first.o, first.snap, ["map_pretest"]);
    await vi.advanceTimersByTimeAsync(10_000);
    await first.o.answerMapPretest(ITEMS[0]!, first.snap().mapPretest!.options[0]!.id);
    await first.o.answerMapPretest(ITEMS[1]!, first.snap().mapPretest!.options[0]!.id);
    vi.clearAllTimers();
    const records = await sink.readAll();
    expect(shellResumeStep({ kind: "briefing" }, records, { aiLiteracyOn: true, isPublic: false, mapPretestOn: true })).toBe("map_pretest");
    const resumed = newStudySession({ sink, resume: { header: records[0]!.detail as LogHeader, records, interruptedForMs: 5_000 } });
    await resumed.o.start();
    expect(resumed.snap().mapPretest).toMatchObject({ itemId: ITEMS[2], position: 3 });
    expect(resumed.o.engineState).toBe("BRIEFING");
    const after = await sink.readAll();
    expect(after.at(-2)!.detail).toMatchObject({ resumedAt: "map_pretest" });
    expect(after.at(-1)!.detail).toMatchObject({ resumed: true, keptItemIds: ITEMS.slice(0, 2), remainingMs: 230_000 });
    await passPretest(resumed.o, resumed.snap);
    expect(resumed.snap().step).toBe("briefing");
    expect((await sink.readAll()).filter((r) => r.kind === "map_pretest_answer")).toHaveLength(ITEMS.length);
  });
});
