/**
 * The goal-based freeze item bank, phase B (V10, V12, V14) and the constructs both phases share
 * (SPEC/08 amendment 2 Oct 2026; conventions in `freeze-bank.ts`). V12's L2 F7 item and every
 * view's infrastructure item are added by `demo-probes.ts`. Finnish DRAFTS, for native and domain
 * review.
 */

import { SITE_SCENARIO } from "./site-scenario.js";
import { choice, headLaterFi, inMinutesFi, minutesAhead, point, type ItemDef } from "./freeze-bank-core.js";
import {
  bandOf, centroid, distanceToReportedM, R2_LINE, distanceToTruthM, headNow, projectionHeadAtEndOf, radioId, reportedAreaAt, reportedDetachedClosingAt, reportedLineDistanceAt, reportedPointDistanceAt,
  projectedLineDistanceAt, projectionOptionFor, siteStep, trafficId, truthHeadAtEndOf,
} from "./freeze-keys.js";

const F = SITE_SCENARIO.features;

/** Crew radio key atoms, found by content (`radioId`): their indices shift whenever the radio is regenerated. */
const RADIO = {
  // Fix pass 3 (researcher decision 7 Oct 2026): at 19:20 the next shift takes over EK11's vehicle and line, and VPK returns to the line
  // with its shift changed; neither goes to the CP any more.
  ek11Relief: radioId(19, /^Vuoronvaihto klo 19\.20: seuraava vuoro otti EK11:n auton ja linjan/),
  vpkRelief: radioId(19, /^VPK palaa linjalle, .*vuoro vaihdettu/),
};

/** Asked at V2 only (Mökkiranta); V12 asks `front_toward` instead (2 Oct 2026). */
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
 * V10 (8 Oct 2026, researcher decision: cabins_distance became L2, so V10 gets a true L3 in place of r2_meaning; REPORT-keyed since fix pass
 * 6, D4): the burnt area of the whole fire an hour from the freeze's now (17:20), at the end of step 15, as the reports delivered by step 13
 * imply (`reportedAreaAt`: the map's reported area 128.2 to 128.9 ha, +0.7 ha per 20 minutes): ~131 ha, 4 ha from the 127 and 135 ha edges.
 * The CA burns ~133.6 ha; DR3's 17:35 survey gives ~126 ha now (the lure, under 127). Edges 127/135/145 (were 125/130/140: 131 was 1 ha
 * from 130, under the 3 ha margin, and the survey's 126.1 may not lie in the key's band).
 */
// Fix pass 7 (9 Oct 2026): L4 secured at 16:40 (not 16:20) leaves DR3's 17:35 survey at 127.8 ha now, inside the old 127–135 band, and
// the key at ~131.8 ha; the lower edge moves to 128, so the figure on record is a lure (under 128) and the key keeps 3.2 ha from 135.
// Review fixes (ah), 9 Oct 2026: with the re-authored winds the key is ~130.5 ha (was ~131.8), 2.5 ha from 128; the edges move to
// 127/134/144 (margins 3.5 and 3.5 ha), and DR3's 17:35 survey (125.9 ha) stays the lure, under 127.
export const V10_AREA = bandOf(reportedAreaAt(13, 15), [127, 134, 144], ["lt127", "m127_134", "m134_144", "gt144"], 3, "V10 area_total_hour");

/**
 * V10 (fix pass 5, 8 Oct 2026; REPORT-keyed since fix pass 6, D4): the south front's distance to service road R2 an hour from the freeze's
 * now (17:20), at the end of step 15. The map shows the front first at step 13 (~1327 m from R2) and DR2's pushed line gives it as "runsaan
 * kilometrin päässä"; with the delivered head rate (3.5 m/min, taken as closing straight on the road) it is still ~1117 m an hour on
 * (`reportedDetachedClosingAt`), 117 m from the 1 km edge. The CA front closes to ~902 m (the reports lag it).
 */
// Fix pass 7 (9 Oct 2026, researcher's open item "V10 has no genuine L3"): an hour on, the reported front is still over a kilometre
// from R2 — the band DR2's pushed "runsaan kilometrin päässä" already names, so the hour item could be answered by recall. Two hours on
// (the end of step 18, 19:20) the delivered rate takes it to ~907 m, a band no record names: only projecting the reports answers it.
export const V10_R2 = bandOf(reportedDetachedClosingAt(13, 18, R2_LINE), [400, 700, 1000], ["lt400", "m400_700", "m700_1000", "gt1000"], 50, "V10 front_r2_2h");

/**
 * The band the CA fire's distance to a settlement falls in at the end of `step`: V12 Lahdenkylä at 19:40 (bands
 * widened 2 Oct 2026: the rekindled front starts at the origin, ~1.6 km out at 19:40), V10 Mökkiranta at 18:20.
 */
function distanceBandKey(feature: string, step: number): string {
  const d = distanceToTruthM(step, F[feature]!);
  return d < 50 ? "in" : d < 800 ? "lt800" : d < 1500 ? "m800_1500" : "m1500_2500";
}
const DISTANCE_BANDS: readonly (readonly [string, string])[] = [["lt800", "Alle 800 metrin päässä"], ["m800_1500", "800–1500 metrin päässä"], ["m1500_2500", "1500–2500 metrin päässä"]];

/**
 * V12 (8 Oct 2026, after the researcher's fire-model change; REPORT-keyed since fix pass 6, D4): Lahdenkylä at 19:40 is ~1.7 km from the CA
 * fire while DR1 and VPK give ~2300 m at 18:45; the bands keep that reported distance a lure and key the projection:
 * the reported fire's edge closes on the village by ~174 m per 20 minutes (the map's 2475 to 2301 m, steps 16-17), so ~1776 m an hour
 * on (`reportedPointDistanceAt`), 176 m from the 1600 m edge. The CA's own distance is ~1737 m (the same band). Edges 1200/1600/2000 m
 * (were 1/2 km and a village option): with 2.3 km delivered and 9 m/min, "under a kilometre" and "already in the village" were impossible
 * in an hour (at most 540 m on); the options now are a surge (under 1200 m), the key, and a front that stalls (over 2000 m).
 * Revision (aj), 9 Oct 2026: with the rekindle grown out of the old edge the key is ~1920 m, 80 m from the 2000 m edge; the upper edge
 * moves to 2100 m (180 m from the key, 320 m from the 1600 m edge).
 */
export const V12_VILLAGE = bandOf(reportedPointDistanceAt(17, 19, F["VILLAGE"]!), [1200, 1600, 2100], ["lt1200", "m1200_1600", "m1600_2100", "gt2100"], 100, "V12 village_distance");

/**
 * V14 (fix pass 5, 8 Oct 2026, replaces growth_trend, whose series the Tilannekuva records stated; REPORT-keyed since fix pass 6, D4): the
 * south-east front's distance to service road R2 at the end of step 20 (20:00), 20 minutes from the freeze's now. The records give the
 * distance now (KY21 "palo 400 m länteen", DR2 "palo noin 380 m tiestä": the lure); the map's reported fire closes by 125 m per 20 minutes
 * (479 to 354 m, steps 19-20), so ~229 m at 20:00 (`reportedLineDistanceAt`), 71 m from the 150 and 300 m edges. The CA front is at ~237 m.
 */
// Fix pass 7 (9 Oct 2026, the projection-direction key): edges 150/275/450 (were 150/300/500) so the view's projection at 20:00 (its
// 40-minute isochrone, ~323 m from R2) falls in another band than the report-keyed ~229 m, with margins of 46 and 48 m: the item now
// also reads projection reliance (`projectionOptionId`, `projectionOptionFor` in `freeze-keys.ts`). The records' 380–400 m now lie in the projection's band.
// Review fixes (ah), 9 Oct 2026: with the re-authored winds the report-keyed value is ~316 m (the map's fire 549 → 433 m from R2 over
// steps 19-20) and the projection's 40-minute isochrone ~453 m (step 20's envelope rate 7 → 4 m/min, `scenario-18.ts`, so the two bands
// stay apart); edges 150/380/600 give margins of 64 and 72 m, and the records' ~430–600 m now lie in the projection's band, as before.
// Revision (aj), 9 Oct 2026: the rekindle grows out of the old edge and the re-tuned front (steps 14, 17, 19) reaches R2 a step later:
// the map's fire 568 → 557 m from R2 over steps 19–20, so the report-keyed value is ~546 m; the projection's 40-minute isochrone ~568 m
// and the records ~550–580 m lie in the same band. Edges 150/450/650 (margins 96 and 82 m). The projection option (fix pass 7) is
// therefore null for this item until the researcher re-designs it: the report, the projection and the records all give 450–650 m.
const V14_R2_EDGES = [150, 450, 650] as const;
const V14_R2_IDS = ["lt150", "m150_450", "m450_650", "gt650"] as const;
export const V14_R2 = bandOf(reportedLineDistanceAt(20, 20, R2_LINE), V14_R2_EDGES, V14_R2_IDS, 40, "V14 se_front_r2");
export const V14_R2_PROJECTION = projectionOptionFor(projectedLineDistanceAt(14, 20, R2_LINE), V14_R2.id, V14_R2_EDGES, V14_R2_IDS, 40, "V14 se_front_r2");

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
      rule: "cited", basis: "EK12 (step 13): water running low (25 %), it asked EK13 for a water run to a basin, due 17.41; EK13 confirms it brings the basin to the end of EK12's line: the crew stays on the flank",
    }),
    // Fix pass 5 (8 Oct 2026, researcher decision): replaces front_direction, whose key ("east") DR2's pushed 17:21 line stated.
    // 8 Oct 2026 (researcher decision): replaces r2_meaning (L2), so V10 keeps 2×L1, 2×L2, 2×L3 with cabins_distance as L2.
    choice({
      slug: "area_total_hour", level: "L3", goal: "containment", keySteps: [13, 15], promptFi: "Kuinka suuri koko palon pinta-ala on tunnin kuluttua?",
      options: [["lt127", "Alle 127 hehtaaria"], ["m127_134", "127–134 hehtaaria"], ["m134_144", "134–144 hehtaaria"], ["gt144", "Yli 144 hehtaaria"]], key: V10_AREA.id,
      keyAtomIds: [], rule: "computed", basis: "REPORT-keyed (D4): the reported area at the end of step 15 (18:20) by extrapolation of the reports delivered by step 13, ~130.5 ha, 3.5 ha from the 127 and 134 ha edges (bandOf; (ah) edges 127/134/144); ~125.9 ha now (DR3, 17:35: the lure, under 127)",
    }),
    choice({
      slug: "front_r2_2h", level: "L3", goal: "containment", keySteps: [13, 18], promptFi: `Kuinka kaukana eteläinen palorintama on huoltotiestä R2 ${inMinutesFi(minutesAhead(10, 18))}?`,
      options: [["lt400", "Alle 400 metrin päässä"], ["m400_700", "400–700 metrin päässä"], ["m700_1000", "700–1000 metrin päässä"], ["gt1000", "Yli kilometrin päässä"]], key: V10_R2.id,
      keyAtomIds: [], rule: "computed", basis: "REPORT-keyed (D4; fix pass 7, two hours on): the south front's reported distance to R2 now (~1327 m, 'runsaan kilometrin', DR2 pushed: the lure, over 1 km) less the delivered head rate (3.5 m/min) x 120 min, ~907 m, 93 m from the 1 km edge (bandOf); the CA front is ~480 m from R2 at 19:20, past the forest road (the reports lag the evening wind)",
    }),
    // Fix pass 2 (7 Oct 2026, P2-4): replaces south_units, whose key ("the front is widening quickly") cued the no-fit
    // decision and contradicted its own basis; an L3 item away from the new front (the held north edge).
    choice({
      // Researcher decision 8 Oct 2026: kept, but L2 (comprehension), not an L3 projection: DR1 gives the distance (~1600 m) at 16:45 and
      // 17:05 and the north edge holds, so the hour-ahead band is the distance on record.
      slug: "cabins_distance", level: "L2", goal: "values", promptFi: `Kuinka kaukana palon reuna on Mökkirannan mökeistä ${inMinutesFi(minutesAhead(10, 15))}?`,
      options: [...DISTANCE_BANDS, ["in", "Palo on jo mökeillä"]], key: distanceBandKey("CABINS", 15),
      keyAtomIds: [trafficId(11, /^DR1 lämpökuva, Mökkiranta klo 16\.45: .*lähin reuna noin \d+ m/), trafficId(12, /^DR1 lämpökuva, Mökkiranta klo 17\.05: .*lähin reuna noin \d+ m/)],
      rule: "computed", basis: "CA truth distance to CABINS at the end of step 15 (~1.7 km: the north edge is held; the evening north-westerly drives the growth south-east); DR1 gives ~1600 m at 16:45 and 17:05 (L2 since 8 Oct 2026)",
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
      // 2 Oct 2026: replaces "nearest settlement" (with the rekindle at the origin Mökkiranta is nearer again, the same key as V2).
      slug: "front_toward", level: "L2", goal: "values", promptFi: "Minkä asutuksen suuntaan kaakkoisrintama etenee?",
      options: [["village", "Lahdenkylän"], ["cabins", "Mökkirannan"], ["none", "Ei kummankaan, rintama jää metsäautotien taakse"], ["cp", "Johtopaikan"]], key: "village",
      keyAtomIds: ["atom.demo.17.1"], rule: "cited", basis: "SPOT (step 17): the head spreads south-east towards Lahdenkylä; the CA distance to VILLAGE falls 2.1 → 1.9 km over steps 16–17",
    }),
    choice({
      slug: "village_distance", level: "L3", goal: "values", keySteps: [17, 19], promptFi: `Kuinka kaukana palon reuna on Lahdenkylästä ${inMinutesFi(minutesAhead(12, 19))}?`,
      options: [["lt1200", "Alle 1200 metrin päässä"], ["m1200_1600", "1200–1600 metrin päässä"], ["m1600_2100", "1600–2100 metrin päässä"], ["gt2100", "Yli 2100 metrin päässä"]],
      key: V12_VILLAGE.id,
      keyAtomIds: [], rule: "computed", basis: "REPORT-keyed (D4): the reported fire's distance to VILLAGE at the end of step 19 by extrapolation of the reports delivered by step 17, ~1920 m (revision (aj); was ~1776 m), 180 m from the 2100 m edge (bandOf); the CA fire is ~1.7 km away",
    }),
    point({
      slug: "head_later", level: "L3", goal: "containment", keySteps: [17, 18], promptFi: headLaterFi(12, 18), point: truthHeadAtEndOf(18),
      keyAtomIds: [], rule: "computed", basis: "the CA truth head at the end of step 18 (19:20)",
    }),
  ],
  14: [
    choice({
      // Fix pass 3: the crews change on the line (no one goes to the CP), so the item asks whose crews changed.
      slug: "shift_change", level: "L1", goal: "safety", promptFi: "Minkä yksiköiden miehistöt vaihtuivat illan vuoronvaihdossa?",
      options: [["ek11_vpk", "EK11 ja VPK"], ["ek12_ky21", "EK12 ja KY21"], ["out", "OUT1 ja OUT2"], ["none", "Ei mitkään"]], key: "ek11_vpk",
      keyAtomIds: [RADIO.ek11Relief, RADIO.vpkRelief], rule: "cited", basis: "step 19: the next shift took over EK11's vehicle and line on R2; VPK returns to the line, its shift changed",
    }),
    // Researcher decision 8 Oct 2026: restored (the 12:01 stopgap commented it out); the re-tuned fire model has the stop at step 18
    // and the crossing at step 19 again, both before the V14 freeze.
    choice({
      slug: "road_crossed", level: "L2", goal: "containment", promptFi: "Mitä palon eteneminen Honkaharjun metsäautotien yli merkitsee?",
      options: [
        // Fix pass 2 (7 Oct 2026, P1-1): the key was the longest option by half; the options are balanced. Fix pass 3: the key
        // names no action (it named R2, a directive-aligned line).
        ["moved", "Tie ei enää pysäytä palon kärkeä"], ["stopped", "Palo pysähtyi tiehen, ja tien linja pitää yhä"],
        ["back", "Palo kääntyy takaisin palaneelle alueelle"], ["none", "Ylitys on pieni, eikä se vaikuta torjuntaan"],
      ], key: "moved",
      keyAtomIds: [radioId(18, /^Palo pysähtyi metsäautotien \(Honkaharju\)/), radioId(19, /^Palon kärki ylitti metsäautotien \(Honkaharju\)/)], rule: "cited",
      basis: "KY21, which held that stretch of the road until 19:00 (revision (ak)): the fire stopped at the Honkaharju road (step 18); then EK16: the head crossed it in gusts, 19.00–19.20, EK16 withdrawing (step 19) (8 Oct 2026: the re-tuned fire model restores the stop)",
    }),
    // Fix pass 2 (7 Oct 2026, P2-4): replaces ugv_meaning, so the V14 set does not all pull toward the south-east front. Fix pass 3:
    // replaces north_edge, which cued the H3 contradiction (the north edge, SPOT against EK14); the shift change's meaning cues neither
    // it nor the no-fit decision (researcher decision 7 Oct 2026: the next shift takes over the vehicles on the line).
    choice({
      slug: "shift_meaning", level: "L2", goal: "resources", promptFi: "Mitä illan vuoronvaihto merkitsee linjoille?",
      options: [
        ["nogap", "Uusi vuoro jatkaa samoilla autoilla, linjat pysyvät"], ["empty", "Linjat jäävät tyhjiksi, kunnes korvaajat saapuvat"],
        ["moved", "Linjat siirretään yöksi johtopaikan lähelle"], ["stop", "Sammutustyö loppuu niiltä linjoilta tältä illalta"],
      ], key: "nogap",
      keyAtomIds: [RADIO.ek11Relief, RADIO.vpkRelief],
      rule: "cited", basis: "step 19: the next shift took over EK11's vehicle and line on R2, no gap; VPK back on the line, shift changed (researcher decision 7 Oct 2026)",
    }),
    point({
      slug: "head_later", level: "L3", goal: "containment", keySteps: [20, 20], promptFi: headLaterFi(14, 20), point: truthHeadAtEndOf(20), projectionPoint: projectionHeadAtEndOf(14, 20),
      keyAtomIds: [], rule: "computed", basis: "the CA truth head at the end of step 20 (20:00)",
    }),
    // Fix pass 5 (8 Oct 2026, researcher decision): replaces growth_trend, whose key ("same") the Tilannekuva series (151.1, 158.8, 166.3 ha)
    // stated and whose "none" option was absurd; a quantity not on record: the south-east front's distance to R2 in 20 minutes.
    choice({
      slug: "se_front_r2", level: "L3", goal: "containment", keySteps: [20, 20], promptFi: `Kuinka kaukana kaakkoisrintama on huoltotiestä R2 ${inMinutesFi(minutesAhead(14, 20))}?`,
      options: [["lt150", "Alle 150 metrin päässä"], ["m150_450", "150–450 metrin päässä"], ["m450_650", "450–650 metrin päässä"], ["gt650", "Yli 650 metrin päässä"]], key: V14_R2.id,
      ...(V14_R2_PROJECTION ? { projectionOption: V14_R2_PROJECTION } : {}),
      keyAtomIds: [], rule: "computed", basis: "REPORT-keyed (D4): the reported fire's distance to R2 at the end of step 20 (20:00) by extrapolation of the reports delivered by step 20, ~546 m, 96 m from the 450 m edge (bandOf; revision (aj) edges 150/450/650, were 150/380/600 with ~316 m); the records give ~550–580 m now; the projection's 40-minute isochrone ~568 m lies in the same band, so there is no projection option (fix pass 7) until the item is re-designed",
    }),
  ],
};
