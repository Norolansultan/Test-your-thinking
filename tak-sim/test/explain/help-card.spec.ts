/**
 * SPEC/35 §3 item 3: the help card — public sessions only; its three sections (the glossary A–Ö, the call-sign roster with
 * the unit types, the map legend); opening a section reports it once (`onHelpCardOpened`); mounted in both shells.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { alphaKey, chooseSection, glossaryLetters, glossaryList, HELP_CARD_SECTIONS, HELP_CARD_TEXT, rosterRows } from "../../app/render/ui/explain/HelpCard.js";
import { GLOSSARY_FILES } from "../../app/render/ui/explain/glossary.js";
import { UNIT_ROSTER } from "../../app/render/ui/unit-roster.js";
import type { HelpCardSection } from "../../app/render/ui/audience-context.js";

const code = (f: string) => readFileSync(`app/render/ui/${f}`, "utf8");

describe("the help card (SPEC/35 §3 item 3)", () => {
  it("has the three sections, named in both languages", () => {
    expect(HELP_CARD_SECTIONS).toEqual(["glossary", "roster", "legend"]);
    for (const lang of ["fi", "en"] as const) for (const s of HELP_CARD_SECTIONS) expect(HELP_CARD_TEXT[lang].sections[s].length).toBeGreaterThan(2);
    expect(Object.keys(HELP_CARD_TEXT.en)).toEqual(Object.keys(HELP_CARD_TEXT.fi));
  });

  it("reports a section when it is opened, and not again while it stays open", () => {
    const opened: HelpCardSection[] = [];
    const report = (s: HelpCardSection) => opened.push(s);
    let s = chooseSection(null, "glossary", report); // the card opens on the glossary
    s = chooseSection(s, "glossary", report);
    s = chooseSection(s, "roster", report);
    s = chooseSection(s, "legend", report);
    s = chooseSection(s, "glossary", report);
    expect(s).toBe("glossary");
    expect(opened).toEqual(["glossary", "roster", "legend", "glossary"]);
  });

  it("lists the glossary A–Ö (å, ä, ö after z), filtered by initial letter (no free-text field: the study takes no free text)", () => {
    const list = glossaryList(GLOSSARY_FILES.fi.terms, null);
    expect(list).toHaveLength(GLOSSARY_FILES.fi.terms.length);
    for (let i = 1; i < list.length; i++) expect(alphaKey(list[i - 1]!.term) <= alphaKey(list[i]!.term), list[i]!.term).toBe(true);
    expect(alphaKey("öljy") > alphaKey("zeta")).toBe(true);
    expect(alphaKey("ä") > alphaKey("å")).toBe(true);
    const letters = glossaryLetters(GLOSSARY_FILES.fi.terms);
    expect(letters).toContain("L");
    expect(letters.indexOf("V")).toBeLessThan(letters.length);
    expect(glossaryList(GLOSSARY_FILES.fi.terms, "L").map((t) => t.id)).toContain("hose_line");
    expect(glossaryList(GLOSSARY_FILES.en.terms, "H").map((t) => t.id)).toContain("hose_line");
    expect(glossaryList(GLOSSARY_FILES.en.terms, "Ö")).toEqual([]);
    const total = letters.reduce((n, l) => n + glossaryList(GLOSSARY_FILES.fi.terms, l).length, 0);
    expect(total).toBe(GLOSSARY_FILES.fi.terms.length);
    expect(code("explain/HelpCard.tsx")).not.toMatch(/<input|<textarea/);
  });

  it("lists every unit of the roster with its type, in both languages (VPK is VOL1 in English)", () => {
    const fi = rosterRows("fi");
    const en = rosterRows("en");
    expect(fi).toHaveLength(Object.keys(UNIT_ROSTER).length);
    expect(en).toHaveLength(fi.length);
    expect(fi.find((r) => r.callSign === "EK13")!.type).toMatch(/Säiliöauto/);
    expect(en.find((r) => r.callSign === "EK13")!.type).toMatch(/tanker/);
    expect(fi.map((r) => r.callSign)).toContain("VPK");
    expect(en.map((r) => r.callSign)).toContain("VOL1");
    for (const r of [...fi, ...en]) expect(r.type.length, r.callSign).toBeGreaterThan(3);
  });

  it("never repeats the row's own label in a unit's origin (play-test 24 Oct 2026: \"From: From outside the region\")", () => {
    for (const lang of ["fi", "en"] as const) {
      const label = HELP_CARD_TEXT[lang].from;
      for (const r of rosterRows(lang)) if (r.from) expect(r.from, `${lang} ${r.callSign}`).not.toMatch(new RegExp(`^${label}\\b`, "i"));
    }
    expect(rosterRows("en").find((r) => r.callSign === "OUT1")!.from).toBe("Outside the region");
    expect(rosterRows("fi").find((r) => r.callSign === "OUT1")!.from).toBe("Alueen ulkopuolelta"); // "Mistä: Alueen ulkopuolelta" reads right
  });

  it("shows the map legend with every row (the map's own legend, embedded)", () => {
    const card = code("explain/HelpCard.tsx");
    expect(card).toMatch(/<Legend isoMinutes=\{\[\]\} drawn=\{ALL_LEGEND_ROWS\} embedded surface="help_card" \/>/);
    expect(card).toMatch(/const ALL_LEGEND_ROWS = new Set\(LEGEND_ROWS\);/);
    const lg = code("components/Legend.tsx");
    expect(lg).toMatch(/if \(embedded\) \{/);
  });

  it("renders nothing for experts, and only reports through the contract", () => {
    const card = code("explain/HelpCard.tsx");
    expect(card).toMatch(/if \(audience !== "public"\) return null;/);
    expect(card).toMatch(/chooseSection\(section, next, onHelpCardOpened\)/);
    expect(card).not.toMatch(/condition|substitutive|snapshot/i); // the same card in both groups, nothing of the session's state
  });

  it("is mounted in both shells: the classic message log's header and the TAK toolbar", () => {
    expect(code("components/RightPanel.tsx")).toMatch(/<span>\{t\.messageLog\} \(\{snapshot\.radioLog\.length\}\)<\/span>\n\s*<\/div>\n\s*\{\/\*[^\n]*\*\/\}\n\s*<HelpCard \/>/);
    expect(code("tak/TakToolbar.tsx")).toMatch(/<HelpCard variant="toolbar" \/>\n\s*<\/nav>/);
  });
});
