/**
 * Nothing of the main scenario in the training, and nothing of the training in the scenario (SPEC/08 (bp) §bp.8, `15` (bp) §bp.7),
 * tested against every scenario text in both languages (`scenarioStrings`: records, item stems and options, SPAM prompts, radio
 * lines, branch statements, labels and their English):
 * - the training's names (EK51–EK53, DR8, R5–R7, Kaitajärvi, Narrow Lake) occur in no scenario text;
 * - no training text names a call sign of the scenario, a contract place or feature (its fi and en names and match pattern), the road
 *   codes R1–R3, or a scored item's subject (the 20 kV line, the company, police, cabins, a village, evacuation, a bridge, a road by
 *   name, rekindle, an aircraft, the W1 and W2 water points, the forecast);
 * - every clock a training text holds lies before 11.32, the first clock of any scenario text;
 * - no run of four words of a training text occurs in a scenario text, apart from the allow-list of plain phrases below.
 */

import { describe, expect, it } from "vitest";
import { contractPatterns, readContract } from "../../tools/review/training-contract.js";
import { grams, MAIN_CALL_SIGNS, MAIN_SUBJECTS, OVERLAP_ALLOW, scenarioStrings, trainingStrings } from "./texts-corpus.js";

const TRAINING = trainingStrings();
const SCENARIO = scenarioStrings();
const minutes = (h: string, m: string) => Number(h) * 60 + Number(m);
const clocksOf = (s: string) => [...s.matchAll(/(?<![\d,.])([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d,])/g)].map((m) => minutes(m[1]!, m[2]!));

describe("the training against the scenario's texts (SPEC/08 (bp) §bp.8)", () => {
  it("collects every text: the training's in both languages and the scenario's", () => {
    expect(new Set(TRAINING.map((t) => t.lang))).toEqual(new Set(["fi", "en"]));
    expect(TRAINING.length).toBeGreaterThan(400);
    expect(SCENARIO.length).toBeGreaterThan(3000);
  });

  it("the training's own names occur in no scenario text", () => {
    const own = /\b(EK5[0-9]|DR8|R5|R6|R7)\b|Kaitaj|Narrow Lake/;
    expect(SCENARIO.filter((s) => own.test(s))).toEqual([]);
  });

  it("no training text names a call sign, contract place or feature, road code or scored subject of the scenario", () => {
    const patterns = contractPatterns(readContract("."));
    for (const t of TRAINING) {
      expect(t.text, t.where).not.toMatch(MAIN_CALL_SIGNS);
      expect(t.text, t.where).not.toMatch(MAIN_SUBJECTS);
      for (const p of patterns) expect(p.re.test(t.text), `${t.where}: ${p.id}`).toBe(false);
    }
  });

  it("every clock a training text holds lies before 11.32, the first clock of any scenario text", () => {
    const first = Math.min(...SCENARIO.flatMap(clocksOf));
    expect(first).toBe(minutes("11", "32"));
    const training = TRAINING.flatMap((t) => clocksOf(t.text));
    expect(training.length).toBeGreaterThan(20);
    expect(Math.max(...training)).toBeLessThan(first);
    expect(Math.min(...training)).toBeGreaterThanOrEqual(minutes("09", "41"));
  });

  it("no run of four words of a training text occurs in a scenario text, apart from the allow-list", () => {
    const scenario = new Set(SCENARIO.flatMap((s) => grams(s)));
    const hits = new Set<string>();
    for (const t of TRAINING) for (const g of grams(t.text)) if (scenario.has(g) && !OVERLAP_ALLOW.includes(g)) hits.add(`${g}  (${t.where})`);
    expect([...hits]).toEqual([]);
    // The allow-list holds only phrases that still occur (a stale entry is removed).
    const used = new Set(TRAINING.flatMap((t) => grams(t.text)).filter((g) => scenario.has(g)));
    expect(OVERLAP_ALLOW.filter((g) => !used.has(g))).toEqual([]);
  });
});
