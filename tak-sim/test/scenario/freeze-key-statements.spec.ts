/**
 * SPEC/30 §5.3: every L2/L3 item of the seven main freezes carries `keyStatements` (fi and en regular-expression sources, matched
 * case-insensitively against AI answers by `aiStatedKey`). Each choice item's statements recognise its key option's own text in both
 * languages and none of its distractors'; the band items' generated patterns read numbers strictly inside the key band, with the unit
 * (and for distances a context word), and the band written as a range.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { bandStatements, KEY_STATEMENT_ITEM_IDS } from "../../app/scenario/freeze-key-statements.js";
import { tr } from "../../app/i18n/text.js";
import type { FreezeItem } from "../../app/scenario/types.js";

const scenario = buildDemoScenario();
const items = scenario.freezes.flatMap((f) => f.items).filter((it) => it.level !== "L1");
const matches = (sources: readonly string[], text: string) => sources.some((s) => new RegExp(s, "i").test(text));
const isChoice = (it: FreezeItem) => (it.kind ?? "choice") === "choice";

describe("keyStatements on every L2/L3 freeze item (SPEC/30 §5.3)", () => {
  it("every L2/L3 item of V2, V4, V5, V7, V10, V12 and V14 has statements in both languages, and every authored entry names a built item", () => {
    expect(items.length).toBeGreaterThanOrEqual(24 + 3 * 4);
    for (const it of items) {
      expect(it.keyStatements?.fi.length, it.id).toBeGreaterThan(0);
      expect(it.keyStatements?.en.length, it.id).toBeGreaterThan(0);
    }
    const built = new Set(items.map((it) => it.id));
    for (const id of KEY_STATEMENT_ITEM_IDS) expect(built.has(id), id).toBe(true);
  });

  it("every source compiles as a case-insensitive regular expression", () => {
    for (const it of items) for (const s of [...it.keyStatements!.fi, ...it.keyStatements!.en]) expect(() => new RegExp(s, "i"), `${it.id}: ${s.slice(0, 60)}`).not.toThrow();
  });

  it("each choice item's statements match its key option's own text, in Finnish and English, and no distractor's", () => {
    for (const it of items.filter(isChoice)) {
      const ks = it.keyStatements!;
      const keyFi = it.options.find((o) => o.correct)!.labelFi;
      expect(matches(ks.fi, keyFi), `${it.id} fi key "${keyFi}"`).toBe(true);
      expect(matches(ks.en, tr("en", keyFi)), `${it.id} en key "${tr("en", keyFi)}"`).toBe(true);
      for (const o of it.options.filter((x) => !x.correct)) {
        expect(matches(ks.fi, o.labelFi), `${it.id} fi distractor "${o.labelFi}"`).toBe(false);
        expect(matches(ks.en, tr("en", o.labelFi)), `${it.id} en distractor "${tr("en", o.labelFi)}"`).toBe(false);
      }
    }
  });

  it("no statement matches its own item's prompt (a statement is about the key, not the question)", () => {
    for (const it of items) {
      expect(matches(it.keyStatements!.fi, it.promptFi), it.id).toBe(false);
      expect(matches(it.keyStatements!.en, tr("en", it.promptFi)), it.id).toBe(false);
    }
  });

  it("the infrastructure slot's F7 item (L2, built in demo-probes.ts) carries statements too: the line is live", () => {
    const f7 = items.find((it) => it.id === "freeze.12.f7")!;
    expect(matches(f7.keyStatements!.fi, "Johto on edelleen jännitteinen, turvaetäisyydet voimassa.")).toBe(true);
    expect(matches(f7.keyStatements!.fi, "Linja on jännitteetön, vahvistettu.")).toBe(false);
    expect(matches(f7.keyStatements!.en, "The grid company says the line is still energised.")).toBe(true);
    expect(matches(f7.keyStatements!.en, "The line is de-energised, confirmed.")).toBe(false);
  });
});

describe("the band statements (generated from the key option's band)", () => {
  const distance = bandStatements(400, 700, { band: "m", context: { fi: ["risteyk", "R2"], en: ["junction", "R2"] } });
  const area = bandStatements(15, 22, { band: "ha" });
  const far = bandStatements(1500, 2500, { band: "m", context: { fi: ["Mökkiran"], en: ["Lakeside Cottages"] } });

  it("read a number strictly inside the band, with its unit and a context word, in metres or kilometres", () => {
    expect(matches(distance.fi, "Palon reuna on noin 600 m teiden risteyksestä.")).toBe(true);
    expect(matches(distance.fi, "R2:n risteys on noin 0,55 km päässä reunasta.")).toBe(true);
    expect(matches(distance.en, "The junction is about 0.6 km from the edge.")).toBe(true);
    expect(matches(distance.fi, "Palon reuna on noin 800 m teiden risteyksestä.")).toBe(false);
    expect(matches(distance.fi, "Palon reuna on noin 600 m tiestä.")).toBe(false); // no context word in the sentence
    expect(matches(distance.fi, "Kärki etenee 450 m/min risteystä kohti.")).toBe(false); // a rate, not a distance
    expect(matches(far.en, "The Lakeside Cottages are about 1,600 metres from the edge.")).toBe(true);
    expect(matches(far.fi, "Mökkiranta on noin 1,8 km päässä.")).toBe(true);
    expect(matches(far.fi, "Mökkiranta on noin 1,4 km päässä.")).toBe(false);
  });

  it("exclude the band's edges, numbers inside a longer number, and 'under'/'over' statements; read the band written as a range", () => {
    expect(matches(area.fi, "Palanut ala on noin 18,8 ha.")).toBe(true);
    expect(matches(area.fi, "Palanut ala on noin 15,5 hehtaaria.")).toBe(true);
    expect(matches(area.fi, "Palanut ala on noin 22 ha.")).toBe(false);
    expect(matches(area.fi, "Palanut ala on noin 15 ha.")).toBe(false);
    expect(matches(area.fi, "Palanut ala on noin 125,6 ha.")).toBe(false);
    expect(matches(area.fi, "Palanut ala on alle 20 ha.")).toBe(false);
    expect(matches(area.en, "The burnt area will be about 15–22 hectares.")).toBe(true);
    expect(matches(area.en, "The burnt area will be 22–30 ha.")).toBe(false);
  });
});

describe("`31` F16: the element patterns and the lure statements (analysis only: WP-3's `aiStatedKey` and `statedLure`)", () => {
  const isBand = (it: FreezeItem) => isChoice(it) && it.options.every((o) => /^(lt|gt)\d+$|^m\d+_\d+$/.test(o.id));

  it("every L2/L3 item names its element in both languages, and each set matches the item's own prompt, in Finnish and English", () => {
    for (const it of items) {
      const el = it.elementPatterns;
      expect(el?.fi.length, it.id).toBeGreaterThan(0);
      expect(el?.en.length, it.id).toBeGreaterThan(0);
      for (const s of [...el!.fi, ...el!.en]) expect(() => new RegExp(s, "i"), `${it.id}: ${s}`).not.toThrow();
      expect(matches(el!.fi, it.promptFi), `${it.id} fi: ${it.promptFi}`).toBe(true);
      expect(matches(el!.en, tr("en", it.promptFi)), `${it.id} en: ${tr("en", it.promptFi)}`).toBe(true);
    }
  });

  it("every band item carries one lure entry per wrong option; a closed band's lure reads a number inside it, which the key's statements do not", () => {
    const bands = items.filter(isBand);
    expect(bands.length).toBeGreaterThanOrEqual(6);
    for (const it of bands) {
      const lures = it.lureStatements!;
      expect(lures.map((l) => l.optionId).sort(), it.id).toEqual(it.options.filter((o) => !o.correct).map((o) => o.id).sort());
      for (const l of lures) {
        expect(l.fi.length, `${it.id} ${l.optionId}`).toBeGreaterThan(0);
        expect(l.en.length, `${it.id} ${l.optionId}`).toBeGreaterThan(0);
        const closed = /^m(\d+)_(\d+)$/.exec(l.optionId);
        if (!closed) continue;
        const mid = (Number(closed[1]) + Number(closed[2])) / 2;
        const unit = /\bha\b|hehtaari/.test(it.promptFi) || /pinta-ala|palanut ala/.test(it.promptFi) ? "ha" : "m";
        const fi = `${it.promptFi.replace(/\?$/, "")}: noin ${String(mid).replace(".", ",")} ${unit}.`;
        const en = `${tr("en", it.promptFi).replace(/\?$/, "")}: about ${mid} ${unit}.`;
        expect(matches(l.fi, fi), `${it.id} ${l.optionId}: ${fi}`).toBe(true);
        expect(matches(l.en, en), `${it.id} ${l.optionId}: ${en}`).toBe(true);
        expect(matches(it.keyStatements!.fi, fi), `${it.id}: the key's statements read ${l.optionId}`).toBe(false);
      }
    }
  });

  it("no item but a band item carries lure statements", () => {
    for (const it of items.filter((x) => !isBand(x))) expect(it.lureStatements, it.id).toBeUndefined();
  });
});
