/**
 * English place names (revision (ae), 9 Oct 2026): the one table (`app/i18n/place-names.ts`) names every
 * place an English session shows, on the map and in the texts alike, and no Finnish place name or code
 * reaches an English screen.
 *
 * - the map: every label of the built map (`content/site/build/topo-features.json`, written by
 *   `npm run map:build`) has its English from the table, at the same point, in the same style;
 * - the texts: the generated records' English, the authored English, the scenario labels, questions and
 *   options as shown (`tr`), the roster, the interface and study texts, the briefing and training texts,
 *   and the Thinker's English questions name no Finnish place and no place outside the table.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { codeIn, englishNames, finnishNamesIn, PLACE_NAMES_EN, topoTileUrl, unitCallSign } from "../../app/i18n/place-names.js";
import { recordEn, tr } from "../../app/i18n/text.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { introTextsIn, SETTING_TEXT_EN } from "../../app/scenario/briefing.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { UNIT_ROSTER_EN } from "../../app/render/ui/unit-roster.js";
import { ALL_AUTHORED_QUESTIONS_EN, PLANTED_PROBES } from "../../tools/thinker/authored-questions.js";
import labelsEn from "../../content/i18n/labels.en.json" with { type: "json" };
import authoredEn from "../../content/i18n/authored.en.json" with { type: "json" };
import overridesEn from "../../content/i18n/records.en.overrides.json" with { type: "json" };

interface MapLabel { readonly text: string; readonly px: readonly [number, number] | { readonly x: number; readonly y: number }; readonly style: string }
const features = JSON.parse(readFileSync("content/site/build/topo-features.json", "utf8")) as { labels: MapLabel[]; labelsEn: MapLabel[] };

/** Every string inside a value (objects, arrays, functions of a cell are skipped). */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

/** A word shaped like a Finnish place name (a capitalised compound ending in a Finnish place word). */
const FINNISH_PLACE = /(?<![\p{L}])[A-ZÄÖ][a-zäö-]*(?:järvi|järven|lampi|lammen|joki|joen|oja|ojan|puro|suo|suon|kangas|kankaan|mäki|mäen|harju|harjun|kylä|kylän|ranta|rannan|laakso)(?![\p{L}])/u;

const scenario = buildDemoScenario();
const englishTexts: readonly [string, string][] = [
  ...Object.entries(SITE_SCENARIO.english ?? {}).map(([k, v]) => [`bundle ${k}`, v] as [string, string]),
  ...Object.entries(authoredEn as Record<string, string>).map(([k, v]) => [`authored ${k}`, v] as [string, string]),
  ...Object.entries(overridesEn as Record<string, string>).map(([k, v]) => [`override ${k}`, v] as [string, string]),
  ...Object.keys(labelsEn).map((fi) => [`label ${fi}`, tr("en", fi)] as [string, string]),
  ...scenario.atoms.map((a) => [`record ${a.id}`, recordEn(a.id) ?? ""] as [string, string]),
  ...strings(UNIT_ROSTER_EN).map((s) => ["roster", s] as [string, string]),
  ...strings(UI_TEXT.en).map((s) => ["ui", s] as [string, string]),
  ...strings({ ...STUDY_TEXT.en, debrief: null }).map((s) => ["study", s] as [string, string]),
  ...(["radio", "reasoning_once", "reasoning_intent"] as const).flatMap((c) => STUDY_TEXT.en.debrief.paragraphs(c).map((s) => [`debrief ${c}`, s] as [string, string])),
  ...(["directed", "substitutive"] as const).flatMap((c) => strings(introTextsIn(c, "en")).map((s) => [`intro ${c}`, s] as [string, string])),
  ["setting", SETTING_TEXT_EN],
  ...ALL_AUTHORED_QUESTIONS_EN.map((q) => ["thinker query", q] as [string, string]),
  ...PLANTED_PROBES.map((p) => ["planted probe", p.en] as [string, string]),
  ...(JSON.parse(readFileSync("content/thinker/neutral-eval.en.json", "utf8")) as { questions: { id: string; question: string }[] }).questions.map((q) => [`eval ${q.id}`, q.question] as [string, string]),
];

describe("the table", () => {
  const en = Object.values(PLACE_NAMES_EN);
  it("gives every place a distinct English name, none a unit call sign or a Finnish word", () => {
    expect(new Set(en).size).toBe(en.length);
    const units = new Set(SITE_SCENARIO.units.map((u) => u.id));
    for (const name of en) {
      expect(units.has(name), name).toBe(false);
      expect(name, name).not.toMatch(/[äöå]/i);
      expect(finnishNamesIn(name), name).toEqual([]);
    }
  });

  it("englishNames is idempotent and leaves English alone", () => {
    const s = "Vehicle location VPK: north flank, Karhujärvi side. Embers flew over the Korpioja brook; the Mökkiranta cabins; spot fire PP1, rekindle US2.";
    const once = englishNames(s);
    expect(once).toBe("Vehicle location VOL1: north flank, Bear Lake side. Embers flew over Alder Creek; the Lakeside Cottages; spot fire SF1, rekindle RK2.");
    expect(englishNames(once)).toBe(once);
    expect(codeIn("en", "US1")).toBe("RK1");
    expect(codeIn("fi", "US1")).toBe("US1");
    expect(unitCallSign("en", "VPK")).toBe("VOL1");
    expect(unitCallSign("fi", "VPK")).toBe("VPK");
    expect(topoTileUrl("/maps/topo/0_0.webp", "en")).toBe("/maps/topo-en/0_0.webp");
    expect(topoTileUrl("/maps/topo/0_0.webp", "fi")).toBe("/maps/topo/0_0.webp");
  });
});

describe("the map's labels", () => {
  const named = features.labels.filter((l) => l.style !== "height");
  it("every Finnish label has its English from the table, at the same point and in the same style", () => {
    expect(features.labelsEn).toHaveLength(features.labels.length);
    features.labels.forEach((fi, k) => {
      const en = features.labelsEn[k]!;
      expect(en.px).toEqual(fi.px);
      expect(en.style).toBe(fi.style);
      if (fi.style === "height") expect(en.text).toBe(fi.text.replace(",", "."));
      else expect(en.text, fi.text).toBe(PLACE_NAMES_EN[fi.text]);
    });
  });

  it("every place in the table is on the map, and the English map has no Finnish name", () => {
    expect(new Set(named.map((l) => l.text))).toEqual(new Set(Object.keys(PLACE_NAMES_EN)));
    for (const l of features.labelsEn) expect(finnishNamesIn(l.text), l.text).toEqual([]);
  });
});

describe("the English texts", () => {
  it("name no Finnish place and use no Finnish code (VPK, AVL, PP1, US1)", () => {
    const bad = englishTexts.flatMap(([where, text]) => finnishNamesIn(text).map((n) => `${where}: ${n}`));
    expect(bad).toEqual([]);
  });

  it("name no place outside the table", () => {
    // Kymenlaakso is a real region (the roster's "from"), its English name too, not a place on the site.
    const bad = englishTexts.map(([where, text]) => [where, text.replaceAll("Kymenlaakso", "")] as const)
      .filter(([, text]) => FINNISH_PLACE.test(text)).map(([where, text]) => `${where}: ${text.match(FINNISH_PLACE)![0]}`);
    expect(bad).toEqual([]);
  });

  it("use the English names where the Finnish names a place", () => {
    const all = englishTexts.map(([, t]) => t).join("\n");
    for (const name of ["Bear Lake", "Pike Pond", "Eagle River", "Birch Creek", "Alder Creek", "Bay Village", "Lakeside Cottages", "Moss Bog", "Dry Heath", "Spruce Hill", "Pine Ridge"]) expect(all, name).toContain(name);
  });
});
