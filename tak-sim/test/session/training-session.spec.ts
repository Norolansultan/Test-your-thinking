/**
 * The training incident in the session (SPEC/15 (bp) §bp.1–§bp.3, §bp.7's session tests; SPEC/07 (bp)), over the synthetic fixture:
 * its place in the order (after the pre-session item and a public session's primer, before the intro video); the header and the
 * format; feedback after every item, right or wrong, the first answer logged before it; each item answered once; S3's card window;
 * S4's exposure and its blank map; covariates before group-specific content; the cap; the real components routed to the training;
 * no record outside `training_*`; the Thinker absent; the lock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRAINING_FIXTURE } from "./training-fixture.js";
import { driveTo, kinds, newTrainingSession, ofKind, passTraining, trainingMove } from "./training-run.js";
import type { TrainingAnswerDetail, TrainingCompletedDetail, TrainingDemoShownDetail, TrainingStartedDetail } from "../../app/telemetry/record-kinds-training.js";
import { trainingExtent } from "../../app/session/training/area.js";

vi.mock("../../app/session/training/spec-data.js", async () => ({ TRAINING: (await import("./training-fixture.js")).TRAINING_FIXTURE }));
vi.mock("../../app/session/training/corpus.js", async () => {
  const f = await import("./training-fixture.js");
  return { TRAINING_VIEW: { startsAtVirtual: -12_000, steps: 1 }, TRAINING_STEP: -9, TRAINING_NOW_S: -10_920, TRAINING_ATOMS: f.TRAINING_ATOMS_FIXTURE, trainingLogRows: f.trainingLogRowsFixture };
});
vi.mock("../../app/i18n/training-texts.js", async () => ({ TRAINING_TEXT: (await import("./training-fixture.js")).TRAINING_TEXT_FIXTURE }));

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

const spec = TRAINING_FIXTURE;
const ITEM_IDS = spec.items.map((it) => it.id);
const COVARIATE_IDS = spec.items.filter((it) => it.covariate !== null).map((it) => it.id);

describe("the training incident's place and records (SPEC/15 (bp) §bp.1, SPEC/07 (bp))", () => {
  for (const cell of ["radio", "reasoning_intent", "reasoning_once"] as const) {
    it(`${cell}: after the pre-session item, before the intro video; ${spec.items.length} answers and feedbacks, then S5 and the end`, async () => {
      const { o, snap } = newTrainingSession({ cell });
      await o.start();
      await driveTo(o, snap);
      expect(o.engineState).toBe("BRIEFING");
      expect(o.logHeader).toMatchObject({ trainingIncident: true, formatVersion: "0.18.0" });
      expect(o.logHeader).not.toHaveProperty("mapPretest");
      expect(o.logHeader).not.toHaveProperty("practiceFeedback");
      expect(snap().training).toMatchObject({ phase: "intro", position: 0, itemCount: spec.items.length, capMs: 720_000 });
      await passTraining(o, snap, spec);
      expect(snap().step).toBe("briefing"); // the intro video
      const records = await o.logRecords();
      const pre = records.findIndex((r) => r.kind === "questionnaire_submitted");
      const mine = records.slice(pre + 1);
      const training = mine.slice(0, mine.findIndex((r) => r.kind === "training_completed") + 1);
      expect(training.every((r) => r.kind.startsWith("training_"))).toBe(true); // nothing else is written by the training
      const sections = spec.sections.filter((s) => s.itemIds.length > 0).length;
      expect(training).toHaveLength(1 + sections + 2 * spec.items.length + 2); // 33 for the real 13 items (`07` (bp))
      expect(kinds(training).filter((k) => k === "training_section_left")).toHaveLength(sections);
      // Feedback after every item: each answer is followed by its own feedback before the next item's answer.
      const flow = training.filter((r) => r.kind === "training_answer" || r.kind === "training_feedback_left").map((r) => `${r.kind === "training_answer" ? "A" : "F"}:${(r.detail as { itemId: string }).itemId}`);
      expect(flow).toEqual(ITEM_IDS.flatMap((id) => [`A:${id}`, `F:${id}`]));
      const started = ofKind<TrainingStartedDetail>(training, "training_started")[0]!;
      expect(started).toEqual({ version: spec.version, sectionIds: ["s1", "s2", "s3", "s4", "s5"], itemIds: ITEM_IDS, capMs: 720_000, remainingMs: 720_000, resumed: false, keptItemIds: [] });
      const demo = ofKind<TrainingDemoShownDetail>(training, "training_demo_shown")[0]!;
      expect(demo).toMatchObject({ demoId: cell === "radio" ? "haku" : "guide", exampleIds: ["ex1", "ex2"] });
      expect(demo.dwellMs).toBeGreaterThanOrEqual(spec.demoMinDwellMs);
      expect(ofKind<TrainingCompletedDetail>(training, "training_completed")[0]).toMatchObject({ endReason: "completed", answeredCount: spec.items.length, missingItemIds: [] });
      // The intro video follows (its page logs on leaving), then VP.
      expect(mine.slice(training.length).some((r) => r.kind.startsWith("training_"))).toBe(false);
    });
  }

  it("a public session: after the primer", async () => {
    const { o, snap } = newTrainingSession({ audience: "public" });
    await o.start();
    await driveTo(o, snap);
    const records = await o.logRecords();
    const primer = records.findIndex((r) => r.kind === "briefing_advanced" && (r.detail as { screenId: string }).screenId === "briefing.primer");
    expect(primer).toBeGreaterThan(0);
    expect(records.at(-1)!.kind).toBe("training_started");
  });

  it("without the option there is no training: the pre-session item leads to the intro video", async () => {
    const { o, snap } = newTrainingSession({ trainingIncident: false });
    await o.start();
    await driveTo(o, snap, "briefing");
    expect(kinds(await o.logRecords()).some((k) => k.startsWith("training_"))).toBe(false);
    expect(o.logHeader).not.toHaveProperty("trainingIncident");
  });

  it("covariates before group-specific content: every covariate item's answer precedes S5, which follows S4's last feedback", async () => {
    const { o, snap } = newTrainingSession({ cell: "reasoning_intent" });
    await o.start();
    await driveTo(o, snap);
    await passTraining(o, snap, spec, (s) => s.training?.phase === "demo");
    expect(snap().training).toMatchObject({ phase: "demo", demoId: "guide", sectionId: "s5" });
    const records = await o.logRecords();
    const lastS4 = records.map((r) => r.kind).lastIndexOf("training_feedback_left");
    expect((records[lastS4]!.detail as { itemId: string }).itemId).toBe(spec.items.at(-1)!.id);
    const answered = ofKind<TrainingAnswerDetail>(records, "training_answer").map((d) => d.itemId);
    for (const id of COVARIATE_IDS) expect(answered).toContain(id);
    expect(kinds(records)).not.toContain("training_demo_shown");
    // S5's button: refused before its 10 s.
    await expect(o.leaveTrainingDemo()).rejects.toThrow(/enabled after/);
    expect(o.trainingDemoSecondsLeft()).toBe(10);
  });
});

describe("the real components routed to the training (SPEC/15 (bp) §bp.2)", () => {
  async function at(itemId: string) {
    const ctx = newTrainingSession();
    await ctx.o.start();
    await driveTo(ctx.o, ctx.snap);
    await passTraining(ctx.o, ctx.snap, spec, (s) => s.training?.itemId === itemId && s.training.phase !== "feedback");
    return ctx;
  }

  it("a live item: the map shows its scene, the tools its section opens; the first answer is logged before the feedback, once", async () => {
    const first = spec.items[0]!;
    const { o, snap } = await at(first.id);
    expect(snap().training).toMatchObject({ phase: "question", itemId: first.id, position: 1, tools: { map: true, rb: true, log: false, haku: false } });
    expect(snap().renderTree.cycleInfo).toBe(spec.scenes[first.scene]);
    expect(snap().radioLog).toEqual([]);
    expect(snap().aiAvailable).toBe(false); // no Thinker pane
    expect(o.mapExtent).toEqual(trainingExtent(spec));
    await expect(o.leaveTrainingFeedback(first.id)).rejects.toThrow(/no feedback/);
    o.noteTrainingMeasure(512.4);
    await vi.advanceTimersByTimeAsync(4_000);
    const r6 = (v: number) => Math.round(v * 1e6) / 1e6; // the answer's point is logged to 6 decimals
    const key = (first.key as { point: { lat: number; lon: number } }).point;
    const off = { lat: r6(key.lat + 0.001), lon: r6(key.lon) };
    await o.answerTraining(first.id, { point: off });
    expect(snap().training).toMatchObject({ phase: "feedback", answer: { point: off }, timedOut: false });
    expect(snap().training!.errorM).toBeGreaterThan(100);
    await expect(o.answerTraining(first.id, { point: off })).rejects.toThrow(/not asked now/);
    const answer = ofKind<TrainingAnswerDetail>(await o.logRecords(), "training_answer");
    expect(answer).toHaveLength(1);
    expect(answer[0]).toMatchObject({ itemId: first.id, sectionId: first.section, position: 1, rtMs: 4_000, measures: [512], errorM: snap().training!.errorM });
    expect(answer[0]).not.toHaveProperty("confidence");
  });

  it("refuses an answer of the wrong shape, outside the lock, or a confidence on a live item", async () => {
    const choice = spec.items.find((it) => it.mode === "live" && it.answer === "choice")!;
    const { o } = await at(choice.id);
    await expect(o.answerTraining(choice.id, { choiceId: "zz" })).rejects.toThrow(RangeError);
    await expect(o.answerTraining(choice.id, { choiceId: choice.options[0]!.id, confidence: 50 })).rejects.toThrow(/without a confidence/);
    await expect(o.answerTraining(choice.id, { point: spec.area.centre })).rejects.toThrow(RangeError);
    const point = spec.items.find((it) => it.answer === "point" && it.mode === "live")!;
    const p = await at(point.id);
    await expect(p.o.answerTraining(point.id, { point: { lat: 60.8, lon: 27.3 } })).rejects.toThrow(/outside the training's area/);
  });

  it("S2 opens the log to its clock, S3 to now; S3's card is the SPAM card, opened at once, its window counting down", async () => {
    const s2 = spec.items.find((it) => it.section === "s2")!;
    const a = await at(s2.id);
    expect(a.snap().training!.tools).toMatchObject({ log: true, haku: false });
    expect(a.snap().radioLog.map((r) => r.clockLabel).every((c) => c <= "10.12")).toBe(true);
    const card = spec.items.find((it) => it.mode === "card")!;
    const { o, snap } = await at(card.id);
    expect(snap().training!.tools).toEqual({ map: true, rb: true, log: true, haku: true });
    expect(snap().radioLog.length).toBeGreaterThan(a.snap().radioLog.length);
    expect(snap().spam).toMatchObject({ phase: "item", probeId: card.id, chosen: null, forced: false, itemIndex: 1, itemCount: 1 });
    expect(o.spamSecondsLeft()).toBe(60);
    await o.answerSpam(card.options[1]!.id);
    expect(snap().spam).toMatchObject({ phase: "confidence", chosen: card.options[1]!.id });
    await expect(o.answerSpam(card.options[2]!.id)).rejects.toThrow(/final/);
    await o.logPanelUse({ kind: "probe_option_hovered", detail: { probeId: card.id, optionId: "a" } }); // not logged in the training
    await o.submitSpamConfidence(75);
    expect(snap().spam).toBeNull();
    const d = ofKind<TrainingAnswerDetail>(await o.logRecords(), "training_answer").at(-1)!;
    expect(d).toMatchObject({ itemId: card.id, choiceId: card.options[1]!.id, confidence: 75, hakuBefore: 0, timedOut: false });
    expect(kinds(await o.logRecords())).not.toContain("probe_option_hovered");
  });

  it("S3's card closes unanswered at 60 s (timedOut, no confidence; a choice made stands) and its feedback shows", async () => {
    const card = spec.items.find((it) => it.mode === "card")!;
    const { o, snap } = await at(card.id);
    await o.answerSpam(card.options[0]!.id);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(snap().training!.phase).toBe("question");
    await vi.advanceTimersByTimeAsync(1);
    expect(snap().training).toMatchObject({ phase: "feedback", timedOut: true, answer: { choiceId: card.options[0]!.id } });
    const d = ofKind<TrainingAnswerDetail>(await o.logRecords(), "training_answer").at(-1)!;
    expect(d).toMatchObject({ itemId: card.id, rtMs: 60_000, choiceId: card.options[0]!.id, hakuBefore: 0, timedOut: true });
    expect(d).not.toHaveProperty("confidence");
  });

  it("S4: the memory unit for 8 s on the live map (no answer meanwhile), then the freeze screen's blank map; the answer through it", async () => {
    const memory = spec.items.find((it) => it.memory)!;
    const { o, snap } = await at(memory.id);
    expect(snap().training).toMatchObject({ phase: "study", tools: { map: true, rb: false, log: false, haku: false } });
    expect(snap().renderTree.cycleInfo!.unitPositions).toEqual({ [memory.memory!.unit]: memory.memory!.at });
    expect(o.trainingStudySecondsLeft()).toBe(8);
    expect(snap().freeze).toBeNull();
    await expect(o.answerTraining(memory.id, { point: memory.memory!.at, confidence: 50 })).rejects.toThrow(/not asked now \(study\)/);
    await vi.advanceTimersByTimeAsync(7_999);
    expect(snap().training!.phase).toBe("study");
    await vi.advanceTimersByTimeAsync(1);
    expect(snap().training).toMatchObject({ phase: "question", tools: { map: false } });
    expect(snap().renderTree.cycleInfo).toBeNull(); // the picture is hidden
    expect(snap().freeze).toEqual({ items: [{ id: memory.id, level: "L1", promptFi: expect.any(String), kind: "map_point", options: [] }] });
    expect(o.freezeNowLabel()).toBe("10.00–10.18");
    await vi.advanceTimersByTimeAsync(3_000);
    await o.markFreezeItemAnswered(memory.id); // nothing for the training (one item on screen)
    await o.logFreezeMapPick(memory.id, memory.memory!.at, { zoom: 14, centre: memory.memory!.at, mapPx: { width: 600, height: 400 } });
    await o.submitFreeze([{ itemId: memory.id, optionId: "map_point", confidence: 75, point: memory.memory!.at }]);
    expect(snap().training).toMatchObject({ phase: "feedback", tools: { map: true } });
    const d = ofKind<TrainingAnswerDetail>(await o.logRecords(), "training_answer").at(-1)!;
    expect(d).toMatchObject({ itemId: memory.id, rtMs: 3_000, confidence: 75, memoryMs: 8_000 });
    const all = kinds(await o.logRecords());
    expect(all.filter((k) => k.startsWith("freeze_"))).toEqual([]);
  });

  it("an S4 log or records item's feedback shows no map (it would answer the next item)", async () => {
    const choice = spec.items.find((it) => it.mode === "freeze" && it.answer === "choice" && it.source !== "map")!;
    const { o, snap } = await at(choice.id);
    await o.submitFreeze([{ itemId: choice.id, optionId: choice.options[0]!.id, confidence: 25 }]);
    expect(snap().training).toMatchObject({ phase: "feedback", tools: { map: false } });
    expect(snap().renderTree.cycleInfo).toBeNull();
  });

  it("the map's, the tabs' and the panels' records are not written in the training", async () => {
    const { o } = await at(spec.items[0]!.id);
    const before = (await o.logRecords()).length;
    expect(await o.logMapUse({ kind: "viewport_changed", detail: { centre: spec.area.centre, zoom: 13, bbox: { ...spec.area.bounds }, bearing: 0, mapPx: { width: 800, height: 600 }, view: 0, cause: "settle" } })).toBe(-1);
    await o.logTabSelected("haku");
    expect(await o.logRecords()).toHaveLength(before);
  });
});

describe("the cap (SPEC/15 (bp) §bp.3)", () => {
  it("ends the items at 12 minutes: the rest are missing, S5 still shows, `endReason` timeout", async () => {
    const { o, snap } = newTrainingSession();
    await o.start();
    await driveTo(o, snap);
    await trainingMove(o, snap, spec); // the intro
    await trainingMove(o, snap, spec); // S1's card
    await trainingMove(o, snap, spec); // the first item answered
    expect(o.trainingSecondsLeft()).toBe(720);
    await vi.advanceTimersByTimeAsync(720_000);
    expect(snap().training).toMatchObject({ phase: "demo", sectionId: "s5", endReason: "timeout" });
    expect(o.trainingSecondsLeft()).toBe(0);
    // Review 27 Oct 2026: the cap is logged, durable before S5 shows — the items left, the item on screen, the active time.
    const atCap = await o.logRecords();
    expect(atCap.at(-1)!.kind).toBe("training_cap_reached");
    expect(atCap.at(-1)!.detail).toEqual({ remainingItemIds: ITEM_IDS.slice(1), atItemId: ITEM_IDS[0], activeMs: 720_000 });
    await vi.advanceTimersByTimeAsync(10_000);
    await o.leaveTrainingDemo();
    expect(snap().step).toBe("briefing");
    const end = ofKind<TrainingCompletedDetail>(await o.logRecords(), "training_completed")[0]!;
    expect(end).toEqual({ endReason: "timeout", answeredCount: 1, missingItemIds: ITEM_IDS.slice(1), durationMs: 720_000 });
    expect(kinds(await o.logRecords()).filter((k) => k === "training_cap_reached")).toHaveLength(1);
  });
});
