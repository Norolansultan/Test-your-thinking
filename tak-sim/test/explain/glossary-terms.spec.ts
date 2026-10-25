/**
 * SPEC/35 §9 P2: the terms are complete in both languages (`content/glossary/terms.{fi,en}.json`): the same ids, each with a
 * headword, a valid form and a definition, both files marked DRAFT; and §1's rule as far as a test can hold it — a
 * definition names no place of the scenario and no unit of it, and gives no instruction.
 */

import { describe, expect, it } from "vitest";
import { GLOSSARY_FILES, glossaryProblems, segmentsIn, type GlossaryFile } from "../../app/render/ui/explain/glossary.js";
import { PLACE_NAMES_EN } from "../../app/i18n/place-names.js";
import { UI_TEXT } from "../../app/i18n/ui.js";

const { fi, en } = GLOSSARY_FILES;

describe("the glossary's terms (SPEC/35 §3 item 2)", () => {
  it("every term id exists in both languages, once, with a headword, forms and a definition", () => {
    expect(glossaryProblems()).toEqual([]);
    expect(fi.terms.map((t) => t.id)).toEqual(en.terms.map((t) => t.id));
  });

  // R12 (25 Oct 2026): "puolustuslinja (linjan pito)" split into the posture's defensive line and the secondary task's holding a
  // line, 91 terms; SPEC/35 sets no number, so the bound (90 since the play-test's four terms) moves to 91 (SPEC/35 (bi)).
  it("has 60–91 terms", () => {
    expect(fi.terms.length).toBeGreaterThanOrEqual(60);
    expect(fi.terms.length).toBeLessThanOrEqual(91);
  });

  it("R12: the plan's two 'line' choices are glossed by two different terms, in both languages", () => {
    for (const lang of ["fi", "en"] as const) {
      const termsIn = (text: string) => segmentsIn(lang, text).flatMap((s) => (s.kind === "term" ? [s.termId] : []));
      expect(termsIn(UI_TEXT[lang].postures.barrier_line), lang).toContain("defensive_line");
      expect(termsIn(UI_TEXT[lang].postures.barrier_line), lang).not.toContain("hold_line");
      expect(termsIn(UI_TEXT[lang].secondaryTasks["task.hold-line"]), lang).toContain("hold_line");
      expect(termsIn(UI_TEXT[lang].secondaryTasks["task.hold-line"]), lang).not.toContain("defensive_line");
    }
    // The English labels say which line: a new one ahead of the fire, or one that exists; the Finnish are unchanged (DRAFT).
    expect(UI_TEXT.en.postures.barrier_line).toBe("Defensive line ahead of the fire, on a road or water");
    expect(UI_TEXT.en.secondaryTasks["task.hold-line"]).toBe("Hold an existing line on a road or water");
    expect(UI_TEXT.fi.postures.barrier_line).toBe("Puolustuslinja tien tai vesistön varaan");
    expect(UI_TEXT.fi.secondaryTasks["task.hold-line"]).toBe("Linjan pito tiellä tai vesistöllä");
  });

  it("marks the Finnish definitions DRAFT in a top-level field (and the English, pending the domain check)", () => {
    expect(fi.status).toMatch(/^DRAFT/);
    expect(en.status).toMatch(/^DRAFT/);
  });

  it("the check finds a missing id, a duplicate and a bad form", () => {
    const broken: Record<"fi" | "en", GlossaryFile> = {
      fi: { ...fi, terms: [...fi.terms, { id: "extra", term: "x", forms: ["a*b"], definition: "d" }, fi.terms[0]!] },
      en,
    };
    const problems = glossaryProblems(broken);
    expect(problems).toContain('fi: "extra" has no en entry');
    expect(problems.some((p) => p.includes(`"${fi.terms[0]!.id}" twice`))).toBe(true);
    expect(problems.some((p) => p.includes('form "a*b"'))).toBe(true);
  });

  it("covers the words the brief names", () => {
    const ids = new Set(fi.terms.map((t) => t.id));
    for (const id of ["callsign_ek", "tanker", "forest_fire_unit", "drone", "head", "flank", "heel", "anchor", "hose_line", "firebreak", "mop_up",
      "smouldering", "ember", "spot_fire", "rekindle", "drained_peatland", "crown_fire", "laces", "lookout", "escape_route", "safety_zone",
      "power_line", "de_energised", "safety_distance", "water_point", "water_shuttle", "command_post", "directive", "main_effort", "situation_picture"]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("each headword is marked by its own term (Finnish and English), so the card and the text agree", () => {
    const misses: string[] = [];
    for (const [lang, file] of [["fi", fi], ["en", en]] as const) {
      for (const t of file.terms) {
        const head = t.term.replace(/\s*\(.*\)$/, "");
        const ids = segmentsIn(lang, head).flatMap((s) => (s.kind === "term" ? [s.termId] : []));
        if (!ids.includes(t.id)) misses.push(`${lang}:${t.id} "${head}"`);
      }
    }
    // Call-sign headwords ("EK (kutsutunnus)") carry no number, and LACES-like acronyms are matched as written.
    expect(misses.filter((m) => !/callsign_|"(EK|KY|OUT|DR)"/.test(m))).toEqual([]);
  });
});

describe("definitions explain the word, never the situation (SPEC/35 §1)", () => {
  const places = Object.keys(PLACE_NAMES_EN).flatMap((fiName) => [fiName, PLACE_NAMES_EN[fiName]!]);
  const all = [...fi.terms, ...en.terms];

  it("no definition names a place of the scenario", () => {
    const named = (text: string, p: string) => new RegExp(`(?<![\\p{L}])${p}(?![\\p{L}])`, "u").test(text);
    for (const t of all) for (const p of places) expect(named(t.definition, p), `${t.id}: ${p}`).toBe(false);
  });

  it("a farm named Harju is not the esker; the common noun is", () => {
    expect(segmentsIn("fi", "Harju ja Peltola").filter((s) => s.kind === "term")).toEqual([]);
    expect(segmentsIn("fi", "Mitä harjun uusi palo merkitsee?").filter((s) => s.kind === "term").map((s) => s.text)).toEqual(["harjun"]);
  });

  it("no definition names a particular unit, sector, road or water point of the scenario, or a time", () => {
    for (const t of all) {
      expect(t.definition, t.id).not.toMatch(/\b(EK|KY|OUT|DR|VD|UGV|HELI)\d|\bR[1-3]\b|\bW[1-3]\b|\d{1,2}[.:]\d{2}\b/);
      if (t.id !== "sector") expect(t.definition, t.id).not.toMatch(/\bL[1-4]\b/); // "sector" names the form of a sector's name (e.g. L1)
    }
  });

  it("no definition tells the participant what to do", () => {
    for (const t of fi.terms) expect(t.definition, t.id).not.toMatch(/\b(sinun|kannattaa|pitäisi|suosittele|tarkista|muista|valitse)\b/i);
    for (const t of en.terms) expect(t.definition, t.id).not.toMatch(/\b(you should|should|recommend|check whether|remember to|choose)\b/i);
  });

  it("definitions are short: at most two sentences, 260 characters", () => {
    for (const t of all) {
      expect(t.definition.length, t.id).toBeLessThanOrEqual(260);
      expect(t.definition.split(/(?<!\b(?:e\.g|i\.e|esim)\.)(?<=[.!?])\s+(?=[A-ZÅÄÖ0-9])/).length, t.id).toBeLessThanOrEqual(2);
    }
  });
});
