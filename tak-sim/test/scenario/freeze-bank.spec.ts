/**
 * The goal-based bank's answer keys against the frozen CA bundle and the corpus (SPEC/08
 * amendment 2 Oct 2026): the computed rules of `freeze-keys.ts`, and an independent check of every
 * cited key whose basis the data can confirm. `31` (19 Oct 2026): the recall guard repaired (it held a literal U+0008 where `\b`
 * was meant, so it never matched), with the 588908b `se_front_r2` item kept as its regression case; the re-authored items' keys.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import { UNIT_PLAN } from "../../tools/fire-ca/deployment.js";
import {
  cardinalOf, deliveredAreaAt, detachedFrontToLineM, distanceM, distanceToLineM, firstDetachedFrontAfter, headNow, inPolygon, liveFrontToLineM, R1_LINE, R2_LINE, reportedAreaAt, reportedAreaHa,
  reportedDetachedClosingAt, reportedDetachedToLineM, reportedGrowthHa, sectorOf, siteStep, trafficId, truthHeadAtEndOf, unitsByDistanceToHead,
} from "../../app/scenario/freeze-keys.js";
import { arrangeOptions, minutesAhead, nowStepOf } from "../../app/scenario/freeze-bank-core.js";
import { FREEZE_BANK, PRACTICE_BANK, V2_AREA, V2_JUNCTION, V5_AREA, VPK_RELIEF_RE } from "../../app/scenario/freeze-bank.js";
import { V10_AREA, V10_R2, V12_VILLAGE, V14_R2, V14_SPRINKLERS } from "../../app/scenario/freeze-bank-b.js";
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

  it("map keys: 'now' is the head or unit the map shows; 'at clock' is the CA head at that step's end, worded from the freeze's now", () => {
    expect(item(0, "head_now").mapKey!.point).toEqual(headNow(-3));
    expect(item(5, "head_now").mapKey!.point).toEqual(headNow(7));
    expect(item(12, "head_now").mapKey!.point).toEqual(headNow(16)); // a merged view draws its first step's fire
    expect(item(2, "ek11_point").mapKey!.point).toEqual(siteStep(3).units["EK11"]); // and its second step's units
    expect(item(2, "head_later").mapKey!.point).toEqual(truthHeadAtEndOf(5)); // `31` F03: an hour on (15.00), was 14.40
    expect(item(4, "head_later").mapKey!.point).toEqual(truthHeadAtEndOf(6));
    expect(item(12, "head_later").mapKey!.point).toEqual(truthHeadAtEndOf(20)); // `31` §3.8: now is V12's end (19.00); an hour on is 20.00
    expect(item(2, "head_later").promptFi).toMatch(/ tunnin kuluttua/); // 15:00 from 14:00
    expect(item(4, "head_later").promptFi).toMatch(/20 minuutin kuluttua/); // 15:20, the end of the crown run, from 15:00
    expect(item(12, "head_later").promptFi).toMatch(/ tunnin kuluttua/); // 20:00 from 19:00
    expect(scenario.freezes.find((f) => f.cycle === 14)!.items.some((it) => it.kind === "map_point")).toBe(false); // `31` F03: no truth after 20.00
    for (const f of scenario.freezes) for (const it of f.items) expect(it.promptFi, it.id).not.toMatch(/klo \d/);
    // "Now" is the last step's start for a freeze inside the view: every merged view's freeze falls after its step boundary.
    for (const c of scenario.cycles.filter((x) => x.stepBoundary && x.freezeAtSeconds !== null)) expect(c.freezeAtSeconds!, `V${c.index}`).toBeGreaterThan(c.minViewSeconds / 2);
  });

  it("VP: the head needs over an hour to reach R1 (≈340 m at the drawn 3.5 m/min), and the CA head is at R1 by 13:20", () => {
    expect(distanceToLineM(headNow(-3), R1_LINE)).toBeGreaterThan(300);
    expect(key(0, "r1_arrival")).toBe("gt60");
    expect(distanceToLineM(headNow(1), R1_LINE)).toBeLessThan(75); // SPEC/33 stage 9: the 13:20 head is ~53 m past R1 on the rebuilt map (DR1 "noin 50 m")
  });

  it("V2 ek11_between (`31` F10): EK11 works on the esker by the new ignition, nearest the head, which the next unit is twice as far from", () => {
    const [a, b] = unitsByDistanceToHead(3, ["EK11", "EK12", "EK14", "KY21", "VPK"]);
    expect(a!.unit).toBe("EK11");
    expect(b!.m).toBeGreaterThan(2 * a!.m);
    expect(CYCLE_STORY[3 as CycleIndex].bubbles[0]!.text).toMatch(/^Uusi savu Kuivakankaan harjulla, noin 100 m kärjestä/); // SPEC/33 stage 9: was 150 m
    expect(key(2, "ek11_between")).toBe("between");
  });

  it("V4: EK12 is on R1 in the burned area, the safety zone (review fixes (ah); was the R1/R2 junction)", () => {
    expect(distanceM(siteStep(6).units["EK12"]!, F["R1_BLACK"]!)).toBeLessThan(200);
    expect(key(4, "ek12_where")).toBe("black");
  });

  it("V14 se_front_r2 (`31` F02): 20 minutes from 20.00 the front is still hundreds of metres from R2, past twice the sprinklers' trigger; the retired 450–650 m band stays computed", () => {
    expect(V14_SPRINKLERS).toMatchObject({ key: "not_yet", nearest: 500, trigger: 100 }); // SPEC/33 stage 9: KY21 19.47 (was 550, EK11 19.43)
    expect(V14_SPRINKLERS.at20).toBeGreaterThan(2 * V14_SPRINKLERS.trigger);
    expect(key(14, "se_front_r2")).toBe("not_yet");
    expect(item(14, "se_front_r2")).toMatchObject({ level: "L3", goal: "containment", basisKind: "record" });
    expect(item(14, "se_front_r2").projectionOptionId).toBeUndefined();
    expect(V14_R2.id).toBe("m400_650"); // SPEC/33 stage 9 (was m450_650): the band the step-20 lines state: what made the old item answerable by recall
    expect(liveFrontToLineM(20, R2_LINE)).toBeLessThan(liveFrontToLineM(19, R2_LINE));
  });

  it("V7: the fire resurfaces in L3 at step 12 (the H10 anticipation key), and does not reach the cabins within the hour", () => {
    const front = firstDetachedFrontAfter(10)!;
    expect(front.step).toBe(12);
    expect(front.sector).toBe("L3");
    expect(key(7, "rekindle_sector")).toBe("L3");
    expect(item(7, "rekindle_sector").family).toBe("verification");
    expect(key(7, "cabins_reach")).toBe("no");
    // No crew on the old edge: KY21 and VPK leave it at 16:21–16:22 (their 16:20 map position is a stale report, A3); the others are elsewhere.
    for (const u of ["EK11", "EK12", "EK14"]) expect(sectorOf(siteStep(10).units[u]!), `${u} at step 10`).not.toBe("L3");
    for (const u of ["KY21", "VPK"]) { expect(UNIT_PLAN[u]!.stale).toContain(10); expect(sectorOf(siteStep(11).units[u]!), `${u} at step 11`).not.toBe("L3"); }
  });

  it("V7: KY21's key is its radioed move to the north edge; the stale south-edge option is gone (`31` F24: it cued H10's sector)", () => {
    expect(UNIT_PLAN["KY21"]!.stale).toContain(10);
    expect(sectorOf(siteStep(10).units["KY21"]!)).toBe("L3");
    expect(sectorOf(siteStep(11).units["KY21"]!)).toBe("L1");
    expect(key(7, "ky21_where")).toBe("north");
    expect(item(7, "ky21_where").options.map((o) => o.id).sort()).toEqual(["cp", "head", "north", "w1"]);
    for (const o of item(7, "ky21_where").options) expect(o.labelFi).not.toMatch(/eteläreun|lohko L3/);
  });

  it("V10 (now 17.40, the view's end): the reports put the south front 700–1000 m from R2 in an hour and 20 minutes, as the CA does; the cabins are 1.5–2.5 km from the fire now", () => {
    expect(key(10, "front_r2_80")).toBe("m650_950"); // SPEC/33 stage 9: bands 350/650/950 (were 400/700/1000)
    expect(item(10, "front_r2_80").promptFi).toMatch(/tunnin ja 20 minuutin kuluttua/);
    expect(reportedDetachedClosingAt(13, 15, R2_LINE)).toBeGreaterThan(1000); // the hour item's key was the recalled band
    expect(cardinalOf(96)).toBe("east");
    expect(cardinalOf(45)).toBeNull();
    expect(key(10, "cabins_distance")).toBe("m1500_2500");
    expect(item(10, "cabins_distance").promptFi).toMatch(/\bnyt\b/); // `31` F29: the present tense
  });

  it("settlements: at V12 the south-east front heads for Lahdenkylä, 1.6–2.1 km from it 40 minutes after the view's end", () => {
    expect(key(12, "front_toward")).toBe("village");
    expect(key(12, "village_distance")).toBe("m1600_2100");
    expect(item(12, "front_toward").options.map((o) => o.labelFi)).not.toContain("Johtopaikan"); // `31` F26
  });

  it("V14: EK11 and VPK changed crews; people remain in Lahdenkylä behind R2's lines (`31` F28)", () => {
    expect(key(14, "shift_change")).toBe("ek11_vpk");
    expect(key(14, "residents")).toBe("people");
    expect(scenario.freezes.find((f) => f.cycle === 14)!.items.map((it) => it.id)).not.toContain("freeze.14.shift_meaning");
  });
});

describe("every L3 key forecasts from the freeze's now (fix pass 4, 7 Oct 2026; `31` §3.8)", () => {
  it("each L3 item's key interval starts at the freeze's now step (the view's last step, or the step after it for a view-end freeze), and a head-later item's ends at its prompt's clock", () => {
    const defs = [...Object.entries(FREEZE_BANK).flatMap(([v, ds]) => ds.map((d) => ({ v: Number(v), d }))), ...PRACTICE_BANK.map((d) => ({ v: 0, d }))];
    expect(nowStepOf(10)).toBe(14); // 17.40
    expect(nowStepOf(12)).toBe(18); // 19.00
    expect(nowStepOf(14)).toBe(21); // 20.00
    expect(nowStepOf(2)).toBe(3); // 14.00, inside the view
    for (const { v, d } of defs.filter((x) => x.d.level === "L3")) {
      expect(d.keySteps, `V${v} ${d.slug}`).toBeDefined();
      const now = v === 0 ? -3 : nowStepOf(v);
      expect(d.keySteps![0], `V${v} ${d.slug}`).toBe(now);
      expect(d.keySteps![1], `V${v} ${d.slug}`).toBeGreaterThanOrEqual(now);
      if (d.slug === "head_later") expect(minutesAhead(v, d.keySteps![1]), `V${v}`).toBe((d.keySteps![1] - now + 1) * 20);
    }
  });

  it("the re-keyed intervals: V7's rekindle within steps 10–12 and the cabins not reached; V10's front within 80 minutes of 17.40", () => {
    expect(firstDetachedFrontAfter(9)!.step).toBeLessThanOrEqual(12);
    expect(key(7, "cabins_reach")).toBe("no");
    expect(minutesAhead(10, 17)).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// The recall guard (fix pass 5, 8 Oct 2026; repaired `31` §1, 19 Oct 2026): no L3 key may be stated by a record on hand before the
// freeze. It reads every atom of the view's steps up to its last, pushed or recorded — the pushed records of the view's LAST step too,
// which arrive when that step starts (all of them before a freeze at the view's end).
// ---------------------------------------------------------------------------

const atomText = (a: (typeof scenario.atoms)[number]) => ("text" in a.record ? String(a.record.text) : "content" in a.record ? String(a.record.content) : "");
/** Every atom of the view's steps up to its last (pushed or recorded): a superset of what the participant can have seen by the freeze. */
const onHand = (view: number) => {
  const last = view === 0 ? -3 : MAIN_VIEWS.find((v) => v.index === view)!.steps.at(-1)!;
  return scenario.atoms.filter((a) => Number(a.cycle) <= last && (view !== 0 || Number(a.cycle) === -3)).map((a) => ({ id: a.id, text: atomText(a) }));
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
/**
 * Per L3 choice item: the subject a stating record must name and, where a record states the very quantity keyed, its number (capture 1),
 * read instead of every number the record holds; or a pattern that would state a non-numeric key. Every pattern is case-insensitive
 * (`31`: the guard's distance pattern held a literal backspace where `\b` was meant, and "Palo noin 550 m" begins with a capital).
 */
type Check = { readonly subject: RegExp; readonly value?: RegExp } | { readonly states: RegExp };
const CHECKS: Readonly<Record<string, Check>> = {
  r1_arrival: { subject: /R1/i },
  area_hour: { subject: /palanut ala/i, value: /palanut ala noin (\d+(?:,\d+)?) ha/gi },
  area_40: { subject: /palanut ala/i, value: /palanut ala noin (\d+(?:,\d+)?) ha/gi },
  area_total_hour: { subject: /palanut ala/i, value: /palanut ala noin (\d+(?:,\d+)?) ha/gi },
  wind_shift: { states: /pohjoisreuna\w* (aktivoi|kiihty)/i },
  rekindle_sector: { states: /syttyi uudelleen|syttynyt uudelleen|uudelleensyttymä/i },
  cabins_reach: { states: /mökeill|mökit palav|palo (on )?mökeillä/i },
  front_r2_80: { subject: /R2/i },
  village_distance: { subject: /Lahdenkyl/i },
  spruce_behaviour: { states: /latva/i }, // no record to step 3 names a crown fire
  junction_hour: { subject: /risteyk|risteys/i },
  return_danger: { states: /pistepalo\w*[^.]*(takana|taakse)|\bPP1\b/i }, // no record to step 6 names a spot fire behind a crew
  crown_drops: { states: /latvapalo laskeutu|Koivuoj|koivik|lehtimets/i }, // Koivuoja is first on record at step 7 ("savu laskeutuu" is smoke)
  korpioja_spot: { states: /Korpioj/i },
  ek14_shelter: { states: /EK14[^.]*(?:vetäyty|turva-alue|turvaan)/i },
  road_jump: { states: /toisessa kohdassa|toisessakin kohdassa/i },
  cp_safe: { states: /johtopaik\w*[^.]*(?:turvassa|uhattu|vaarassa|ei tarvitse siirt)|ei paloa näköetäisyydellä/i },
  relief_next: { states: /VPK[^.]*(?:lepo|korvaav|vuoronvaih)/i },
  // `31` F02: the consequence for R2's sprinklers 20 minutes on: no record says the water went on or that the front stayed far.
  se_front_r2: { states: /satojen metrien|sadettim\w* (?:on )?kytketty|vesi kytkettiin/i },
  // `31` F03: the flare-up's spread. SPEC/31 (az) phase 4, finding 5 (20 Oct 2026): the guard also sees the smoke's direction in a
  // record about the flare-up ("… länsipuolen uusi palo … Savu painuu kaakkoon"), which nearly states the key "spreads south-east".
  flare_next: { states: /(?:uudelleensyttym|länsipuolen (?:uusi )?palo)\w*(?:[^.]*(?:laajen|levi|etene)\w*[^.]*kaakko|[\s\S]*savu\w* (?:painuu|kulkee|ajautuu|leviää|menee) kaakko)/i },
};
/**
 * L3 items the guard flags that stay in the bank for the domain reviewer, each marked so in its comment in the bank (never a silent
 * exemption): the stating records are pinned, so a new one, or the item's repair, shows here.
 */
const FOR_DOMAIN_REVIEW: Readonly<Record<string, readonly string[]>> = {
  // V14: SPOT's recorded 19.30 pass and its pushed 19.42 line give the flare-up's smoke south-east (story 19.3, 20.1).
  "freeze.14.flare_next": ["atom.demo.19.3", "atom.demo.20.1"],
};

/** The records on hand at a view's freeze that state an L3 choice item's key, by the item's check. */
function recallHits(view: number, it: FreezeItem, check: Check): { id: string; text: string }[] {
  const texts = onHand(view);
  if ("states" in check) return texts.filter((t) => check.states.test(t.text));
  const b = band(it.options.find((o) => o.correct)!.labelFi);
  const values = (t: string) => (check.value ? [...t.matchAll(check.value)].map((m) => Number(m[1]!.replace(",", "."))) : stated(t, b.unit));
  return texts.filter((t) => check.subject.test(t.text) && values(t.text).some((v) => v >= b.lo && v < b.hi));
}

describe("no L3 key is stated by a record on hand before the freeze (fix pass 5, 8 Oct 2026; repaired `31` §1, 19 Oct 2026)", () => {
  it("covers every L3 choice item, and no record on hand states its key", () => {
    for (const f of [scenario.practice.freeze, ...scenario.freezes]) {
      for (const it of f.items.filter((x) => x.level === "L3" && (x.kind ?? "choice") === "choice")) {
        const check = CHECKS[it.id.split(".").at(-1)!];
        expect(check, `${it.id}: no check`).toBeDefined();
        if (!check) continue;
        const hits = recallHits(f.cycle, it, check);
        if (FOR_DOMAIN_REVIEW[it.id]) expect(hits.map((h) => h.id), it.id).toEqual(FOR_DOMAIN_REVIEW[it.id]);
        else expect(hits.map((h) => h.text), it.id).toEqual([]);
      }
    }
  });

  it("V14 flare_next (SPEC/31 (az) phase 4, finding 5): its key records are the pushed records its basis cites, so its told class is computed; the smoke-direction wording fails the guard (marked for the domain reviewer)", () => {
    const flare = item(14, "flare_next");
    expect(flare.keyAtomIds).toEqual(["atom.demo.19.2", "atom.demo.20.1"]);
    expect(flare.keyAtomIds).toEqual(flare.basisAtomIds);
    for (const id of flare.keyAtomIds!) expect(scenario.atoms.find((a) => a.id === id)!.tier, id).toBe("T1_pushed"); // so stream-told when shown
    // Before the extension the guard saw only spread wording ("laajenee … kaakkoon"), which no record states; the smoke's direction it now sees.
    const spreadOnly = { states: /(?:uudelleensyttym|länsipuolen (?:uusi )?palo)\w*[^.]*(?:laajen|levi|etene)\w*[^.]*kaakko/i };
    expect(recallHits(14, flare, spreadOnly)).toEqual([]);
    expect(recallHits(14, flare, CHECKS["flare_next"]!).map((h) => h.id)).toEqual(["atom.demo.19.3", "atom.demo.20.1"]);
    expect(key(14, "flare_next")).toBe("spreads_se"); // the key unchanged
  });

  it("the repaired guard catches the item it was blind to: 588908b's V14 se_front_r2 (450–650 m from R2 in 20 minutes), stated by both pushed step-20 lines", () => {
    // The item as it stood at 588908b (and at 7394df8), with the guard's check of then, repaired.
    const legacy: FreezeItem = {
      id: "freeze.14.se_front_r2", level: "L3", kind: "choice", promptFi: "Kuinka kaukana kaakkoisrintama on huoltotiestä R2 20 minuutin kuluttua?",
      options: [["lt150", "Alle 150 metrin päässä"], ["m150_450", "150–450 metrin päässä"], ["m450_650", "450–650 metrin päässä"], ["gt650", "Yli 650 metrin päässä"]].map(([id, labelFi]) => ({ id: id!, labelFi: labelFi!, correct: id === "m450_650" })),
    };
    const hits = recallHits(14, legacy, { subject: /R2|tie/i, value: /\bpalo (?:noin )?(\d+) m/gi }).map((h) => h.id);
    // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): the step-20 lines that state the band are now KY21's pushed 19.47 line ("palo noin
    // 500 m länteen") and DR2's recorded 19.47 road report ("palo noin 500 m tiestä"); EK11's "palo 600 m länteen" is no longer generated.
    const ky21 = trafficId(20, /^Johto, KY21, tie R2: kärki ylitti metsäautotien.*palo noin 500 m länteen/);
    const dr2 = trafficId(20, /^DR2 tiehavainto: tie R2 metsäautotien risteyksessä, palo noin 500 m tiestä/);
    expect(hits).toEqual(expect.arrayContaining([ky21, dr2]));
    expect(scenario.atoms.find((a) => a.id === ky21)!.tier).toBe("T1_pushed");
    // The guard's source holds no control character any more.
    expect(String(CHECKS["area_hour"] && (CHECKS["area_hour"] as { value: RegExp }).value.source)).not.toMatch(/[\u0000-\u001f]/);
  });

  it("the report-keyed projections key with a margin from every band edge, and the fire model's truth falls in the same band (`31` §3.5 rule (5))", () => {
    for (const [name, k, id, margin] of [
      ["V2 area_40", V2_AREA, "m20_35", 2], ["V2 junction_hour", V2_JUNCTION, "m400_700", 50], ["V5 area_hour", V5_AREA, "m140_190", 5], // SPEC/33 stage 9: re-keyed
      ["V10 area_total_hour", V10_AREA, "m155_167", 2.5], ["V10 front_r2_80", V10_R2, "m650_950", 50], ["V12 village_distance", V12_VILLAGE, "m1600_2100", 100],
    ] as const) {
      expect(k.id, name).toBe(id);
      expect(k.margin, name).toBeGreaterThanOrEqual(margin);
      expect(k.truthId, name).toBe(k.id);
    }
    for (const f of scenario.freezes) for (const it of f.items) expect(it.truthOptionId, it.id).toBeUndefined(); // no dual key needed
    for (const [v, slug] of [[5, "area_hour"], [10, "front_r2_80"], [12, "village_distance"]] as const) expect(item(v, slug).level).toBe("L3");
  });
});

describe("the cited keys hold against the data", () => {
  it("V2 spruce: the head reaches the Kuusimäki spruce edge (step 5) and crowns (step 6)", () => {
    expect(distanceM(truthHeadAtEndOf(5), F["SPR"]!)).toBeLessThan(400);
    expect(CYCLE_STORY[5 as CycleIndex].bubbles[0]!.text).toMatch(/kuusikon reunalla/);
    expect(CYCLE_STORY[6 as CycleIndex].bubbles[0]!.text).toMatch(/Latvapalo/);
    expect(key(2, "spruce_behaviour")).toBe("crown");
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

  it("V14 road crossed: the head stopped at the Honkaharju road (radioed at step 18), crossed it (step 19), and the lines moved to R2 — the next barrier", () => {
    expect(SITE_SCENARIO.radio.some((r) => r.cycle === 18 && /^Palo pysähtyi metsäautotien \(Honkaharju\)/.test(r.text))).toBe(true);
    expect(SITE_SCENARIO.radio.some((r) => r.cycle === 19 && /^Palon kärki ylitti metsäautotien \(Honkaharju\)/.test(r.text))).toBe(true);
    expect(SITE_SCENARIO.radio.some((r) => r.cycle === 19 && /^EK16: vetäydymme tielle R2 .*linja siirtyy tielle R2/.test(r.text))).toBe(true);
    expect(key(14, "road_crossed")).toBe("r2_next");
    // `31` F14: the key is a consequence the stem does not contain.
    expect(item(14, "road_crossed").promptFi).not.toMatch(/R2|este/);
  });

  it("crew radio keys found by content resolve to the records the fixed ids named on the 6 Oct 2026 bundle", () => {
    const keys = (view: number, slug: string) => (item(view, slug).keyAtomIds ?? []).filter((id) => id.startsWith("atom.radio."));
    expect(keys(2, "ek11_point")).toEqual(["atom.radio.3.0"]);
    expect(keys(2, "ek11_between")).toEqual(["atom.radio.3.0"]);
    expect(keys(4, "ek12_where")).toEqual(["atom.radio.6.1"]);
    expect(keys(4, "head_unattended")).toEqual(["atom.radio.6.0", "atom.radio.6.1"]);
    expect(keys(5, "lines_breached")).toEqual(["atom.radio.7.2"]); // SPEC/33 stage 9: the Korpioja crossing only; gate R (R1): 7.2, VPK's return from W1 (7.0) now goes out in step 7
    expect(keys(7, "ky21_where")).toEqual(["atom.radio.10.3"]);
    expect(keys(7, "north_help")).toEqual(["atom.radio.10.3", "atom.radio.10.4", "atom.radio.10.1"]);
    expect(keys(14, "shift_change")).toEqual(["atom.radio.19.3", "atom.radio.19.1"]); // the relief on the line (EK11 shift change 19.3, VPK move 19.1)
    expect(keys(14, "road_crossed")).toEqual(["atom.radio.18.4", "atom.radio.19.2", "atom.radio.19.0"]); // the stop, the crossing, EK16 to R2
    expect(keys(14, "residents")).toEqual(["atom.radio.18.6", "atom.radio.19.1"]); // the police on the two households (18.6 since `31` D8 put EK16's LCES line at 18.5), VPK back to R2
    expect(keys(14, "infra")).toEqual(["atom.radio.16.0", "atom.radio.16.1"]); // fix pass 3: EK11's step-16 drive to W2 is gone (N1)
  });

  it("V7 relief_next (`31` F19): keyed on pushed records — VPK has been on scene longest after EK11, and asks for relief in V8", () => {
    expect(key(7, "relief_next")).toBe("VPK");
    expect(SITE_SCENARIO.traffic.some((t) => t.cycle === 11 && t.tier === "T1_pushed" && VPK_RELIEF_RE.test(t.content))).toBe(true); // gate R (R1): either wording
    for (const id of item(7, "relief_next").basisAtomIds ?? []) {
      const a = scenario.atoms.find((x) => x.id === id)!;
      expect(a.tier, id).toBe("T1_pushed");
      expect(Number(a.cycle), id).toBeLessThanOrEqual(10);
    }
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

  it("`31` F11: an ordinal band item keeps its ascending order, takes no part in the balance and moves no other item; a descending one fails the build", () => {
    const bands = (id: string, ids: readonly string[]): FreezeItem => ({ id, level: "L3", promptFi: id, kind: "choice", options: ids.map((o, i) => ({ id: o, labelFi: o, correct: i === 1 })) });
    const plain = [{ key: 0, items: [it3("x0", "L3"), it3("x1", "L3")] }];
    const withBand = [{ key: 0, items: [it3("x0", "L3"), bands("b", ["lt5", "m5_15", "m15_30", "gt30"]), it3("x1", "L3")] }];
    const a = arrangeOptions(plain, 7n).get(0)!, b = arrangeOptions(withBand, 7n).get(0)!;
    expect(b[1]!.options.map((o) => o.id)).toEqual(["lt5", "m5_15", "m15_30", "gt30"]);
    expect([b[0], b[2]]).toEqual(a);
    expect(() => arrangeOptions([{ key: 0, items: [bands("d", ["gt30", "m15_30", "m5_15", "lt5"])] }], 7n)).toThrow(/ascending/);
  });
});

describe("projection reliance (revision (x), 6 Oct 2026; exploratory)", () => {
  const withProjection = scenario.freezes.flatMap((f) => f.items.filter((it) => it.projectionPoint).map((it) => ({ view: f.cycle as number, it })));

  it("only the head_later items whose clock the view's projection reaches carry a projectionPoint: V4 (`31` F03: V14's map item is gone)", () => {
    expect(withProjection.map(({ view, it }) => [view, it.id])).toEqual([[4, "freeze.4.head_later"]]);
  });

  it("V5's area item: still L3 and containment, the freeze 2×L1, 2×L2, 4×L3 (SPEC/30 §5.1)", () => {
    const v5 = scenario.freezes.find((f) => f.cycle === 5)!;
    expect(v5.items.some((it) => it.id === "freeze.5.head_later" || it.id === "freeze.5.growth_trend")).toBe(false);
    const levels = v5.items.map((it) => it.level).sort();
    expect(levels).toEqual(["L1", "L1", "L2", "L2", "L3", "L3", "L3", "L3"]);
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

describe("the numeric L3 keys are REPORT-keyed (fix pass 6, D4) on DELIVERED reports (`31` §3.5 rule (1))", () => {
  it("the formula: the line through the reports of two delivered steps, read at the asked clock; a growth is its slope", () => {
    const a1 = reportedAreaHa(1), a2 = reportedAreaHa(2);
    expect(deliveredAreaAt(1, 2, 4)).toBeCloseTo(a2 + 3 * (a2 - a1), 6); // 14.40 is three steps after step 2's start
    const a4 = reportedAreaHa(4), a3 = reportedAreaHa(3);
    expect(reportedAreaAt(4, 5)).toBeCloseTo(a4 + 2 * (a4 - a3), 6); // the consecutive-step form (fix pass 6) is the special case
    expect(deliveredAreaAt(5, 7, 9)).toBeCloseTo(reportedAreaHa(7) + 3 * (reportedAreaHa(7) - reportedAreaHa(5)) / 2, 6); // a gap of two steps
    expect(reportedGrowthHa(6)).toBeCloseTo(reportedAreaHa(6) - reportedAreaHa(5), 6);
    // V10's single detached front has no series: its reported distance less the drawn head rate.
    expect(reportedDetachedClosingAt(13, 15, R2_LINE)).toBeCloseTo(reportedDetachedToLineM(13, R2_LINE) - siteStep(13).observedHead.rateMpm * 60, 6);
  });

  it("map and direction items stay truth-keyed: the heads, the rekindle's sector, the cabins, the wind-shifted edge", () => {
    expect(item(2, "head_later").mapKey!.point).toEqual(truthHeadAtEndOf(5));
    expect(item(12, "head_later").mapKey!.point).toEqual(truthHeadAtEndOf(20));
    expect(key(7, "rekindle_sector")).toBe(firstDetachedFrontAfter(9)!.sector);
    expect(key(5, "wind_shift")).toBe("north");
  });

  it("`31` F01: V4's growth item is gone — the reports' growth and the crown run's could share no band (the reports lag the run four-fold)", () => {
    expect(scenario.freezes.find((f) => f.cycle === 4)!.items.map((it) => it.id)).not.toContain("freeze.4.growth_next");
    const delivered = deliveredAreaAt(4, 5, 6) - reportedAreaHa(5) - (reportedAreaHa(5) - reportedAreaHa(4)); // the drawn 20 minutes' growth carried on
    expect(siteStep(6).areaHa - siteStep(5).areaHa).toBeGreaterThan(3 * (reportedAreaHa(5) - reportedAreaHa(4)));
    expect(Number.isFinite(delivered)).toBe(true);
    // At V10's two hours the reports and the CA were two bands apart; at 80 minutes they agree (`front_r2_80`).
    const bandIx = (v: number) => [350, 650, 950].filter((e) => v >= e).length; // SPEC/33 stage 9: the re-keyed edges
    expect(bandIx(reportedDetachedClosingAt(13, 19, R2_LINE))).not.toBe(bandIx(detachedFrontToLineM(19, R2_LINE)));
    expect(bandIx(reportedDetachedClosingAt(13, 17, R2_LINE))).toBe(bandIx(detachedFrontToLineM(17, R2_LINE)));
  });
});
