/**
 * The intro video before the practice view (10 Oct 2026, `SessionOptions.introVideo`): with the study
 * shell, the briefing step waits on the video's page; how the page was left is logged as
 * `briefing_advanced` "briefing.video"; skipping is for demonstrations only; a resume shows it again.
 * Without the option (and without the shell) the briefing is passed at once, as before.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionOptions, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { InMemoryLogSink, type LogRecord } from "../../app/telemetry/log.js";
import type { PreflightEnv } from "../../app/session/preflight.js";
import { conditionOfCell } from "../../app/session/preview.js";

const scenario = buildDemoScenario();
const VIDEO = "/video/intro.mp4";
const GOOD: PreflightEnv = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  maxTouchPoints: 0, pointer: "fine", viewport: { w: 1440, h: 900, dpr: 1 }, indexedDb: true, webgl2: true, proxy: "not_needed",
};

function start(options: Partial<SessionOptions> = {}, video: string | null = VIDEO) {
  const o = new SessionOrchestrator(scenario, conditionOfCell("radio"), { cell: "radio", studyShell: true, ...(video ? { introVideo: video } : {}), thinker: { transport: vi.fn() }, ...options });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}

async function toVideo(options: Partial<SessionOptions> = {}, video: string | null = VIDEO) {
  const s = start(options, video);
  await s.o.start();
  await s.o.decideConsent(true, true);
  await s.o.submitPreflight(GOOD);
  await s.o.submitQuestionnaire({ "fatigue.start": 2 });
  return s;
}

const briefing = (records: readonly LogRecord[]) => records.filter((r) => r.kind === "briefing_advanced").map((r) => r.detail);
const triggers = (records: readonly LogRecord[]) => records.filter((r) => r.kind === "state_transition").map((r) => (r.detail as { trigger: string }).trigger);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the intro video before the practice view", () => {
  it("waits on the video's page after the pre-session item; the header logs the video", async () => {
    const { o, snap } = await toVideo();
    expect(snap().step).toBe("briefing");
    expect(snap().introVideo).toEqual({ src: VIDEO, skippable: false });
    const records = await o.logRecords();
    expect((records[0]!.detail as { introVideo?: string }).introVideo).toBe(VIDEO);
    expect(briefing(records)).toEqual([]);
    expect(triggers(records)).not.toContain("briefing_complete");
  });

  it("the video ended: logged as briefing.video with its dwell and outcome, then the practice view", async () => {
    const { o, snap } = await toVideo();
    vi.advanceTimersByTime(42_000);
    await o.finishIntroVideo("ended");
    const records = await o.logRecords();
    expect(briefing(records)).toEqual([{ screenId: "briefing.video", dwellMs: expect.any(Number), videoOutcome: "ended" }]);
    expect(triggers(records)).toContain("briefing_complete");
    expect(snap().step).toBe("exploration");
    expect(snap().practice).toBe(true);
    expect(snap().introVideo).toBeNull();
    await expect(o.finishIntroVideo("ended")).rejects.toThrow(/finishIntroVideo in step/);
  });

  it("a video that cannot be played lets the participant go on, logged as error", async () => {
    const { o } = await toVideo();
    await o.finishIntroVideo("error");
    expect(briefing(await o.logRecords())[0]).toMatchObject({ screenId: "briefing.video", videoOutcome: "error" });
  });

  it("skipping is for demonstrations only", async () => {
    const study = await toVideo();
    await expect(study.o.finishIntroVideo("skipped")).rejects.toThrow(/demonstrations only/);
    expect(study.snap().step).toBe("briefing");
    const demo = await toVideo({ allowViewSkip: true });
    expect(demo.snap().introVideo).toEqual({ src: VIDEO, skippable: true });
    await demo.o.finishIntroVideo("skipped");
    expect(briefing(await demo.o.logRecords())[0]).toMatchObject({ videoOutcome: "skipped" });
    expect(demo.snap().practice).toBe(true);
  });

  it("without the option, or without the study shell, the briefing is passed at once (revision (ae))", async () => {
    const plain = await toVideo({}, null);
    expect(plain.snap().step).toBe("exploration");
    expect(briefing(await plain.o.logRecords())).toEqual([{ screenId: "briefing.setting", dwellMs: 0, auto: true, screenRemoved: true }]);
    const noShell = new SessionOrchestrator(scenario, conditionOfCell("radio"), { cell: "radio", introVideo: VIDEO, thinker: { transport: vi.fn() } });
    await noShell.start();
    const records = await noShell.logRecords();
    expect((records[0]!.detail as { introVideo?: string }).introVideo).toBeUndefined();
    expect(briefing(records)[0]).toMatchObject({ screenId: "briefing.setting", auto: true });
  });

  it("a session interrupted on the video's page shows the video again on resume", async () => {
    const sink = new InMemoryLogSink();
    await toVideo({ sink });
    vi.clearAllTimers();
    const records = await sink.readAll();
    const { o, snap } = start({ sink, resume: { header: records[0]!.detail as never, records, interruptedForMs: 5_000 } }, null);
    await o.start();
    expect(snap().step).toBe("briefing");
    expect(snap().introVideo).toEqual({ src: VIDEO, skippable: false }); // from the header, not the options
    await o.finishIntroVideo("ended");
    expect(snap().practice).toBe(true);
  });
});
