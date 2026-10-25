/**
 * Revision (bl), 25 Oct 2026 (researcher): the practice feedback's records item shows what a search would have given — the example
 * question, the record (source, clock, text, in the session language) and, because the practice is unscored, the right answer, then the
 * participant's own. Log, map and worked-out items keep their source-only text. No scored item's key may ever reach the screen. The
 * principle: teach HOW a search changes an answer (once, in practice), never THAT one must search.
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { practiceChoicesIn, practiceChoicesOf, practiceFeedbackView, searchLessonLines } from "../../app/session/practice-feedback.js";
import { DIFFICULTY_TEXT } from "../../app/i18n/difficulty-texts.js";
import { hasLabelEn, recordEn, recordIn, sourceName, tr } from "../../app/i18n/text.js";
import { recordClockLabel } from "../../app/session/message-history.js";
import { spamKeysOf } from "../../app/telemetry/spam-measures.js";
import type { ScenarioContract } from "../../app/scenario/types.js";
import { InMemoryLogSink, type LogHeader } from "../../app/telemetry/log.js";
import { driveSession, newStudySession } from "../public/public-run.js";

const scenario = buildDemoScenario();
const FORECAST = "freeze.practice.forecast";
const forecastItem = scenario.practice.freeze.items.find((i) => i.id === FORECAST)!;
const forecastAtom = scenario.atoms.find((a) => a.id === "evt.wx.01")!;
const RIGHT_FI = "Lounaistuulta 4–6 m/s, puuskissa 8–10 m/s";
const lessonOf = (view = practiceFeedbackView(scenario, null)) => view.items.find((i) => i.itemId === FORECAST)!.lesson!;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the records item's lesson: the example question, the record a search would have shown, the practice's right answer", () => {
  const view = practiceFeedbackView(scenario, null);

  it("only the practice's records item has one; the log, map and worked-out items stay source-only", () => {
    expect(view.items.filter((i) => i.lesson !== null).map((i) => i.itemId)).toEqual([FORECAST]);
    for (const i of view.items.filter((x) => x.source === "records")) expect(i.lesson, i.itemId).not.toBeNull();
    for (const i of view.items.filter((x) => x.source !== "records")) expect(i.lesson, i.itemId).toBeNull();
    expect(view.items.map((i) => [i.itemId, i.source])).toEqual([
      ["freeze.practice.infra", "log"], [FORECAST, "records"], ["freeze.practice.first_target", "log"],
      ["freeze.practice.r1_arrival", "worked_out"], ["freeze.practice.head_now", "map"],
    ]);
  });

  it("carries the existing example question, the unpushed forecast record as the message log lists records, and the item's own key", () => {
    expect(scenario.practice.cycle.pushedAtomIds).not.toContain(forecastAtom.id); // found by search, not in the log
    expect(lessonOf()).toEqual({
      question: { fi: "Mikä on sääennuste?", en: "What is the weather forecast?" },
      record: { id: "evt.wx.01", sourceId: "SÄÄENNUSTE", clockLabel: recordClockLabel(forecastAtom), textFi: expect.stringContaining("lounaistuulta 4–6 m/s, puuskissa 8–10 m/s") },
      rightFi: RIGHT_FI,
      yourFi: null,
    });
    expect(lessonOf().record.clockLabel).toBe("12:07");
    expect(forecastItem.options.filter((o) => o.correct).map((o) => o.labelFi)).toEqual([RIGHT_FI]); // the key is the one correct option
  });

  it("the Finnish line is the researcher's: question, source, 'klo' clock and text in „ ”, then the answer", () => {
    const fiText = recordIn("fi", "evt.wx.01", lessonOf().record.textFi);
    expect(fiText).toMatch(/\.$/);
    expect(searchLessonLines("fi", lessonOf())).toEqual({
      lesson: `Haun kysymys kuten „Mikä on sääennuste?” olisi näyttänyt tämän ilmoituksen: SÄÄENNUSTE klo 12:07: „${fiText}” Sen perusteella vastaus on: ${RIGHT_FI}.`,
      yours: null,
    });
    // The template as written, for a text that does not end in a full stop of its own.
    expect(DIFFICULTY_TEXT.fi.feedback.lesson("K", "L", "12:00", "t", "o")).toBe("Haun kysymys kuten „K” olisi näyttänyt tämän ilmoituksen: L klo 12:00: „t”. Sen perusteella vastaus on: o.");
    expect(DIFFICULTY_TEXT.fi.feedback.yourAnswer("o")).toBe("Vastauksesi: o");
  });

  it("the English line is the researcher's, in English: the English record, the source's English name, the English option; the tool is 'Search' as on the English screen", () => {
    const enText = recordIn("en", "evt.wx.01", lessonOf().record.textFi);
    expect(enText).not.toBe(lessonOf().record.textFi); // translated (the record has its English)
    expect(recordEn("evt.wx.01")).toBe(enText);
    expect(hasLabelEn(RIGHT_FI)).toBe(true);
    expect(enText).toMatch(/\.$/);
    expect(searchLessonLines("en", lessonOf())).toEqual({
      lesson: `A Search question such as “What is the weather forecast?” would have shown this report: ${sourceName("en", "SÄÄENNUSTE")} 12:07: “${enText}” With it, the answer is: ${tr("en", RIGHT_FI)}.`,
      yours: null,
    });
    expect(tr("en", RIGHT_FI)).not.toBe(RIGHT_FI);
    expect(DIFFICULTY_TEXT.en.feedback.lesson("K", "L", "12:00", "t", "o")).toBe("A Search question such as “K” would have shown this report: L 12:00: “t”. With it, the answer is: o.");
    expect(DIFFICULTY_TEXT.en.feedback.yourAnswer("o")).toBe("Your answer: o");
    expect(DIFFICULTY_TEXT.en.feedback.lesson("K", "L", "12:00", "t", "o")).not.toMatch(/Haku/);
  });

  it("a text that ends in its own full stop gets no second one after the closing quote", () => {
    for (const lang of ["fi", "en"] as const) {
      const line = DIFFICULTY_TEXT[lang].feedback.lesson("K", "L", "12:00", "teksti.", "o");
      expect(line).not.toContain(".”.");
      expect(line).toContain("teksti.”");
    }
  });

  it("the record is shown in full, as Haku shows records, in the session language", () => {
    for (const lang of ["fi", "en"] as const) {
      const shown = searchLessonLines(lang, lessonOf()).lesson;
      expect(shown).toContain(recordIn(lang, forecastAtom.id, lessonOf().record.textFi));
    }
  });
});

describe("the participant's own answer", () => {
  it("is read from the practice freeze's responses (a map tap is not a choice) and from the log", () => {
    const responses = [
      { itemId: FORECAST, optionId: "sw_showers", confidence: 50 },
      { itemId: "freeze.practice.head_now", optionId: "map_point", confidence: 50, point: { lat: 60.85, lon: 27.35 } },
    ];
    expect(practiceChoicesIn(responses)).toEqual({ [FORECAST]: "sw_showers" });
    const submitted = (cycle: number) => ({ kind: "freeze_submitted", detail: { cycle, responses } }) as never;
    expect(practiceChoicesOf([submitted(3)])).toEqual({}); // only the practice view's freeze
    expect(practiceChoicesOf([submitted(0)])).toEqual({ [FORECAST]: "sw_showers" });
  });

  it("is shown after the right answer: 'Your answer: …' / 'Vastauksesi: …', the option as worded in the session language", () => {
    const wrong = forecastItem.options.find((o) => !o.correct)!;
    const lesson = lessonOf(practiceFeedbackView(scenario, null, { [FORECAST]: wrong.id }));
    expect(lesson.yourFi).toBe(wrong.labelFi);
    expect(lesson.rightFi).toBe(RIGHT_FI); // unchanged by what the participant answered
    expect(searchLessonLines("fi", lesson).yours).toBe(`Vastauksesi: ${wrong.labelFi}`);
    expect(searchLessonLines("en", lesson).yours).toBe(`Your answer: ${tr("en", wrong.labelFi)}`);
    // Right, too; an unknown option id or no answer: no line.
    expect(lessonOf(practiceFeedbackView(scenario, null, { [FORECAST]: "sw_gusts" })).yourFi).toBe(RIGHT_FI);
    expect(lessonOf(practiceFeedbackView(scenario, null, { [FORECAST]: "nonsense" })).yourFi).toBeNull();
    expect(searchLessonLines("en", lessonOf(practiceFeedbackView(scenario, null, {}))).yours).toBeNull();
  });

  it("in a session: the answer given in the practice freeze reaches the feedback, and a resume into the feedback keeps it; the log gains nothing", async () => {
    vi.setSystemTime(0);
    const sink = new InMemoryLogSink();
    const { o, snap } = newStudySession({ sink });
    await o.start();
    await driveSession(o, snap, ["exploration"]); // VP
    while (snap().step !== "freeze") await vi.advanceTimersByTimeAsync(500);
    await o.submitFreeze([{ itemId: FORECAST, optionId: "sw_showers", confidence: 25 } as never]);
    await driveSession(o, snap, ["practice_feedback"]);
    const shown = snap().practiceFeedback!.items.find((i) => i.itemId === FORECAST)!.lesson!;
    expect(shown.yourFi).toBe("Lounaistuulta 4–6 m/s, iltapäivällä sadekuuroja");
    expect(shown.rightFi).toBe(RIGHT_FI);
    // The log gets the same records as before: the shown item ids, not the lesson (no log format change).
    const records = await o.logRecords();
    const logged = records.find((r) => r.kind === "practice_feedback_shown")!;
    expect(logged.detail).toEqual({ itemIds: scenario.practice.freeze.items.map((i) => i.id) });
    expect(JSON.stringify(records.filter((r) => r.kind !== "freeze_submitted"))).not.toContain(RIGHT_FI);

    vi.clearAllTimers();
    const resumed = newStudySession({ sink, resume: { header: records[0]!.detail as LogHeader, records, interruptedForMs: 5_000 } });
    await resumed.o.start();
    expect(resumed.snap().step).toBe("practice_feedback");
    expect(resumed.snap().practiceFeedback!.items.find((i) => i.itemId === FORECAST)!.lesson).toEqual(shown);
  });

  it("an unanswered practice item (a freeze that closed without it) has the lesson without the participant's answer", async () => {
    vi.setSystemTime(0);
    const { o, snap } = newStudySession({});
    await o.start();
    await driveSession(o, snap, ["exploration"]);
    while (snap().step !== "freeze") await vi.advanceTimersByTimeAsync(500);
    await o.submitFreeze([]);
    await driveSession(o, snap, ["practice_feedback"]);
    const lesson = snap().practiceFeedback!.items.find((i) => i.itemId === FORECAST)!.lesson!;
    expect(lesson.yourFi).toBeNull();
    expect(lesson.rightFi).toBe(RIGHT_FI);
  });

  it("the same screen in both groups and both audiences", async () => {
    const seen: unknown[] = [];
    for (const options of [{ cell: "radio" as const }, { cell: "reasoning_once" as const }, { cell: "reasoning_intent" as const }, { cell: "radio" as const, audience: "public" as const }]) {
      vi.setSystemTime(0);
      const { o, snap } = newStudySession(options);
      await o.start();
      await driveSession(o, snap, ["practice_feedback"]);
      seen.push(snap().practiceFeedback);
    }
    for (const v of seen.slice(1)) expect(v).toEqual(seen[0]);
  });
});

describe("no scored item's key ever reaches this screen", () => {
  const view = practiceFeedbackView(scenario, { lat: 60.85, lon: 27.351 }, { [FORECAST]: "sw_showers" });
  const shown = JSON.stringify(view) + JSON.stringify(DIFFICULTY_TEXT) + (["fi", "en"] as const).map((l) => JSON.stringify(searchLessonLines(l, lessonOf(view)))).join("");
  const scoredItems = scenario.freezes.flatMap((f) => f.items);

  it("the view holds the practice freeze's items and no other; every id is a practice id", () => {
    const scoredIds = new Set(scoredItems.map((i) => i.id));
    expect(scoredItems.length).toBeGreaterThanOrEqual(40);
    expect(view.items.map((i) => i.itemId)).toEqual(scenario.practice.freeze.items.map((i) => i.id));
    for (const i of view.items) {
      expect(i.itemId.startsWith("freeze.practice.")).toBe(true);
      expect(scoredIds.has(i.itemId)).toBe(false);
    }
    expect(Object.keys(lessonOf(view)).sort()).toEqual(["question", "record", "rightFi", "yourFi"]); // no option ids, flags or atom lists
  });

  it("no scored freeze item's right option (in either language), key point or key record, and no scored SPAM item's right option, is in the view, the texts or the lesson's lines", () => {
    let checked = 0;
    for (const it of scoredItems) {
      for (const o of it.options.filter((x) => x.correct)) {
        for (const label of [o.labelFi, tr("en", o.labelFi)]) { expect(shown, `${it.id}: ${label}`).not.toContain(label); checked++; }
      }
      if (it.mapKey) for (const v of [it.mapKey.point.lat, it.mapKey.point.lon]) { expect(shown, `${it.id}: key point`).not.toContain(v.toFixed(4)); checked++; }
      for (const id of it.keyAtomIds ?? []) if (id !== "evt.wx.01") { expect(shown, `${it.id}: ${id}`).not.toContain(id); checked++; }
    }
    const keys = spamKeysOf(scenario.probeSchedule.probes, scenario.invariants);
    for (const p of scenario.probeSchedule.probes) {
      if (p.response.kind !== "categorical") continue;
      const key = p.response.options.find((o) => o.id === keys.get(p.id));
      if (key) for (const label of [key.fi, tr("en", key.fi)]) { expect(shown, `${p.id}: ${label}`).not.toContain(label); checked++; }
    }
    expect(checked).toBeGreaterThan(100); // the check looked at many keys, not none
  });

  it("refuses a scored item among the practice items, and a practice item resting on a scored item's records", () => {
    const scored = scoredItems.find((it) => (it.kind ?? "choice") === "choice" && (it.keyAtomIds ?? []).length > 0 && !scenario.practice.cycle.pushedAtomIds.includes(it.keyAtomIds![0]!))!;
    const withItems = (items: typeof scenario.practice.freeze.items): ScenarioContract => ({ ...scenario, practice: { ...scenario.practice, freeze: { ...scenario.practice.freeze, items } } });
    expect(() => practiceFeedbackView(withItems([...scenario.practice.freeze.items, scored]), null)).toThrow(/is not a practice item/);
    const rests = { ...forecastItem, keyAtomIds: [scored.keyAtomIds![0]!] };
    expect(() => practiceFeedbackView(withItems(scenario.practice.freeze.items.map((i) => (i === forecastItem ? rests : i))), null)).toThrow(/outside the practice view/);
    expect(() => practiceFeedbackView(scenario, null)).not.toThrow();
  });

  it("the screen component reads the view only: no scenario truth, no option flags, no key fields", () => {
    const screen = readFileSync("app/render/ui/components/PracticeFeedbackScreen.tsx", "utf8");
    expect(screen).toContain("searchLessonLines");
    expect(screen).not.toMatch(/\bcorrect\b|mapKey|keyAtomIds|projectionPoint|scenario\/types|ScenarioContract|FreezeItem\b/);
  });
});

describe("the lesson teaches how, not that: the texts never say a search is needed, never mention the memory checks or scores' dependence", () => {
  it("the intro says the practice is unscored and no longer that no answer is shown; the lesson lines say nothing more than the researcher's", () => {
    const NEEDED = /ennen kuin vastaat|ennen vastaamista|muistikatko|täytyy|kannattaa|pitää hakea|before you answer|before answering|memory check|\bmust\b|\bshould\b|\bneed to\b|scores? depend|pisteet riippuvat/i;
    for (const lang of ["fi", "en"] as const) {
      const t = DIFFICULTY_TEXT[lang].feedback;
      for (const s of [t.intro, t.lesson("K", "L", "12:00", "t", "o"), t.yourAnswer("o")]) expect(s, `${lang}: ${s}`).not.toMatch(NEEDED);
      expect(t.intro).not.toMatch(/ei kerro, mikä vastaus oli oikea|does not tell you which answer was right/);
    }
    expect(DIFFICULTY_TEXT.fi.feedback.intro).toMatch(/Harjoitusta ei pisteytetä/);
    expect(DIFFICULTY_TEXT.en.feedback.intro).toMatch(/The practice is not scored/);
  });
});
