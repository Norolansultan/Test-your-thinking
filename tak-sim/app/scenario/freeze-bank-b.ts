/**
 * The goal-based freeze item bank, phase B (V10, V12, V14) and the constructs both phases share
 * (SPEC/08 amendment 2 Oct 2026; conventions in `freeze-bank.ts`). V12's L2 F7 item and every
 * view's infrastructure item are added by `demo-probes.ts`. Finnish DRAFTS, for native and domain
 * review.
 *
 * `31` §3.8 (19 Oct 2026): all three phase-B freezes come at the view's end (`FREEZE_AT_VIEW_END`), so "now" is the view's end — V10
 * 17.40, V12 19.00, V14 20.00 — stated in the freeze's header, and every L3 item is re-horizoned from it (`nowStepOf`, `minutesAhead`).
 * V14's L3 items are report-keyed extrapolations without a truth band: nothing in the scenario exists after 20.00. V14's `se_front_r2`
 * (F02: answerable by recall of the step-20 road-crew lines) is a consequence item now, `head_later` (F03) a non-map item (`flare_next`),
 * `shift_meaning` (F28) a values item (`residents`), and `road_crossed` (F14) asks a consequence its stem does not contain.
 */

import { SITE_SCENARIO } from "./site-scenario.js";
import { choice, headLaterFi, inMinutesFi, minutesAhead, point, withinMinutesFi, type ItemDef } from "./freeze-bank-core.js";
import {
  bandOf, centroid, deliveredAreaAt, deliveredPointDistanceAt, detachedFrontToLineM, distanceToReportedM, distanceToTruthM, headNow, keyBand, projectedLineDistanceAt, projectionOptionFor, R2_LINE,
  radioId, reportedDetachedClosingAt, reportedDetachedToLineM, reportedLineDistanceAt, siteStep, trafficFigure, trafficId, truthHeadAtEndOf, type KeyBand,
} from "./freeze-keys.js";

const F = SITE_SCENARIO.features;

/** Crew radio key atoms, found by content (`radioId`): their indices shift whenever the radio is regenerated. */
const RADIO = {
  // Fix pass 3 (researcher decision 7 Oct 2026): at 19:20 the next shift takes over EK11's vehicle and line, and VPK returns to the line
  // with its shift changed; neither goes to the CP any more.
  ek11Relief: radioId(19, /^Vuoronvaihto klo 19\.20: seuraava vuoro otti EK11:n auton ja linjan/),
  vpkRelief: radioId(19, /^VPK: palaamme linjalle, .*vuoro vaihdettu/), // radio ST-07 (20 Oct 2026): speech, was "VPK palaa linjalle, …"
  roadStop: radioId(18, /^Palo pysähtyi metsäautotien \(Honkaharju\)/),
  roadCrossed: radioId(19, /^Palon kärki ylitti metsäautotien \(Honkaharju\)/),
  ek16ToR2: radioId(19, /^EK16: vetäydymme tielle R2/),
  policeVillage: radioId(18, /^Poliisi Lahdenkylästä: kaksi taloa kieltäytyy lähtemästä/),
};

const f1 = (n: number) => n.toFixed(1);
const f0 = (n: number) => n.toFixed(0);
const figures = (k: KeyBand, unit: string, fmt = f1) => `~${fmt(k.value)} ${unit}, ${fmt(k.margin)} ${unit} from the nearest band edge; the CA's truth ~${fmt(k.truthValue!)} ${unit}, ${k.truthId === k.id ? "the same band" : `band ${k.truthId}`}`;

/** Asked at V2 only (Mökkiranta); V12 asks `front_toward` instead (2 Oct 2026). Kept for the review tools. */
export const SETTLEMENT_PROMPT_FI = "Mihin asuttuun kohteeseen on nyt lyhin matka palon reunalta?";
export const SETTLEMENT_OPTIONS: readonly (readonly [string, string])[] = [
  ["cabins", "Mökkirannan mökkeihin"],
  ["village", "Lahdenkylään"],
  ["equal", "Molempiin on suunnilleen yhtä pitkä matka"],
  ["none", "Kolmen kilometrin säteellä ei ole asutusta"],
];
/**
 * The nearer settlement to the fire the map draws during `step` (reported perimeter and detached
 * fronts); "equal" if the two are within 300 m of each other, so a close call is never keyed.
 */
export function settlementKey(step: number): string {
  const cab = distanceToReportedM(step, F["CABINS"]!), vil = distanceToReportedM(step, F["VILLAGE"]!);
  if (Math.min(cab, vil) > 3000) return "none";
  if (Math.abs(cab - vil) < 300) return "equal";
  return cab < vil ? "cabins" : "village";
}

/**
 * V10 (now 17.40, the view's end; REPORT-keyed, D4; `31` rule (1), §3.8): the whole burnt area an hour on (18.40, the end of step 16)
 * through the reported fire the maps of V9 and V10 draw (steps 12, 13). SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): edges 143/155/167
 * (were 129/138/148, where both the reports' ~158 ha and the truth's ~164 ha fell in the open top band); both now in 155–167; the map now
 * (~154 ha) and DR3's recorded 17.35 survey (153.6 ha) are the lures, in 143–155.
 */
export const V10_AREA = keyBand(deliveredAreaAt(12, 13, 16), [143, 155, 167], ["lt143", "m143_155", "m155_167", "gt167"], 2.5, "V10 area_total_hour", { value: siteStep(16).areaHa, minMargin: 2.5 });

/**
 * V10 (REPORT-keyed, D4; `31` §3.8): the south front's distance to service road R2 an hour and 20 minutes on from the view's end (19.00,
 * the end of step 17): the map shows the front first at step 13 and DR2's pushed line gives it as "runsaan kilometrin päässä"; the drawn
 * head rate of step 13, taken as closing straight on the road, gives the key (`reportedDetachedClosingAt`). Two hours on (19.40) the CA
 * front is ~550 m from R2 while the reports give ~785 m (two bands apart); 80 minutes on the two agree. SPEC/33 stage 9 (20 Oct 2026, the
 * rebuilt map): edges 350/650/950 (were 400/700/1000, where the truth's ~746 m lay 46 m from the 700 m edge); the reports give ~869 m and
 * the truth ~746 m, both in 650–950. "Runsaan kilometrin" (~1.3 km at 17.20, over 950 m) is the lure.
 */
export const V10_R2 = keyBand(reportedDetachedClosingAt(13, 17, R2_LINE), [350, 650, 950], ["lt350", "m350_650", "m650_950", "gt950"], 50, "V10 front_r2_80", { value: detachedFrontToLineM(17, R2_LINE), minMargin: 50 });

/** The band the CA fire's distance to a settlement falls in at the end of `step` (`31` F11: ascending bands, no "already there"). */
function distanceBandKey(feature: string, step: number): string {
  const d = distanceToTruthM(step, F[feature]!);
  return d < 800 ? "lt800" : d < 1500 ? "m800_1500" : d < 2500 ? "m1500_2500" : "gt2500";
}
const DISTANCE_BANDS: readonly (readonly [string, string])[] = [["lt800", "Alle 800 metrin päässä"], ["m800_1500", "800–1500 metrin päässä"], ["m1500_2500", "1500–2500 metrin päässä"], ["gt2500", "Yli 2500 metrin päässä"]];

/**
 * V12 (now 19.00, the view's end; REPORT-keyed, D4; `31` rule (1), §3.8): Lahdenkylä's distance to the fire's edge 40 minutes on (19.40,
 * the end of step 19) through the reported fire V12's map draws (step 16) and step 17's, which DR1's pushed 18.45 thermal survey of the
 * village gives ("lähin reuna noin 2350 m"). The delivered ~2300–2350 m is the lure (over 2100 m). An hour on the truth would fall in
 * another band; at 40 minutes the two agree.
 */
const V12_DR1 = trafficFigure(17, /^DR1 lämpökuva, Lahdenkylä klo 18\.45: .*lähin reuna noin (\d+) m/);
export const V12_VILLAGE = keyBand(deliveredPointDistanceAt(16, 17, 19, F["VILLAGE"]!), [1200, 1600, 2100], ["lt1200", "m1200_1600", "m1600_2100", "gt2100"], 100, "V12 village_distance", { value: distanceToTruthM(19, F["VILLAGE"]!), minMargin: 100 });

/**
 * The retired V14 `se_front_r2` band (fix pass 7 → revision (aj)): the map's fire 20 minutes on from 19.40, 450–650 m from R2 — the band
 * the pushed step-20 road-crew lines state ("palo 600 m länteen", "Palo noin 550 m päässä"), so the item was answerable by recall (`31`
 * F02; the repaired recall guard in `freeze-bank.spec.ts` finds both). No item keys on it since `31`; kept for the projection reading's
 * check (`test/scenario/open-items-fixpass7.spec.ts`). SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): edges 150/400/650 (were 150/450/650,
 * where the map's ~487 m lay 37 m from the 450 m edge); the pushed step-20 line now states ~500 m (KY21 19.47), inside 400–650.
 */
const V14_R2_EDGES = [150, 400, 650] as const;
const V14_R2_IDS = ["lt150", "m150_400", "m400_650", "gt650"] as const;
export const V14_R2 = bandOf(reportedLineDistanceAt(20, 20, R2_LINE), V14_R2_EDGES, V14_R2_IDS, 40, "V14 se_front_r2 (retired band)");
export const V14_R2_PROJECTION = projectionOptionFor(projectedLineDistanceAt(14, 20, R2_LINE), V14_R2.id, V14_R2_EDGES, V14_R2_IDS, 40, "V14 se_front_r2 (retired band)");

/**
 * V14 `se_front_r2` (`31` F02, §3.8; REPORT-keyed, no truth after 20.00): the consequence for R2's sprinkler lines 20 minutes on from the
 * view's end. The nearest distance the pushed step-20 lines give (KY21 19.47, OUT1 19.52) less the fastest pushed rate of the south-east
 * front (DR2 19.05) times 20 minutes, against the trigger KY21's line states (water on when the fire is ~100 m away): a key only when the
 * front is still at least twice the trigger away (else the build fails: re-author). SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): EK11's
 * step-20 "ei omaa reunaa, palo … m länteen" line is no longer generated (it reports the cancelled burnout instead), so OUT1's pushed line
 * gives the second distance and KY21's own line the trigger.
 */
export const V14_SPRINKLERS = (() => {
  const ky21 = trafficFigure(20, /^Johto, KY21, tie R2: kärki ylitti metsäautotien.*palo noin (\d+) m länteen/);
  const out1 = trafficFigure(20, /^OUT1, tie R2: ei omaa reunaa, palo (\d+) m luoteeseen/);
  const rate = trafficFigure(18, /^DR2 lämpökuva, kaakkoisrintama klo 19\.05: reuna etenee kaakkoon noin (\d+,\d) m\/min/);
  const trigger = trafficFigure(20, /^Johto, KY21, tie R2: kärki ylitti metsäautotien.*vesi kytketään altaasta kun palo on noin (\d+) m päässä/);
  const nearest = Math.min(ky21.value, out1.value);
  const at20 = nearest - rate.value * minutesAhead(14, 21);
  if (at20 < 2 * trigger.value) throw new Error(`freeze key V14 se_front_r2: the front ${at20.toFixed(0)} m from R2 in 20 minutes is too near the ${trigger.value} m trigger; re-author`);
  return { key: "not_yet", nearest, rate: rate.value, trigger: trigger.value, at20, ids: [ky21.id, out1.id, rate.id] };
})();

export const PHASE_B_BANK: Readonly<Record<number, readonly ItemDef[]>> = {
  10: [
    point({
      slug: "south_front_point", level: "L1", goal: "containment", promptFi: "Merkitse kartalle eteläinen palorintama syttymäkohdan eteläpuolella.", point: centroid(siteStep(13).reportedDetached[0]!), toleranceM: 100, // fix pass 6: a 0.8 ha front, so the 200 m of an L1 item would take in the old south edge
      // Round 2 (5 Oct 2026): was "… Rahkasuolla" (the rekindle left the bog on 2 Oct 2026), and cited KY21's step-13 move,
      // which is now at step 14; DR2's step-13 line places the front instead.
      keyAtomIds: ["atom.demo.12.0", "atom.demo.13.0"], rule: "computed", basis: "the centroid of the detached front step 13 draws (reportedDetached)",
    }),
    // Fix pass 2 (7 Oct 2026, P2-4): replaces why_rekindle ("no crew in the sector"), which cued V10's no-fit decision (crew
    // the new front); an L2 item away from the new front. Since the regen (FF3) the water shuttle brings a basin to the line.
    choice({
      slug: "ek12_water", level: "L2", goal: "resources", promptFi: "Mitä EK12:n vesitilanne merkitsee sen työlle kärjen eteläsivustalla?",
      options: [
        ["brought", "EK12 jää linjalle, lisävesi tuodaan sen luo"], ["leaves", "EK12 lähtee täyttämään, sivusta jää ilman vettä"],
        ["out", "Vesi on loppu, sivustan työ keskeytyy illaksi"], ["none", "Ei vaikutusta, säiliö riittää illan loppuun asti"],
      ], key: "brought",
      keyAtomIds: [trafficId(13, /^EK12, kärki, eteläsivusta: vesi loppumassa \(25 %\)\. Pyysimme EK13:lta vesiajon/), trafficId(13, /^EK12, EK13: selvä, tuomme altaan linjanne päähän/)],
      rule: "cited", basis: "EK12 (step 13): water running low (25 %), it asked EK13 for a water run to a basin, due 17.43 (the record; was 17.41 before gate R, 20 Oct 2026); EK13 confirms it brings the basin to the end of EK12's line: the crew stays on the flank",
    }),
    choice({
      // `31` F27: "palanut ala" as V2 and V5 say, the new front's inclusion stated.
      slug: "area_total_hour", level: "L3", goal: "containment", keySteps: [14, 16], promptFi: `Kuinka suuri koko palanut ala on ${inMinutesFi(minutesAhead(10, 16))}, uusi rintama mukaan lukien?`,
      options: [["lt143", "Alle 143 hehtaaria"], ["m143_155", "143–155 hehtaaria"], ["m155_167", "155–167 hehtaaria"], ["gt167", "Yli 167 hehtaaria"]], key: V10_AREA.id,
      keyAtomIds: [], rule: "computed", basisKind: "map", basisSteps: [12, 13],
      basis: `REPORT-keyed (D4; \`31\` rule (1)): the area at the end of step 16 (18.40, an hour from the view's end) through the reported fire the maps of V9 and V10 draw (steps 12, 13), ${figures(V10_AREA, "ha")}; the map now ~154 ha and DR3's recorded 17.35 survey 153.6 ha (the lures, 143–155)`,
    }),
    choice({
      slug: "front_r2_80", level: "L3", goal: "containment", keySteps: [14, 17], promptFi: `Kuinka kaukana eteläinen palorintama on huoltotiestä R2 ${inMinutesFi(minutesAhead(10, 17))}?`,
      options: [["lt350", "Alle 350 metrin päässä"], ["m350_650", "350–650 metrin päässä"], ["m650_950", "650–950 metrin päässä"], ["gt950", "Yli 950 metrin päässä"]], key: V10_R2.id,
      keyAtomIds: [], rule: "computed", basisKind: "map", basisSteps: [13],
      basis: `REPORT-keyed (D4; \`31\` §3.8): the south front's reported distance to R2 at 17.20 (~${f0(reportedDetachedToLineM(13, R2_LINE))} m, the front step 13 draws; 'runsaan kilometrin', DR2 pushed: the lure, over 950 m) less its drawn rate (${siteStep(13).observedHead.rateMpm} m/min) × 100 min to 19.00, ${figures(V10_R2, "m", f0)}`,
    }),
    // Fix pass 2 (7 Oct 2026, P2-4): replaces south_units; researcher decision 8 Oct 2026: L2. `31` F29: the present tense (it is keyed on now
    // and on record); F11, F26: ascending bands, and "Palo on jo mökeillä" (implausible with DR1's ~1700 m) is gone.
    choice({
      slug: "cabins_distance", level: "L2", goal: "values", promptFi: "Kuinka kaukana palon reuna on nyt Mökkirannan mökeistä?",
      options: DISTANCE_BANDS, key: distanceBandKey("CABINS", 13),
      keyAtomIds: [trafficId(11, /^DR1 lämpökuva, Mökkiranta klo 16\.45: .*lähin reuna noin \d+ m/), trafficId(12, /^DR1 lämpökuva, Mökkiranta klo 17\.05: .*lähin reuna noin \d+ m/)],
      rule: "computed", basis: `CA truth distance to CABINS at the view's end (17.40, the end of step 13): ~${f0(distanceToTruthM(13, F["CABINS"]!))} m (the north edge is held); DR1 gives ~1600–1700 m at 16:45 and 17:05`,
    }),
  ],
  12: [
    choice({
      slug: "longest_shift", level: "L1", goal: "safety", promptFi: "Minkä yksikön miehistö on ollut kentällä pisimpään?",
      options: [["EK11", "Yksikkö EK11"], ["EK14", "Yksikkö EK14"], ["KY21", "Yksikkö KY21"], ["EK15", "Yksikkö EK15"]], key: "EK11",
      // EK11 6.8 h, EK14 5.3 h, KY21 4.7 h, EK15 2.3 h, found by content (3 Oct 2026: fixed ids had drifted onto drone logs).
      keyAtomIds: [trafficId(17, /EK11 \(kysyttäessä\).*6,8 h/), trafficId(17, /EK14 \(kysyttäessä\).*5,3 h/), trafficId(17, /KY21.*4,7 h/), trafficId(17, /EK15 \(kysyttäessä\).*2,3 h/)], rule: "cited",
      basis: "crew hours reported by step 17: EK11 6.8 h, EK14 5.3 h, KY21 4.7 h, EK15 2.3 h (checked against the corpus in freeze-bank.spec.ts)",
    }),
    point({
      slug: "head_now", level: "L1", goal: "containment", promptFi: "Merkitse kartalle palon kärki.", point: headNow(16),
      keyAtomIds: [], rule: "computed", basis: "the observed head step 16 draws (observedHead.anchor)",
    }),
    choice({
      // 2 Oct 2026: replaces "nearest settlement". `31` F26: "Johtopaikan" (not a settlement) gave way to a plausible wrong state.
      slug: "front_toward", level: "L2", goal: "values", promptFi: "Minkä asutuksen suuntaan kaakkoisrintama etenee?",
      options: [["village", "Lahdenkylän"], ["cabins", "Mökkirannan"], ["none", "Ei kummankaan, rintama jää metsäautotien taakse"], ["both", "Molempien, rintama leviää kahteen suuntaan"]], key: "village",
      keyAtomIds: ["atom.demo.17.1"], rule: "cited", basis: "SPOT (step 17): the head spreads south-east towards Lahdenkylä; the CA distance to VILLAGE falls 2.1 → 1.9 km over steps 16–17",
    }),
    choice({
      slug: "village_distance", level: "L3", goal: "values", keySteps: [18, 19], promptFi: `Kuinka kaukana palon reuna on Lahdenkylästä ${inMinutesFi(minutesAhead(12, 19))}?`,
      options: [["lt1200", "Alle 1200 metrin päässä"], ["m1200_1600", "1200–1600 metrin päässä"], ["m1600_2100", "1600–2100 metrin päässä"], ["gt2100", "Yli 2100 metrin päässä"]],
      key: V12_VILLAGE.id,
      keyAtomIds: [], rule: "computed", basisKind: "record", basisAtomIds: [V12_DR1.id], basisSteps: [16, 17],
      basis: `REPORT-keyed (D4; \`31\` rule (1), §3.8): the distance at the end of step 19 (19.40, 40 minutes from the view's end) through the reported fire V12's map draws (step 16) and step 17's, which DR1's pushed 18.45 survey gives (${V12_DR1.value} m), ${figures(V12_VILLAGE, "m", f0)}; the delivered ~2300–2350 m (the lure, over 2100)`,
    }),
    point({
      // `31` F03, §3.8: an hour from the view's end (20.00, the end of step 20); tolerance 250 m (phase B's head runs ~10 m/min, so an hour
      // is ~570 m from the head at 19.00: the key must lie ≥ 2 × the tolerance from it, and the scenario has no data after 20.00).
      slug: "head_later", level: "L3", goal: "containment", keySteps: [18, 20], promptFi: headLaterFi(12, 20), point: truthHeadAtEndOf(20), toleranceM: 250,
      keyAtomIds: [], rule: "computed", basisKind: "ca_truth", basis: "the CA truth head at the end of step 20 (20:00); no projectionPoint: 20.00 is beyond V12's projection (its isochrones end at 60 minutes from 18.20)",
    }),
  ],
  14: [
    choice({
      // Fix pass 3: the crews change on the line (no one goes to the CP), so the item asks whose crews changed.
      slug: "shift_change", level: "L1", goal: "safety", promptFi: "Minkä yksiköiden miehistöt vaihtuivat illan vuoronvaihdossa?",
      options: [["ek11_vpk", "EK11 ja VPK"], ["ek12_ky21", "EK12 ja KY21"], ["out", "OUT1 ja OUT2"], ["none", "Ei mitkään"]], key: "ek11_vpk",
      keyAtomIds: [RADIO.ek11Relief, RADIO.vpkRelief], rule: "cited", basis: "step 19: the next shift took over EK11's vehicle and line on R2; VPK returns to the line, its shift changed",
    }),
    choice({
      // `31` F14, F26: the consequence the stem does not contain (the next barrier and its lines), not "the road no longer stops it"; the
      // implausible "turns back onto the burned area" is gone.
      slug: "road_crossed", level: "L2", goal: "containment", promptFi: "Mitä palon eteneminen Honkaharjun metsäautotien yli merkitsee?",
      options: [
        ["r2_next", "Seuraava este kärjen edessä on tie R2 linjoineen"], ["held", "Metsäautotien linja pitää yhä kärjen eteläpuolella"],
        ["north", "Kärki kääntyy pohjoiseen kohti Mökkirantaa"], ["cut", "Vesikuljetusreitti tiellä R2 on jo katkennut"],
      ], key: "r2_next",
      keyAtomIds: [RADIO.roadStop, RADIO.roadCrossed, RADIO.ek16ToR2], rule: "cited",
      basis: "integrates the stop at the Honkaharju road (KY21, radio 18.4), the crossing in gusts (EK16, radio 19.2) and EK16's line moving to R2 (radio 19.0), with KY21's (18.0): R2, the water-shuttle road, is the next barrier ahead of the head, the crews' lines on it; R2 stays drivable (DR2's road report, recorded)",
    }),
    choice({
      // `31` F28: replaces shift_meaning (a second item on the shift change); life safety and values, after the plan (it cues nothing).
      slug: "residents", level: "L2", goal: "values", promptFi: "Mitä Lahdenkylän tilanne merkitsee tien R2 linjoille?",
      options: [
        ["people", "Kylässä on yhä asukkaita, joten linjojen on pidettävä"], ["empty", "Kylä on tyhjennetty, linjat voidaan tarvittaessa jättää"],
        ["moved", "Asukkaat on siirretty johtopaikalle, kylää ei suojata"], ["vpk", "VPK jää kylään suostuttelemaan, linja jää vajaaksi"],
      ], key: "people",
      keyAtomIds: [RADIO.policeVillage, RADIO.vpkRelief], rule: "cited",
      basis: `relates the police's pushed report (radio ${RADIO.policeVillage.slice("atom.radio.".length)}: two households refuse to leave, the police continue alone) and VPK's return to the line on R2 towards Lahdenkylä (radio ${RADIO.vpkRelief.slice("atom.radio.".length)}) to the village: people remain behind R2's lines (DR1 sees people in at least three houses, recorded 19.26 and 19.46)`,
    }),
    choice({
      // `31` F02: a consequence at a stated horizon from the view's end (20.00), report-keyed on the pushed lines; the id is kept (it is the
      // south-east front at R2) so the retired band's projection check reads on.
      slug: "se_front_r2", level: "L3", goal: "containment", keySteps: [21, 21], promptFi: `Joudutaanko tien R2 sadetinlinjojen vesi kytkemään päälle ${withinMinutesFi(minutesAhead(14, 21))}?`,
      options: [
        ["not_yet", "Ei, rintama on silloin vielä satojen metrien päässä tiestä"], ["turned", "Ei, rintama on kääntynyt pois tieltä pohjoiseen"],
        ["near", "Kyllä, rintama on silloin alle 100 metrin päässä tiestä"], ["sparks", "Kyllä, kipinät ylittävät tien ennen rintamaa"],
      ], key: V14_SPRINKLERS.key,
      keyAtomIds: [], rule: "computed", basisKind: "record", basisAtomIds: V14_SPRINKLERS.ids,
      basis: `REPORT-keyed (\`31\` F02; no truth after 20.00): the nearest pushed distance (KY21 19.47, OUT1 19.52: ${V14_SPRINKLERS.nearest} m) less the fastest pushed rate of the south-east front (DR2 19.05: ${V14_SPRINKLERS.rate} m/min) × 20 min, ~${f0(V14_SPRINKLERS.at20)} m, against the ~${V14_SPRINKLERS.trigger} m at which the sprinkler water goes on (KY21, pushed)`,
    }),
    choice({
      // `31` F03: replaces the V14 map item (head_later: the head at "now" was 168 m from its key, and no truth exists after 20.00); the
      // deciding front of V14, asked after the plan, report-keyed on the pushed records and the wind the map shows.
      // SPEC/31 (az) phase 4, finding 5 (20 Oct 2026): the cited records are its key records, so its told class is computed, not
      // assumed: both are pushed before the freeze, so it is stream-told. FOR THE DOMAIN REVIEWER: the item fails the repaired recall
      // guard (`test/scenario/freeze-bank.spec.ts`, smoke-direction wording): the pushed 19.42 line "Savu painuu kaakkoon Rahkasuon
      // suuntaan" (story 20.1) and the recorded 19.30 pass "Savu painuu kaakkoon" (story 19.3) nearly state the key "spreads south-east".
      // Kept, not deleted: the reviewer decides whether it stays (classed stream-told in H2t) or is re-authored.
      slug: "flare_next", level: "L3", goal: "containment", keySteps: [21, 23], promptFi: `Mitä syttymäkohdan länsipuolen uudelleensyttymälle todennäköisesti tapahtuu ${withinMinutesFi(minutesAhead(14, 23))}, jos sitä ei sammuteta?`,
      options: [
        ["spreads_se", "Se laajenee kaakkoon tuulen mukana"], ["spreads_nw", "Se leviää luoteeseen kohti Karhujärveä"],
        ["dies", "Se sammuu itsestään, liekit ovat matalia"], ["smoulders", "Se jää kytemään paikoilleen ilman liekkejä"],
      ], key: "spreads_se",
      keyAtomIds: ["atom.demo.19.2", "atom.demo.20.1"], rule: "cited", basisKind: "record", basisAtomIds: ["atom.demo.19.2", "atom.demo.20.1"],
      basis: "REPORT-keyed (`31` F03; no truth after 20.00; DRAFT, domain review): the flare-up still burns with visible flames, its smoke driven south-east towards Rahkasuo (story 20.1, pushed 19.42; story 19.2, pushed 19.23), in the north-westerly the map's wind arrow shows; unattended, a litter fire in that wind runs south-east (the V14 directive key's basis, `demo-directive.ts`)",
    }),
  ],
};
