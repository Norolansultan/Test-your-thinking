/**
 * SPEC/35 §9 P2: the glossary matcher (`app/render/ui/explain/glossary.ts`) — whole words only, inflected Finnish forms and
 * compounds, the longest match first, no nested marks, each term at its first occurrence only, case ignored except for the
 * `=` forms, and the text itself never changed.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileGlossary, markTerms, segmentsIn, wordPattern, type Segment } from "../../app/render/ui/explain/glossary.js";

const marked = (segments: readonly Segment[]) => segments.filter((s) => s.kind === "term").map((s) => [s.text, s.kind === "term" ? s.termId : ""]);
const fi = (text: string) => marked(segmentsIn("fi", text));
const en = (text: string) => marked(segmentsIn("en", text));
const joined = (segments: readonly Segment[]) => segments.map((s) => s.text).join("");

describe("Finnish inflection and compounds", () => {
  it("finds a term in its inflected forms", () => {
    expect(fi("EK12 työskentelee sivustalla.")).toContainEqual(["sivustalla", "flank"]);
    expect(fi("Paine putosi letkulinjan päässä.")).toContainEqual(["letkulinjan", "hose_line"]);
    expect(fi("Kärjen eteneminen jatkuu.")).toContainEqual(["Kärjen", "head"]);
    expect(fi("Liekit kärjessä 3 m.")).toContainEqual(["kärjessä", "head"]);
    expect(fi("Vesi otetaan altaasta.")).toContainEqual(["altaasta", "basin"]);
    expect(fi("Turpeessa kytee.")).toEqual([["Turpeessa", "peat"], ["kytee", "smouldering"]]);
  });

  it("finds a term as the last part of a compound, and marks the whole word", () => {
    expect(fi("Kaakkoissivusta etenee.")).toEqual([["Kaakkoissivusta", "flank"]]);
    expect(fi("Kaakkoisrintama lähestyy tietä.")).toContainEqual(["Kaakkoisrintama", "front"]);
    expect(fi("VTOL-drooni kartoittaa kehän.")).toContainEqual(["VTOL-drooni", "vtol"]);
  });

  it("finds a call sign with its number and its case ending, case-sensitively", () => {
    expect(fi("EK13:n vesiajo on matkalla.")).toEqual([["EK13:n", "callsign_ek"], ["vesiajo", "water_shuttle"]]);
    expect(fi("ek13 ja Ek13")).toEqual([]);
    expect(en("VOL1's crew")).toEqual([["VOL1's", "volunteer_brigade"], ["crew", "crew"]]);
  });

  it("matches multi-word forms across white space only", () => {
    expect(fi("Mitä 20 kV:n sähkölinjan tila merkitsee?")).toEqual([["20 kV:n sähkölinjan", "power_line"]]);
    expect(fi("Johto on kytketty pois.")).toEqual([["kytketty pois", "de_energised"]]);
    expect(fi("kytketty, pois")).toEqual([]);
  });
});

describe("no match inside another word", () => {
  it("does not mark a term inside a longer word that is not one of its forms", () => {
    expect(en("Ahead of the fire; the headquarters")).toEqual([]);
    expect(en("He was spotted near the frontier.")).toEqual([]);
    expect(fi("Silta kantaa kaiken kaluston.")).toEqual([]); // "kantaa" (carries) is not the heel
    expect(fi("Honkaharju")).toEqual([]); // a place name is not the esker
    expect(fi("Linja kytketään huomenna.")).toEqual([]); // "kytk-" is not smouldering ("kyte-")
  });

  it("a word pattern covers whole words only", () => {
    const p = wordPattern("kärki", false);
    expect(p.test("kärki")).toBe(true);
    expect(p.test("kärkiä")).toBe(false);
    expect(p.test("ylikärki")).toBe(false);
    expect(wordPattern("*sivust*", false).test("eteläsivustalta")).toBe(true);
    expect(wordPattern("EK#", true).test("EK11")).toBe(true);
    expect(wordPattern("EK#", true).test("EK")).toBe(false);
    expect(() => wordPattern("*", false)).toThrow(RangeError);
    expect(() => wordPattern("a*b", false)).toThrow(RangeError);
  });
});

describe("the longest match first, no nested marks", () => {
  const g = compileGlossary({
    exclude: ["in front of"],
    terms: [
      { id: "hose", term: "hose", forms: ["hose"], definition: "d" },
      { id: "hose_line", term: "hose line", forms: ["hose line*"], definition: "d" },
      { id: "line", term: "line", forms: ["line*"], definition: "d" },
      { id: "front", term: "front", forms: ["front"], definition: "d" },
      { id: "drone", term: "drone", forms: ["*drone*"], definition: "d" },
      { id: "water_drone", term: "water drone", forms: ["waterdrone*"], definition: "d" },
    ],
  });
  it("prefers more words, then more literal letters", () => {
    expect(marked(markTerms("Lay the hose lines now.", g))).toEqual([["hose lines", "hose_line"]]);
    expect(marked(markTerms("The waterdrones fly.", g))).toEqual([["waterdrones", "water_drone"]]);
  });
  it("an exclude phrase takes its words out without a mark", () => {
    expect(marked(markTerms("Stand in front of the front.", g))).toEqual([["front", "front"]]);
    const segs = markTerms("Stand in front of the front.", g);
    expect(segs.at(-2)).toEqual({ kind: "term", text: "front", termId: "front" });
  });
  it("a longer match whose term is already marked is skipped whole, not split into shorter terms", () => {
    expect(marked(markTerms("hose line, then hose line again", g))).toEqual([["hose line", "hose_line"]]);
  });
});

describe("first occurrence only; case", () => {
  it("marks each term once per text block", () => {
    expect(fi("Kärki etenee. Kärjen edessä on tie, ja kärki kääntyy.")).toEqual([["Kärki", "head"]]);
    expect(en("The head moves. The head turns.")).toEqual([["head", "head"]]);
  });
  it("ignores case for ordinary forms", () => {
    expect(en("HOSE LINE laid")).toEqual([["HOSE LINE", "hose_line"]]);
    expect(fi("PERÄÄNTYMISTIE auki")).toEqual([["PERÄÄNTYMISTIE", "escape_route"]]);
  });
});

describe("the text is never changed", () => {
  it("joins back to the input exactly, for every record and label of the scenario, in both languages", () => {
    const site = JSON.parse(readFileSync("app/scenario/site-scenario.json", "utf8")) as { traffic: { content?: string }[]; radio: { text: string }[]; english: Record<string, string> };
    const labels = JSON.parse(readFileSync("content/i18n/labels.en.json", "utf8")) as Record<string, string>;
    const fiTexts = [...site.traffic.map((t) => t.content ?? ""), ...site.radio.map((r) => r.text), ...Object.keys(labels)];
    const enTexts = [...Object.values(site.english), ...Object.values(labels)];
    let terms = 0;
    for (const t of fiTexts) { const s = segmentsIn("fi", t); expect(joined(s)).toBe(t); terms += s.filter((x) => x.kind === "term").length; }
    for (const t of enTexts) { const s = segmentsIn("en", t); expect(joined(s)).toBe(t); terms += s.filter((x) => x.kind === "term").length; }
    expect(terms).toBeGreaterThan(1000); // the glossary does meet the scenario's words
  });
  it("an empty text has no segments; a text without terms is one plain segment", () => {
    expect(segmentsIn("fi", "")).toEqual([]);
    expect(segmentsIn("en", "Nothing here.")).toEqual([{ kind: "plain", text: "Nothing here." }]);
  });
  it("English: 'water running out' is not a water shuttle; 'Head to' is not the head", () => {
    expect(en("Water running out (25 %).")).toEqual([]);
    expect(en("Head to the north-east.")).toEqual([]);
  });
});
