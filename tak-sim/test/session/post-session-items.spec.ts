/**
 * `31` §3.10 (19 Oct 2026; sagat F17, proposal (a); parity P-6, P-12): the post-session block's new items — believability, recognition
 * (with what was recognised, shown on yes), prior use of the web demonstration, and two perceived-reliability items — right
 * after `prior.knowledge`, in every cell, each with its pre-registered exclusion or sensitivity rule, with text in both languages.
 */

import { describe, expect, it } from "vitest";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { POST_SESSION_RULES, questionnaireItems } from "../../app/session/questionnaire.js";
import type { Cell } from "../../app/scenario/types.js";

const NEW_ITEMS = ["believability", "recognition.real_fire", "recognition.what", "prior.demo", "reliability.answers", "reliability.projection"];
const CELLS: readonly Cell[] = ["radio", "reasoning_once", "reasoning_intent"];

describe("the post-session items of `31` §3.10", () => {
  it("follow prior.knowledge in this order, in every cell", () => {
    for (const cell of CELLS) {
      const ids = questionnaireItems("post", cell).map((i) => i.id);
      const at = ids.indexOf("prior.knowledge");
      expect(at, cell).toBeGreaterThanOrEqual(0);
      expect(ids.slice(at + 1, at + 1 + NEW_ITEMS.length), cell).toEqual(NEW_ITEMS);
    }
  });

  it("each has its pre-registered rule: the recognition of the fire, its department or units and prior use of the demo exclude; the reliability items are exploratory", () => {
    expect(Object.keys(POST_SESSION_RULES).sort()).toEqual([...NEW_ITEMS].sort());
    expect(POST_SESSION_RULES["recognition.what"]!.rule).toBe("exclude");
    expect(POST_SESSION_RULES["prior.demo"]!.rule).toBe("exclude");
    expect(POST_SESSION_RULES["prior.demo"]!.when).toBe("the web demonstration used before the session (parity P-12)");
    expect(POST_SESSION_RULES["believability"]!.rule).toBe("sensitivity");
    expect(POST_SESSION_RULES["recognition.real_fire"]!.rule).toBe("sensitivity");
    expect(POST_SESSION_RULES["reliability.answers"]!.rule).toBe("exploratory");
    expect(POST_SESSION_RULES["reliability.projection"]!.rule).toBe("exploratory");
  });

  it("what was recognised is asked only after a yes, as a multi-select of the fire, the department, the units and the course of events", () => {
    const what = questionnaireItems("post", "radio").find((i) => i.id === "recognition.what")!;
    expect(what).toMatchObject({ kind: "multi", showIf: { itemId: "recognition.real_fire", equals: "yes" } });
    expect(what.kind === "multi" ? what.options.map((o) => o.id).sort() : []).toEqual(["course", "department", "fire", "units"]);
  });

  it("asks about the web demonstration only (21 Oct 2026: game mode removed): no, yes or not sure", () => {
    const prior = questionnaireItems("post", "radio").find((i) => i.id === "prior.demo")!;
    expect(prior.kind === "choice" ? prior.options : []).toEqual(["no", "demo", "unsure"]);
    expect(STUDY_TEXT.fi.questionnaire.items["prior.demo"]?.prompt).toBe("Olitko käyttänyt tämän harjoituksen verkkoesittelyä ennen tätä päivää?");
    expect(STUDY_TEXT.en.questionnaire.items["prior.demo"]?.prompt).toBe("Had you used this exercise's web demonstration before today?");
  });

  it("has its prompt and every option or scale anchor in Finnish and English (DRAFT, native review)", () => {
    const items = questionnaireItems("post", "radio").filter((i) => NEW_ITEMS.includes(i.id));
    for (const lang of ["fi", "en"] as const) for (const it of items) {
      const t = STUDY_TEXT[lang].questionnaire.items[it.id];
      expect(t?.prompt.length, `${lang} ${it.id}`).toBeGreaterThan(10);
      if (it.kind === "choice") for (const o of it.options) expect(t!.options?.[o], `${lang} ${it.id} ${o}`).toBeTruthy();
      if (it.kind === "multi") for (const o of it.options) expect(t!.options?.[o.id], `${lang} ${it.id} ${o.id}`).toBeTruthy();
      if (it.kind === "scale") expect(t!.low && t!.high, `${lang} ${it.id}`).toBeTruthy();
    }
  });
});
