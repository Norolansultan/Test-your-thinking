/**
 * Group parity of the training (SPEC/30 (bp) §bp.4): S1–S4's texts are the same in every cell (identical hashes); S5's two recordings
 * have two examples each, the same questions, one limitation case each, the same shared lines; displayed words (the question, the
 * answer and Haku's labels, split at spaces) per example within ±10 % and in total within ±5 %, in both languages; the recordings
 * quote only `trn.r08` and `trn.r10`; no imperative, recommendation, question to the participant or reliability word; the radio cell
 * names no Thinker and the guide cells no Haku.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TRAINING_TEXT } from "../../app/i18n/training-texts.js";
import { DEMO_RECORD_IDS, demoIdOf, shownWords } from "../../app/i18n/training-texts-demo.js";
import { TRAINING_QUESTIONS } from "../../app/session/training/corpus.js";
import { CELLS, LANGS, trainingStrings } from "./texts-corpus.js";

const count = (e: { question: string; answer: readonly string[] }) => shownWords(e.question) + e.answer.reduce((s, a) => s + shownWords(a), 0);

describe("the training's group parity (SPEC/30 (bp))", () => {
  it("S1–S4 (intro, cards, stems, options, feedback) hash the same in every cell: only S5 takes the cell", () => {
    const hashOf = () => createHash("sha256").update(trainingStrings().filter((t) => !t.where.startsWith("demo.")).map((t) => `${t.lang}|${t.where}|${t.text}`).join("\n")).digest("hex");
    const hashes = CELLS.map(() => hashOf());
    expect(new Set(hashes).size).toBe(1);
    for (const lang of LANGS) {
      const t = TRAINING_TEXT[lang];
      expect([t.section.length, t.item.length, t.feedback.length, t.demo.length]).toEqual([1, 1, 2, 1]);
    }
    expect(demoIdOf("radio")).toBe("haku");
    expect(demoIdOf("reasoning_intent")).toBe("guide");
    expect(demoIdOf("reasoning_once")).toBe("guide");
  });

  for (const lang of LANGS) {
    it(`${lang}: two examples each, the same questions and notes, one limitation case each; the shared lines identical`, () => {
      const haku = TRAINING_TEXT[lang].demo("radio"), guide = TRAINING_TEXT[lang].demo("reasoning_intent");
      expect(TRAINING_TEXT[lang].demo("reasoning_once")).toEqual(guide);
      expect(haku.examples).toHaveLength(2);
      expect(guide.examples).toHaveLength(2);
      expect(haku.examples.map((e) => e.question)).toEqual(guide.examples.map((e) => e.question));
      expect(haku.examples.map((e) => e.question)).toEqual([TRAINING_QUESTIONS["trn.q.ek52_water"]![lang], TRAINING_QUESTIONS["trn.q.under_control"]![lang]]);
      expect(haku.examples.map((e) => e.note)).toEqual(guide.examples.map((e) => e.note));
      expect(haku.examples.map((e) => e.id)).toEqual(["ex1", "ex2"]);
      const incomplete = lang === "fi" ? /vajaa/ : /incomplete/;
      for (const d of [haku, guide]) {
        expect(d.examples.filter((e) => incomplete.test(e.answer.join(" "))).map((e) => e.id)).toEqual(["ex2"]);
        expect(d.intro).toMatch(lang === "fi" ? /nauhoitettu: tämä ei ole elävä kysely/ : /recorded: this is not a live query/);
      }
      // The heading and the intro differ by the tool's name only.
      const tool = lang === "fi" ? ["Haku", "Thinker"] : ["Search", "Thinker"];
      expect(haku.title.replace(tool[0]!, "#")).toBe(guide.title.replace(tool[1]!, "#"));
      expect(haku.intro.replace(tool[0]!, "#")).toBe(guide.intro.replace(tool[1]!, "#"));
      expect(`${haku.title} ${haku.intro} ${haku.examples.map((e) => e.answer.join(" ")).join(" ")}`).not.toMatch(/Thinker/);
      expect(`${guide.title} ${guide.intro} ${guide.examples.map((e) => e.answer.join(" ")).join(" ")}`).not.toMatch(/\bHaku|\bSearch\b/);
    });

    it(`${lang}: displayed words per example within ±10 %, the total within ±5 %`, () => {
      const h = TRAINING_TEXT[lang].demo("radio").examples.map(count), g = TRAINING_TEXT[lang].demo("reasoning_intent").examples.map(count);
      for (let i = 0; i < 2; i++) expect(Math.abs(h[i]! - g[i]!) / Math.max(h[i]!, g[i]!), `${lang} ex${i + 1}: ${h[i]} / ${g[i]}`).toBeLessThanOrEqual(0.1);
      const th = h[0]! + h[1]!, tg = g[0]! + g[1]!;
      expect(Math.abs(th - tg) / Math.max(th, tg), `${lang}: ${th} / ${tg}`).toBeLessThanOrEqual(0.05);
      // Today's counts (SPEC/30 (bp) §bp.1.3): a change re-runs them.
      expect([h, g]).toEqual(lang === "fi" ? [[38, 47], [38, 47]] : [[50, 66], [51, 65]]);
    });

    it(`${lang}: the recordings quote only trn.r08 and trn.r10; no imperative, recommendation, question to the participant or reliability word`, () => {
      expect(DEMO_RECORD_IDS).toEqual(["trn.r10", "trn.r08"]);
      for (const cell of CELLS) {
        const d = TRAINING_TEXT[lang].demo(cell);
        const said = [d.title, d.intro, ...d.examples.flatMap((e) => [...e.answer, e.note]), TRAINING_TEXT[lang].demoLines.limitation];
        const all = said.join(" ");
        expect(all).not.toMatch(/\?/);
        expect(all).not.toMatch(/\b(luotettava|reliable|aina|always|never|koskaan|suosittel|recommend|kannattaa|should|pitäisi|kannattaisi)\b/i);
        expect(all).not.toMatch(/(^|[.!:]\s+)(Kysy|Hae|Käytä|Tarkista|Ask|Search|Use|Check)\s/);
        // Records it quotes: EK52 at 10.15 (trn.r10) and DR8 at 10.12 (trn.r08) only.
        const clocks = [...all.matchAll(/\b(\d{2})[.:](\d{2})\b/g)].map((m) => `${m[1]}.${m[2]}`);
        expect(new Set(clocks)).toEqual(new Set(["10.15", "10.12"]));
      }
    });
  }
});
