/**
 * The AI literacy questionnaire after consent (SNAIL; revision (ac), amended 9 Oct 2026;
 * `app/session/ai-literacy.ts`, `ai-literacy-items.ts`): the 31 items and their factors; its place in
 * the screen order, the same in every cell; four items per screen, each rating logged at once (the
 * last counts), "Next" only with the screen rated; the 5-minute cap; "Skip the test" (at once and
 * midway); missing ratings as null; the TU/CA/PA means over the rated items, computed in the
 * analysis and never logged (SPEC/07 §3); resume (reopen on the first screen with an unrated item,
 * ratings kept, the clock less the active time; an ended questionnaire not shown again).
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionOptions, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { InMemoryLogSink, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { PreflightEnv } from "../../app/session/preflight.js";
import { conditionOfCell } from "../../app/session/preview.js";
import type { Cell } from "../../app/scenario/types.js";
import { AI_LITERACY_ITEMS, AI_LITERACY_ITEMS_PENDING, AI_LITERACY_PAGES, AI_LITERACY_SCALE, AI_LITERACY_TIME_LIMIT_MS } from "../../app/session/ai-literacy-items.js";
import { checkAiLiteracyRating } from "../../app/session/ai-literacy.js";
import { aiLiteracyScoreOf, scoreSnail, SNAIL_FACTOR_OF } from "../../app/telemetry/ai-literacy-score.js";
import type { AiLiteracyAnsweredDetail, AiLiteracyStartedDetail, AiLiteracySubmittedDetail } from "../../app/telemetry/record-kinds.js";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { SHELL_STEPS } from "../../app/render/ui/components/StudyShell.js";

const scenario = buildDemoScenario();
const GOOD: PreflightEnv = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  maxTouchPoints: 0, pointer: "fine", viewport: { w: 1440, h: 900, dpr: 1 }, indexedDb: true, webgl2: true, proxy: "reachable",
};

function start(cell: Cell = "radio", options: Partial<SessionOptions> = {}) {
  const o = new SessionOrchestrator(scenario, conditionOfCell(cell), { cell, studyShell: true, aiLiteracyTest: true, realClockMs: () => Date.now(), thinker: { transport: vi.fn() }, ...options });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}
async function toTest(cell: Cell = "radio", options: Partial<SessionOptions> = {}) {
  const s = start(cell, options);
  await s.o.start();
  await s.o.decideConsent(true, true);
  return s;
}
const kinds = (records: readonly LogRecord[]) => records.map((r) => r.kind);
const transitions = (records: readonly LogRecord[]) => records.filter((r) => r.kind === "state_transition").map((r) => (r.detail as { trigger: string }).trigger);
const ofKind = <T>(records: readonly LogRecord[], kind: string) => records.filter((r) => r.kind === kind).map((r) => r.detail as T);
/** The end records, each checked for SPEC/07 §3: no score in the log. */
const submitted = async (o: SessionOrchestrator) => {
  const ends = ofKind<AiLiteracySubmittedDetail>(await o.logRecords(), "ai_literacy_submitted");
  for (const e of ends) expect(JSON.stringify(e)).not.toMatch(/"(score|mean|TU|CA|PA|correct)"/);
  return ends;
};

/** Rates every item on the next `screens` screens with `rating(itemId)` (`secondsEach` apart) and presses Next. */
async function rateScreens(o: SessionOrchestrator, snap: () => SessionSnapshot, screens: number, { rating = (_: string): number => 4, secondsEach = 3 } = {}) {
  for (let k = 0; k < screens; k++) {
    for (const it of snap().aiLiteracy!.items) {
      await vi.advanceTimersByTimeAsync(secondsEach * 1000);
      await o.answerAiLiteracy(it.id, rating(it.id));
    }
    await o.nextAiLiteracyPage();
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the SNAIL items (app/session/ai-literacy-items.ts)", () => {
  it("31 verbatim items: 14 TU, 10 CA, 7 PA, the eliminated eight left out; both languages; 8 screens of at most 4", () => {
    expect(AI_LITERACY_ITEMS).toHaveLength(31);
    expect(AI_LITERACY_ITEMS_PENDING).toBe(false);
    expect(AI_LITERACY_TIME_LIMIT_MS).toBe(300_000);
    expect(AI_LITERACY_SCALE).toEqual({ min: 1, max: 7 });
    const count = (f: string) => AI_LITERACY_ITEMS.filter((i) => i.factor === f).length;
    expect([count("TU"), count("CA"), count("PA")]).toEqual([14, 10, 7]);
    const vars = AI_LITERACY_ITEMS.map((i) => i.variable);
    expect(new Set(vars).size).toBe(31);
    for (const gone of ["V03", "V07", "V09", "V10", "V11", "V26", "V27", "V38"]) expect(vars).not.toContain(gone);
    expect([...vars].sort()).toEqual(vars); // one fixed order, by variable number
    for (const i of AI_LITERACY_ITEMS) { expect(i.en, i.id).not.toBe(""); expect(i.fi, i.id).not.toBe(""); }
    expect(AI_LITERACY_PAGES.map((p) => p.length)).toEqual([4, 4, 4, 4, 4, 4, 4, 3]);
    // Spot checks against Table 1.
    expect(AI_LITERACY_ITEMS.find((i) => i.variable === "V14")).toMatchObject({ factor: "TU", en: "describe how machine learning models are trained, validated, and tested." });
    expect(AI_LITERACY_ITEMS.find((i) => i.variable === "V35")).toMatchObject({ factor: "CA", en: "explain why data privacy must be considered when developing and using artificial intelligence applications." });
    expect(AI_LITERACY_ITEMS.find((i) => i.variable === "V31")).toMatchObject({ factor: "PA", en: "assess if a problem in my field can and should be solved with artificial intelligence methods." });
    expect(SNAIL_FACTOR_OF["snail.V05"]).toBe("TU");
  });

  it("a rating is an integer 1–7 of a known item", () => {
    expect(checkAiLiteracyRating("snail.V01", 7)).toBe(7);
    for (const bad of [0, 8, 3.5, "4", null]) expect(() => checkAiLiteracyRating("snail.V01", bad)).toThrow(RangeError);
    expect(() => checkAiLiteracyRating("snail.V03", 4)).toThrow(RangeError); // eliminated
  });

  it("subscale means over the rated items only; none rated is null, not a low score", () => {
    const s = scoreSnail(new Map([["snail.V04", 2], ["snail.V05", 6], ["snail.V06", 7]]));
    expect(s.TU).toEqual({ mean: 4, rated: 2, items: 14 });
    expect(s.CA).toEqual({ mean: 7, rated: 1, items: 10 });
    expect(s.PA).toEqual({ mean: null, rated: 0, items: 7 });
    expect(s.total).toEqual({ mean: 5, rated: 3, items: 31 });
  });

  it("the screen texts exist in both languages: the stem, the anchors; the Finnish marks its draft only in Finnish", () => {
    for (const lang of ["fi", "en"] as const) {
      const t = STUDY_TEXT[lang].aiLiteracy;
      for (const v of [t.title, t.intro, t.stem, t.low, t.high, t.next, t.skip, t.skipConfirm, t.skipYes, t.skipCancel, t.timeLeft, t.pendingBanner]) expect(v).not.toBe("");
    }
    expect(STUDY_TEXT.en.aiLiteracy.stem).toBe("I can…");
    expect(STUDY_TEXT.en.aiLiteracy.low).toMatch(/strongly disagree/);
    expect(STUDY_TEXT.en.aiLiteracy.high).toMatch(/strongly agree/);
    expect(STUDY_TEXT.fi.aiLiteracy.draftTranslationBanner).toMatch(/LUONNOS/);
    expect(STUDY_TEXT.en.aiLiteracy.draftTranslationBanner).toBe("");
  });
});

describe("the screen and the app's wiring (source; hooks cannot be rendered in this test setup)", () => {
  it("the shell draws it full screen with the countdown, the rating scales, Next, and Skip with one inline confirmation; the app turns it on", () => {
    expect(SHELL_STEPS.has("ai_literacy")).toBe(true);
    const shell = readFileSync("app/render/ui/components/StudyShell.tsx", "utf8");
    expect(shell).toMatch(/case "ai_literacy": return <AiLiteracyScreen/);
    expect(shell).toMatch(/orchestrator\.aiLiteracySecondsLeft\(\)/);
    expect(shell).toMatch(/orchestrator\.answerAiLiteracy\(item\.id, n\)/);
    expect(shell).toMatch(/setConfirmSkip\(true\)/);
    expect(shell).toMatch(/act\(\(\) => orchestrator\.skipAiLiteracy\(\)\)/);
    expect(readFileSync("app/render/ui/useSession.ts", "utf8")).toMatch(/aiLiteracyTest: true/);
  });
});

describe("the screen order", () => {
  it("consent, then the AI literacy questionnaire as the first data collected, then the preflight, the pre-session item and the briefing", async () => {
    const { o, snap } = start();
    await o.start();
    expect(snap().aiLiteracy).toBeNull();
    await o.decideConsent(true, true);
    expect(snap().step).toBe("ai_literacy");
    let records = await o.logRecords();
    expect(kinds(records)).toEqual(["session_started", "consent_decided", "state_transition", "ai_literacy_started"]);
    expect((records[0]!.detail as LogHeader).aiLiteracyTest).toBe(true);
    expect(records[3]!.detail).toEqual({
      instrumentId: "SNAIL", version: "snail-31.2023.v1", itemIds: AI_LITERACY_ITEMS.map((i) => i.id), timeLimitMs: 300_000, itemsPerPage: 4, firstPage: 0,
      remainingMs: 300_000, resumed: false, keptItemIds: [], itemsPending: false,
    } satisfies AiLiteracyStartedDetail);
    await expect(o.submitPreflight(GOOD)).rejects.toThrow();
    await rateScreens(o, snap, 8, { secondsEach: 1 });
    expect(snap().step).toBe("preflight");
    expect(snap().aiLiteracy).toBeNull();
    await o.submitPreflight(GOOD);
    await o.submitQuestionnaire({});
    expect(snap().step).toBe("exploration"); // the briefing page is gone (revision (ae)): straight to the practice view
    records = await o.logRecords();
    expect(kinds(records).indexOf("ai_literacy_submitted")).toBeLessThan(kinds(records).indexOf("preflight_result"));
    expect(transitions(records)).toEqual(["start", "preflight_passed", "briefing_complete"]); // the briefing passed at once (revision (ae))
  });

  it("without the option (or without the study shell) nothing changes", async () => {
    const off = start("radio", { aiLiteracyTest: false });
    await off.o.start();
    await off.o.decideConsent(true, true);
    expect(off.snap().step).toBe("preflight");
    const noShell = start("radio", { studyShell: false });
    await noShell.o.start();
    expect(noShell.snap().step).toBe("exploration"); // no briefing page (revision (ae))
    await expect(noShell.o.skipAiLiteracy()).rejects.toThrow();
  });

  it("is identical in both conditions and the demonstration: the same screens, records and skip", async () => {
    const run = async (cell: Cell, options: Partial<SessionOptions> = {}) => {
      const { o, snap } = await toTest(cell, options);
      const shown = snap().aiLiteracy;
      await rateScreens(o, snap, 2, { rating: (id) => (id.length % 7) + 1 });
      await o.skipAiLiteracy();
      return { shown, records: (await o.logRecords()).filter((r) => r.kind.startsWith("ai_literacy_")).map((r) => ({ kind: r.kind, detail: r.detail })) };
    };
    const haku = await run("radio");
    expect(await run("reasoning_intent")).toEqual(haku);
    expect(await run("reasoning_once", { allowPreflightOverride: true })).toEqual(haku);
  });
});

describe("rating", () => {
  it("four statements per screen in the session language; each rating logged at once, re-rating logged again (the last counts); Next only when the screen is rated", async () => {
    const { o, snap } = await toTest("radio", { language: "en" });
    expect(snap().aiLiteracy).toMatchObject({ page: 0, pageCount: 8, itemCount: 31, answeredCount: 0, scale: { min: 1, max: 7 }, itemsPending: false });
    expect(snap().aiLiteracy!.items).toEqual([
      { id: "snail.V01", position: 1, text: "tell if the technologies I use are supported by artificial intelligence." },
      { id: "snail.V02", position: 2, text: "name examples of technical applications that are supported by artificial intelligence." },
      { id: "snail.V04", position: 3, text: AI_LITERACY_ITEMS[2]!.en }, { id: "snail.V05", position: 4, text: AI_LITERACY_ITEMS[3]!.en },
    ]);
    expect(JSON.stringify(snap().aiLiteracy)).not.toMatch(/"factor"|"TU"|"CA"|"PA"/);
    await expect(o.answerAiLiteracy("snail.V06", 3)).rejects.toThrow(/not on the screen/);
    await expect(o.answerAiLiteracy("snail.V01", 9)).rejects.toThrow(RangeError);
    await vi.advanceTimersByTimeAsync(6_000);
    await o.answerAiLiteracy("snail.V01", 3);
    await vi.advanceTimersByTimeAsync(2_000);
    await o.answerAiLiteracy("snail.V01", 5);
    expect(snap().aiLiteracy!.ratings).toEqual({ "snail.V01": 5, "snail.V02": null, "snail.V04": null, "snail.V05": null });
    await expect(o.nextAiLiteracyPage()).rejects.toThrow(/not rated/);
    const answered = ofKind<AiLiteracyAnsweredDetail>(await o.logRecords(), "ai_literacy_answered");
    expect(answered).toEqual([
      { itemId: "snail.V01", sourceItemId: "V01", position: 1, page: 0, response: 3, timeOnItemMs: 6_000 },
      { itemId: "snail.V01", sourceItemId: "V01", position: 1, page: 0, response: 5, timeOnItemMs: 2_000 },
    ]);
    for (const id of ["snail.V02", "snail.V04", "snail.V05"]) await o.answerAiLiteracy(id, 4);
    await o.nextAiLiteracyPage();
    expect(snap().aiLiteracy).toMatchObject({ page: 1, answeredCount: 4 });
    const fi = await toTest("radio", { language: "fi" });
    expect(fi.snap().aiLiteracy!.items[0]!.text).toBe(AI_LITERACY_ITEMS[0]!.fi);
  });

  it("Next on the last screen completes it; the analysis computes the subscale means; nothing afterwards", async () => {
    const { o, snap } = await toTest();
    const rating = (id: string) => ({ TU: 2, CA: 6, PA: 5 })[SNAIL_FACTOR_OF[id]!];
    await rateScreens(o, snap, 8, { rating, secondsEach: 2 });
    const [end] = await submitted(o);
    expect(end).toMatchObject({ endReason: "completed", itemCount: 31, answeredCount: 31, missingItemIds: [], durationMs: 62_000 });
    expect(await aiLiteracyScoreOf(await o.logRecords())).toMatchObject({ endReason: "completed", answeredCount: 31, TU: { mean: 2, rated: 14 }, CA: { mean: 6, rated: 10 }, PA: { mean: 5, rated: 7 } });
    await expect(o.answerAiLiteracy("snail.V39", 4)).rejects.toThrow();
    expect(snap().step).toBe("preflight");
  });
});

describe("the 5-minute cap", () => {
  it("counts down; on timeout every rating so far is kept (those on the interrupted screen too), the rest missing", async () => {
    const { o, snap } = await toTest();
    expect(o.aiLiteracySecondsLeft()).toBe(300);
    await rateScreens(o, snap, 2, { secondsEach: 5 }); // 40 s
    await o.answerAiLiteracy("snail.V14", 6); // on screen 3, not yet "Next"
    expect(o.aiLiteracySecondsLeft()).toBe(260);
    await vi.advanceTimersByTimeAsync(259_000);
    expect(snap().step).toBe("ai_literacy");
    expect(await submitted(o)).toEqual([]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(snap().step).toBe("preflight");
    const ends = await submitted(o);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ endReason: "timeout", answeredCount: 9, durationMs: 300_000 });
    expect(ends[0]!.missingItemIds).toHaveLength(22);
    expect(ends[0]!.responses.find((r) => r.itemId === "snail.V14")!.response).toBe(6);
    expect(ends[0]!.responses.find((r) => r.itemId === "snail.V15")!.response).toBeNull();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(await submitted(o)).toHaveLength(1);
  });
});

describe("skip the test", () => {
  it("at once, before any rating: skipped, nothing rated, no score at all (the covariate is missing)", async () => {
    const { o, snap } = await toTest("reasoning_intent");
    await vi.advanceTimersByTimeAsync(3_000);
    await o.skipAiLiteracy();
    expect(snap().step).toBe("preflight");
    const [end] = await submitted(o);
    expect(end).toMatchObject({ endReason: "skipped", answeredCount: 0, durationMs: 3_000 });
    expect(end!.responses.every((r) => r.response === null)).toBe(true);
    await expect(o.skipAiLiteracy()).rejects.toThrow();
    expect(aiLiteracyScoreOf(await o.logRecords())).toMatchObject({ endReason: "skipped", answeredCount: 0, TU: { mean: null }, CA: { mean: null }, PA: { mean: null }, total: { mean: null } });
  });

  it("midway: the ratings given are kept and scored over the rated items, the rest missing", async () => {
    const { o, snap } = await toTest("radio");
    await rateScreens(o, snap, 1, { rating: () => 6 });
    await o.answerAiLiteracy("snail.V06", 2);
    await o.skipAiLiteracy();
    const [end] = await submitted(o);
    expect(end).toMatchObject({ endReason: "skipped", answeredCount: 5 });
    expect(aiLiteracyScoreOf(await o.logRecords())).toMatchObject({ TU: { mean: 6, rated: 2 }, CA: { mean: 2, rated: 1 }, PA: { mean: 6, rated: 2 }, total: { rated: 5 } });
  });
});

describe("resume", () => {
  async function resumeFrom(records: readonly LogRecord[], cell: Cell = "radio") {
    vi.clearAllTimers();
    const sink = new InMemoryLogSink();
    for (const r of records) await sink.append(r);
    const s = start(cell, { sink, resume: { header: records[0]!.detail as LogHeader, records, interruptedForMs: 5_000 } });
    await s.o.start();
    return { ...s, sink, before: records.length };
  }

  it("interrupted midway: it reopens on the first screen with an unrated item, the ratings kept and shown; the clock less the active time", async () => {
    const first = await toTest();
    await rateScreens(first.o, first.snap, 2, { secondsEach: 10 }); // 80 s
    await vi.advanceTimersByTimeAsync(5_000);
    await first.o.answerAiLiteracy("snail.V14", 3); // 85 s; screen 3 half done when the tab closes
    await vi.advanceTimersByTimeAsync(20_000); // not charged
    const { o, snap, sink, before } = await resumeFrom(await first.o.logRecords());
    expect(snap().step).toBe("ai_literacy");
    expect(snap().aiLiteracy).toMatchObject({ page: 2, answeredCount: 9 });
    expect(snap().aiLiteracy!.ratings["snail.V14"]).toBe(3);
    const after = (await sink.readAll()).slice(before);
    expect(kinds(after)).toEqual(["fault", "fault_resolved", "session_resumed", "ai_literacy_started"]);
    expect(after[2]!.detail).toMatchObject({ resumedAt: "ai_literacy" });
    expect(after[3]!.detail).toMatchObject({ resumed: true, firstPage: 2, remainingMs: 215_000 });
    expect((after[3]!.detail as AiLiteracyStartedDetail).keptItemIds).toHaveLength(9);
    expect(o.aiLiteracySecondsLeft()).toBe(215);
    await rateScreens(o, snap, 6);
    const ends = ofKind<AiLiteracySubmittedDetail>(await sink.readAll(), "ai_literacy_submitted");
    expect(ends).toEqual([expect.objectContaining({ endReason: "completed", answeredCount: 31 })]);
    await o.submitPreflight(GOOD);
    expect(transitions(await sink.readAll())).toEqual(["start", "preflight_passed"]);
  });

  it("after a skip it is not shown again: the preflight follows", async () => {
    const first = await toTest();
    await rateScreens(first.o, first.snap, 1);
    await first.o.skipAiLiteracy();
    const { snap, sink, before } = await resumeFrom(await first.o.logRecords());
    expect(snap().step).toBe("preflight");
    const after = (await sink.readAll()).slice(before);
    expect(kinds(after)).toEqual(["fault", "fault_resolved", "session_resumed"]);
    expect(after[2]!.detail).toMatchObject({ resumedAt: "preflight" });
  });

  it("every item rated but the end lost: the resume submits it as completed and moves on", async () => {
    const first = await toTest();
    await rateScreens(first.o, first.snap, 8);
    const all = await first.o.logRecords();
    const { snap, sink, before } = await resumeFrom(all.slice(0, all.findIndex((r) => r.kind === "ai_literacy_submitted")));
    expect(snap().step).toBe("preflight");
    const after = (await sink.readAll()).slice(before);
    expect(kinds(after)).toEqual(["fault", "fault_resolved", "session_resumed", "ai_literacy_started", "ai_literacy_submitted"]);
    expect(after[4]!.detail).toMatchObject({ endReason: "completed", answeredCount: 31 });
  });
});
