/**
 * SPEC/14 revision (as), 11 Oct 2026: "allow questions, drop imperatives". A lookup's question may be a genuine question that uses
 * "should" (fi and en); statements and recommendations are still rejected. In options and safety answers an imperative sentence is cut
 * out of its field (never reworded), an emptied option is dropped only while two remain, and the change is logged as `imperative_removed`.
 */
import { describe, expect, it } from "vitest";
import { renderOpenAnswer, type OpenStructuredAnswer } from "../../app/session/open-answer.js";
import { imperativeWordsIn, isImperativeSentence, withoutImperativeSentences } from "../../server/thinker/answer-checks.js";
import { loadDirectivePremises } from "../../server/thinker/directive-premises.js";
import { limitOpenAnswer, parseOpenAnswer } from "../../server/thinker/open-answer.js";
import { openJson } from "./open-json.js";

const ctx = (directiveInForce: boolean) => ({ directiveInForce, taggedCount: 3, tagTimes: ["15.40", "15.45", "16.00"], premises: directiveInForce ? loadDirectivePremises() : undefined });
const parsed = (json: string): OpenStructuredAnswer => parseOpenAnswer(json)!;
const opt = (option: string, tradeoffs: string) => ({ option, tradeoffs, verdict: null, tags: ["T1"] });

describe("a lookup's question: genuine questions pass, instructions and recommendations fail", () => {
  const lookup = (q: string) => parseOpenAnswer(openJson({ kind: "lookup", questionsForYou: [q] }));

  it.each([
    "Should the relay move given W2 is 1.2 km away?",
    "Should you adjust the main effort to engage the new fire in sector L3?",
    "Must the crews on R2 be relieved before dark?",
    "Pitäisikö releen siirtyä, kun W2 on 1,2 km päässä?",
    "Pitäisi ehkä siirtää rele W2:n lähelle: onko se mahdollista?",
    "Kannattaako rele siirtää, kun vesipiste W2 on 1,2 km päässä?",
  ])("accepts: %s", (q) => {
    expect(lookup(q)).not.toBeNull();
  });

  it.each([
    "Move the relay immediately. Should it be W2?",
    "You should move the relay.",
    "You must move the relay immediately.",
    "I recommend moving the relay to W2.",
    "Should the relay move? I recommend yes.",
    "We suggest moving the relay. Does W2 work?",
    "Sinun pitäisi siirtää rele.",
    "Kannattaa siirtää rele heti.",
    "Lopeta tulitus.",
    "Suosittelen releen siirtoa. Onko W2 sopiva?",
  ])("rejects: %s", (q) => {
    expect(lookup(q)).toBeNull();
  });

  it("a lookup without any question is still a schema failure", () => {
    expect(parseOpenAnswer(openJson({ kind: "lookup", questionsForYou: [] }))).toBeNull();
  });
});

describe("isImperativeSentence: descriptive uses are not instructions", () => {
  it.each([
    ["Sparks crossed the road immediately east of R2.", "en"],
    ["Fire reached the road immediately after 17.10.", "en"],
    ["The front must have crossed the road by now.", "en"],
    ["Should the wind shift, the line fails.", "en"],
    ["The line fails if the wind should shift.", "en"],
    ["Pitää linjat teiden varassa, mutta jättää L3:n paljaaksi.", "fi"],
    ["Palo ylitti tien heti kun tuuli kääntyi.", "fi"],
    ["Palo on heti tien itäpuolella.", "fi"],
    ["Rele pitää paikkansa.", "fi"],
    ["Jos tuuli pitäisi kääntyä, linja pettää.", "fi"],
  ] as const)("not flagged: %s", (s, lang) => {
    expect(isImperativeSentence(s, lang)).toBe(false);
  });

  it.each([
    ["Stop the spread immediately at the fire line.", "en"],
    ["Crews must hold the road.", "en"],
    ["Crews should hold the road.", "en"],
    ["Cease the burnout.", "en"],
    ["I recommend a direct attack.", "en"],
    ["Pysäytä leviäminen heti.", "fi"],
    ["Miehistön täytyy pitää tie.", "fi"],
    ["Kannattaa pitää tie.", "fi"],
    ["Lopeta vastapalo.", "fi"],
  ] as const)("flagged: %s", (s, lang) => {
    expect(isImperativeSentence(s, lang)).toBe(true);
  });

  it("a question is not counted by the log screen, a statement is", () => {
    expect(imperativeWordsIn("Questions for you:\n- Should the relay move?", "en")).toEqual([]);
    expect(imperativeWordsIn("Questions for you:\n- Move now. You should go.", "en")).toEqual(["should"]);
    expect(imperativeWordsIn("Sinun pitäisi lähteä heti.", "fi")).toEqual(["pitäisi", "heti"]);
  });

  it("withoutImperativeSentences keeps the other sentences word for word", () => {
    expect(withoutImperativeSentences("Holds the road. Act immediately. Needs two crews.", "en")).toEqual({ text: "Holds the road. Needs two crews.", changed: true });
    expect(withoutImperativeSentences("Holds the road.", "en")).toEqual({ text: "Holds the road.", changed: false });
  });
});

describe("limitOpenAnswer: imperative sentences are cut from options and safety answers", () => {
  it("cuts the imperative sentence from a trade-off and keeps the rest unchanged, logged", () => {
    const raw = parsed(openJson({ kind: "options", options: [opt("Direct attack", "Fast containment. Attack immediately."), opt("Defensive line", "Slower, holds the road.")] }));
    const out = limitOpenAnswer(raw, ctx(false), "en");
    expect(out.answer.options.map((o) => o.tradeoffs)).toEqual(["Fast containment.", "Slower, holds the road."]);
    expect(out.trimmed).toContain("imperative_removed");
  });

  it("an option left empty is dropped while two options remain, never below two", () => {
    const three = parsed(openJson({ kind: "options", options: [opt("A", "Hold the line immediately."), opt("B", "Slower."), opt("C", "Costly.")] }));
    const out3 = limitOpenAnswer(three, ctx(false), "en");
    expect(out3.answer.options.map((o) => o.option)).toEqual(["B", "C"]);
    expect(out3.trimmed).toContain("imperative_removed");

    const two = parsed(openJson({ kind: "options", options: [opt("A", "Hold the line immediately."), opt("B", "Slower.")] }));
    const out2 = limitOpenAnswer(two, ctx(false), "en");
    expect(out2.answer.options.map((o) => [o.option, o.tradeoffs])).toEqual([["A", ""], ["B", "Slower."]]);
    expect(renderOpenAnswer(out2.answer, out2.tagTimes, "en")).toContain("1. A [T1");
  });

  it("Finnish: an imperative sentence goes, a descriptive 'Pitää' and a question stay", () => {
    const raw = parsed(openJson({
      kind: "options",
      options: [opt("Suora isku", "Nopea. Pysäytä leviäminen heti."), opt("Torjuntalinja", "Pitää linjat teiden varassa, mutta jättää L3:n paljaaksi.")],
      questionsForYou: ["Pitäisikö pääponnistus siirtää L3:een?", "Siirrä yksiköt heti."],
    }));
    const out = limitOpenAnswer(raw, ctx(false), "fi");
    expect(out.answer.options.map((o) => o.tradeoffs)).toEqual(["Nopea.", "Pitää linjat teiden varassa, mutta jättää L3:n paljaaksi."]);
    expect(out.answer.questionsForYou).toEqual(["Pitäisikö pääponnistus siirtää L3:een?"]);
    expect(out.trimmed).toContain("imperative_removed");
  });

  it("descriptive words are left alone and nothing is logged", () => {
    const raw = parsed(openJson({ kind: "options", options: [opt("A", "Sparks crossed the road immediately east of R2."), opt("B", "The front must have crossed by now.")] }));
    const out = limitOpenAnswer(raw, ctx(false), "en");
    expect(out.answer.options.map((o) => o.tradeoffs)).toEqual(["Sparks crossed the road immediately east of R2.", "The front must have crossed by now."]);
    expect(out.trimmed).not.toContain("imperative_removed");
  });

  it("safety: an imperative fact sentence is cut, an only fact that is all imperative is kept and logged", () => {
    const cut = limitOpenAnswer(parsed(openJson({ kind: "safety", facts: [{ text: "Smoke near the crew. Evacuate immediately.", tags: [] }] })), ctx(false), "en");
    expect(cut.answer.facts.map((f) => f.text)).toEqual(["Smoke near the crew."]);
    expect(cut.trimmed).toContain("imperative_removed");

    const kept = limitOpenAnswer(parsed(openJson({ kind: "safety", facts: [{ text: "Evacuate immediately.", tags: [] }] })), ctx(false), "en");
    expect(kept.answer.facts.map((f) => f.text)).toEqual(["Evacuate immediately."]);
    expect(kept.trimmed).toContain("imperative_kept");
  });

  it("a lookup's fact is not touched by the cut", () => {
    const out = limitOpenAnswer(parsed(openJson({ kind: "lookup", facts: [{ text: "W2 is 1.2 km away.", tags: [] }], questionsForYou: ["Should the relay move?"] })), ctx(false), "en");
    expect(out.answer.questionsForYou).toEqual(["Should the relay move?"]);
    expect(out.trimmed).not.toContain("imperative_removed");
  });
});
