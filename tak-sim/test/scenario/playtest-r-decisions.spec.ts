/**
 * The play-test decisions of 25 Oct 2026 (`docs/audits/2026-10-23-playtest/analysis.md` §10.4; SPEC/08, SPEC/18 (bh)) on the built
 * scenario: R2 V4 `head_later` exploratory, R3 V10 `infra` a plain current state, R5 the brook renamed, R7 one R1 stretch per map name,
 * R8 V5's bands, R9 SPAM V3.b's magnitudes, B4 V14's basis text, B9 the contradiction prompt. R1 (clock-only stems) is in
 * `freeze-rules.spec.ts`, R4 (`r1_arrival`) in `freeze-bank.spec.ts`.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import { CONTRADICTION_BACKUP_AUTHORED, SPAM_3B_RATIO, SPAM_SECOND_ITEMS, SPAM_SECOND_KEY_ATOMS } from "../../app/scenario/demo-probes.js";
import { FREEZE_BANK } from "../../app/scenario/freeze-bank.js";
import { V5_AREA, V5_AREA_EDGES, V5_AREA_TRUTH_MARGIN } from "../../app/scenario/freeze-readings.js";
import { detachedFrontToLineM, distanceToLineM, R2_LINE, siteStep } from "../../app/scenario/freeze-keys.js";
import { PLACE_NAMES_EN } from "../../app/i18n/place-names.js";
import { recordEn, tr } from "../../app/i18n/text.js";
import { BROOKS } from "../../tools/topo-map/terrain.js";
import { overlayLabels } from "../../app/render/ui/map-overlay.js";

const scenario = buildDemoScenario();
const items = [scenario.practice.freeze, ...scenario.freezes].flatMap((f) => f.items);
const item = (id: string) => items.find((it) => it.id === id)!;
const texts = (): string[] => [
  ...SITE_SCENARIO.traffic.map((t) => t.content), ...SITE_SCENARIO.radio.map((r) => r.text), ...Object.values(SITE_SCENARIO.english ?? {}),
  ...scenario.atoms.map((a) => recordEn(a.id) ?? ""), ...items.flatMap((it) => [it.promptFi, tr("en", it.promptFi), ...it.options.flatMap((o) => [o.labelFi, tr("en", o.labelFi)])]),
];

describe("R2: V4 head_later is exploratory", () => {
  it("carries scoredFor exploratory; F7 stays H9-only; no other item is outside the composites", () => {
    expect(items.filter((it) => it.scoredFor).map((it) => [it.id, it.scoredFor])).toEqual([["freeze.4.head_later", "exploratory"], ["freeze.12.f7", "h9_only"]]);
  });
});

describe("R3: V10 infra asks a plain current state", () => {
  it("DR2's 17.21 line says R2 is passable, without 'vielä' / 'still'", () => {
    const fi = CYCLE_STORY[13]!.bubbles[0]!.text;
    expect(fi).toContain("Huoltotie R2 ajettavissa, uusi palo runsaan kilometrin päässä tiestä.");
    expect(fi).not.toMatch(/vielä/);
    expect(recordEn("atom.demo.13.0")).not.toMatch(/\bstill\b/);
  });

  it("option c is a clearly false current state: low fire at R2's roadside while the nearest fire is the new front ~1.1 km off", () => {
    const it = item("freeze.10.infra");
    expect(it.options.map((o) => [o.id, o.correct])).toEqual(expect.arrayContaining([["open", true], ["with_care", false]]));
    expect(it.options.map((o) => o.id)).not.toContain("threatened");
    expect(it.options.find((o) => o.id === "with_care")!.labelFi).toBe("Ajettavissa varoen, matalaa paloa tien reunassa");
    // The drone road reports write "low fire at the roadside" only within 60 m of the fire: at 17.40 the new front is over 1 km from R2 and
    // the old fire, held and cold, ~490 m.
    expect(detachedFrontToLineM(13, R2_LINE)).toBeGreaterThan(1000);
    expect(Math.min(...siteStep(13).truthAtEnd.flat().map((p) => distanceToLineM(p, R2_LINE)))).toBeGreaterThan(400);
  });
});

describe("R5: Korpioja is Myllyoja, 'Alder Creek' is 'Mill Brook'", () => {
  it("no record, item, label or English text names the old brook", () => {
    for (const t of texts()) expect(t).not.toMatch(/Korpioj|Alder Creek/);
    for (const lang of ["fi", "en"] as const) for (const l of overlayLabels(lang)) expect(l.html).not.toMatch(/Korpioj|Alder Creek/);
  });

  it("the brook, its overlay label and its crossing radio carry the new name; neither name collides with another place", () => {
    expect(BROOKS.map((b) => b.name)).toContain("Myllyoja");
    expect(overlayLabels("fi").find((l) => l.key === "brook:myllyoja")!.html).toContain(">Myllyoja<");
    expect(overlayLabels("en").find((l) => l.key === "brook:myllyoja")!.html).toContain(">Mill Brook<");
    expect(SITE_SCENARIO.radio.some((r) => r.cycle === 7 && r.text.startsWith("Kipinät lensivät Myllyojan yli"))).toBe(true);
    expect(PLACE_NAMES_EN["Myllyoja"]).toBe("Mill Brook");
    const others = Object.entries(PLACE_NAMES_EN).filter(([fi]) => fi !== "Myllyoja");
    for (const [fi, en] of others) {
      expect(fi.slice(0, 3), fi).not.toBe("Myl");
      expect(en, fi).not.toMatch(/\bMill\b/);
    }
    expect("Myllyoja".startsWith("Ko")).toBe(false);
  });
});

describe("R7: one R1 stretch per map name", () => {
  const r1Reports = SITE_SCENARIO.traffic.filter((t) => /tiehavainto: tie R1 /.test(t.content));
  it("every R1 report naming Kuivakangas names the same stretch, south of it (the DR2 series of V5 infra and SPAM V6.b)", () => {
    const named = r1Reports.filter((t) => /Kuivakan/.test(t.content));
    expect(named.length).toBeGreaterThan(8);
    for (const t of named) expect(t.content, t.id).toMatch(/tie R1 Kuivakankaan eteläpuolella, /);
  });

  it("the step-5 DR1/DR3 reports name the R2 junction with no figure, and SPAM V6.b's lure and keys are intact", () => {
    const step5 = r1Reports.filter((t) => t.cycle === 5 && /^DR[13] /.test(t.content));
    expect(step5.map((t) => t.content.slice(0, 3))).toEqual(["DR1", "DR3"]);
    for (const t of step5) expect(t.content, t.id).toMatch(/^DR[13] tiehavainto: tie R1 vajaa kilometri R2:n risteyksestä länteen, palo noin 10 m tiestä/);
    for (const t of step5) expect(SITE_SCENARIO.english![t.id]).toContain("road R1 just under a kilometre west of the R2 junction");
    expect(SITE_SCENARIO.traffic.find((t) => t.id === "evt.c06.022")!.content).toMatch(/^DR2 tiehavainto: tie R1 Kuivakankaan eteläpuolella, palanut alue tien reunassa — ei liekkejä, ajettavissa/);
    expect(SPAM_SECOND_KEY_ATOMS[6]).toHaveLength(2);
  });
});

describe("R8: V5 area_hour's bands", () => {
  it("90/130/190, the key 130–190, the truth at least 10 % of its value from every edge and in the reports' band", () => {
    expect(V5_AREA_EDGES).toEqual([90, 130, 190]);
    expect(V5_AREA.id).toBe("m130_190");
    expect(V5_AREA.truthId).toBe(V5_AREA.id);
    const margin = Math.min(...V5_AREA_EDGES.map((e) => Math.abs(V5_AREA.truthValue! - e)));
    expect(margin).toBeGreaterThanOrEqual(V5_AREA_TRUTH_MARGIN * V5_AREA.truthValue!);
    expect(item("freeze.5.area_hour").options.map((o) => o.labelFi)).toEqual(["Alle 90 hehtaaria", "90–130 hehtaaria", "130–190 hehtaaria", "Yli 190 hehtaaria"]);
    expect(FREEZE_BANK[5]!.find((d) => d.slug === "area_hour")!.basis).toMatch(/≥ 10 % of its value required/);
  });
});

describe("R9: SPAM V3.b's options differ in magnitude", () => {
  it("ascending, two of them 'sped up'; the key, a third more, is the surveys' ratio", () => {
    const v3b = SPAM_SECOND_ITEMS[3]!;
    expect(v3b.options).toEqual(["Hidastunut, uutta alaa vähemmän", "Ennallaan, uutta alaa suunnilleen yhtä paljon", "Kiihtynyt, uutta alaa noin kolmanneksen enemmän", "Kiihtynyt, uutta alaa noin kaksi kertaa niin paljon"]);
    expect(v3b.correct).toBe("c");
    expect(v3b.options.filter((o) => o.startsWith("Kiihtynyt"))).toHaveLength(2);
    expect(SPAM_3B_RATIO).toMatchObject({ before: 4.4, latest: 6 });
    expect(Math.abs(SPAM_3B_RATIO.ratio - 4 / 3)).toBeLessThan(Math.min(Math.abs(SPAM_3B_RATIO.ratio - 1), Math.abs(SPAM_3B_RATIO.ratio - 2)));
  });
});

describe("B4, B9: texts", () => {
  it("V14 se_front_r2's basis quotes each pushed distance with its own source", () => {
    expect(FREEZE_BANK[14]!.find((d) => d.slug === "se_front_r2")!.basis).toContain("500 m (KY21 19.52: 500 m; OUT1 19.56: 900 m)");
  });

  it("the contradiction probe asks for one pair (singular)", () => {
    expect(CONTRADICTION_BACKUP_AUTHORED.prompt).toBe("Mikä seuraavista raporttipareista, jos mikään, oli keskenään ristiriitainen?");
    expect(tr("en", CONTRADICTION_BACKUP_AUTHORED.prompt)).toBe("Which of the following pairs of reports, if any, was inconsistent?");
  });
});
