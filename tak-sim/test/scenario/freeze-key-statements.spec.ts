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
