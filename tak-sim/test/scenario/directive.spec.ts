/**
 * The phase-B directive (researcher decision 4 Oct 2026; review round 2 the same day): one directive
 * from P2 replaces SPEC/18 §4.2's four hinge rules. Its text and delivery, and the truth-only keys
 * (`demo-directive.ts`) with their basis records found by content, the sector-aware V9–V10 keys and the
 * per-view fit. The SPAM items and the hinge manipulation check: `spam.spec.ts` (round 2, agent C).
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario, DIRECTIVE_FI, PHASE_A_INTENT_FI } from "../../app/scenario/demo-scenario.js";
import { DIRECTIVE_KEYS, frontSectors, headSector, headSectors, NEW_FRONT, newFrontSector, recordAtomId, SECOND_REKINDLE, secondRekindleSector, VILLAGE_SECTOR } from "../../app/scenario/demo-directive.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { centroid, nearestSectorOf, sectorOf, siteStep } from "../../app/scenario/freeze-keys.js";
import { HINGE_AFTER_VIEW, MAIN_VIEWS } from "../../app/scenario/views.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { viewTimingOf } from "../../app/session/view-clock.js";
import { hasLabelEn, recordIn, tr } from "../../app/i18n/text.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import LABELS_EN from "../../content/i18n/labels.en.json" with { type: "json" };

const scenario = buildDemoScenario();
const atom = (id: string) => scenario.atoms.find((a) => a.id === id)!;
const text = (id: string) => recordText(toRenderable(atom(id)).record);
const pushed = (id: string) => scenario.cycles.some((c) => c.pushedAtomIds.includes(id));

describe("the directive", () => {
  it("is the round-2 text, delivered at V8 (both groups alike, no reply expected) and stated at the hinge, with English", () => {
    expect(DIRECTIVE_FI).toBe("Alueella on kolme maastopaloa. Henkilöstön turvallisuuden ja alueen kokonaistilanteen vuoksi siirrytään puolustavaan toimintaan: linjat teiden ja vesistöjen varaan, ei suoraa hyökkäystä palon reunaan. Ensisijainen tavoite on suojata Lahdenkylä ja Mökkiranta.");
    const guidance = scenario.dutyOfficerMessages.filter((m) => m.isStrategicGuidance);
    expect(guidance).toHaveLength(1);
    expect(guidance[0]).toMatchObject({ cycle: HINGE_AFTER_VIEW + 1, text: DIRECTIVE_FI, expectsReply: false });
    expect(scenario.hinge.intentStatement).toBe(DIRECTIVE_FI);
    expect(hasLabelEn(DIRECTIVE_FI)).toBe(true);
    expect(tr("en", DIRECTIVE_FI)).toBe("There are three wildfires in the region. For the crews' safety and the region's overall situation we move to defensive action: lines on roads and water, no direct attack on the fire's edge. The first aim is to protect Bay Village and Lakeside Cottages."); // English place names, revision (ae)
  });

  it("does not mention readiness or the forecast, says no 'no more resources', and drops the release and resource rules", () => {
    expect(DIRECTIVE_FI).not.toMatch(/valmius|ennuste|tuuli|lisää|resurss|vapaut|lämpökamera|P3/i);
    expect(tr("en", DIRECTIVE_FI)).not.toMatch(/readiness|forecast|wind/i);
  });

  it("V1's intent states phase A's posture (direct attack) and no release rule (round 2), with English", () => {
    const v1 = scenario.dutyOfficerMessages.filter((m) => m.cycle === 1);
    expect(v1).toHaveLength(1);
    expect(v1[0]!.text).toBe(PHASE_A_INTENT_FI);
    expect(PHASE_A_INTENT_FI).toBe("Tavoite: palo rajataan metsäautotien ja suon väliin. Painopiste: kärjen pysäyttäminen koillisessa. Toimintatapa: suora hyökkäys siellä, missä palon voimakkuus sallii.");
    expect(PHASE_A_INTENT_FI).not.toMatch(/vapaut/i);
    expect(tr("en", PHASE_A_INTENT_FI)).toBe("Objective: contain the fire between the forest road and the bog. Priority: stop the head in the north-east. Method: direct attack where intensity allows.");
  });

  it("is not a corpus atom (neither Haku nor Thinker can find it)", () => {
    expect(scenario.atoms.some((a) => JSON.stringify(a.record).includes("puolustavaan toimintaan"))).toBe(false);
  });

  it("the stale texts are gone from the English labels", () => {
    const keys = Object.keys(LABELS_EN as Record<string, string>);
    expect(keys.some((k) => k.startsWith("Uusi linja: ihmiset ja asutus ensin"))).toBe(false);
    expect(keys.some((k) => /valmius on ohut|Yksikkö vapautetaan, kun sen lohko/.test(k))).toBe(false);
  });
});

describe("the directive's keys (truth only)", () => {
  it("cover every main view; phase A is not coded for alignment (descriptive) nor for soundness; phase B aligned = barrier line or protecting settlements", () => {
    for (const v of MAIN_VIEWS) {
      const k = DIRECTIVE_KEYS[v.index]!;
      expect(k, `V${v.index}`).toBeTruthy();
      if (v.phase === "A") expect(k).toMatchObject({ aligned: null, sound: null, fit: "neutral" });
      else expect(k.aligned).toEqual(["barrier_line", "protect_values"]);
      expect(k.basis.length).toBeGreaterThan(20);
    }
    expect(DIRECTIVE_KEYS[0]).toBeNull();
  });

  it("phase B's fits, sound postures and sector restrictions (round 2)", () => {
    const table = Object.fromEntries([8, 9, 10, 11, 12, 13, 14].map((v) => [v, [DIRECTIVE_KEYS[v]!.fit, DIRECTIVE_KEYS[v]!.sound, DIRECTIVE_KEYS[v]!.soundSectors ?? null]]));
    expect(table).toEqual({
      8: ["neutral", null, null],
      // Fix pass 2 (7 Oct 2026): a front straddling a sector boundary accepts both sides; V11–V13 only in the head's sector.
      // Review fixes (ah), 9 Oct 2026: with the re-authored evening winds the new front and its head stay in L3 (computed).
      // SPEC/31 coa F13: L2 (across the boundary the new front runs towards) is in the sound sectors, and marked a boundary sector,
      // so the primary coding reads L3 alone and the boundary-accepted sensitivity L2 and L3.
      9: ["no", ["direct_attack"], { direct_attack: ["L2", "L3"] }],
      10: ["no", ["direct_attack"], { direct_attack: ["L2", "L3"] }],
      11: ["yes", ["barrier_line", "protect_values"], { barrier_line: ["L3"], protect_values: ["L3"] }],
      12: ["yes", ["barrier_line", "protect_values"], { barrier_line: ["L3"], protect_values: ["L3"] }],
      13: ["yes", ["barrier_line", "protect_values"], { barrier_line: ["L3"], protect_values: ["L3"] }],
      // SPEC/31 §3.2 (coa F2, RC): the second rekindle is sound only through the secondary route (was a main-effort direct attack in L1, L4).
      14: ["no", [], null],
    });
    for (const v of [9, 10]) expect((DIRECTIVE_KEYS[v] as { boundarySectors?: readonly string[] }).boundarySectors, `V${v}`).toEqual(["L2"]);
    expect((DIRECTIVE_KEYS[14] as { boundarySectors?: readonly string[] }).boundarySectors).toEqual(["L1"]);
    // 6 Oct 2026: at V14 the flare-up attacked directly as the secondary sector, the main effort protecting Lahdenkylä (L3); fix pass 2: V9–V10's new front too, the main effort anywhere.
    expect([8, 11, 12, 13].every((v) => DIRECTIVE_KEYS[v]!.soundSecondary === undefined)).toBe(true);
    expect(VILLAGE_SECTOR).toBe(nearestSectorOf(SITE_SCENARIO.features["VILLAGE"]!));
    expect(DIRECTIVE_KEYS[14]!.soundSecondary).toEqual({ taskId: "task.direct-attack", sectors: ["L1", "L4"], mainEffortSectors: ["L3"], mainEffortPostures: ["barrier_line", "protect_values"] });
    for (const v of [9, 10]) expect(DIRECTIVE_KEYS[v]!.soundSecondary).toEqual({ taskId: "task.direct-attack", sectors: ["L2", "L3"], mainEffortSectors: ["L1", "L2", "L3", "L4"], mainEffortPostures: ["barrier_line", "protect_values"] });
    // Alignment reads the whole plan in phase B: a secondary direct attack is against the directive.
    for (const v of [8, 9, 10, 11, 12, 13, 14]) expect(DIRECTIVE_KEYS[v]!.againstSecondaryTaskId, `V${v}`).toBe("task.direct-attack");
    for (const v of [11, 12, 13]) expect(headSector(MAIN_VIEWS.find((x) => x.index === v)!.steps[0]!)).toBe("L3");
    expect([14, 16, 18].map(headSectors)).toEqual([["L3"], ["L3"], ["L3"]]); // review fixes (ah): L3 alone at 17:40, 18:20 and 19:00 (was L2+L3 for the first two)
  });

  it("V14's misfit sector is computed from the map: the new detached front at 19:20 that the CA did not have at 19:00 (L4), not V13's spot fire", () => {
    expect(SECOND_REKINDLE).toEqual({ step: 19, sector: "L4", sectors: ["L1", "L4"] }); // its polygon crosses the L1/L4 boundary (fix pass 2)
    // Fix pass 4 (paper2 NEW-1): V14 is merged; its second step's outline of the flare-up stays in the same sectors (no L3).
    const c19 = centroid(siteStep(19).reportedDetached.find((f) => frontSectors(f).includes("L4"))!);
    const near = (f: (typeof siteStep extends (n: number) => infer S ? S : never)["reportedDetached"][number]) => Math.hypot(centroid(f).lat - c19.lat, centroid(f).lon - c19.lon);
    const at20 = [...siteStep(20).reportedDetached].sort((a, b) => near(a) - near(b))[0]!;
    // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): at 20:00 the 0.36 ha flare-up's outline touches L3 by one vertex where L1, L3 and
    // L4 meet at the origin; the map V14 draws (step 19) has it in L1 and L4 only. Every other vertex stays in the key's sectors.
    const outside = at20[0]!.slice(0, -1).filter((p) => !SECOND_REKINDLE.sectors.includes(sectorOf(p) ?? nearestSectorOf(p) ?? ""));
    expect(outside.length, "step 20: vertices outside L1/L4").toBeLessThanOrEqual(1);
    expect(secondRekindleSector()).toEqual(SECOND_REKINDLE);
    // V13's spot fire persists on the 19:20 map; the rekindle is the other front.
    expect(siteStep(19).reportedDetached.length).toBeGreaterThanOrEqual(2); // 3 since 8 Oct 2026: the south-east front is a part of its own
  });

  it("the new front's sector is computed from the map's detached front at V9–V10's steps (L3), not hard-coded", () => {
    expect(siteStep(12).reportedDetached).toHaveLength(0); // V9: the map has no detached front yet
    const front = siteStep(13).reportedDetached[0]!;
    expect(newFrontSector()).toEqual({ step: 13, sector: nearestSectorOf(centroid(front)), sectors: frontSectors(front) });
    expect(NEW_FRONT).toEqual({ step: 13, sector: "L3", sectors: ["L3"] }); // review fixes (ah): in L3 alone (fix pass 2: it touched L2; the old basis named L4)
    expect(DIRECTIVE_KEYS[9]!.basis).not.toMatch(/whether L4 should also count/);
    // The records agree: DR2's step-13 thermal names L3, and the step-13 radio moves crews there.
    expect(text(recordAtomId(13, /^DR2 lämpökuva, eteläreuna \(L3\) klo 17\.25/))).toMatch(/\(L3\)/);
  });

  it("every phase-B key cites basis records that exist, reachable by the view's end; V8–V10 and V12–V14 rest on at least one pushed record, V11 on the recorded-only forecast", () => {
    for (const v of MAIN_VIEWS.filter((x) => x.phase === "B")) {
      const ids = DIRECTIVE_KEYS[v.index]!.basisAtomIds;
      expect(ids.length, `V${v.index}`).toBeGreaterThan(0);
      for (const id of ids) {
        expect(atom(id), `${id} (V${v.index})`).toBeDefined();
        expect(atom(id).cycle).toBeLessThanOrEqual(v.steps.at(-1)!);
      }
      if (v.index !== 11) expect(ids.some(pushed), `V${v.index}`).toBe(true);
    }
    const forecasts = DIRECTIVE_KEYS[11]!.basisAtomIds.filter((id) => atom(id).provenance.sourceId === "SÄÄENNUSTE");
    expect(forecasts.length).toBeGreaterThan(0);
    for (const id of forecasts) expect(pushed(id)).toBe(false);
  });

  it("no basis text cites a CA-only value; V9's size rests on the recorded SPOT pass (round 2: before it, no V9 record gave a size)", () => {
    for (const v of [8, 9, 10, 11, 12, 13, 14]) expect(DIRECTIVE_KEYS[v]!.basis, `V${v}`).not.toMatch(/\bCA\b|8\.5|0 m\/min at step/);
    expect(DIRECTIVE_KEYS[9]!.basis).toMatch(/recorded only: ~0\.5–1 ha/);
  });

  it("rests on the facts it names, read from the records", () => {
    const basis = (v: number) => DIRECTIVE_KEYS[v]!.basisAtomIds.map(text).join(" | ");
    expect(basis(9)).toMatch(/Avotulta ja savua syttymäkohdan kaakkoispuolella/);
    expect(basis(9)).toMatch(/noin 0,5–1 ha.*arviolta 3 m\/min/);
    expect(basis(10)).toMatch(/noin \d+,\d ha, liekit 2–3 m/); // ~1.0 ha since the 8 Oct 2026 fire model; SPEC/31 D1: the flame table (was 0,3–1 m)
    expect(basis(10)).not.toMatch(/m\/min/); // phase-B rebuild: no V10 record gives a rate
    expect(basis(10)).toMatch(/Uusi palo etenee itään/); // radio DF-02 (SPEC/31): "uusi palo" (was "uusi rintama")
    expect(basis(11)).toMatch(/annettu klo 18\.00\): tuuli kääntyy luoteeseen ja voimistuu/);
    expect(basis(12)).toMatch(/Kärki lähestyy metsäautotietä/);
    expect(basis(12)).toMatch(/puuskissa 14,0/);
    // 6 Oct 2026: the road stops the fire in 18.40–19.00 (radioed at step 18, V13) and the head crosses in 19.00–19.20 (step 19, V14).
    expect(basis(13)).toMatch(/Palo pysähtyi metsäautotien \(Honkaharju\) kohdalle klo 18\.40–19\.00/); // the stop is back (re-tuned 8 Oct 2026)
    expect(basis(13)).toMatch(/11,5 m\/min/); // SPEC/33 stage 9: 11,5 on the rebuilt map (revision (aj): 10,1; was 10,6)
    expect(basis(14)).toMatch(/syttymäkohdan länsipuolella, vanhan länsireunan ulkopuolella/);
    expect(basis(14)).toMatch(/SPOT, toinen ylilento klo 19\.30: syttymäkohdan länsipuolen uusi palo noin 0,3 ha/); // fix pass 2 regen: SPOT, was DR2's thermal
    expect(basis(14)).toMatch(/etenee kohti huoltotietä R2/);
    expect(basis(14)).toMatch(/tie R2 .*palo noin \d+ m tiestä/);
    expect(basis(14)).not.toMatch(/200 m tiestä/); // EK14's old "~200 m" from R2 (the rekindle's "200 m syttymäkohdasta" is a position)
  });

  it("the basis texts quote the figures of the records and the map (8 Oct 2026, fix pass 5), not stale ones", () => {
    const k = (v: number) => DIRECTIVE_KEYS[v]!.basis;
    // V10: DR2 and DR3 give 0.8 ha, the map's polygon 0.70 ha; the key rests on records up to 17:40 only.
    expect(k(10)).toMatch(/recorded only: 1\.0 ha, flames 2–3 m \(DR2 thermal 17:25; DR3 mapping 17:35: 1\.0 ha\), and the map's polygon draws it at 0\.97 ha/); // SPEC/33 stage 9: 1.0 / 1.0 / 0.97 on the rebuilt map; // review fixes (ah): was 0.8 / 0.8 / 0.70; revision (aj): the polygon 0.89 (was 0.82); SPEC/31 D1: flames from the table (was 0.3–1 m)
    expect(k(10)).toMatch(/Review note: key on records up to 17:40 only/);
    expect(k(10)).not.toMatch(/~1\.0 ha|was ~0\.8/);
    // V11: DR2's two measurements, with their intervals.
    expect(k(11)).toMatch(/7\.6 m\/min over 17\.20–17\.40 \(150 m, flames 3–4 m\) and 4\.0 m\/min over 17\.40–18\.00 \(80 m, flames 2–3 m\) \(DR2, recorded; the provisional flame-length table\)/); // SPEC/31 D1: the flames DR2 states // review fixes (ah): 7.6 / 7.3; revision (aj): step 14's rate 6 → 4 m/min
    expect(k(11)).not.toMatch(/8\.4 m\/min/);
    expect(DIRECTIVE_KEYS[11]!.basisAtomIds.map(text).join(" | ")).toMatch(/17\.40–18\.00/);
    // V14: SPOT's 0.3 ha at 19:30, the flare-up's polygons.
    expect(k(14)).toMatch(/~0\.3 ha, flames 1–2 m \(SPOT's second pass, 19\.30; the provisional flame-length table/); // SPEC/31 D1 (was "under a metre")
    expect(k(9)).toMatch(/~0\.5–1 ha, flames 2–3 m, the edge running east ~3 m\/min/);
    expect(k(14)).toMatch(/polygon draws it at 0\.15 ha at 19:20 and 0\.36 ha at 20:00/); // SPEC/33 stage 9: the rebuilt map (was 0.21 / 0.26); // fix pass 7: L4 secured at 16:40; review fixes (ah): 0.28 / 1.02; revision (aj): the flare-up on the edge, 15 m out, barely grows in the north-westerly
  });

  it("finds a record by content, and fails loudly when none matches", () => {
    expect(recordAtomId(19, /^Palon kärki ylitti metsäautotien \(Honkaharju\)/)).toMatch(/^atom\.radio\.19\.\d+$/);
    expect(recordAtomId(12, /^Avotulta ja savua/)).toMatch(/^atom\.demo\.12\.\d+$/);
    expect(() => recordAtomId(12, /no such record anywhere/)).toThrow(/no step-12 record/);
  });
});

/**
 * Phase-B corpus rebuild (4 Oct 2026, a separate branch merged after the Thinker index is rebuilt):
 * applying the directive takes the records, and the phase-B records do not contradict the CA or each
 * other on what the keys rest on.
 */
describe("the phase-B records the directive keys rest on", () => {
  const atomsOfStep = (step: number) => scenario.atoms.filter((a) => a.cycle === step);
  const pushedOfStep = (step: number) => atomsOfStep(step).filter((a) => pushed(a.id)).map((a) => ({ id: a.id, text: text(a.id) }));

  it("V10: no pushed record gives the new front's size or a rate; DR2's thermal and DR3's mapping (~0.8 ha) are recorded only", () => {
    for (const p of pushedOfStep(13)) expect(p.text, p.id).not.toMatch(/\d ha\b|m\/min|m minuutissa/);
    for (const re of [/^DR2 lämpökuva, eteläreuna \(L3\) klo 17\.25: erillinen palo kuva-alalla, noin \d+,\d ha/, /^DR3 kehäkartoitus valmis klo 17\.35:.*Erillinen uusi palo, noin \d+,\d ha/]) {
      const id = recordAtomId(13, re);
      expect(atom(id).tier, id).toBe("T2_system");
      expect(pushed(id), id).toBe(false);
    }
    // Round 2 (5 Oct 2026): no crew is on the new front in V10, so no crew radios "we are on it"; its existence
    // is pushed by DR2's story line (English too), and the map shows the front.
    expect(pushedOfStep(13).filter((p) => /uusi pieni palo|pieni uusi palo|uusi palo on vielä pieni|kiinni/i.test(p.text))).toEqual([]);
    const dr2 = recordAtomId(13, /^Uusi palo etenee itään vanhan eteläreunan suuntaisesti/); // radio DF-02 (SPEC/31): was "Uusi rintama"
    expect(pushed(dr2)).toBe(true);
    expect(atom(dr2).provenance.sourceId).toBe("DR2");
    expect(recordIn("en", dr2, text(dr2))).toMatch(/^The new fire is spreading east/);
    expect(siteStep(13).reportedDetached.length).toBeGreaterThan(0);
  });

  it("V9: SPOT's pushed report detects the flare-up and gives no size", () => {
    const spot = recordAtomId(12, /^Avotulta ja savua syttymäkohdan kaakkoispuolella/);
    expect(pushed(spot)).toBe(true);
    expect(text(spot)).not.toMatch(/\bha\b|hehtaari|m²|neliö|pieni|suuri/);
  });

  it("V9: SPOT's second pass at 17.10 gives the size and rate, recorded only, consistent with the CA's new front (round 2)", () => {
    const id = recordAtomId(12, /^SPOT, toinen ylilento klo 17\.10/);
    expect(id).toBe("atom.demo.12.1"); // a new atom: the other story ids are unchanged
    expect(atom(id).tier).toBe("T2_system");
    expect(pushed(id)).toBe(false);
    expect(atom(id).provenance.observedAt).toBe(11 * 1200 + 600); // 17:10
    expect(atom(id).provenance.sourceId).toBe("SPOT");
    expect(recordIn("en", id, text(id))).toMatch(/^SPOT, second pass at 17\.10/);
    // The CA: ignited at 17:00 with a 35 m radius (~0.4 ha), ~0.7 ha at 17:20 (step 12's truth; 6 Oct 2026, anchored to the burned edge: was 1.1); at 17:10 between.
    const ha = (poly: readonly (readonly { lat: number; lon: number }[])[]) => {
      const r = poly[0]!.map((p) => ({ x: p.lon * 111_320 * Math.cos((p.lat * Math.PI) / 180), y: p.lat * 111_320 }));
      let a = 0;
      for (let i = 0; i + 1 < r.length; i++) a += r[i]!.x * r[i + 1]!.y - r[i + 1]!.x * r[i]!.y;
      return Math.abs(a / 2) / 10_000;
    };
    const at1720 = ha(siteStep(12).truthDetached[0]!);
    expect(at1720).toBeGreaterThan(0.6);
    expect(at1720).toBeLessThan(1);
    expect(text(id)).toMatch(/noin 0,5–1 ha/);
    // ~60 m east in the step: the front's east edge at 17:20 vs the ignition disk's (~119 m at 135°, radius 35 m; scenario-18.ts step 12, anchored to the burned edge).
    const east = Math.max(...siteStep(12).truthDetached[0]![0]!.map((p) => p.lon));
    const ign = SITE_SCENARIO.ignition;
    const eastM = (east - ign.lon) * 111_320 * Math.cos((ign.lat * Math.PI) / 180);
    // Revision (aj): the disk overlaps the old edge (centre ~65 m out on the 135° ray, radius 40 m); its east edge is ~75 m east of the origin.
    const rate = (eastM - 102) / 20; // SPEC/33 stage 9: the disk (edge 130° + 35 m, r 45) reaches ~102 m east of the origin (was ~75)
    expect(rate).toBeGreaterThan(2);
    expect(rate).toBeLessThan(4.5);
    expect(text(id)).toMatch(/arviolta 3 m\/min/);
  });

  it("V11: EK11's step-14 line keeps the region's request for KY21 and no longer states the dropped release rule", () => {
    const id = recordAtomId(14, /^Alue pyytää KY21:tä toiselle palolle/);
    expect(pushed(id)).toBe(true);
    expect(text(id)).not.toMatch(/vapaut|lämpökamera/i);
    expect(recordIn("en", id, text(id))).toBe("The region requests KY21 for another fire.");
  });

  it("V14: the crossing names when it crossed, and its gust is the weather station's then (crossed in step 18, radioed at 19; re-tuned 8 Oct 2026)", () => {
    const crossing = text(recordAtomId(19, /^Palon kärki ylitti metsäautotien \(Honkaharju\)/));
    const m = /klo (\d\d\.\d\d)–(\d\d\.\d\d) puuskissa \((\d+) m\/s\)/.exec(crossing);
    expect(m).not.toBeNull();
    expect(siteStep(18).clock).toBe(m![1]!.replace(".", ":"));
    const station = atomsOfStep(18).map((a) => text(a.id)).filter((t) => /^Sääasema johtopaikalla/.test(t));
    expect(station.length).toBeGreaterThan(0);
    for (const t of station) expect(t).toMatch(new RegExp(`puuskissa ${m![3]},0`));
  });

  it("V14: no pushed record gives an R2 distance; DR2's recorded step-20 road report (fix pass 2 regen: DR1's step-19 one is gone) agrees with the CA; the pushed line is from a crew on the south-east front", () => {
    for (const step of [19, 20]) for (const p of pushedOfStep(step)) expect(p.text, p.id).not.toMatch(/R2,? noin \d+ m|\d+ m tiestä/);
    const dr2road = recordAtomId(20, /^DR2 tiehavainto: tie R2 .*palo noin \d+ m tiestä/);
    expect(pushed(dr2road)).toBe(false);
    const d = Number(/palo noin (\d+) m/.exec(text(dr2road))![1]);
    expect(d).toBeGreaterThanOrEqual(250);
    expect(d).toBeLessThanOrEqual(600);
    const line = recordAtomId(19, /^Kaakkoisrintama etenee kohti huoltotietä R2/);
    expect(pushed(line)).toBe(true);
    expect(atom(line).provenance.sourceId).toBe("EK12");
  });

  it("V14 (round 2): the second rekindle's existence is pushed (SPOT, 19:23), its size recorded only (SPOT's second pass, 19.30; fix pass 2 regen: was DR2), and the size is the map's", () => {
    const seen = recordAtomId(19, /^Uutta savua ja liekkejä syttymäkohdan länsipuolella, vanhan länsireunan ulkopuolella/);
    expect(seen).toBe("atom.demo.19.2"); // a new atom: 19.0 and 19.1 are unchanged
    expect(pushed(seen)).toBe(true);
    expect(atom(seen).provenance.sourceId).toBe("SPOT");
    expect(text(seen)).not.toMatch(/\bha\b|m\/min|pieni|suuri/);
    expect(recordIn("en", seen, text(seen))).toMatch(/^New smoke and flames west of the point of origin/);
    const thermal = recordAtomId(19, /^SPOT, toinen ylilento klo 19\.30: syttymäkohdan länsipuolen uusi palo noin (\d+,\d) ha/);
    expect(atom(thermal).tier).toBe("T2_system");
    expect(pushed(thermal)).toBe(false);
    for (const step of [19, 20]) for (const p of pushedOfStep(step)) expect(p.text, p.id).not.toMatch(/länsireuna.*(\d ha\b|m\/min)/);
    const front = siteStep(19).reportedDetached.find((f) => !siteStep(18).truthDetached.some((g) => JSON.stringify(g) === JSON.stringify(f)))!;
    const c = centroid(front);
    const ha = Number(/noin (\d+,\d) ha/.exec(text(thermal))![1]!.replace(",", "."));
    expect(ha).toBeGreaterThanOrEqual(0.2);
    expect(ha).toBeLessThanOrEqual(0.5);
    expect(nearestSectorOf(c)).toBe("L4");
  });
});

describe("D3 (fix pass 6): a burnout from a held road is in line with the directive", () => {
  it("V11–V13's basis says so, and that it is not a plan option; the other views' basis does not", () => {
    for (const v of [11, 12, 13]) expect(DIRECTIVE_KEYS[v]!.basis, `V${v}`).toMatch(/a burnout proposed from a held road is in line with the directive \(a barrier-line technique\) and is not a plan option/);
    for (const v of [8, 9, 10, 14]) expect(DIRECTIVE_KEYS[v]!.basis, `V${v}`).not.toMatch(/burnout/);
  });
});
