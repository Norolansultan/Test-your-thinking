/**
 * The practice view's search lesson and map tasks (difficulty audit, 23 Oct 2026; `proposal.md` (b.2), (b.3); `proposal-map.md` c.3):
 * the feedback screen after VP is SOURCE-ONLY for the practice questions (where the information was; so SPEC/32 §1 holds), but for the
 * records item, which since revision (bl) (25 Oct 2026) also shows what a search would have given with the practice's right answer
 * (`practice-feedback-lesson.spec.ts`); it shows the head mark beside the head the practice map drew, and the measured distance; it comes
 * after VP's end and before the training, is logged, is resumed into, and is absent without the option. The measuring task's key is computed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { drawnHeadOf, practiceFeedbackView, PRACTICE_HEAD_ITEM_ID } from "../../app/session/practice-feedback.js";
import { PRACTICE_MEASURE, PRACTICE_MEASURE_BANDS_KM, PRACTICE_MEASURE_ID, metresBetween } from "../../app/scenario/practice-measure.js";
import { headNow } from "../../app/scenario/freeze-keys.js";
import { hasLabelEn, tr } from "../../app/i18n/text.js";
import { DIFFICULTY_TEXT } from "../../app/i18n/difficulty-texts.js";
import { InMemoryLogSink, type LogHeader } from "../../app/telemetry/log.js";
import { APP_OPTIONS, driveSession, kinds, newStudySession } from "../public/public-run.js";

const scenario = buildDemoScenario();
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the practice feedback's content (source-only, but for the records item's lesson)", () => {
  const view = practiceFeedbackView(scenario, { lat: 60.85, lon: 27.351 });

  it("says where each practice question's information was: the log, the records (Haku, with an example question), the map, or worked out", () => {
    expect(view.items.map((i) => [i.itemId, i.source])).toEqual([
      ["freeze.practice.infra", "log"], ["freeze.practice.forecast", "records"], ["freeze.practice.first_target", "log"],
      ["freeze.practice.r1_arrival", "worked_out"], ["freeze.practice.head_now", "map"],
    ]);
    const forecast = view.items.find((i) => i.itemId === "freeze.practice.forecast")!;
    expect(forecast.records).toEqual([{ sourceId: "SÄÄENNUSTE", clockLabel: "12:07" }]);
    expect(forecast.exampleQuestion).toEqual({ fi: "Mikä on sääennuste?", en: "What is the weather forecast?" });
    for (const i of view.items.filter((x) => x.source === "log")) expect(i.records.length, i.itemId).toBeGreaterThan(0);
  });

  it("names no option and says nothing of a right answer, but for the records item's search lesson (revision (bl), practice and unscored): its key only, no distractor", () => {
    const frame = JSON.stringify(DIFFICULTY_TEXT);
    const lessonItem = view.items.find((i) => i.lesson !== null)!;
    expect(lessonItem.itemId).toBe("freeze.practice.forecast");
    for (const it of scenario.practice.freeze.items) for (const o of it.options) {
      expect(frame, `${it.id} ${o.id} in the texts`).not.toContain(o.labelFi);
      expect(frame, `${it.id} ${o.id} (en) in the texts`).not.toContain(tr("en", o.labelFi));
      for (const item of view.items) {
        const shown = JSON.stringify(item);
        const keyOfLessonItem = item === lessonItem && it.id === item.itemId && o.correct;
        if (keyOfLessonItem) { expect(shown, `${it.id} ${o.id}: its key is shown`).toContain(o.labelFi); continue; }
        expect(shown, `${item.itemId} shows ${it.id} ${o.id}`).not.toContain(o.labelFi);
        expect(shown, `${item.itemId} shows ${it.id} ${o.id} (en)`).not.toContain(tr("en", o.labelFi));
      }
    }
    expect(JSON.stringify(view.items) + frame).not.toMatch(/"correct"|"key"|oikea vastaus|right answer was/i);
  });

  it("the head is the practice map's drawn head (its furthest point downwind), within 50 m of the practice key; never a later fire", () => {
    const { head } = drawnHeadOf(scenario.practice.cycle);
    expect(metresBetween(head, headNow(-3))).toBeLessThan(50);
    expect(view.head.head).toEqual(head);
    expect(view.head.outline).toEqual(scenario.practice.cycle.perimeter[0]);
    expect(practiceFeedbackView(scenario, null).head.mark).toBeNull();
  });

  it("the measuring task: the R3 bridge about 3 km east of the fire, the key computed from the map (origin and drawn head agree)", () => {
    expect(PRACTICE_MEASURE).toMatchObject({ keyKm: 3, keyOptionId: "b", directionEn: "east", directionFi: "itään" });
    expect(PRACTICE_MEASURE.fromOriginM).toBeGreaterThan(2_500);
    expect(PRACTICE_MEASURE.fromOriginM).toBeLessThan(3_500);
    expect(view.measure).toEqual({ km: 3, directionFi: "itään", directionEn: "east" });
    const probe = scenario.practice.spamSecond!;
    expect(probe).toMatchObject({ id: PRACTICE_MEASURE_ID, type: "S", cycle: 0 });
    expect(probe.offsetInWorkingPeriodMs).toBeUndefined(); // shown under the first item's "ready"
    expect(JSON.stringify(probe)).not.toMatch(/correct|"key"/);
    const options = probe.response.kind === "categorical" ? probe.response.options : [];
    expect(options.map((o) => o.fi)).toEqual(PRACTICE_MEASURE_BANDS_KM.map((km) => `Noin ${km} km`)); // ascending
    for (const fi of [probe.prompt, ...options.map((o) => o.fi)]) expect(hasLabelEn(fi), fi).toBe(true);
    expect(scenario.probeSchedule.probes.map((p) => p.id)).not.toContain(PRACTICE_MEASURE_ID);
    expect(scenario.invariants.map((i) => i.name)).not.toContain(probe.invariantName);
  });

  it("the closing line names the tools a group has: Haku alone, or Haku and Thinker", () => {
    for (const lang of ["fi", "en"] as const) {
      expect(DIFFICULTY_TEXT[lang].feedback.closingHaku).not.toMatch(/Thinker/);
      expect(DIFFICULTY_TEXT[lang].feedback.closingThinker).toMatch(/Thinker/);
    }
  });

  it("revision (bn), review S7: the closing line describes where reports are and what finds them; it tells no one to search", () => {
    for (const lang of ["fi", "en"] as const) {
      for (const line of [DIFFICULTY_TEXT[lang].feedback.closingHaku, DIFFICULTY_TEXT[lang].feedback.closingThinker]) {
        expect(line, lang).not.toMatch(/Käytä|kannattaa|täytyy|\bUse\b|\bshould\b|\bmust\b|when the message log/i);
        expect(line, lang).toMatch(lang === "fi" ? /ne löytyvät Haulla/ : /Search (?:or Thinker )?finds them/);
      }
    }
  });
});

describe("the practice feedback in the session", () => {
  it("comes after VP's end and before the training, in both groups; logged when shown and with its dwell when left; the head mark kept", async () => {
    for (const cell of ["radio", "reasoning_once"] as const) {
      vi.setSystemTime(0);
      const { o, snap } = newStudySession({ cell });
      await o.start();
      await driveSession(o, snap, ["practice_feedback"]);
      expect(o.engineState).toBe("TUTORIAL");
      expect(snap().practiceFeedback!.items.map((i) => i.itemId)).toEqual(scenario.practice.freeze.items.map((i) => i.id));
      await vi.advanceTimersByTimeAsync(7_000);
      await o.finishPracticeFeedback();
      expect(snap().step).toBe("training");
      const records = await o.logRecords();
      const shown = records.findIndex((r) => r.kind === "practice_feedback_shown");
      expect(records[shown - 2]).toMatchObject({ kind: "cycle_end", detail: { cycle: 0 } });
      expect(records[shown - 1]).toMatchObject({ kind: "state_transition", detail: { trigger: "warmup_complete" } });
      expect(records[shown]!.detail).toEqual({ itemIds: scenario.practice.freeze.items.map((i) => i.id) });
      expect(records[shown + 1]).toMatchObject({ kind: "briefing_advanced", detail: { screenId: "practice.feedback" } });
      expect((records[shown + 1]!.detail as { dwellMs: number }).dwellMs).toBeGreaterThanOrEqual(7_000);
    }
  });

  it("shows the participant's own head mark from the practice freeze", async () => {
    vi.setSystemTime(0);
    const { o, snap } = newStudySession({});
    await o.start();
    await driveSession(o, snap, ["exploration"]); // VP
    while (snap().step !== "freeze") await vi.advanceTimersByTimeAsync(500);
    expect(snap().currentCycle).toBe(0);
    const mark = { lat: 60.8495, lon: 27.3512 };
    await o.submitFreeze([{ itemId: PRACTICE_HEAD_ITEM_ID, optionId: "map_point", confidence: 75, point: mark } as never]);
    await driveSession(o, snap, ["practice_feedback"]);
    expect(snap().practiceFeedback!.head.mark).toEqual(mark);
  });

  it("is resumed into while not left (the head mark from the log), and is absent without the option", async () => {
    vi.setSystemTime(0);
    const sink = new InMemoryLogSink();
    const first = newStudySession({ sink });
    await first.o.start();
    await driveSession(first.o, first.snap, ["practice_feedback"]);
    vi.clearAllTimers();
    const records = await sink.readAll();
    const resumed = newStudySession({ sink, resume: { header: records[0]!.detail as LogHeader, records, interruptedForMs: 5_000 } });
    await resumed.o.start();
    expect(resumed.snap().step).toBe("practice_feedback");
    expect((await sink.readAll()).find((r) => r.kind === "session_resumed")!.detail).toMatchObject({ resumedAt: "practice_feedback" });
    await resumed.o.finishPracticeFeedback();
    expect(resumed.snap().step).toBe("training");

    vi.setSystemTime(0);
    const { practiceFeedback: _off, ...noFeedback } = APP_OPTIONS;
    const plain = newStudySession({}, noFeedback);
    await plain.o.start();
    await driveSession(plain.o, plain.snap, ["training"]);
    expect(kinds(await plain.o.logRecords())).not.toContain("practice_feedback_shown");
  });
});
