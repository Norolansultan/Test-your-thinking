/**
 * The goal-based freeze item bank, VP and phase A (SPEC/08 amendment 2 Oct 2026); phase B is in
 * `freeze-bank-b.ts`. It replaces the two items every freeze repeated ("Missä yksikkö EK11
 * viimeksi raportoitiin olevan?", "Mikä lohko on tällä hetkellä eniten uhattuna?").
 *
 * Each main freeze has six items, 2×L1, 2×L2, 2×L3, with the infrastructure item (or, at V12, F7
 * as the L2 implication item) added by `demo-probes.ts`; the practice freeze has four, one per
 * format and level. Every L3 key is the CA's actual future under the current deployment (the
 * participant's orders change nothing: identical stimulus), computed in `freeze-keys.ts` or cited.
 * A merged view's map draws its FIRST step's fire and its SECOND step's units (`demo-map.ts`), and
 * every pushed item of both steps has arrived before the freeze, so "now" keys read the fire of
 * `steps[0]` and the units and reports of the last step.
 *
 * DRAFT GOAL SET AND FINNISH DRAFTS: for native-speaker and domain review (a GDTA with rescue
 * officers comes later). No item names a tool, and no option names anything not knowable at its
 * view (`test/scenario/freeze-items.spec.ts`, `freeze-bank.spec.ts`).
 */

import { SITE_SCENARIO } from "./site-scenario.js";
import { choice, headLaterFi, point, type ItemDef } from "./freeze-bank-core.js";
import { PHASE_B_BANK, SETTLEMENT_OPTIONS, SETTLEMENT_PROMPT_FI, settlementKey } from "./freeze-bank-b.js";
import {
  R1_LINE, bandOf, distanceM, distanceToLineM, distanceToTruthM, firstDetachedFrontAfter, headNow, projectionHeadAtEndOf, radioId, reportedAreaAt, reportedGrowthHa, siteStep, trafficId, truthHeadAtEndOf, unitsByDistanceToHead,
} from "./freeze-keys.js";

const F = SITE_SCENARIO.features;

/** Crew radio key atoms, found by content (`radioId`): their indices shift whenever the radio is regenerated. */
const RADIO = {
  ek11Ridge: radioId(3, /^EK11 siirtyy .*harjulle/),
  ek11Withdraws: radioId(6, /^EK11 vetäytyy .*latvapalo/),
  ek12Withdraws: radioId(6, /^EK12 vetäytyy .*palaneelle alueelle/), // review fixes (ah): to R1 in the black (was the R1/R2 junction)
  sparksRoad: radioId(7, /^Kipinät lensivät metsäautotien \(Kuusimäki\) yli/),
  sparksKorpioja: radioId(7, /^Kipinät lensivät Korpiojan yli/),
  ky21North: radioId(10, /^KY21, lohkon L3 johtaja: .*siirrän .*KY21:n ja VPK:n nyt pohjoisreunalle/), // fix pass 3: the L3 sector leader moves KY21 and VPK (FF11)
};

/** The unit nearest the head; a build error unless the next is at least twice as far, so a close call is never keyed. */
function nearestToHead(step: number, candidates: readonly string[], what: string): string {
  const [a, b] = unitsByDistanceToHead(step, candidates);
  if (!a || (b && b.m < 2 * a.m)) throw new Error(`freeze key ${what}: no clearly nearest unit, got ${JSON.stringify([a, b])}`);
  return a.unit;
}

const HEAD_NOW_FI = "Merkitse kartalle palon kärki.";

/** VP: the minutes the head needs to reach R1 at its reported rate (EK11 and DR1: 340 m, 3 m/min). */
function r1ArrivalKey(): string {
  const s = siteStep(-3);
  const minutes = distanceToLineM(headNow(-3), R1_LINE) / s.observedHead.rateMpm;
  return minutes < 15 ? "lt15" : minutes < 30 ? "m15_30" : minutes < 60 ? "m30_60" : "gt60";
}

/**
 * V2 (8 Oct 2026, researcher decision: fuel_ahead became L2, so V2 gets a true L3 in place of nearest_settlement; REPORT-keyed since fix
 * pass 6, D4): the burnt area 40 minutes from the freeze's now (14:00), at the end of step 4, as the reports delivered by step 3 imply
 * (`reportedAreaAt`: the map's reported area 10.6 → 13.3 ha, +2.7 ha per 20 minutes): ~18.8 ha, 3.2 ha from the 22 ha edge. The CA
 * burns ~23 ha by then (the reports lag it); DR3's pushed 14:15 survey gives ~12.9 ha now (the lure, under 15 ha). Edges 15/22/30
 * (were 15/20/30: 18.8 was 1.2 ha from 20, under the 2 ha margin).
 */
export const V2_AREA = bandOf(reportedAreaAt(3, 4), [15, 22, 30], ["lt15", "m15_22", "m22_30", "gt30"], 2, "V2 area_40");

/**
 * V4 (fix pass 5, 8 Oct 2026; REPORT-keyed since fix pass 6, D4): the area growth over the next 20 minutes from the freeze's now (15:00), as
 * the reports delivered by step 6 imply (`reportedGrowthHa`: the map's reported area 23.4 → 32.9 ha, the last 20 minutes' growth carried
 * on): ~9.5 ha, 4.5 ha from the 5 ha edge. The CA's crown run grows ~23.5 ha (the reports lag it; no delivered record gives that
 * growth, DR3's "23,3 ha uutta" is step 7's, V5).
 */
export const V4_GROWTH = bandOf(reportedGrowthHa(6), [5, 15, 30], ["lt5", "m5_15", "m15_30", "gt30"], 3, "V4 growth_next");
/**
 * V5 (fix pass 5; REPORT-keyed since fix pass 6, D4): the burnt area an hour from the freeze's now (15:20), at the end of step 9, as the
 * reports delivered by step 7 imply (`reportedAreaAt`: the map's reported area 32.9 → 56.7 ha, +23.8 ha per 20 minutes): ~128 ha, 18 ha from
 * the 110 ha edge. The CA burns ~121.5 ha (the same band). The map and DR3's 15:35 survey give the area now (~56 ha).
 */
export const V5_AREA = bandOf(reportedAreaAt(7, 9), [80, 110, 140], ["lt80", "m80_110", "m110_140", "gt140"], 5, "V5 area_hour");

/** V7: whether the CA fire reaches the cabins within the next hour from the freeze's now (steps 10–12; fix pass 4, was 11–13), and when. */
function cabinsReachKey(): string {
  const reached = [10, 11, 12].find((st) => distanceToTruthM(st, F["CABINS"]!) < 50);
  return reached === undefined ? "no" : reached <= 10 ? "yes30" : "yes60";
}

export const PRACTICE_BANK: readonly ItemDef[] = [
  point({
    slug: "head_now", level: "L1", goal: "containment", promptFi: HEAD_NOW_FI, point: headNow(-3),
    keyAtomIds: ["evt.vp.002", "evt.vp.008"], rule: "computed", basis: "the observed head W2 draws (observedHead.anchor)",
  }),
  choice({
    slug: "first_target", level: "L2", goal: "values", promptFi: "Mihin kohteeseen palo ehtii ensimmäisenä, jos se jatkaa nykyiseen suuntaan?",
    options: [["r1", "Tie R1"], ["cabins", "Mökkiranta"], ["village", "Lahdenkylä"], ["w1", "Haukilampi (W1)"]], key: "r1",
    keyAtomIds: ["evt.vp.002", "evt.vp.003", "evt.vp.011"], rule: "cited",
    basis: "EK11: the head runs north-east towards R1, 340 m away; Mökkiranta 2.1 km north-west, Lahdenkylä 3.0 km south-east",
  }),
  choice({
    slug: "r1_arrival", level: "L3", goal: "containment", keySteps: [-3, -3], promptFi: "Kuinka pian palon kärki saavuttaa tien R1, jos se etenee nykyistä vauhtia?",
    options: [["lt15", "Alle 15 minuutissa"], ["m15_30", "15–30 minuutissa"], ["m30_60", "30–60 minuutissa"], ["gt60", "Yli tunnin kuluttua"]], key: r1ArrivalKey(),
    keyAtomIds: [], rule: "computed", basis: "distance from the W2 head to R1 (~340 m) ÷ the reported 3 m/min ≈ 110 min; the CA head is at R1 at 13:20 (step 1)",
  }),
];

export const PHASE_A_BANK: Readonly<Record<number, readonly ItemDef[]>> = {
  2: [
    point({
      slug: "ek11_point", level: "L1", goal: "safety", promptFi: "Merkitse kartalle, missä EK11 työskentelee nyt.", point: siteStep(3).units["EK11"]!,
      keyAtomIds: [RADIO.ek11Ridge], rule: "computed", basis: "EK11's step-3 position (UNIT_PLAN: edge:RIDGE, the new ignition on the esker)",
    }),
    choice({
      // Fix pass 3 (7 Oct 2026, FF5): EK11 reports itself on the head's left (north-west) flank, judged from the wind, ~50 m from
      // it; "ahead of the head, downwind" contradicted that, so the item asks for the unit nearest the head.
      slug: "nearest_head", level: "L2", goal: "safety", promptFi: "Mikä yksikkö työskentelee nyt lähimpänä palon kärkeä?",
      options: [["EK11", "Yksikkö EK11"], ["EK12", "Yksikkö EK12"], ["EK14", "Yksikkö EK14"], ["KY21", "Yksikkö KY21"]], key: nearestToHead(3, ["EK11", "EK12", "EK14", "KY21"], "V2 nearest_head"),
      keyAtomIds: ["atom.demo.3.0", RADIO.ek11Ridge], rule: "computed", basis: "the unit nearest the step-3 head, the next at least twice as far (EK11 on the esker, on the head's left flank ~50 m from it, FF5)",
    }),
    choice({
      // Researcher decision 8 Oct 2026: kept, but L2 (comprehension), not an L3 projection: DR1's pushed report names the spruce ahead.
      slug: "fuel_ahead", level: "L2", goal: "containment", promptFi: "Millaiseen metsään palon kärki etenee seuraavan tunnin aikana?",
      // Fix pass 2 (7 Oct 2026, P1-1): the key no longer repeats DR1's "tiheä kuusikko"; the options are balanced in length.
      options: [["spruce", "Kuusivaltaiseen havumetsään"], ["birch", "Lehtipuuvaltaiseen rantametsään"], ["bog", "Avoimelle, märälle suolle"], ["clearing", "Hakkuuaukealle ja taimikkoon"]], key: "spruce",
      keyAtomIds: ["atom.demo.2.0"], rule: "cited", basis: "DR1's atom.demo.2.0 (step 2, pushed at 60 s, before the 105 s freeze; 6 Oct 2026, D2 b): dense spruce ~400 m ahead of the head (L2 since 8 Oct 2026: the key is on record; was not a key atom while L3, as an L3 key atom may only be a forecast, evt.wx.*); CYCLE_STORY 5–6: the head at the Kuusimäki spruce edge at 14:40, crown fire at 15:00; the CA head at 15:00 is within 400 m of SPR",
    }),
    // 8 Oct 2026 (researcher decision): replaces nearest_settlement (L2), so V2 keeps 2×L1, 2×L2, 2×L3 with fuel_ahead as L2.
    choice({
      slug: "area_40", level: "L3", goal: "containment", keySteps: [3, 4], promptFi: "Kuinka suuri palanut ala on 40 minuutin kuluttua?",
      options: [["lt15", "Alle 15 hehtaaria"], ["m15_22", "15–22 hehtaaria"], ["m22_30", "22–30 hehtaaria"], ["gt30", "Yli 30 hehtaaria"]], key: V2_AREA.id,
      keyAtomIds: [], rule: "computed", basis: "REPORT-keyed (D4): the reported area at the end of step 4 (14:40) by linear extrapolation of the reports delivered by step 3, ~18.8 ha, 3.2 ha from the 22 ha edge (bandOf); the CA burns ~23 ha, ~12.9 ha now (DR3, 14:15)",
    }),
    point({
      slug: "head_later", level: "L3", goal: "containment", keySteps: [3, 4], promptFi: headLaterFi(2, 4), point: truthHeadAtEndOf(4),
      keyAtomIds: [], rule: "computed", basis: "the CA truth head at the end of step 4 (14:40); no projectionPoint: 14:40 is beyond V2's projection (its isochrones end at 40 minutes)",
    }),
  ],
  4: [
    choice({
      slug: "ek12_where", level: "L1", goal: "safety", promptFi: "Missä EK12 on nyt?",
      options: [["head_s", "Kärjen eteläsivustalla"], ["spruce", "Kuusimäen kuusikon reunassa"], ["black", "Tiellä R1 palaneella alueella"], ["water", "Täyttämässä säiliötä Haukilammella"]],
      key: distanceM(siteStep(6).units["EK12"]!, F["R1_BLACK"]!) < 200 ? "black" : "head_s",
      keyAtomIds: [RADIO.ek12Withdraws], rule: "computed", basis: "EK12's step-6 position, on R1 in the burned area, the safety zone (withdrawn after the crown-fire near miss; review fixes (ah): was the R1/R2 junction, ~1 km out in unburned forest)",
    }),
    choice({
      slug: "fastest_spread", level: "L2", goal: "containment", promptFi: "Missä palo leviää nyt nopeimmin?",
      options: [["L1", "Pohjoisreunalla (lohko L1)"], ["L2", "Koillisessa (lohko L2)"], ["L3", "Eteläreunalla (lohko L3)"], ["L4", "Syttymäkohdan takana (lohko L4)"]], key: "L2",
      keyAtomIds: ["atom.demo.6.0", trafficId(6, /^DR3 lämpökuva, Kuusimäki/), trafficId(6, /^DR3 mittaus: Kuusimäen/)], rule: "cited",
      basis: "DR3: the Kuusimäki edge 14.1 m/min, flames over the crowns; the step-5 and step-6 CA growth is in L2 (checked in freeze-bank.spec.ts)",
    }),
    choice({
      slug: "work_danger", level: "L2", goal: "safety", promptFi: "Mikä tekee työskentelystä kärjen lähellä nyt vaarallisinta?",
      // Fix pass 2 (7 Oct 2026, P1-1): the key paraphrases EK12's report; "smoke covers the CP" and "every unit out of water" were absurd, now plausible.
      options: [
        ["crown", "Palo latvoissa, uusia pesäkkeitä syttyy eteen"], ["hose", "Letkulinjat ovat palaneet poikki kärjessä"],
        ["water", "Säiliöt ovat tyhjiä, eikä vettä saada kärkeen"], ["wind", "Tuuli kääntyi ja painaa paloa miehistöjä kohti"],
      ], key: "crown",
      keyAtomIds: ["atom.demo.6.0", RADIO.ek11Withdraws, RADIO.ek12Withdraws], rule: "cited", basis: "EK12: crown fire, spotting 200–400 m ahead; EK11 and EK12 withdraw (near miss)",
    }),
    // Fix pass 5 (8 Oct 2026, researcher decision): replaces rate_trend, whose key ("faster") the crown-run reports pushed at the
    // boundary stated before the freeze. A genuine projection: no delivered record gives the next 20 minutes' growth.
    choice({
      slug: "growth_next", level: "L3", goal: "containment", keySteps: [6, 6], promptFi: "Kuinka paljon palanut ala kasvaa seuraavan 20 minuutin aikana?",
      options: [["lt5", "Alle 5 hehtaaria"], ["m5_15", "5–15 hehtaaria"], ["m15_30", "15–30 hehtaaria"], ["gt30", "Yli 30 hehtaaria"]], key: V4_GROWTH.id,
      keyAtomIds: [], rule: "computed", basis: "REPORT-keyed (D4): the reported area's growth over the next 20 minutes by extrapolation of the reports delivered by step 6, ~9.5 ha, 4.5 ha from the 5 ha edge (bandOf); the CA's crown run (15:00–15:20) grows ~23.5 ha",
    }),
    point({
      // 2 Oct 2026: 15:20 (the end of the crown run, V4's own horizon), was 15:40 — with the 30 m/min run and the
      // 15:20 spot fires the 15:40 head lies ~450 m beyond the freeze map's frame (fire + 1.1 km). RESEARCHER CHECK.
      slug: "head_later", level: "L3", goal: "containment", keySteps: [6, 6], promptFi: headLaterFi(4, 6), point: truthHeadAtEndOf(6), projectionPoint: projectionHeadAtEndOf(4, 6),
      keyAtomIds: [], rule: "computed", basis: "the CA truth head at the end of step 6 (15:20, the crown run); projectionPoint: V4's 40-minute isochrone (a breach view)",
    }),
  ],
  5: [
    point({
      slug: "head_now", level: "L1", goal: "containment", promptFi: HEAD_NOW_FI, point: headNow(7),
      keyAtomIds: [], rule: "computed", basis: "the observed head step 7 draws (observedHead.anchor)",
    }),
    choice({
      slug: "spot_cause", level: "L2", goal: "containment", promptFi: "Miten palo pääsi metsäautotien ja Korpiojan yli?",
      // Fix pass 2 (7 Oct 2026, P1-1): was EK12's wording ("Kipinät lensivät yli, eikä lähellä ollut yksiköitä"), and the longest option.
      options: [
        ["spot", "Pistepaloja syttyi vartioimattomalle puolelle"], ["hose", "Letkulinja petti ja reuna pääsi ylityskohdasta"],
        ["backfire", "Vastatuli karkasi tien toiselle puolelle"], ["wind", "Tuuli kääntyi ja painoi palon reunan yli"],
      ], key: "spot",
      keyAtomIds: [RADIO.sparksRoad, RADIO.sparksKorpioja], rule: "cited", basis: "EK12: sparks flew over the Kuusimäki forest road and Korpioja; no units near",
    }),
    choice({
      slug: "units_enough", level: "L2", goal: "resources", promptFi: "Riittävätkö paikalla olevat yksiköt nyt pitämään palon kärjen?",
      options: [
        // Fix pass 2 (7 Oct 2026, P1-1): the key no longer restates EK11's request and is no longer the longest option.
        ["no", "Eivät, uusia paloja on jo linjojen takana"], ["yes", "Riittävät, linjat pitävät kärjen kohdalla"],
        ["water", "Riittävät, kunhan vedenkuljetus järjestetään"], ["stopped", "Riittävät, kärki on pysähtynyt Koivuojalle"],
      ], key: "no",
      keyAtomIds: ["atom.demo.7.0", RADIO.sparksRoad, RADIO.sparksKorpioja], rule: "cited", basis: "EK11 asks for more units; spot fires beyond the lines with no units near",
    }),
    choice({
      slug: "wind_shift", level: "L3", goal: "containment", keySteps: [7, 9], promptFi: "Mikä palon reuna aktivoituu, jos tuuli alkaa puhaltaa etelästä?",
      options: [["north", "Pohjoisreuna"], ["south", "Eteläreuna"], ["west", "Syttymäkohdan puoleinen länsiosa"], ["none", "Ei mikään, vain kärki etenee"]], key: "north",
      keyAtomIds: ["evt.wx.03", "evt.wx.02"], rule: "cited", basis: "the forecast (evt.wx.03, V4: SW -> S at 15.30-16.00; evt.wx.02 the front) and CA step 9 (wind from 160°): the new growth outside the head is in L1, north; CYCLE_STORY 9 'pohjoisreuna aktivoitunut'",
    }),
    // Fix pass 5 (8 Oct 2026, researcher decision): replaces rate_next, whose key ("slows") EK11's pushed "Latvapalo laskeutunut
    // Koivuojan koivikkoon" stated (fix pass 3 had replaced the head-at-15:40 map item). Still L3 and containment; the V5 freeze
    // still 2×L1, 2×L2, 2×L3. The area NOW is on record (the map, DR3's 15:35 survey); the hour's growth is the projection.
    choice({
      slug: "area_hour", level: "L3", goal: "containment", keySteps: [7, 9], promptFi: "Kuinka suuri palanut ala on tunnin kuluttua?",
      options: [["lt80", "Alle 80 hehtaaria"], ["m80_110", "80–110 hehtaaria"], ["m110_140", "110–140 hehtaaria"], ["gt140", "Yli 140 hehtaaria"]], key: V5_AREA.id,
      keyAtomIds: [], rule: "computed", basis: "REPORT-keyed (D4): the reported area at the end of step 9 (16:20) by extrapolation of the reports delivered by step 7, ~128 ha, 12 ha from the nearest (140 ha) edge (bandOf); the CA burns ~121.5 ha; ~56 ha now",
    }),
  ],
  7: [
    choice({
      // Fix pass 3 (7 Oct 2026): a choice item (was a map item keyed on the post-move position): KY21's radio says it is moving
      // to the north edge now, while the step-10 map symbol still shows it on the south edge by design (UNIT_PLAN stale: [10]).
      slug: "ky21_where", level: "L1", goal: "safety", promptFi: "Missä KY21 on nyt?",
      options: [
        ["north", "Siirtymässä pohjoisreunalle (lohko L1)"], ["south", "Syttymäkohdan eteläreunalla (lohko L3)"],
        ["head", "Kärjessä Koivuojan linjalla"], ["w1", "Täyttämässä säiliötä Haukilammella"],
      ], key: "north",
      keyAtomIds: [RADIO.ky21North], rule: "cited", basis: "KY21's step-10 radio (pushed before the freeze): moving to the north edge (L1) now; UNIT_PLAN edge:L1B from step 10 (its step-10 map symbol is the stale south-edge one)",
    }),
    choice({
      // Fix pass 2 (7 Oct 2026, P1-1/2): the key no longer states the smoulder-and-flare-up mechanism, which cued the H10 item
      // (rekindle_sector) and gave every participant the recorded-only objection; "the wind has no effect" is gone.
      slug: "lull_meaning", level: "L2", goal: "containment", promptFi: "Mitä tuulen heikkeneminen merkitsee palon hallinnalle nyt?",
      options: [
        ["not_out", "Reunat rauhoittuvat hetkeksi, palo ei ole ohi"], ["out", "Palo hidastuu, ja linjoja voidaan harventaa"],
        ["release", "Osa lisäyksiköistä voidaan kotiuttaa illaksi"], ["worse", "Palo kiihtyy uudella reunalla tuulen kääntyessä"],
      ], key: "not_out",
      keyAtomIds: ["atom.demo.10.0", trafficId(10, /^EK11, Koivuoja: pieni liekki sammalessa/)] /* safety re-check (ah): the drawn wording changed (was 'hehkuvaa kariketta ja pientä liekkiä'), same report */, rule: "cited",
      basis: "EK11: the wind easing and turning, smoke decreasing, sector 2 under control and sector 1 nearly (not out); EK11 at Koivuoja: glowing litter and small flames, still moving; the edges calm, the fire still burns (the CA flares up at the origin at step 12)",
    }),
    choice({
      slug: "why_north", level: "L2", goal: "values", promptFi: "Miksi yksiköitä siirrettiin pohjoisreunalle?",
      // Fix pass 2 (7 Oct 2026, P1-1): was EK14's "palo painuu sinne päin"; the options share one form and length.
      options: [
        ["cabins", "Mökkirannan loma-asunnot ovat palon tiellä"], ["village", "Lahdenkylän talot ovat palon tiellä"],
        ["road", "Tie R1 on katkennut pohjoisreunan kohdalla"], ["relief", "Pohjoisreunan miehistöt tarvitsivat lepovuoron"],
      ], key: "cabins",
      keyAtomIds: [RADIO.ky21North, trafficId(10, /EK14 .*Mökkirannan mökit tarkistettu/)], rule: "cited", basis: "KY21 moves to L1B: 'Karhujärven mökit uhattuna'; EK14 asks whether the Mökkiranta cabins are checked",
    }),
    choice({
      slug: "rekindle_sector", level: "L3", goal: "containment", keySteps: [10, 12], promptFi: "Missä lohkossa uudelleensyttymisen riski on suurin seuraavan tunnin aikana?",
      options: [["L1", "L1 Pohjoinen"], ["L2", "L2 Koillinen"], ["L3", "L3 Etelä"], ["L4", "L4 Länsi"]], key: firstDetachedFrontAfter(9)!.sector!, // fix pass 4: from the freeze's now (step 10 on), was after step 10
      keyAtomIds: [], rule: "computed", basis: "the first CA detached front after step 10: step 12, ~120 m SE of the point of origin (6 Oct 2026: anchored to the burned edge, was ~200 m ESE), L3 (the old south edge flaring up; reported in V9) — the H10 anticipation key",
    }),
    choice({
      slug: "cabins_reach", level: "L3", goal: "values", keySteps: [10, 12], promptFi: "Saavuttaako palo Mökkirannan mökit seuraavan tunnin aikana?",
      options: [["yes30", "Kyllä, puolen tunnin sisällä"], ["yes60", "Kyllä, tunnin sisällä"], ["no", "Ei, ei tunnin aikana"], ["already", "Palo on jo mökeillä"]], key: cabinsReachKey(), // fix pass 2: the key was the longest option
      keyAtomIds: [], rule: "computed", basis: "CA truth distance to CABINS at the ends of steps 10–12 (the hour from the freeze's now, 16:20; fix pass 4, was 11–13): ~1.7 km throughout",
    }),
  ],
};

/** Every view's bank items (the infrastructure item and F7 are added by `demo-probes.ts`). */
export const FREEZE_BANK: Readonly<Record<number, readonly ItemDef[]>> = { ...PHASE_A_BANK, ...PHASE_B_BANK };
