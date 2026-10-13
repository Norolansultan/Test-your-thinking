/**
 * The briefing and training texts (SPEC/02 revision (o) §2–§3, SPEC/09 revision (o) §4,
 * SPEC/15 revision (o) §2): the invariants that must survive any rewording in review.
 */

import { describe, expect, it } from "vitest";
import {
  HAKU_CHAT_EN, HAKU_CHAT_FI, introTextsFor, introTextsIn, OPEN_THINKER_EN, OPEN_THINKER_FI, OPEN_THINKER_INTENT_EN, OPEN_THINKER_INTENT_FI, openThinkerTextFor, PERIOD_TIME_EN, PERIOD_TIME_FI,
  PROJECTION_CAVEAT_FI, SECTORS_EN, SECTORS_FI, SETTING_TEXT_FI,
  PRACTICE_THINKER_EN, PRACTICE_THINKER_EXAMPLE_EN, PRACTICE_THINKER_EXAMPLE_FI, PRACTICE_THINKER_FI, THINKER_ORDERS_EN, THINKER_ORDERS_FI, TOOLS_THINKER_AGAIN_EN, TOOLS_THINKER_AGAIN_FI,
} from "../../app/scenario/briefing.js";
import { UI_TEXT } from "../../app/i18n/ui.js";

const haku = introTextsFor("directed");
const llm = introTextsFor("substitutive");
/** Words that would reveal the agent or AI to the Haku group, or bring the AI into the setting. */
const AI_WORDS = /thinker|agent|tekoäly|tekoaly|\bAI\b|\bLLM\b/i;

describe("the setting text", () => {
  it("is byte-identical in both groups", () => {
    expect(new TextEncoder().encode(haku.settingFi)).toEqual(new TextEncoder().encode(llm.settingFi));
  });

  it("says the exercise runs as recorded: allocations are recorded, units act on pre-agreed tasks and their own plans", () => {
    for (const phrase of ["etenee tallenteen mukaisesti", "yksiköt eivät saa kirjauksiasi", "ennalta sovittujen tehtävien", "omien suunnitelmiensa"]) {
      expect(haku.settingFi).toContain(phrase);
    }
  });

  it("does not contradict the commander role (consistency review 1 Oct 2026)", () => {
    expect(haku.settingFi).not.toMatch(/ilman erillistä käskyä|Et voi lähettää viestejä|siirtyvät oman suunnitelmansa/);
  });

  it("mentions no AI, and makes no claim about reliability", () => {
    expect(haku.settingFi).not.toMatch(AI_WORDS);
    expect(haku.settingFi).not.toMatch(/luotettav|virheetön|tarkka/i);
  });

  it("states the role: the participant commands the crews and the drone teams (1 Oct 2026)", () => {
    expect(haku.settingFi).toContain("Johdat pelastusyksiköiden miehistöjä ja drooniryhmiä");
    expect(haku.settingFi).toContain("miehistöjen painopiste ja sen toimintatapa sekä drooniryhmien tehtävä");
    expect(haku.settingFi).toContain("enintään kaksi ja puoli minuuttia"); // the 150 s cap (revision (x), 6 Oct 2026)
  });

  it("says the spread projection can be wrong and the participant must judge for themselves (1 Oct 2026)", () => {
    expect(haku.settingFi).toContain(PROJECTION_CAVEAT_FI);
    for (const phrase of ["Malli ei näe kaikkea", "ennuste voi olla väärä", "koko tilannekuvan perusteella"]) expect(haku.settingFi).toContain(phrase);
  });

  it("is group-independent: the caveat and the role reach both groups unchanged", () => {
    expect(llm.settingFi).toBe(haku.settingFi);
    expect(introTextsFor("substitutive").settingFi).toBe(SETTING_TEXT_FI);
    expect(introTextsFor("directed").settingFi).toBe(SETTING_TEXT_FI);
  });

  it("cues no designed event and says nothing about Thinker's reliability", () => {
    expect(haku.settingFi).not.toMatch(/turve|suo|kyt|voimajoh|110 ?kV|jälleensyt|thinker|luotettav/i);
  });
});

describe("the training texts", () => {
  it("Haku: never mentions Thinker, an agent or AI", () => {
    expect(haku.trainingTitleFi + " " + haku.trainingFi).not.toMatch(AI_WORDS);
    expect(haku.trainingFi).toContain("Haku");
  });

  it("Haku + LLM: introduces Thinker (the Open Thinker, 8 Oct 2026) as a discussion partner that answers when asked and can suggest options", () => {
    for (const lang of ["fi", "en"] as const) expect(introTextsIn("substitutive", lang).training).toContain(lang === "fi" ? OPEN_THINKER_FI : OPEN_THINKER_EN);
    expect(OPEN_THINKER_FI).toMatch(/keskustelukumppani/);
    expect(OPEN_THINKER_FI).toMatch(/vastaa vain, kun kysyt/);
    expect(OPEN_THINKER_FI).toMatch(/ehdottaa vaihtoehtoja/);
    expect(OPEN_THINKER_EN).toMatch(/discussion partner.*suggest options/s);
    for (const lang of ["fi", "en"] as const) expect(introTextsIn("directed", lang).training).not.toMatch(/Thinker/);
  });

  it("cue no designed event and make no claim about Thinker's reliability", () => {
    for (const t of [haku.trainingFi, llm.trainingFi]) expect(t).not.toMatch(/turve|suo|kyt|voimajoh|110 ?kV|jälleensyt|luotettav/i);
  });

  it("both carry the same cross-checking sentence, and neither says what a tool does not do (1 Oct 2026)", () => {
    for (const t of [haku.trainingFi, llm.trainingFi]) {
      expect(t).toContain("Voit verrata eri lähteiden kirjauksia keskenään.");
      expect(t).not.toMatch(/ei tulkitse/);
    }
  });

  it("the setting says what a period covers and that each report carries its own time, in both groups and languages (fix pass 3)", () => {
    for (const condition of ["directed", "substitutive"] as const) {
      expect(introTextsIn(condition, "fi").setting).toContain(PERIOD_TIME_FI);
      expect(introTextsIn(condition, "en").setting).toContain(PERIOD_TIME_EN);
    }
  });

  it("both describe the Haku chat in the same paragraph, in both languages and in the tour's Haku step (8 Oct 2026)", () => {
    for (const condition of ["directed", "substitutive"] as const) {
      expect(introTextsIn(condition, "fi").training.startsWith(HAKU_CHAT_FI)).toBe(true);
      expect(introTextsIn(condition, "en").training.startsWith(HAKU_CHAT_EN)).toBe(true);
    }
    expect(UI_TEXT.fi.tour.steps.haku.body).toContain(HAKU_CHAT_FI);
    expect(UI_TEXT.en.tour.steps.haku.body).toContain(HAKU_CHAT_EN);
    // Revision (am): V1's Thinker step is the short reminder after the practice (`practiceThinker` says what Thinker is for).
    expect(UI_TEXT.fi.tour.steps.toolsThinker.body).toBe(TOOLS_THINKER_AGAIN_FI);
    expect(UI_TEXT.en.tour.steps.toolsThinker.body).toBe(TOOLS_THINKER_AGAIN_EN);
  });

  it("the Haku paragraph says what Haku is now: own words, reports so far only, sources and times, the fixed form, may be wrong", () => {
    for (const phrase of ["omin sanoin", "tähän mennessä", "myöhempää tietoa sillä ei ole", "lähteet ja kellonajat", "vastaus, perusteet, varmuus ja mikä muuttaisi", "väärä tai puutteellinen", "Hakun vastaukset tuottaa kielimalli saapuneiden ilmoitusten pohjalta."]) expect(HAKU_CHAT_FI).toContain(phrase);
    for (const phrase of ["own words", "so far", "no later information", "sources and times", "answer, basis, certainty and what would change it", "wrong or incomplete", "Search's answers are produced by a language model from the reports received so far."]) expect(HAKU_CHAT_EN).toContain(phrase);
    for (const t of [HAKU_CHAT_FI, HAKU_CHAT_EN]) expect(t).not.toMatch(/KUKA|MITÄ|MILLOIN|\bWHO\b|\bWHAT\b|\bWHEN\b/);
    expect(HAKU_CHAT_FI + HAKU_CHAT_EN).not.toMatch(AI_WORDS);
  });

  it("the language-model disclosure is in both groups' training and the tour, once and identically (8 Oct 2026)", () => {
    for (const [lang, phrase] of [["fi", "Hakun vastaukset tuottaa kielimalli"], ["en", "produced by a language model"]] as const) {
      for (const condition of ["directed", "substitutive"] as const) expect(introTextsIn(condition, lang).training.split(phrase).length - 1).toBe(1);
      expect(UI_TEXT[lang].tour.steps.haku.body).toContain(phrase);
    }
  });

  // 8 Oct 2026: the length match (within 5 %) is withdrawn — Haku's paragraph is now identical in both
  // groups, and the AI group's text adds the Open Thinker's paragraph; padding the Haku group's text would add content.
  it("differ only by the Open Thinker's paragraph and the closing sentence", () => {
    expect(llm.trainingFi.replace(OPEN_THINKER_FI + " ", "").replace(/ Molemmat ovat.*$/, "")).toBe(haku.trainingFi.replace(/ Haku on käytössäsi.*$/, ""));
  });
});

describe("revision (al), 10 Oct 2026: what each Thinker cell's text says it knows; the sectors; zooming in", () => {
  it("reasoning_intent: the Thinker text says it also holds P2's orders as issued; reasoning_once: the same information as Search, nothing about orders", () => {
    expect(OPEN_THINKER_INTENT_FI.startsWith(OPEN_THINKER_FI)).toBe(true);
    expect(OPEN_THINKER_INTENT_EN.startsWith(OPEN_THINKER_EN)).toBe(true);
    expect(OPEN_THINKER_INTENT_EN).toMatch(/also holds the text of the duty fire chief's \(P2\) orders as issued: the opening intent and, once it is issued, the directive\.$/);
    expect(OPEN_THINKER_INTENT_FI).toMatch(/päivystävän palopäällikön \(P2\) käskyjen teksti sellaisenaan: alkuperäinen toiminta-ajatus ja, kun se annetaan, linjaus\.$/);
    expect(OPEN_THINKER_EN).toMatch(/reads the same information received so far as Search/);
    for (const lang of ["fi", "en"] as const) {
      expect(openThinkerTextFor("reasoning_once", lang)).not.toMatch(/P2|linjaus|directive/);
      expect(introTextsIn("substitutive", lang, "reasoning_intent").training).toContain(openThinkerTextFor("reasoning_intent", lang));
      expect(introTextsIn("substitutive", lang, "reasoning_once").training).toBe(introTextsIn("substitutive", lang).training);
    }
    // Revision (am): the short V1 reminder keeps the cell's sentence on P2's orders, word for word.
    expect(UI_TEXT.fi.tour.steps.toolsThinkerIntent.body).toBe(`${TOOLS_THINKER_AGAIN_FI} ${THINKER_ORDERS_FI}`);
    expect(UI_TEXT.en.tour.steps.toolsThinkerIntent.body).toBe(`${TOOLS_THINKER_AGAIN_EN} ${THINKER_ORDERS_EN}`);
    expect(OPEN_THINKER_INTENT_FI).toBe(`${OPEN_THINKER_FI} ${THINKER_ORDERS_FI}`);
    expect(OPEN_THINKER_INTENT_EN).toBe(`${OPEN_THINKER_EN} ${THINKER_ORDERS_EN}`);
  });

  it("revision (am): the Thinker practice text says what Thinker is for, that it can be wrong and decides nothing, names no order, and is not repeated at V1", () => {
    expect(PRACTICE_THINKER_FI).toMatch(/keskustelukumppani/);
    expect(PRACTICE_THINKER_FI).toMatch(/voi olla väärässä/);
    expect(PRACTICE_THINKER_FI).toMatch(/eikä se päätä mitään/);
    expect(PRACTICE_THINKER_EN).toMatch(/discussion partner/);
    expect(PRACTICE_THINKER_EN).toMatch(/can be wrong/);
    expect(PRACTICE_THINKER_EN).toMatch(/decides nothing/);
    for (const t of [PRACTICE_THINKER_FI, PRACTICE_THINKER_EN, PRACTICE_THINKER_EXAMPLE_FI, PRACTICE_THINKER_EXAMPLE_EN]) expect(t).not.toMatch(/P2|linjaus|directive|toiminta-ajatus|intent/i);
    expect(PRACTICE_THINKER_EXAMPLE_EN).toBe("What do the latest reports say about the head of the fire, and how old are they?");
    expect(UI_TEXT.fi.tour.practiceThinker.example).toBe(PRACTICE_THINKER_EXAMPLE_FI);
    expect(UI_TEXT.en.tour.practiceThinker.example).toBe(PRACTICE_THINKER_EXAMPLE_EN);
    // No duplicated text: V1's reminders share no sentence with the practice step.
    for (const [practice, again] of [[PRACTICE_THINKER_FI, TOOLS_THINKER_AGAIN_FI], [PRACTICE_THINKER_EN, TOOLS_THINKER_AGAIN_EN]] as const) {
      for (const sentence of again.split(/(?<=\.)\s+/)) expect(practice).not.toContain(sentence);
      expect(again).not.toContain(practice.split(".")[0]!);
    }
    for (const lang of ["fi", "en"] as const) expect(UI_TEXT[lang].tour.steps.practiceThinker.body).toBe(lang === "fi" ? PRACTICE_THINKER_FI : PRACTICE_THINKER_EN);
  });

  it("the practice tour describes the four sectors by terrain only, and asks the participant to zoom in to see the fire", () => {
    for (const [lines, lang] of [[SECTORS_FI, "fi"], [SECTORS_EN, "en"]] as const) {
      expect(lines.map((l) => l.slice(0, 2))).toEqual(["L1", "L2", "L3", "L4"]);
      for (const l of lines) expect(l).not.toMatch(/110 kV|voimajohto|power line|vesipiste|water point|W\d/i);
      expect(UI_TEXT[lang].tour.steps.sectors.body).toBe(lines.join("\n"));
    }
    expect(UI_TEXT.fi.tour.steps.zoom.body).toMatch(/Lähennä karttaa nähdäksesi palon/);
    expect(UI_TEXT.en.tour.steps.zoom.body).toMatch(/Zoom in to see the fire/);
  });
});
