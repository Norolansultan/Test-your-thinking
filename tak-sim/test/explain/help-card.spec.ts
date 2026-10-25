/**
 * SPEC/35 §3 item 3: the help card — public sessions only; its three sections (the glossary A–Ö, the call-sign roster with
 * the unit types, the map legend); opening a section reports it once (`onHelpCardOpened`); mounted in both shells.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { alphaKey, chooseSection, glossaryLetters, glossaryList, HELP_CARD_SECTIONS, HELP_CARD_TEXT, rosterRows, rosterSeen } from "../../app/render/ui/explain/HelpCard.js";
import { GLOSSARY_FILES } from "../../app/render/ui/explain/glossary.js";
import { SOURCE_ROSTER, UNIT_ROSTER, UNIT_ROSTER_EN } from "../../app/render/ui/unit-roster.js";
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

  it("lists every unit of the roster with its type, in both languages (VPK is VOL1 in English), then the command centre JOKE", () => {
    const fi = rosterRows("fi");
    const en = rosterRows("en");
    expect(fi).toHaveLength(Object.keys(UNIT_ROSTER).length + Object.keys(SOURCE_ROSTER).length);
    expect(fi.at(-1)!.callSign).toBe("JOKE"); // revision (bn): the source that acknowledges reports (the pointers)
    expect(en.at(-1)!.callSign).toBe("Command centre");
    expect(fi.at(-1)!.type).toMatch(/johtokeskus/);
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
    // The same card in both groups. Revision (bn): its one input from the session is which units the participant has met (`seen`, from
    // the map and the message log, the same in both groups); nothing else of the session's state.
    expect(card).not.toMatch(/condition|substitutive/i);
    expect(card).toMatch(/export function HelpCard\(\{ variant = "panel", seen \}: \{ readonly variant\?: "panel" \| "toolbar"; readonly seen\?: ReadonlySet<string> \| undefined \}\)/);
  });

  it("revision (bn), review S8: the roster shows only the units and sources met so far, so it does not tell that reinforcements will come", () => {
    // At V1: the first alarm's units on the map, nobody heard from later arrivals.
    const v1 = rosterSeen({ radioLog: [{ from: "EK11" }, { from: "DR1" }, { from: "P2" }], renderTree: { cycleInfo: { unitPositions: { EK11: 0, EK12: 0, EK13: 0, EK14: 0, VPK: 0 }, aircraft: [{ platformId: "DR1" }, { platformId: "SPOT" }] } } });
    const ids = rosterRows("fi", v1).map((r) => r.callSign);
    expect(ids).toEqual(["EK11", "VPK", "EK12", "EK13", "EK14", "DR1", "SPOT"]);
    for (const later of ["EK15", "EK16", "KY23", "OUT1", "OUT2", "UGV1", "VD1", "JOKE"]) expect(ids, later).not.toContain(later);
    // Once heard or on the map, a unit is listed; the command centre once it has acknowledged a report.
    const later = rosterSeen({ radioLog: [{ from: "EK15" }, { from: "JOKE" }], renderTree: { cycleInfo: null } });
    expect(rosterRows("en", later).map((r) => r.callSign)).toEqual(["EK15", "Command centre"]);
    // No origin tells who comes with whom ("Saapui OUT1:n mukana", "Arrived with the reinforcements"), and the note names no OUT.
    for (const lang of ["fi", "en"] as const) {
      for (const r of rosterRows(lang)) expect(r.from ?? "", `${lang} ${r.callSign}`).not.toMatch(/saapui|mukana|arrived|reinforcement/i);
      expect(HELP_CARD_TEXT[lang].rosterNote, lang).not.toMatch(/\bOUT\b/);
    }
    expect(UNIT_ROSTER_EN.VD1!.from).toBe("Regional drone unit");
  });

  it("is mounted in both shells: the classic message log's header and the TAK toolbar", () => {
    expect(code("components/RightPanel.tsx")).toMatch(/<span>\{t\.messageLog\} \(\{snapshot\.radioLog\.length\}\)<\/span>\n\s*<\/div>\n\s*\{\/\*[^\n]*\*\/\}\n\s*<HelpCard seen=\{rosterSeen\(snapshot\)\} \/>/);
    expect(code("tak/TakToolbar.tsx")).toMatch(/<HelpCard variant="toolbar" seen=\{rosterSeen\} \/>\n\s*<\/nav>/);
    expect(code("tak/TakSessionLayout.tsx")).toMatch(/rosterSeen=\{rosterSeen\(snapshot\)\}/);
  });
});
