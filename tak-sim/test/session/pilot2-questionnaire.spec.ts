/**
 * The questionnaire items adopted before pilot 2 (revision (bf), 24 Oct 2026; SPEC/09 (bf)):
 * - pre-session: `fatigue.start` as before, then `sleep.hours` (0–24) and, in expert sessions only, `shift.recent` (yes / no);
 * - post-session, right after the source block and before the workload items: the global self-estimate `accuracy.perceived` (0–100 %),
 *   then the perceived influence of the group's own tool — `influence.plan_views.<tool>` (a count of periods, 0–14; 0–7 in a phase-A
 *   session) and `influence.answers.<tool>` (0–100 in tens) — Haku in the Haku group, the Thinker in the Thinker cells, worded alike.
 */

import { describe, expect, it } from "vitest";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { studyTextFor } from "../../app/i18n/public-texts.js";
import {
  ACCURACY_PERCEIVED_ID, checkQuestionnaireAnswers, influenceAnswersId, influencePlanViewsId, questionnaireItems, SOURCE_SECTION,
} from "../../app/session/questionnaire.js";
import { consultToolOf } from "../../app/session/consult-notice.js";

const CELLS = ["radio", "reasoning_once", "reasoning_intent"] as const;
const ids = (items: readonly { readonly id: string }[]) => items.map((i) => i.id);

describe("the pre-session items (revision (bf))", () => {
  it("an expert session asks fatigue, sleep and the recent shift; a public one leaves the shift out", () => {
    for (const cell of CELLS) {
      expect(ids(questionnaireItems("pre", cell))).toEqual(["fatigue.start", "sleep.hours", "shift.recent"]);
      expect(ids(questionnaireItems("pre", cell, undefined, { audience: "public", scope: "full" }))).toEqual(["fatigue.start", "sleep.hours"]);
    }
    const [, sleep, shift] = questionnaireItems("pre", "radio");
    expect(sleep).toMatchObject({ kind: "number", min: 0, max: 24 });
    expect(shift).toMatchObject({ kind: "choice", options: ["yes", "no"] });
  });

  it("every item may be left blank; values outside the item are refused", () => {
    const items = questionnaireItems("pre", "radio");
    expect(checkQuestionnaireAnswers(items, {})).toEqual([
      { itemId: "fatigue.start", value: null }, { itemId: "sleep.hours", value: null }, { itemId: "shift.recent", value: null },
    ]);
    expect(checkQuestionnaireAnswers(items, { "sleep.hours": 6, "shift.recent": "yes" }).map((a) => a.value)).toEqual([null, 6, "yes"]);
    expect(() => checkQuestionnaireAnswers(items, { "sleep.hours": 25 })).toThrow(RangeError);
    expect(() => checkQuestionnaireAnswers(items, { "sleep.hours": 6.5 })).toThrow(RangeError);
    expect(() => checkQuestionnaireAnswers(items, { "shift.recent": "maybe" })).toThrow(RangeError);
    const pub = questionnaireItems("pre", "radio", undefined, { audience: "public", scope: "full" });
    expect(() => checkQuestionnaireAnswers(pub, { "shift.recent": "no" })).toThrow(/not an item shown/);
  });
});

describe("the post-session self-estimate and perceived influence (revision (bf))", () => {
  it("come right after the source block and before the workload items, the self-estimate first, in the group's own tool", () => {
    for (const cell of CELLS) {
      const items = questionnaireItems("post", cell);
      const lastSource = items.map((i) => i.section).lastIndexOf(SOURCE_SECTION);
      const tool = consultToolOf(cell);
      expect(ids(items.slice(lastSource + 1, lastSource + 4)), cell).toEqual([ACCURACY_PERCEIVED_ID, influencePlanViewsId(tool), influenceAnswersId(tool)]);
      expect(items[lastSource + 4]!.id).toBe("tlx.mental");
      // One of each pair per session: never the other group's tool.
      const other = tool === "haku" ? "thinker" : "haku";
      expect(ids(items)).not.toContain(influencePlanViewsId(other));
      expect(ids(items)).not.toContain(influenceAnswersId(other));
    }
  });

  it("their formats: a percentage, a count of the periods (7 in a phase-A session) and 0–100 in tens", () => {
    const items = questionnaireItems("post", "reasoning_intent");
    expect(items.find((i) => i.id === ACCURACY_PERCEIVED_ID)).toMatchObject({ kind: "number", min: 0, max: 100 });
    expect(items.find((i) => i.id === influencePlanViewsId("thinker"))).toMatchObject({ kind: "number", min: 0, max: 14 });
    expect(items.find((i) => i.id === influenceAnswersId("thinker"))).toMatchObject({ kind: "scale", min: 0, max: 100, step: 10 });
    const phaseA = questionnaireItems("post", "radio", undefined, { audience: "public", scope: "phaseA" });
    expect(phaseA.find((i) => i.id === influencePlanViewsId("haku"))).toMatchObject({ kind: "number", max: 7 });
    const answers = checkQuestionnaireAnswers(items, { [ACCURACY_PERCEIVED_ID]: 62, [influencePlanViewsId("thinker")]: 3, [influenceAnswersId("thinker")]: 40 });
    expect(answers.filter((a) => a.value !== null)).toEqual([
      { itemId: ACCURACY_PERCEIVED_ID, value: 62 }, { itemId: influencePlanViewsId("thinker"), value: 3 }, { itemId: influenceAnswersId("thinker"), value: 40 },
    ]);
    expect(() => checkQuestionnaireAnswers(items, { [influenceAnswersId("thinker")]: 45 })).toThrow(/not a point/);
    expect(() => checkQuestionnaireAnswers(items, { [influencePlanViewsId("thinker")]: 15 })).toThrow(RangeError);
    expect(() => checkQuestionnaireAnswers(phaseA, { [influencePlanViewsId("haku")]: 8 })).toThrow(RangeError);
  });

  it("the two groups' items are worded alike but for the tool's name (fi and en), and the public texts are the same", () => {
    const name = { fi: { haku: /\b(Haun|Haku)\b/, thinker: /\bThinker(in)?\b/ }, en: { haku: /\bSearch\b/, thinker: /\bThinker\b/ } } as const;
    for (const lang of ["fi", "en"] as const) {
      const items = STUDY_TEXT[lang].questionnaire.items;
      for (const pair of [[influencePlanViewsId("haku"), influencePlanViewsId("thinker")], [influenceAnswersId("haku"), influenceAnswersId("thinker")]] as const) {
        const [h, t] = [items[pair[0]]!, items[pair[1]]!];
        expect(h.prompt, `${lang} ${pair[0]}`).toMatch(name[lang].haku);
        expect(t.prompt, `${lang} ${pair[1]}`).toMatch(name[lang].thinker);
        expect(h.prompt.replace(name[lang].haku, "TOOL")).toBe(t.prompt.replace(name[lang].thinker, "TOOL"));
        expect([h.low, h.high]).toEqual([t.low, t.high]);
      }
      expect(STUDY_TEXT[lang].questionnaire.sections.reflection).toBeTruthy();
      const pub = studyTextFor(lang, { audience: "public", scope: "full" }).questionnaire.items;
      for (const id of [ACCURACY_PERCEIVED_ID, influencePlanViewsId("haku"), "sleep.hours"]) expect(pub[id]).toEqual(items[id]);
    }
    // The English screen names Haku "Search"; the Finnish names it "Haku".
    expect(STUDY_TEXT.en.questionnaire.items[influenceAnswersId("haku")]!.prompt).not.toMatch(/Haku/);
  });
});
