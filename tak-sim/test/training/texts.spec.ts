/**
 * The training's texts (SPEC/08 (bp) §§bp.5, bp.7, bp.8): every text exists in both languages; each feedback states the computed
 * answer, names its source class (S2–S4) and the participant's own answer; the source mix (records 30–45 %, every class at least
 * once); and the (bl) principle — "how and where, never that": no text tells the participant to search (before the memory checks or
 * before answering), none ties a score to searching, and none claims reliability beyond the demonstrated limitation.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRAINING_TEXT } from "../../app/i18n/training-texts.js";
import { TRAINING_UI_KEYS } from "../../app/i18n/training-texts-types.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { LANGS, trainingStrings } from "./texts-corpus.js";

const ALL = trainingStrings();
const SOURCE_WORD = { fi: { log: "viestiloki", map: "kartta", records: "kirjaukset", reasoning: "päättely" }, en: { log: "the message log", map: "the map", records: "the records", reasoning: "worked out" } } as const;
const ctxOf = (id: string, answer: { choiceId: string } | { point: { lat: number; lon: number } } | null, timedOut = false) => {
  const it = TRAINING.items.find((x) => x.id === id)!;
  return { answer, key: it.key, errorM: answer && "point" in answer ? 57 : null, timedOut, source: it.source, numbers: it.feedback.numbers, ...(it.lesson ? { lesson: it.lesson } : {}) };
};

describe("the training's texts (fi DRAFT, en)", () => {
  it("every text exists in both languages, with no unfilled slot, undefined or NaN", () => {
    for (const t of ALL) {
      expect(t.text.trim().length, `${t.lang} ${t.where}`).toBeGreaterThan(0);
      // The interface strings' named slots ({t}, {n}, {of}, {s}) are filled by the screen (`trainingUi`); nothing else may hold a brace.
      const text = t.where.startsWith("ui.") ? t.text.replace(/\{(t|n|of|s)\}/g, "") : t.text;
      expect(text, `${t.lang} ${t.where}`).not.toMatch(/undefined|NaN|\{|\}|\[object/);
    }
    const where = (lang: string) => ALL.filter((t) => t.lang === lang).map((t) => t.where).filter((w) => !w.startsWith("record.")).sort();
    expect(where("fi")).toEqual(where("en"));
    for (const lang of LANGS) for (const it of TRAINING.items) {
      const labels = Object.keys(TRAINING_TEXT[lang].item(it.id).options);
      expect(labels.sort(), `${lang} ${it.id}`).toEqual(it.options.map((o) => o.id).sort());
      const shown = it.options.map((o) => TRAINING_TEXT[lang].item(it.id).options[o.id]);
      expect(new Set(shown).size, `${lang} ${it.id}`).toBe(shown.length);
    }
  });

  it("each feedback starts with the right answer, names its source (S2–S4) and ends with the participant's answer", () => {
    for (const lang of LANGS) for (const it of TRAINING.items) {
      const t = TRAINING_TEXT[lang];
      const wrong = it.answer === "choice" ? { choiceId: it.options.find((o) => "optionId" in it.key && o.id !== it.key.optionId)!.id } : { point: { lat: 0, lon: 0 } };
      const lines = t.feedback(it.id, ctxOf(it.id, wrong));
      if ("optionId" in it.key && !["training.s1.measure", "training.s2.now", "training.s4.log"].includes(it.id)) {
        const label = t.item(it.id).options[it.key.optionId]!;
        expect(lines[0]!.toLowerCase(), `${lang} ${it.id}`).toBe(`${label.toLowerCase()}.`);
      }
      if (it.source) expect(lines[1], `${lang} ${it.id}`).toBe(lang === "fi" ? `Lähde: ${SOURCE_WORD.fi[it.source]}${it.source === "reasoning" ? " viimeisimmästä ilmoituksesta ja etenemisnopeudesta" : ""}.` : `Source: ${SOURCE_WORD.en[it.source]}${it.source === "reasoning" ? " from the latest report and the rate" : ""}.`);
      else expect(lines.some((l) => /^(Lähde|Source):/.test(l)), `${lang} ${it.id}`).toBe(false);
      const last = lines.at(-1)!;
      if (it.answer === "point") expect(last, `${lang} ${it.id}`).toMatch(lang === "fi" ? /^Merkkisi oli 57 m päässä/ : /^Your mark was 57 m from/);
      else expect(last, `${lang} ${it.id}`).toBe(lang === "fi" ? `Vastauksesi: ${t.item(it.id).options[(wrong as { choiceId: string }).choiceId]}.` : `Your answer: ${t.item(it.id).options[(wrong as { choiceId: string }).choiceId]}.`);
    }
    // A timed-out card and an unanswered point say so.
    expect(TRAINING_TEXT.fi.feedback("training.s3.records1", ctxOf("training.s3.records1", null, true)).at(-1)).toBe("Aika loppui ennen vastausta.");
    expect(TRAINING_TEXT.en.feedback("training.s4.memory", ctxOf("training.s4.memory", null)).at(-1)).toBe("You marked no place.");
  });

  it("the feedback states the computed figures", () => {
    const n = (id: string, f: string) => TRAINING.items.find((x) => x.id === id)!.feedback.numbers[f];
    const fb = (lang: "fi" | "en", id: string) => TRAINING_TEXT[lang].feedback(id, ctxOf(id, null)).join(" ");
    expect(fb("en", "training.s1.measure")).toContain(`road ${n("training.s1.measure", "road")} is about ${n("training.s1.measure", "m")} m`);
    expect(fb("fi", "training.s1.slope")).toContain(`maa nousee noin ${n("training.s1.slope", "m")} m`);
    expect(fb("en", "training.s1.water")).toMatch(/^Fill point 2\. .*Fill point 1 is nearer in a straight line \(0\.\d km\).*Fill point 2 is \d\.\d km away by road/);
    expect(fb("fi", "training.s2.project")).toContain("Noin 300 m tiestä R5 koilliseen: 10.12–10.42 on 30 minuuttia, ja 30 min × 10 m/min = 300 m.");
    expect(fb("en", "training.s4.map")).toMatch(/^South of the road\./);
    expect(fb("fi", "training.s3.records1")).toContain("”Mitä DR8 ilmoitti klo 10.05?”");
    expect(fb("en", "training.s3.older")).toContain("“Is road R6 passable?”");
  });

  it("the source mix: the nine items of S2–S4 carry a source, records 3 of 9 (30–45 %), every class at least once; S1 none", () => {
    const sourced = TRAINING.items.filter((it) => it.source !== null);
    expect(sourced.map((it) => it.section).every((s) => s !== "s1")).toBe(true);
    expect(sourced).toHaveLength(9);
    const share = sourced.filter((it) => it.source === "records").length / sourced.length;
    expect(share).toBeGreaterThanOrEqual(0.3);
    expect(share).toBeLessThanOrEqual(0.45);
    for (const c of ["log", "map", "records", "reasoning"] as const) expect(sourced.filter((it) => it.source === c).length, c).toBeGreaterThanOrEqual(1);
    expect(sourced.map((it) => [it.id, it.source])).toEqual([
      ["training.s2.now", "log"], ["training.s2.project", "reasoning"], ["training.s3.records1", "records"], ["training.s3.older", "log"], ["training.s3.records2", "records"],
      ["training.s4.memory", "map"], ["training.s4.log", "log"], ["training.s4.map", "map"], ["training.s4.records", "records"],
    ]);
  });

  it("how and where, never that: no text tells the participant to search, before the memory checks or before answering", () => {
    for (const t of ALL) {
      expect(t.text, `${t.lang} ${t.where}`).not.toMatch(/ennen muistikatko|before the memory check|kysy haulta|use search|search first|search before|ask search/i);
      if (t.beforeAnswer) {
        expect(t.text, `${t.lang} ${t.where}`).not.toMatch(/\b(hae|etsi|kysy|käytä hakua|tarkista)\b/i);
        expect(t.text, `${t.lang} ${t.where}`).not.toMatch(/(^|[.!?:]\s+)(Search|Ask|Look up|Check|Use)\s+(the|for|before|first|Search|it|records)\b/);
      }
    }
    // S3's card says nothing about what the records hold or that one should search.
    for (const lang of LANGS) expect(TRAINING_TEXT[lang].section("s3").body.join(" ")).not.toMatch(/kirjauksissa on|drooni|tilatiedo|the records hold|drone|status|löytyvät|finds/i);
  });

  it("no score is tied to searching, and no reliability is claimed beyond the demonstrated limitation", () => {
    for (const t of ALL) {
      const sentences = t.text.split(/(?<=[.!?])\s+/);
      for (const s of sentences) {
        const score = /pistee|pisteyt|pisteet|\bscor/i.test(s), search = /\bhak|\bhau|\bhae\b|search/i.test(s);
        expect(score && search, `${t.lang} ${t.where}: ${s}`).toBe(false);
      }
      expect(t.text, `${t.lang} ${t.where}`).not.toMatch(/\b(luotettava|luotettavasti|reliable|reliably|aina oikein|always right|never wrong)\b/i);
    }
  });

  it("no stem states its key; the S1–S4 texts name no AI tool", () => {
    for (const lang of LANGS) for (const it of TRAINING.items) {
      const stem = TRAINING_TEXT[lang].item(it.id).stem;
      if ("optionId" in it.key) expect(stem, `${lang} ${it.id}`).not.toContain(TRAINING_TEXT[lang].item(it.id).options[it.key.optionId]!);
      expect(stem).not.toMatch(/\b(AI|tekoäly|Thinker|LLM)\b/);
    }
    expect(TRAINING_TEXT.fi.item("training.s3.records1").stem).not.toMatch(/1,1/);
    expect(TRAINING_TEXT.en.item("training.s3.records2").stem).not.toMatch(/four/);
  });

  it("every interface string the screen shows is here, in both languages, and none is left unused (review 27 Oct 2026, finding 8)", () => {
    const screen = ["TrainingScreen.tsx", "TrainingStage.tsx", "TrainingPanels.tsx"].map((f) => readFileSync(`app/render/ui/components/${f}`, "utf8")).join("\n");
    expect(screen).not.toMatch(/UI_FALLBACK/);
    for (const lang of LANGS) expect(Object.keys(TRAINING_TEXT[lang].ui).sort(), lang).toEqual([...TRAINING_UI_KEYS].sort());
    // Each key is shown by the screen (a `trainingUi` call names it), and the screen names no key the texts lack.
    for (const key of TRAINING_UI_KEYS) expect(screen, key).toMatch(new RegExp(`"${key}"`));
    const named = [...screen.matchAll(/trainingUi\(lang, ([^)]*)\)/g)].flatMap((m) => [...m[1]!.matchAll(/"(\w+)"/g)].map((x) => x[1]!));
    expect(named.length).toBeGreaterThan(15);
    for (const k of named) expect(TRAINING_UI_KEYS as readonly string[], k).toContain(k);
    // The slots keep their names.
    for (const lang of LANGS) {
      const ui = TRAINING_TEXT[lang].ui;
      expect(ui.progress).toMatch(/\{n\}.*\{of\}/);
      expect(ui.timeLeft).toMatch(/\{t\}/);
      expect(ui.studyLeft).toMatch(/\{s\}/);
      expect(ui.demoWait).toMatch(/\{s\}/);
    }
  });

  it("S4's note says the training's time keeps running; the memory exposure says what to remember; the cap's end is said on S5", () => {
    expect(TRAINING_TEXT.fi.ui.freezeNote).toBe("Vastaa muistin varassa. Harjoituksen aika kuluu.");
    expect(TRAINING_TEXT.en.ui.freezeNote).toBe("Answer from memory. The training's time keeps running.");
    for (const lang of LANGS) expect(TRAINING_TEXT[lang].ui.freezeNote, lang).not.toMatch(/pysäht|stopped|seis/i);
    expect(TRAINING_TEXT.fi.ui.memoryExposure).toBe("Muista, missä yksikkö EK53 on.");
    expect(TRAINING_TEXT.en.ui.memoryExposure).toBe("Remember where unit EK53 is.");
    const memory = TRAINING.items.find((it) => it.memory)!;
    for (const lang of LANGS) {
      expect(TRAINING_TEXT[lang].ui.memoryExposure, lang).toContain(memory.memory!.unit);
      expect(TRAINING_TEXT[lang].ui.memoryExposure, lang).not.toBe(TRAINING_TEXT[lang].item(memory.id).stem);
    }
    expect(TRAINING_TEXT.fi.ui.capEnded).toMatch(/aika päättyi/);
    expect(TRAINING_TEXT.en.ui.capEnded).toMatch(/time is up/);
  });
});
