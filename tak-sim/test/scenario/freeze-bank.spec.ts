/**
 * The goal-based bank's answer keys against the frozen CA bundle and the corpus (SPEC/08
 * amendment 2 Oct 2026): the computed rules of `freeze-keys.ts`, and an independent check of every
 * cited key whose basis the data can confirm.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import { UNIT_PLAN } from "../../tools/fire-ca/deployment.js";
import {
  cardinalOf, detachedFrontToLineM, distanceM, distanceToLineM, firstDetachedFrontAfter, headNow, inPolygon, liveFrontToLineM, R1_LINE, R2_LINE, reportedAreaAt, reportedAreaHa, reportedDetachedClosingAt,
  reportedDetachedToLineM, reportedGrowthHa, sectorOf, siteStep, truthHeadAtEndOf, unitsByDistanceToHead,
} from "../../app/scenario/freeze-keys.js";
import { arrangeOptions, minutesAhead } from "../../app/scenario/freeze-bank-core.js";
import { FREEZE_BANK, PRACTICE_BANK, V2_AREA, V4_GROWTH, V5_AREA } from "../../app/scenario/freeze-bank.js";
import { V10_AREA, V10_R2, V12_VILLAGE, V14_R2 } from "../../app/scenario/freeze-bank-b.js";
import { MAIN_VIEWS } from "../../app/scenario/views.js";
import type { CycleIndex, LatLon } from "../../app/engine/primitives.js";
import type { FreezeItem } from "../../app/scenario/types.js";

const scenario = buildDemoScenario();
const F = SITE_SCENARIO.features;
const item = (view: number, slug: string): FreezeItem =>
  (view === 0 ? scenario.practice.freeze : scenario.freezes.find((f) => f.cycle === view)!).items.find((it) => it.id.endsWith(`.${slug}`))!;
const key = (view: number, slug: string) => item(view, slug).options.find((o) => o.correct)!.id;

/** CA growth between two steps' truth, in hectares per sector, on a 40 m grid. */
function growthBySector(step: number): Record<string, number> {
  const e = SITE_SCENARIO.extent, out: Record<string, number> = {};
  const inFire = (p: LatLon, s: number) => [siteStep(s).truthAtEnd, ...siteStep(s).truthDetached].some((poly) => inPolygon(p, poly));
  for (let lat = e.south; lat < e.north; lat += 40 / 110_540) for (let lon = e.west; lon < e.east; lon += 40 / 54_200) {
    const p = { lat, lon };
    if (inFire(p, step) && !inFire(p, step - 1)) { const s = sectorOf(p) ?? "-"; out[s] = (out[s] ?? 0) + 0.16; }
  }
  return out;
}

describe("the computed rules", () => {
  it("the truth head at a step's end is the next step's observed head (within 50 m), so a later-clock map key is the CA's — unless that head is a spot fire leading the live front", () => {
    // 8 Oct 2026 (the researcher's fire-model change): the live front is the part the head the map shows lies on, not `truthAtEnd`:
    // from 18:00 the south-east front is a part of its own beside the held 133 ha fire, and phase B's heads (steps 16–19) are on it.
    const parts = (step: number) => [siteStep(step).truthAtEnd, ...siteStep(step).truthDetached];
    const dist = (poly: (typeof parts extends (n: number) => (infer P)[] ? P : never), p: LatLon) => (inPolygon(p, poly) ? 0 : Math.min(...poly[0]!.map((v) => distanceM(v, p))));
    const liveOf = (step: number) => parts(step).reduce((a, b) => (dist(b, headNow(step)) < dist(a, headNow(step)) ? b : a));
    const spotHeads: number[] = [];
    for (const s of SITE_SCENARIO.steps.filter((x) => x.index >= 1 && x.index < 20)) {
      const next = siteStep(s.index + 1).observedHead.anchor;
      if (distanceM(truthHeadAtEndOf(s.index), next) < 50) continue;
      expect(dist(liveOf(s.index), truthHeadAtEndOf(s.index)), `step ${s.index}`).toBeLessThan(50); // the live front's head instead
      spotHeads.push(s.index);
    }
    expect(spotHeads).toEqual([7]); // the crown run's spot fire leads the fire at 15:40 (at 16:00 the next head is on the front again)
    for (const st of [16, 17, 18, 19]) expect(distanceM(truthHeadAtEndOf(st), siteStep(st + 1).observedHead.anchor), `step ${st}`).toBeLessThan(50);
  });

  it("map keys: 'now' is the head or unit the map shows; 'at clock' is the CA head at that step's end", () => {
    expect(item(0, "head_now").mapKey!.point).toEqual(headNow(-3));
    expect(item(5, "head_now").mapKey!.point).toEqual(headNow(7));
    expect(item(12, "head_now").mapKey!.point).toEqual(headNow(16)); // a merged view draws its first step's fire
    expect(item(2, "ek11_point").mapKey!.point).toEqual(siteStep(3).units["EK11"]); // and its second step's units
    expect(item(2, "head_later").mapKey!.point).toEqual(truthHeadAtEndOf(4));
    // Fix pass 3 (researcher decision 7 Oct 2026): worded relative to the freeze's now, the start of the view's last step.
    expect(item(2, "head_later").promptFi).toMatch(/40 minuutin kuluttua/); // 14:40 from 14:00
    expect(item(4, "head_later").promptFi).toMatch(/20 minuutin kuluttua/); // 15:20, the end of the crown run, from 15:00
    expect(item(12, "head_later").promptFi).toMatch(/40 minuutin kuluttua/); // 19:20 from 18:40
    expect(item(14, "head_later").promptFi).toMatch(/20 minuutin kuluttua/); // 20:00 from 19:40
    for (const f of scenario.freezes) for (const it of f.items) expect(it.promptFi, it.id).not.toMatch(/klo \d/);
    // "Now" is the last step's start: every merged view's freeze falls after its step boundary.
    for (const c of scenario.cycles.filter((x) => x.stepBoundary && x.freezeAtSeconds !== null)) expect(c.freezeAtSeconds!, `V${c.index}`).toBeGreaterThan(c.minViewSeconds / 2);
    // An L3 map key is far enough from the head the participant last saw that it is a projection, not a recall.
    for (const [view, shown] of [[2, 2], [4, 5], [12, 16], [14, 19]] as const) expect(distanceM(item(view, "head_later").mapKey!.point, headNow(shown)), `V${view}`).toBeGreaterThan(300);
  });

  it("VP: the head needs over an hour to reach R1 (≈340 m at 3 m/min), and the CA head is at R1 by 13:20", () => {
    expect(distanceToLineM(headNow(-3), R1_LINE)).toBeGreaterThan(300);
    expect(key(0, "r1_arrival")).toBe("gt60");
    expect(distanceToLineM(headNow(1), R1_LINE)).toBeLessThan(50);
  });

  it("V2: EK11 works nearest the head (the esker ignition, on its left flank; fix pass 3, FF5: no longer 'ahead of the head')", () => {
    const [a, b] = unitsByDistanceToHead(3, ["EK11", "EK12", "EK14", "KY21", "VPK"]);
    expect(a!.unit).toBe("EK11");
    expect(b!.m).toBeGreaterThan(2 * a!.m);
    expect(key(2, "nearest_head")).toBe("EK11");
  });

  it("V4: EK12 is on R1 in the burned area, the safety zone (review fixes (ah); was the R1/R2 junction)", () => {
    expect(distanceM(siteStep(6).units["EK12"]!, F["R1_BLACK"]!)).toBeLessThan(200);
    expect(key(4, "ek12_where")).toBe("black");
    // Fix pass 5 (8 Oct 2026): the rate items are replaced by growth and area projections (below).
  });

  it("V14: the south-east front is 150–300 m from R2 at 20:00 (fix pass 5, 8 Oct 2026; replaces growth_trend, whose series the Tilannekuva records stated), the records' 380–400 m now the lure", () => {
    expect(key(14, "se_front_r2")).toBe("m450_650"); // fix pass 7; review fixes (ah): edges 150/380/600; revision (aj): 150/450/650, the report-keyed ~546 m
    expect(V14_R2.margin).toBeGreaterThan(40);
    expect(liveFrontToLineM(20, R2_LINE)).toBeLessThan(liveFrontToLineM(19, R2_LINE));
    expect(item(14, "se_front_r2").level).toBe("L3");
    expect(scenario.freezes.find((f) => f.cycle === 14)!.items.map((it) => it.id)).not.toContain("freeze.14.growth_trend");
  });

  it("V7: the fire resurfaces in L3 at step 12 (the H10 anticipation key), and does not reach the cabins within the hour", () => {
    const front = firstDetachedFrontAfter(10)!;
    expect(front.step).toBe(12);
    expect(front.sector).toBe("L3");
    expect(key(7, "rekindle_sector")).toBe("L3");
    expect(key(7, "cabins_reach")).toBe("no");
    // No crew on the old edge: KY21 and VPK leave it at 16:21–16:22 (their 16:20 map position is a stale report, A3); the others are elsewhere.
    for (const u of ["EK11", "EK12", "EK14"]) expect(sectorOf(siteStep(10).units[u]!), `${u} at step 10`).not.toBe("L3");
    for (const u of ["KY21", "VPK"]) { expect(UNIT_PLAN[u]!.stale).toContain(10); expect(sectorOf(siteStep(11).units[u]!), `${u} at step 11`).not.toBe("L3"); }
  });

  it("V7: KY21's key is its radioed move to the north edge; the map still draws it on the south edge (stale), a wrong option (fix pass 3: a choice item)", () => {
    expect(UNIT_PLAN["KY21"]!.stale).toContain(10);
    expect(sectorOf(siteStep(10).units["KY21"]!)).toBe("L3");
    expect(sectorOf(siteStep(11).units["KY21"]!)).toBe("L1");
    expect(key(7, "ky21_where")).toBe("north");
    expect(item(7, "ky21_where").options.map((o) => o.id).sort()).toEqual(["head", "north", "south", "w1"]);
  });

  it("V10: the reports put the south front 700–1000 m from R2 in two hours (REPORT-keyed; fix pass 7: an hour on it was still over a kilometre, the band DR2's pushed line names); the Mökkiranta cabins stay 1.5–2.5 km from the fire at 18:20", () => {
    expect(key(10, "front_r2_2h")).toBe("m700_1000");
    expect(reportedDetachedClosingAt(13, 15, R2_LINE)).toBeGreaterThan(1000); // the hour item's key was the recalled band
    expect(item(10, "front_r2_2h").promptFi).toMatch(/kahden tunnin kuluttua/);
    expect(cardinalOf(96)).toBe("east");
    expect(cardinalOf(45)).toBeNull();
    expect(key(10, "cabins_distance")).toBe("m1500_2500"); // fix pass 2 (P2-4): replaces south_units
  });

  it("settlements: at V12 the south-east front heads for Lahdenkylä, 1–2 km from the CA fire at 19:40 (V2's nearest-settlement item gave way to area_40, 8 Oct 2026)", () => {
    expect(key(12, "front_toward")).toBe("village");
    expect(key(12, "village_distance")).toBe("m1600_2100"); // fix pass 6: report-keyed (~1776 m; ~1920 m since revision (aj), upper edge 2100); the delivered ~2300 m a lure, over 2100 m
  });

  it("V14: EK11 and VPK are at the command post", () => {
    expect(key(14, "shift_change")).toBe("ek11_vpk");
  });
});

describe("every L3 key forecasts from the freeze's now (fix pass 4, 7 Oct 2026)", () => {
  it("each L3 item's key interval starts at the clock on screen at the freeze (the view's last step), and a head-later item's ends at its prompt's clock", () => {
    const defs = [...Object.entries(FREEZE_BANK).flatMap(([v, ds]) => ds.map((d) => ({ v: Number(v), d }))), ...PRACTICE_BANK.map((d) => ({ v: 0, d }))];
    for (const { v, d } of defs.filter((x) => x.d.level === "L3")) {
      expect(d.keySteps, `V${v} ${d.slug}`).toBeDefined();
      const now = v === 0 ? -3 : MAIN_VIEWS.find((x) => x.index === v)!.steps.at(-1)!;
      expect(d.keySteps![0], `V${v} ${d.slug}`).toBe(now);
      expect(d.keySteps![1], `V${v} ${d.slug}`).toBeGreaterThanOrEqual(now);
      if (d.slug === "head_later") expect(minutesAhead(v, d.keySteps![1]), `V${v}`).toBe((d.keySteps![1] - now + 1) * 20);
    }
  });

  it("the re-keyed intervals: V7's rekindle within steps 10–12 and the cabins not reached; V10's front east within its own step", () => {
    expect(firstDetachedFrontAfter(9)!.step).toBeLessThanOrEqual(12);
    expect(key(7, "cabins_reach")).toBe("no");
    expect(key(10, "front_r2_2h")).toBe("m700_1000");
  });
});

describe("no L3 key is stated by a record on hand before the freeze (fix pass 5, 8 Oct 2026; as far as it is mechanically checkable)", () => {
  /** Every atom of the view's steps up to its last (pushed or recorded): a superset of what the participant can have seen by the freeze. */
  const atomText = (a: (typeof scenario.atoms)[number]) => ("text" in a.record ? String(a.record.text) : "content" in a.record ? String(a.record.content) : "");
  const onHand = (view: number) => {
    const last = view === 0 ? -3 : MAIN_VIEWS.find((v) => v.index === view)!.steps.at(-1)!;
    return scenario.atoms.filter((a) => Number(a.cycle) <= last && (view !== 0 || Number(a.cycle) === -3)).map(atomText);
  };
  /** A band label's range and unit: "15–30 hehtaaria", "Alle 400 metrin päässä", "Yli kilometrin päässä", "Yli tunnin kuluttua". */
  const band = (label: string): { lo: number; hi: number; unit: "ha" | "m" | "min" } => {
    const unit = /hehtaari/.test(label) ? "ha" : /metri|kilometri/.test(label) ? "m" : "min";
    let n = (label.match(/\d+/g) ?? []).map(Number);
    if (/kilometrin/.test(label)) n = n.length === 0 ? [1000] : n.map((x) => x * 1000);
    if (/tunnin/.test(label) && n.length === 0) n.push(60);
    return /^Alle/.test(label) ? { lo: 0, hi: n[0]!, unit } : /^Yli/.test(label) ? { lo: n[0]!, hi: Infinity, unit } : { lo: n[0]!, hi: n[1]!, unit };
  };
  /** The quantities a text states, in the band's unit (km in metres; "m/min" is a rate, not a distance). */
  const stated = (text: string, unit: "ha" | "m" | "min"): number[] => {
    const out: number[] = [];
    for (const m of text.matchAll(/(\d+(?:,\d+)?)\s*(ha|km|m|min)\b(?!\/)/g)) {
      const v = Number(m[1]!.replace(",", ".")), u = m[2]!;
      if (unit === "ha" && u === "ha") out.push(v);
      if (unit === "m" && (u === "m" || u === "km")) out.push(u === "km" ? v * 1000 : v);
      if (unit === "min" && u === "min") out.push(v);
    }
    return out;
  };
  /** Per L3 choice item: the subject a stating record must name, or a pattern that would state a non-numeric key. */
  // `value`: where a record states the very quantity keyed, its number (capture 1), read instead of every number the record holds
  // (DR3's surveys give the total area and, separately, the step's "N ha uutta": only the latter is a growth).
  const CHECKS: Readonly<Record<string, { subject: RegExp; value?: RegExp } | { states: RegExp }>> = {
    r1_arrival: { subject: /R1/ },
    growth_next: { subject: /uutta|kasvo|kasvaa|kasvu/, value: /(\d+(?:,\d+)?) ha uutta/g },
    area_hour: { subject: /palanut ala/, value: /palanut ala noin (\d+(?:,\d+)?) ha/g },
    area_40: { subject: /palanut ala/, value: /palanut ala noin (\d+(?:,\d+)?) ha/g },
    area_total_hour: { subject: /palanut ala/, value: /palanut ala noin (\d+(?:,\d+)?) ha/g },
    wind_shift: { states: /pohjoisreuna\w* (aktivoi|kiihty)/i },
    rekindle_sector: { states: /syttyi uudelleen|syttynyt uudelleen|uudelleensyttymä/i },
    cabins_reach: { states: /mökeill|mökit palav|palo (on )?mökeillä/i },
    front_r2_2h: { subject: /R2/ },
    // V2 fuel_ahead and V10 cabins_distance, whose keys are on record, are L2 since 8 Oct 2026 (researcher): no exemption remains.
    village_distance: { subject: /Lahdenkyl/ },
    // The distance of a fire to R2 as a record states it ("palo 400 m länteen", "palo noin 380 m tiestä"); a hose line's length ("noin 250 m")
    // or a back-burn trigger ("kun rintama on noin 200 m päässä") is not a statement of where the front is.
    se_front_r2: { subject: /R2|tie/, value: /palo (?:noin )?(\d+) m/g },
  };

  it("covers every L3 choice item, and no record on hand states its key", () => {
    for (const f of [scenario.practice.freeze, ...scenario.freezes]) {
      const texts = onHand(f.cycle);
      for (const it of f.items.filter((x) => x.level === "L3" && (x.kind ?? "choice") === "choice")) {
        const slug = it.id.split(".").at(-1)!;
        const check = CHECKS[slug];
        expect(check, `${it.id}: no check`).toBeDefined();
        if (!check) continue;
        if ("states" in check) { expect(texts.filter((t) => check.states.test(t)), it.id).toEqual([]); continue; }
        const b = band(it.options.find((o) => o.correct)!.labelFi);
        const values = (t: string) => (check.value ? [...t.matchAll(check.value)].map((m) => Number(m[1]!.replace(",", "."))) : stated(t, b.unit));
        const hits = texts.filter((t) => check.subject.test(t) && values(t).some((v) => v >= b.lo && v < b.hi));
        expect(hits, `${it.id}: key ${b.lo}–${b.hi} ${b.unit}`).toEqual([]);
      }
    }
  });

  it("the report-keyed projections key with a margin from every band edge (V2 3.2 ha, V4 4.5 ha, V5 18 ha, V10 area 4 ha, V10 front 117 m, V12 224 m, V14 71 m)", () => {
    expect(V2_AREA).toMatchObject({ id: "m15_22" });
    expect(V2_AREA.margin).toBeGreaterThan(2);
    expect(V4_GROWTH).toMatchObject({ id: "m5_15" });
    expect(V4_GROWTH.margin).toBeGreaterThan(3);
    expect(V5_AREA).toMatchObject({ id: "m110_140" });
    expect(V5_AREA.margin).toBeGreaterThan(5);
    expect(V10_AREA).toMatchObject({ id: "m127_134" }); // fix pass 7; review fixes (ah): edges 127/134/144
    expect(V10_AREA.margin).toBeGreaterThan(3);
    expect(V10_R2).toMatchObject({ id: "m700_1000" }); // fix pass 7: two hours on
    expect(V10_R2.margin).toBeGreaterThan(50);
    expect(V12_VILLAGE).toMatchObject({ id: "m1600_2100" });
    expect(V12_VILLAGE.margin).toBeGreaterThan(100);
    expect(V14_R2).toMatchObject({ id: "m450_650" }); // revision (aj)
    for (const [v, slug] of [[4, "growth_next"], [5, "area_hour"], [10, "front_r2_2h"]] as const) expect(item(v, slug).level).toBe("L3");
  });
});

describe("the cited keys hold against the data", () => {
  it("V2 fuel ahead: the head reaches the Kuusimäki spruce edge (step 5) and crowns (step 6)", () => {
    expect(distanceM(truthHeadAtEndOf(5), F["SPR"]!)).toBeLessThan(400);
    expect(CYCLE_STORY[5 as CycleIndex].bubbles[0]!.text).toMatch(/kuusikon reunalla/);
    expect(CYCLE_STORY[6 as CycleIndex].bubbles[0]!.text).toMatch(/Latvapalo/);
    expect(key(2, "fuel_ahead")).toBe("spruce");
  });

  it("V4 fastest spread: the CA growth of steps 5 and 6 is in the head sector (L2)", () => {
    for (const s of [5, 6]) {
      const g = growthBySector(s);
      const top = Object.entries(g).sort((a, b) => b[1] - a[1])[0]!;
      expect(top[0], `step ${s}: ${JSON.stringify(g)}`).toBe("L2");
    }
    expect(key(4, "fastest_spread")).toBe("L2");
  }, 30_000);

  it("V5 wind shift: once the wind backs to the south (step 9), the fire grows in L1, the north", () => {
    expect(siteStep(9).wind.fromDeg).toBeGreaterThanOrEqual(135); // review fixes (ah): SE 140 at 16:00 (was S–SE 160); still backed south of SW
    expect(siteStep(9).wind.fromDeg).toBeLessThanOrEqual(200);
    expect(growthBySector(9)["L1"] ?? 0).toBeGreaterThan(1);
    expect(growthBySector(7)["L1"] ?? 0).toBeLessThan(0.5);
    expect(key(5, "wind_shift")).toBe("north");
  }, 30_000);

  it("V12 longest shift: EK11's crew has the most hours of the four options by step 17", () => {
    const hours = new Map<string, number>();
    for (const e of SITE_SCENARIO.traffic) {
      const m = /kentällä (\d+),(\d) h/.exec(e.content);
      if (m && e.cycle <= 17) hours.set(e.actor, Number(`${m[1]}.${m[2]}`));
    }
    const ranked = ["EK11", "EK14", "KY21", "EK15"].sort((a, b) => hours.get(b)! - hours.get(a)!);
    expect(ranked[0]).toBe("EK11");
    expect(hours.get("EK11")! - hours.get(ranked[1]!)!).toBeGreaterThanOrEqual(1);
    expect(key(12, "longest_shift")).toBe("EK11");
  });

  it("V14 road crossed: the head stopped at the Honkaharju road (radioed at step 18) and crossed it (radioed at step 19)", () => {
    expect(SITE_SCENARIO.radio.some((r) => r.cycle === 18 && /^Palo pysähtyi metsäautotien \(Honkaharju\)/.test(r.text))).toBe(true);
    expect(SITE_SCENARIO.radio.some((r) => r.cycle === 19 && /^Palon kärki ylitti metsäautotien \(Honkaharju\)/.test(r.text))).toBe(true);
    expect(key(14, "road_crossed")).toBe("moved");
  });

  it("crew radio keys found by content resolve to the records the fixed ids named on the 6 Oct 2026 bundle", () => {
    const keys = (view: number, slug: string) => (item(view, slug).keyAtomIds ?? []).filter((id) => id.startsWith("atom.radio."));
    expect(keys(2, "ek11_point")).toEqual(["atom.radio.3.0"]);
    expect(keys(2, "nearest_head")).toEqual(["atom.radio.3.0"]);
    expect(keys(4, "ek12_where")).toEqual(["atom.radio.6.1"]);
    expect(keys(4, "work_danger")).toEqual(["atom.radio.6.0", "atom.radio.6.1"]);
    expect(keys(5, "spot_cause")).toEqual(["atom.radio.7.1", "atom.radio.7.2"]);
    expect(keys(5, "units_enough")).toEqual(["atom.radio.7.1", "atom.radio.7.2"]);
    expect(keys(7, "ky21_where")).toEqual(["atom.radio.10.3"]);
    expect(keys(7, "why_north")).toEqual(["atom.radio.10.3"]);
    expect(keys(14, "shift_change")).toEqual(["atom.radio.19.3", "atom.radio.19.1"]); // the relief on the line (EK11 shift change 19.3, VPK move 19.1; 8 Oct 2026: the crossing moved to step 18)
    expect(keys(14, "road_crossed")).toEqual(["atom.radio.18.4", "atom.radio.19.2"]); // the stop and the crossing (re-tuned 8 Oct 2026; revision (ak): KY21's 19:00 withdrawal precedes the stop, 18.3 → 18.4)
    expect(keys(14, "infra")).toEqual(["atom.radio.16.0", "atom.radio.16.1"]); // fix pass 3: EK11's step-16 drive to W2 is gone (N1)
  });
});

describe("the option arrangement", () => {
  const it3 = (id: string, level: "L1" | "L2" | "L3"): FreezeItem => ({
    id, level, promptFi: id, kind: "choice", options: ["a", "b", "c", "d"].map((o) => ({ id: o, labelFi: o, correct: o === "a" })),
  });

  it("balances the correct position per level, keeps every option, and is deterministic for a seed", () => {
    const freezes = Array.from({ length: 8 }, (_, k) => ({ key: k, items: [it3(`x${k}`, "L1"), it3(`y${k}`, "L2")] }));
    const a = arrangeOptions(freezes, 7n), b = arrangeOptions(freezes, 7n);
    expect([...a]).toEqual([...b]);
    const pos = [...a.values()].map((items) => items[0]!.options.findIndex((o) => o.correct));
    for (let p = 0; p < 4; p++) expect(pos.filter((x) => x === p)).toHaveLength(2);
    for (const items of a.values()) for (const it of items) expect(it.options.map((o) => o.id).sort()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("projection reliance (revision (x), 6 Oct 2026; exploratory)", () => {
  const withProjection = scenario.freezes.flatMap((f) => f.items.filter((it) => it.projectionPoint).map((it) => ({ view: f.cycle as number, it })));

  it("only the head_later items whose clock the view's projection reaches carry a projectionPoint: V4 and V14 (fix pass 3: V5's hold-view item is gone)", () => {
    expect(withProjection.map(({ view, it }) => [view, it.id])).toEqual([[4, "freeze.4.head_later"], [14, "freeze.14.head_later"]]);
  });

  it("V5's area item replaces the head-later map item (fix pass 3) and the rate item (fix pass 5): still L3 and containment, the freeze still 2×L1, 2×L2, 2×L3", () => {
    const v5 = scenario.freezes.find((f) => f.cycle === 5)!;
    expect(v5.items.some((it) => it.id === "freeze.5.head_later" || it.id === "freeze.5.growth_trend")).toBe(false);
    const levels = v5.items.map((it) => it.level).sort();
    expect(levels).toEqual(["L1", "L1", "L2", "L2", "L3", "L3"]);
    expect(v5.items.find((it) => it.id === "freeze.5.area_hour")).toMatchObject({ level: "L3", kind: "choice", goal: "containment" });
  });

  it("a tap at the projection's head reads as anchored, a tap at the true head as not", async () => {
    const { projectionReliance } = await import("../../app/telemetry/freeze-measures.js");
    const { it: v4 } = withProjection.find(({ view }) => view === 4)!;
    const rec = (point: LatLon, seq: number) => ({ seq: seq as never, tVirtual: 0 as never, tWallOffsetMs: seq, kind: "freeze_submitted",
      detail: { cycle: 4, responses: [{ itemId: v4.id, optionId: "map_point", confidence: 75, point }] } });
    // One answer per item counts (8 Oct 2026: the first), so each tap is its own log.
    const out = [...projectionReliance([rec(v4.projectionPoint!, 1)], scenario.freezes), ...projectionReliance([rec(v4.mapKey!.point, 2)], scenario.freezes)];
    expect(out.map((a) => a.anchored)).toEqual([true, false]);
    expect(out[0]!.toProjectionM).toBeLessThan(1);
    expect(out[1]!.toTruthM).toBeLessThan(1);
  });
});

describe("the numeric L3 keys are REPORT-keyed (fix pass 6, D4, researcher decision 8 Oct 2026)", () => {
  it("the formula: the line through the reports of the last two steps, read at the asked clock; a growth is its slope", () => {
    // Reports of steps 3 and 4: the end of step 5 is two steps after step 4's start.
    const a3 = reportedAreaHa(3), a4 = reportedAreaHa(4);
    expect(reportedAreaAt(4, 5)).toBeCloseTo(a4 + 2 * (a4 - a3), 6);
  });

  it("keys an area, a growth and a distance on the delivered series, not on the CA truth the reports lag", () => {
    expect(reportedAreaAt(3, 4)).toBeCloseTo(reportedAreaHa(3) + 2 * (reportedAreaHa(3) - reportedAreaHa(2)), 6); // 40 minutes on: two steps
    expect(reportedGrowthHa(6)).toBeCloseTo(reportedAreaHa(6) - reportedAreaHa(5), 6);
    // The reports lag the CA: V2's reported extrapolation (18.8 ha) is below the CA's 23 ha, V4's growth (9.5 ha) far below the crown run's 23.5 ha.
    expect(reportedAreaAt(3, 4)).toBeLessThan(siteStep(4).areaHa);
    expect(reportedGrowthHa(6)).toBeLessThan(siteStep(6).areaHa - siteStep(5).areaHa);
    // V10's single detached front has no series: its reported distance less the delivered head rate, an hour on.
    expect(reportedDetachedClosingAt(13, 15, R2_LINE)).toBeCloseTo(reportedDetachedToLineM(13, R2_LINE) - siteStep(13).observedHead.rateMpm * 60, 6);
  });

  it("map and direction items stay truth-keyed: the heads, the rekindle's sector, the cabins, the wind-shifted edge", () => {
    expect(item(2, "head_later").mapKey!.point).toEqual(truthHeadAtEndOf(4));
    expect(item(14, "head_later").mapKey!.point).toEqual(truthHeadAtEndOf(20));
    expect(key(7, "rekindle_sector")).toBe(firstDetachedFrontAfter(9)!.sector);
    expect(key(5, "wind_shift")).toBe("north");
  });

  it("the report-keyed bands differ from the CA-truth ones where the reports lag (V2, V4, V10)", () => {
    const truth = (v: number, edges: readonly number[]) => edges.filter((e) => v >= e).length;
    expect(truth(reportedAreaAt(3, 4), [15, 22, 30])).not.toBe(truth(siteStep(4).areaHa, [15, 22, 30])); // 18.8 against 23 ha
    expect(truth(reportedGrowthHa(6), [5, 15, 30])).not.toBe(truth(siteStep(6).areaHa - siteStep(5).areaHa, [5, 15, 30]));
    // Revision (aj): at the key's own horizon (two hours on, step 18): the delivered rate takes the front to ~865 m, the CA to ~570 m
    // (an hour on the two were ~1105 and ~1070 m, the same band, once the rekindle grew out of the old edge).
    expect(truth(reportedDetachedClosingAt(13, 18, R2_LINE), [400, 700, 1000])).not.toBe(truth(detachedFrontToLineM(18, R2_LINE), [400, 700, 1000]));
  });
});
