/**
 * Two keys of the freeze bank whose readings carry their own build guards (play-test decisions R4 and R8, researcher 25 Oct 2026;
 * SPEC/08 (bh)): the practice item `r1_arrival` and V5's `area_hour`. Split from `freeze-bank.ts` (file length); the items themselves stay
 * there. TRUTH: analysis and build only, never on screen. A regenerated scenario that moves a reading out of its key band fails the build
 * (re-author the item), as the other report-keyed items do.
 */

import { SITE_SCENARIO } from "./site-scenario.js";
import { distanceToLineM, headNow, keyBand, R1_LINE, siteStep, trafficFigure } from "./freeze-keys.js";
import type { LatLon } from "../engine/primitives.js";

const clockMin = (hhmm: string): number => { const [h, m] = hhmm.split(/[:.]/).map(Number); return h! * 60 + m!; };
export const clockOf = (min: number): string => `${Math.floor(min / 60)}.${String(Math.round(min) % 60).padStart(2, "0")}`;

/**
 * VP `r1_arrival` (play-test R4): the clock at which the head reaches road R1 at its current rate, in four time-of-day bands (was the
 * minutes from "now", whose 60-minute edge the readings straddled: the pushed figures give 61 minutes from the header's 12.20). The band
 * ids are the clocks (`lt1250` … `gt1340`), so the build shows them ascending (`isOrdinal`). The key is 13.10–13.40, and three readings
 * must fall inside it, at least `R1_ARRIVAL_MIN_MARGIN` minutes from either edge:
 * - pushed: EK11's 12.01 "Kärjestä tielle R1 noin 320 m" at its 12.01 "noin 4 m/min" (≈ 13.21);
 * - drawn: the W2 head the VP map draws (12.00) and its rate mark (≈ 13.37);
 * - truth: the first fire-model state the bundle holds at R1 (within one CA cell, 25 m): step 1's fire at 13.20 (W2's 12.20 truth is
 *   ~110 m short). The bundle holds no state between 12.20 and 13.20; the CA run (`content/site/build/fire-ca.json`) has the fire 34 m
 *   short at 13.00, so the crossing falls in 13.00–13.20 (`test/scenario/freeze-bank.spec.ts`), read at step resolution as 13.20.
 */
export const R1_ARRIVAL_EDGES = [12 * 60 + 50, 13 * 60 + 10, 13 * 60 + 40] as const;
export const R1_ARRIVAL_IDS = ["lt1250", "m1250_1310", "m1310_1340", "gt1340"] as const;
export const R1_ARRIVAL_MIN_MARGIN = 2;
const R1_REACHED_M = 25;
const nearR1 = (polys: readonly (readonly (readonly LatLon[])[])[]): number => Math.min(...polys.flatMap((p) => p.flatMap((ring) => ring.map((v) => distanceToLineM(v, R1_LINE)))));

export const R1_ARRIVAL = (() => {
  const w2 = siteStep(-3), s1 = siteStep(1);
  const dist = trafficFigure(-3, /^EK11: .*Kärjestä tielle R1 noin (\d+) m/);
  const rate = trafficFigure(-3, /^EK11 paikalla .*Kärki etenee koilliseen noin (\d+) m\/min kohti tietä R1/);
  const distAt = clockMin(SITE_SCENARIO.traffic.find((t) => t.id === dist.id)!.timestamp.slice(0, 5));
  const pushed = distAt + dist.value / rate.value;
  const drawnM = distanceToLineM(headNow(-3), R1_LINE);
  const drawn = clockMin(w2.clock) + drawnM / w2.observedHead.rateMpm;
  const shortAt1220 = nearR1([w2.truthAtEnd, ...w2.truthDetached]);
  const at1320 = nearR1([s1.reported, ...s1.reportedDetached]);
  if (shortAt1220 <= R1_REACHED_M || at1320 > R1_REACHED_M) throw new Error(`practice r1_arrival: the fire model is ${shortAt1220.toFixed(0)} m from R1 at 12.20 and ${at1320.toFixed(0)} m at 13.20; re-author`);
  const truth = clockMin(s1.clock);
  const [lo, hi] = [R1_ARRIVAL_EDGES[1], R1_ARRIVAL_EDGES[2]];
  for (const [name, at] of [["pushed", pushed], ["drawn", drawn], ["truth", truth]] as const) {
    if (at < lo + R1_ARRIVAL_MIN_MARGIN || at > hi - R1_ARRIVAL_MIN_MARGIN) throw new Error(`practice r1_arrival: the ${name} reading ${clockOf(at)} is not inside the key band 13.10–13.40 (margin ${R1_ARRIVAL_MIN_MARGIN} min); re-author`);
  }
  return { key: R1_ARRIVAL_IDS[2], pushed, drawn, truth, drawnM, drawnRate: w2.observedHead.rateMpm, pushedM: dist.value, pushedRate: rate.value, ids: [dist.id, rate.id], shortAt1220 };
})();

/**
 * V5 `area_hour` (now 15.20; REPORT-keyed, D4): the burnt area an hour on (16.20, the end of step 9): the pushed 15.35 perimeter survey
 * (DR3: the area and the last 20 minutes' new area, comparing the 15.00 and 15.20 images) carried on for three steps. The map draws step 7.
 */
export const V5_SURVEY = {
  area: trafficFigure(7, /^DR3 kehäkartoitus valmis klo 15\.35: palanut ala noin (\d+,\d) ha/),
  added: trafficFigure(7, /^DR3 kehäkartoitus valmis klo 15\.35: .*\((\d+,\d) ha uutta/),
};
/**
 * Play-test R8 (researcher 25 Oct 2026): edges 90/130/190 (were 90/140/190, SPEC/33 stage 9), the same four bands and scale with the middle
 * edge moved down, so the fire model's ~148 ha no longer sits 8 ha above an edge (4 of 5 play-test runs chose 90–140 with an expert's
 * slowdown). Guard, as `area_growth_hour`'s: the truth must lie at least `V5_AREA_TRUTH_MARGIN` (10 %) of its value from every edge, else
 * the build fails. Why 10 %: it is about two thirds of one 20-minute step of the fire's growth over that hour (~24 ha a step, 72 ha in
 * three), so an estimate that slows the spread by less than that cannot cross an edge the truth is near; and it is twice the 5 ha the
 * report-keyed reading keeps. The reading of the reports (76.4 + 3 × 35.8 ≈ 184 ha) keeps its 5 ha margin and the same band.
 */
export const V5_AREA_EDGES = [90, 130, 190] as const;
export const V5_AREA_IDS = ["lt90", "m90_130", "m130_190", "gt190"] as const;
export const V5_AREA_TRUTH_MARGIN = 0.1;
export const V5_AREA = keyBand(V5_SURVEY.area.value + 3 * V5_SURVEY.added.value, V5_AREA_EDGES, V5_AREA_IDS, 5, "V5 area_hour", { value: siteStep(9).areaHa, minMargin: V5_AREA_TRUTH_MARGIN * siteStep(9).areaHa });
if (V5_AREA.truthId !== V5_AREA.id) throw new Error(`V5 area_hour: the truth's band ${V5_AREA.truthId} is not the reports' ${V5_AREA.id}; re-author the bands`);
