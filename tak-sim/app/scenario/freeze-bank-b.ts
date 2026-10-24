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

import type { CycleIndex } from "../engine/primitives.js";
import { SITE_SCENARIO } from "./site-scenario.js";
import { CYCLE_STORY } from "./demo-story.js";
import { choice, HEAD_NOW_LATEST_FI, headLaterFi, horizonFi, minutesAhead, point, withinHorizonFi, type ItemDef } from "./freeze-bank-core.js";
import {
  bandOf, centroid, deliveredAreaAt, deliveredPointDistanceAt, detachedFrontToLineM, distanceM, distanceToReportedM, distanceToTruthM, headNow, keyBand, projectedLineDistanceAt, projectionOptionFor,
  R2_LINE, radioId, reportedDetachedClosingAt, reportedDetachedToLineM, reportedLineDistanceAt, siteStep, storyId, trafficFigure, trafficId, truthHeadAtEndOf, type KeyBand,
} from "./freeze-keys.js";

const F = SITE_SCENARIO.features;
/** Play-test D1 (24 Oct 2026): V10's south front at the header's "now", the view's end (17.40): the centroid of step 13's truth front. */
const SOUTH_FRONT_1740 = centroid(siteStep(13).truthDetached[0]!);

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
  ek16HeadNearsRoad: radioId(17, /^Kärki lähestyy metsäautotietä luoteesta, etenee kaakkoon/), // EK16's pushed 18.41 hold (V12 `head_now`, play-test D1)
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
 * Play-test D5 (24 Oct 2026): the area V9's pushed situation picture states at 17.05 — the 17.00 map's, the fire model's area at the end of
 * step 11 (the old fire; the rekindle is not yet on that map). Read from the story beat and checked against the bundle, so a regenerated
 * fire that moves the area fails the build until the beat is re-authored.
 */
export const V9_PICTURE = (() => {
  const id = storyId(12, /^Tilannekuva klo 17\.05: /);
  const text = CYCLE_STORY[12 as CycleIndex]!.bubbles[Number(id.split(".").at(-1))]!.text;
  const ha = Number(/Palanut ala noin (\d+,\d) ha/.exec(text)![1]!.replace(",", "."));
  if (Math.abs(ha - siteStep(11).areaHa) > 0.05) throw new Error(`V9 situation picture: it states ${ha} ha, the 17.00 fire is ${siteStep(11).areaHa} ha; re-author the beat`);
  return { id, ha };
})();

/**
 * V10 `area_growth_hour` (play-test D5, researcher 24 Oct 2026; replaces `area_total_hour`): how much the burnt area grows over the next
 * hour from the view's end (17.40 → 18.40, the ends of steps 13 and 16). TRUTH-keyed with a stated tolerance: the fire model's growth
 * must lie ≥ 2.5 ha from every band edge, else the build fails (re-author). The old item asked the TOTAL in 12-ha bands (143/155/167),
 * whose scale revealed ~150 ha to anyone whose last pushed figure was 76.4 ha (15.35); growth bands of 2/15/40 ha reveal no magnitude, and
 * V9 now pushes the area (`V9_PICTURE`). The reports' reading — the line through the areas the maps of V9 and V10 draw (steps 12, 13) — is
 * computed beside it and must fall in the same band (`31` §3.5 rule (5): no dual key). The lures: no growth (DR3's recorded 17.35 survey,
 * "reuna ei ole liikkunut missään") under 2 ha, and phase A's pace carried on over 40 ha.
 */
const V10_GROWTH_EDGES = [2, 15, 40] as const;
const V10_GROWTH_IDS = ["lt2", "m2_15", "m15_40", "gt40"] as const;
export const V10_GROWTH = (() => {
  const truth = siteStep(16).areaHa - siteStep(13).areaHa;
  const reported = deliveredAreaAt(12, 13, 16) - deliveredAreaAt(12, 13, 13);
  const key = bandOf(truth, V10_GROWTH_EDGES, V10_GROWTH_IDS, 2.5, "V10 area_growth_hour (truth)");
  const rep = bandOf(reported, V10_GROWTH_EDGES, V10_GROWTH_IDS, 0.5, "V10 area_growth_hour (reports)");
  if (rep.id !== key.id) throw new Error(`V10 area_growth_hour: the reports' band ${rep.id} is not the truth's ${key.id}; re-author the bands`);
  return { id: key.id, margin: key.margin, value: truth, reported, reportedMargin: rep.margin };
})();

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
  const out1 = trafficFigure(20, /^OUT1, tie R2: (?:ei omaa reunaa, palo|meillä hiljaista, palon reuna) (\d+) m/); // gate R (R1): the re-seeded step draws the second wording, the same 900 m
  const rate = trafficFigure(18, /^DR2 lämpökuva, kaakkoisrintama klo 19\.05: reuna etenee kaakkoon noin (\d+,\d) m\/min/);
  // SPEC/33 gate R (R1): the re-seeded step-20 draws give KY21's shorter sprinkler wording ("vesi kytketään kun palo lähestyy", no
  // figure); OUT1's pushed R2 line (Lahdenkylä's sprinklers) states the trigger now, the same ~100 m.
  const trigger = trafficFigure(20, /^OUT1, tie R2: .*vesi kytketään (?:altaasta )?kun palo on noin (\d+) m päässä/);
  const nearest = Math.min(ky21.value, out1.value);
  const at20 = nearest - rate.value * minutesAhead(14, 21);
  if (at20 < 2 * trigger.value) throw new Error(`freeze key V14 se_front_r2: the front ${at20.toFixed(0)} m from R2 in 20 minutes is too near the ${trigger.value} m trigger; re-author`);
  const hm = (id: string) => SITE_SCENARIO.traffic.find((x) => x.id === id)!.timestamp.slice(0, 5).replace(":", ".");
  return { key: "not_yet", nearest, rate: rate.value, trigger: trigger.value, at20, ids: [ky21.id, out1.id, rate.id], ky21At: hm(ky21.id), out1At: hm(out1.id) };
})();

export const PHASE_B_BANK: Readonly<Record<number, readonly ItemDef[]>> = {
  10: [
    point({
      // Play-test D8 (researcher, 24 Oct 2026): the L1 200 m like the other map items (was 100 m, fix pass 6, for a 0.8 ha front; on the blank
      // basemap all three play-test players missed it, at 112, 199 and 203 m). Play-test D1, the header's "now" (the view's end, 17.40): the
      // key is the front as the fire model has it then — the centroid of step 13's truth front — not the 17.20 front the map draws, 84 m
      // west of it (a mark on the drawn front still scores).
      slug: "south_front_point", level: "L1", goal: "containment", promptFi: "Merkitse kartalle eteläinen palorintama syttymäkohdan eteläpuolella.", point: SOUTH_FRONT_1740,
      // Round 2 (5 Oct 2026): was "… Rahkasuolla" (the rekindle left the bog on 2 Oct 2026), and cited KY21's step-13 move,
      // which is now at step 14; DR2's step-13 line places the front instead.
      keyAtomIds: ["atom.demo.12.0", "atom.demo.13.0"], rule: "computed",
      basis: `the centroid of the CA's detached front at the end of step 13 (17.40, the view's end): ${f0(distanceM(SOUTH_FRONT_1740, centroid(siteStep(13).reportedDetached[0]!)))} m from the front step 13 draws (17.20), which SPOT (17.01, 120 m SE of the origin) and DR2 (17.21, spreading east) place`,
    }),
    // Fix pass 2 (7 Oct 2026, P2-4): replaces why_rekindle ("no crew in the sector"), which cued V10's no-fit decision (crew
    // the new front); an L2 item away from the new front. Since the regen (FF3) the water shuttle brings a basin to the line.
    choice({
      // SPEC/33 gate R (R1, R3; 20 Oct 2026; DRAFT, panel): EK12 mops up its 15:40 stretch on the south-east flank from R1 (was the head's
      // south flank from the north spur's dead end), and the shuttle drives on the road graph: the stem names the flank, the key is unchanged.
      slug: "ek12_water", level: "L2", goal: "resources", promptFi: "Mitä EK12:n vesitilanne merkitsee sen työlle kaakkoissivustalla?",
      options: [
        ["brought", "EK12 jää linjalle, lisävesi tuodaan sen luo"], ["leaves", "EK12 lähtee täyttämään, sivusta jää ilman vettä"],
        ["out", "Vesi on loppu, sivustan työ keskeytyy illaksi"], ["none", "Ei vaikutusta, säiliö riittää illan loppuun asti"],
      ], key: "brought",
      keyAtomIds: [trafficId(13, /^EK12, kaakkoissivusta: vesi loppumassa \(25 %\)\. Pyysimme EK13:lta vesiajon/), trafficId(13, /^EK12, EK13: selvä, tuomme altaan linjanne päähän/)],
      rule: "cited", basis: "EK12 (step 13, on the south-east flank by R1): water running low (25 %), it asked EK13 for a water run to a basin, due 17.41 (the road route from VPK's line, 1.5 km; was 17.43 on the north spur before gate R R1/R3); EK13 confirms it brings the basin to the end of EK12's line: the crew stays on the flank",
    }),
    choice({
      // Play-test D5 (researcher, 24 Oct 2026; DRAFT, native and domain review): replaces `area_total_hour` (the total, whose 12-ha bands
      // revealed the magnitude): the growth over the hour, the new fire included ("uusi palo", as DR2's pushed 17.21 line calls it).
      slug: "area_growth_hour", level: "L3", goal: "containment", keySteps: [14, 16], promptFi: `Kuinka paljon palanut ala kasvaa ${withinHorizonFi(10, 16)}, uusi palo mukaan lukien?`,
      options: [["lt2", "Alle 2 hehtaaria"], ["m2_15", "2–15 hehtaaria"], ["m15_40", "15–40 hehtaaria"], ["gt40", "Yli 40 hehtaaria"]], key: V10_GROWTH.id,
      keyAtomIds: [], rule: "computed", basisKind: "record", basisAtomIds: [V9_PICTURE.id], basisSteps: [12, 13],
      basis: `TRUTH-keyed with a stated tolerance (play-test D5): the CA's growth 17.40 → 18.40 (the ends of steps 13 and 16) ~${f1(V10_GROWTH.value)} ha, ${f1(V10_GROWTH.margin)} ha from the nearest band edge (≥ 2.5 ha required); the reports' line through the areas V9's and V10's maps draw (steps 12, 13) gives ~${f1(V10_GROWTH.reported)} ha, the same band; the base: V9's pushed situation picture (${f1(V9_PICTURE.ha)} ha at 17.05) and the new fire on V10's map (DR2's recorded 17.25 thermal ~1.0 ha); the lures: no growth (DR3's recorded 17.35 'no edge moved', under 2 ha) and phase A's pace carried on (over 40 ha)`,
    }),
    choice({
      slug: "front_r2_80", level: "L3", goal: "containment", keySteps: [14, 17], promptFi: `Kuinka kaukana eteläinen palorintama on huoltotiestä R2 ${horizonFi(10, 17)}?`,
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
      // Play-test D1 (researcher, 24 Oct 2026; open item `11` §7.18 closed): the header's "now" is the view's end (19.00), so the key is the
      // head the fire model gives then (`truthHeadAtEndOf(17)`, at the Honkaharju forest road), no longer the head the merged view's map
      // draws at 18.20 (step 16), ~370 m behind it — both play-test players were marked wrong there (327 and 268 m off; 278 m in the
      // replication), all three displaced towards this key by the 40 minutes of spread the period's reports describe. The basis is pushed:
      // EK16's 18.41 radio (the head nears the forest road from the north-west at ~10 m/min); DR2's 18.47 road report (80 m) is recorded.
      slug: "head_now", level: "L1", goal: "containment", promptFi: HEAD_NOW_LATEST_FI, point: truthHeadAtEndOf(17),
      keyAtomIds: [RADIO.ek16HeadNearsRoad, trafficId(17, /^DR2 tiehavainto: metsäautotie \(Honkaharju\).*palo noin \d+ m tiestä/)], rule: "computed",
      basis: `the CA truth head at the end of step 17 (19.00, the view's end), ${f0(distanceM(truthHeadAtEndOf(17), F["FR_MID"]!))} m from the Honkaharju forest road's mid point and ${f0(distanceM(truthHeadAtEndOf(17), headNow(16)))} m from the head step 16 draws; EK16's pushed 18.41 radio puts the head near the road, closing from the north-west at ~10 m/min`,
    }),
    choice({
      // 2 Oct 2026: replaces "nearest settlement". `31` F26: "Johtopaikan" (not a settlement) gave way to a plausible wrong state.
      slug: "front_toward", level: "L2", goal: "values", promptFi: "Minkä asutuksen suuntaan kaakkoisrintama etenee?",
      options: [["village", "Lahdenkylän"], ["cabins", "Mökkirannan"], ["none", "Ei kummankaan, rintama jää metsäautotien taakse"], ["both", "Molempien, rintama leviää kahteen suuntaan"]], key: "village",
      keyAtomIds: ["atom.demo.17.1"], rule: "cited", basis: "SPOT (step 17): the head spreads south-east towards Lahdenkylä; the CA distance to VILLAGE falls 2.1 → 1.9 km over steps 16–17",
    }),
    choice({
      slug: "village_distance", level: "L3", goal: "values", keySteps: [18, 19], promptFi: `Kuinka kaukana palon reuna on Lahdenkylästä ${horizonFi(12, 19)}?`,
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
      slug: "se_front_r2", level: "L3", goal: "containment", keySteps: [21, 21], promptFi: `Joudutaanko tien R2 sadetinlinjojen vesi kytkemään päälle ${withinHorizonFi(14, 21)}?`,
      options: [
        ["not_yet", "Ei, rintama on silloin vielä satojen metrien päässä tiestä"], ["turned", "Ei, rintama on kääntynyt pois tieltä pohjoiseen"],
        ["near", "Kyllä, rintama on silloin alle 100 metrin päässä tiestä"], ["sparks", "Kyllä, kipinät ylittävät tien ennen rintamaa"],
      ], key: V14_SPRINKLERS.key,
      keyAtomIds: [], rule: "computed", basisKind: "record", basisAtomIds: V14_SPRINKLERS.ids,
      basis: `REPORT-keyed (\`31\` F02; no truth after 20.00): the nearest pushed distance (KY21 ${V14_SPRINKLERS.ky21At}, OUT1 ${V14_SPRINKLERS.out1At}: ${V14_SPRINKLERS.nearest} m) less the fastest pushed rate of the south-east front (DR2 19.05: ${V14_SPRINKLERS.rate} m/min) × 20 min, ~${f0(V14_SPRINKLERS.at20)} m, against the ~${V14_SPRINKLERS.trigger} m at which the sprinkler water goes on (OUT1, pushed; gate R: was KY21's line)`,
    }),
    choice({
      // `31` F03: replaces the V14 map item (head_later: the head at "now" was 168 m from its key, and no truth exists after 20.00); the
      // deciding front of V14, asked after the plan, report-keyed on the pushed records and the wind the map shows.
      // SPEC/31 (az) phase 4, finding 5 (20 Oct 2026): the cited records are its key records, so its told class is computed, not
      // assumed: both are pushed before the freeze, so it is stream-told. FOR THE DOMAIN REVIEWER: the item fails the repaired recall
      // guard (`test/scenario/freeze-bank.spec.ts`, smoke-direction wording): the pushed 19.42 line "Savu painuu kaakkoon Rahkasuon
      // suuntaan" (story 20.1) and the recorded 19.30 pass "Savu painuu kaakkoon" (story 19.3) nearly state the key "spreads south-east".
      // Kept, not deleted: the reviewer decides whether it stays (classed stream-told in H2t) or is re-authored.
      slug: "flare_next", level: "L3", goal: "containment", keySteps: [21, 23], promptFi: `Mitä syttymäkohdan länsipuolen uudelleensyttymälle todennäköisesti tapahtuu ${withinHorizonFi(14, 23)}, jos sitä ei sammuteta?`,
      options: [
        ["spreads_se", "Se laajenee kaakkoon tuulen mukana"], ["spreads_nw", "Se leviää luoteeseen kohti Karhujärveä"],
        ["dies", "Se sammuu itsestään, liekit ovat matalia"], ["smoulders", "Se jää kytemään paikoilleen ilman liekkejä"],
      ], key: "spreads_se",
      keyAtomIds: ["atom.demo.19.2", "atom.demo.20.1"], rule: "cited", basisKind: "record", basisAtomIds: ["atom.demo.19.2", "atom.demo.20.1"],
      basis: "REPORT-keyed (`31` F03; no truth after 20.00; DRAFT, domain review): the flare-up still burns with visible flames, its smoke driven south-east towards Rahkasuo (story 20.1, pushed 19.42; story 19.2, pushed 19.23), in the north-westerly the map's wind arrow shows; unattended, a litter fire in that wind runs south-east (the V14 directive key's basis, `demo-directive.ts`)",
    }),
  ],
};
