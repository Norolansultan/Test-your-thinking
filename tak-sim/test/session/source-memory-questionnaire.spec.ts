/**
 * SPEC/30 §5.5: the post-session source-memory block (`questionnaire.ts` SOURCE_ITEMS, texts in `study-texts.ts`): one item per fact,
 * after the recall items and before the workload items; "Where did this come from for you?" with five sources, Thinker only in the
 * Thinker cells, "I did not know this" last; checked and logged as ordinary questionnaire answers (no new record kind).
 */

import { describe, expect, it } from "vitest";
import {
  checkQuestionnaireAnswers, POST_ITEMS, questionnaireItems, SOURCE_ITEMS, SOURCE_OPTIONS, SOURCE_SECTION, THINKER_CELLS, type QuestionnaireItem,
} from "../../app/session/questionnaire.js";
import { SOURCE_MEMORY_FACTS, sourceItemId } from "../../app/scenario/source-memory.js";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { ALL_RECORD_KINDS } from "../../app/telemetry/record-kinds.js";

const ids = POST_ITEMS.map((i) => i.id);
const choiceOptions = (i: QuestionnaireItem | undefined) => (i && i.kind === "choice" ? i.options : []);

describe("the source-memory block (SPEC/30 §5.5)", () => {
  it("has one item per fact, in the post questionnaire after the recall items and before the workload items", () => {
    expect(SOURCE_ITEMS.map((i) => i.id)).toEqual(SOURCE_MEMORY_FACTS.map((f) => sourceItemId(f.id)));
    const first = ids.indexOf(SOURCE_ITEMS[0]!.id), last = ids.indexOf(SOURCE_ITEMS.at(-1)!.id);
    expect(last - first).toBe(SOURCE_ITEMS.length - 1);
    expect(first).toBeGreaterThan(ids.indexOf("directive.fit"));
    expect(last).toBeLessThan(ids.indexOf("tlx.mental"));
    for (const i of SOURCE_ITEMS) expect(i).toMatchObject({ section: SOURCE_SECTION, kind: "choice" });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers the Thinker as a source in the Thinker cells only; 'I did not know this' is last in every cell", () => {
    for (const cell of ["radio", ...THINKER_CELLS] as const) {
      const items = questionnaireItems("post", cell);
      for (const s of SOURCE_ITEMS) {
        const options = choiceOptions(items.find((i) => i.id === s.id));
        expect(options, `${cell} ${s.id}`).toEqual(cell === "radio" ? ["self", "records", "haku", "unknown"] : [...SOURCE_OPTIONS]);
        expect(options.at(-1)).toBe("unknown");
      }
    }
  });

  it("refuses the Thinker source in the Haku cell, accepts it in a Thinker cell, and logs a blank as null", () => {
    const id = SOURCE_ITEMS[0]!.id;
    expect(() => checkQuestionnaireAnswers(questionnaireItems("post", "radio"), { [id]: "thinker" })).toThrow(RangeError);
    const answers = checkQuestionnaireAnswers(questionnaireItems("post", "reasoning_intent"), { [id]: "thinker" });
    expect(answers.find((a) => a.itemId === id)).toEqual({ itemId: id, value: "thinker" });
    expect(answers.find((a) => a.itemId === SOURCE_ITEMS[1]!.id)).toEqual({ itemId: SOURCE_ITEMS[1]!.id, value: null });
    expect(ALL_RECORD_KINDS).toContain("questionnaire_submitted");
  });

  it("each item states its fact and asks the one question, in both languages; the section and every source has a label", () => {
    for (const lang of ["fi", "en"] as const) {
      const q = STUDY_TEXT[lang].questionnaire;
      expect(q.sections[SOURCE_SECTION]).toBeTruthy();
      for (const f of SOURCE_MEMORY_FACTS) {
        const t = q.items[sourceItemId(f.id)]!;
        expect(t.prompt.startsWith(lang === "fi" ? f.statementFi : f.statementEn), f.id).toBe(true);
        expect(t.prompt).toMatch(lang === "fi" ? /Mistä tämä tieto tuli sinulle\?$/ : /Where did this come from for you\?$/);
        for (const o of SOURCE_OPTIONS) expect(t.options?.[o], `${lang} ${o}`).toBeTruthy();
      }
    }
    expect(STUDY_TEXT.en.questionnaire.items[SOURCE_ITEMS[0]!.id]!.options!["haku"]).toBe("Search"); // the English screen's name for Haku
    expect(STUDY_TEXT.fi.questionnaire.items[SOURCE_ITEMS[0]!.id]!.options!["self"]).toBe("Päättelin sen itse");
  });
});
