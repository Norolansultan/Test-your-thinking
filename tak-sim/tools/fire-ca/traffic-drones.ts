/**
 * Drone products (review 1 Oct 2026, items 2 and 6), all read from the reported fire inside the
 * camera's footprint (`traffic-fire.ts`), so a drone never reports what the CA does not contain:
 *
 * - the thermal picture of its footprint: edge moving or not, measured rate of spread on the named
 *   edge (two frames 20 min apart), flame height / intensity class, hot spots, spot fires;
 * - the smoke plume (direction from the wind, height from the fire's intensity) from the mapping loop;
 * - roads and water points near the footprint (how far the fire is from them);
 * - people and vehicles where the world state has them (Mökkiranta's 14 cabins, occupancy unknown
 *   until step 17; Lahdenkylä during the evacuation);
 * - which drones are up and over what (the drone team's status line);
 * - battery swaps and landings from one battery model (`app/scenario/drone-battery.ts`), which the
 *   allocation roster also reads;
 * - a confidence qualifier on every reading (rain on the optics, thermal saturation, link drop, smoke).
 *
 * Only what was observed is reported (researcher decision 1 Oct 2026): no line says that a place
 * was NOT imaged. The V7–V9 gap over Rahkasuo (SPEC/26 §5) is simply an absence — no drone films
 * it, and nothing says so.
 */

import { batteryTimeline, type BatteryTimeline } from "../../app/scenario/drone-battery.js";
import { FIXED_ROADS, ROADS } from "../topo-map/roads.js";
import { AIR_PLAN, FEATURES, THERMAL_FOOTPRINT_M, type P } from "./deployment.js";
import { ANCHOR_PLACE, sectorOfPoint } from "./traffic-places.js";
import { bearing, cap, dirAdj, dirTo, dist, flameWords, flatPlace, fmt1, hm, intensityClass, isBog, L, pl, r10, r50, sec, statedClass, stepStartS } from "./traffic-text.js";
import { SCENARIO_18_FORCING } from "./scenario-18.js";
import { PHASE_B_FIRST_STEP } from "./flame-table.js";

/** The continuous front's authored rate (m/min) in step n, without the spot fires that merged with it (`scenario-18.ts` "Head ROS (actual)"; radio FB-01). */
function frontRateWithoutJumps(n: number): number {
  const f = SCENARIO_18_FORCING.find((x) => x.id === String(n));
  if (!f) throw new Error(`traffic-drones: no forcing row for step ${n}`);
  return f.headRosActualMpm;
}
import { NEW_FIRE_STEPS, NEW_FRONT_STEP, type Out, type TrafficAircraft, type TrafficCycleInput } from "./traffic-types.js";
import { isRekindleCallsign } from "./fire-display.js";

/** Below this local rate (m/min) an edge is reported as backing (against the wind), whatever its few fresh cells say. */
const BACKING_BELOW_MPM = 2;
/** A water drone drops 80 l a round and stops dropping when the gusts at drop height pass this (m/s). */
const WATER_DRONE_LOAD_L = 80;
const WATER_DRONE_MAX_GUST_MS = 11;
/** Multicopters fly low and light: above this gust (m/s) they hold position or fly a reduced sortie (the 18.40 step has 14 m/s). */
const THERMAL_DRONE_MAX_GUST_MS = 13;

/** Rahkasuo (BOG-S, SPEC/18 §5): a camera covering any of these points has imaged the bog. */
export const BOG_S_POINTS: readonly P[] = [FEATURES.BOG_S, { x: 0, y: -700 }, { x: 600, y: -900 }, { x: 300, y: -1600 }, { x: -250, y: -1300 }, { x: 800, y: -1250 }];

const coversBogS = (a: TrafficAircraft) => BOG_S_POINTS.some((p) => a.covers(p));
/** A road's line as points 20 m apart, so a distance to it is a distance to the road, not to a few named points. */
const densify = (line: readonly P[]): P[] => line.flatMap((a, i) => {
  const b = line[i + 1];
  if (!b) return [a];
  const k = Math.max(1, Math.ceil(dist(a, b) / 20));
  return Array.from({ length: k }, (_, j) => ({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k }));
});
/** The named roads from their real geometry (`FIXED_ROADS`: index 3 is R1, 5 is R2; consistency review item 10). */
const NAMED_ROADS: readonly { readonly fi: string; readonly pts: readonly P[] }[] = [
  { fi: "tie R1", pts: densify(FIXED_ROADS[3]!.line) },
  { fi: "tie R2", pts: densify(FIXED_ROADS[5]!.line) },
  { fi: "R3:n silta (Kotkanjoki)", pts: [FEATURES.R3_BRIDGE_W] },
  // Fix pass 3 (FF2): the Honkaharju forest road (roads.ts road 48, through FR_W–FR_E to R2), the south-east front's road line.
  { fi: "metsäautotie (Honkaharju)", pts: densify(ROADS[48]!.line) },
];
/**
 * Named stretches of R1 and R2 (fix pass 2, 7 Oct 2026, FF2): a road report names the stretch it saw, so two
 * drones over two stretches of one road cannot read as contradicting each other (DR1 "R1 passable, fire 200 m"
 * and DR2 "R1 flames at the roadside, unsafe" at 15:06–15:07).
 */
const STRETCHES: readonly { readonly road: string; readonly at: P; readonly fi: string; readonly en: string }[] = [
  { road: "tie R1", at: { x: -1000, y: 400 }, fi: "johtopaikan kohdalla", en: "at the command post" },
  { road: "tie R1", at: { x: -300, y: 400 }, fi: "syttymäkohdan pohjoispuolella", en: "north of the point of origin" },
  { road: "tie R1", at: { x: 450, y: 410 }, fi: "Kuivakankaan eteläpuolella", en: "south of Kuivakangas" },
  { road: "tie R1", at: { x: 1150, y: 415 }, fi: "Kuusimäen kohdalla", en: "by Kuusimäki" },
  { road: "tie R1", at: { x: 1500, y: 420 }, fi: "R2:n risteyksessä", en: "at the R2 junction" },
  { road: "tie R1", at: { x: 2100, y: 410 }, fi: "R2:n risteyksen itäpuolella", en: "east of the R2 junction" },
  { road: "tie R2", at: { x: 1515, y: 100 }, fi: "R1:n risteyksen eteläpuolella", en: "south of the R1 junction" },
  { road: "tie R2", at: { x: 1517, y: -500 }, fi: "Rahkasuon itäpuolella", en: "east of Rahkasuo" },
  { road: "tie R2", at: { x: 1525, y: -842 }, fi: "metsäautotien risteyksessä", en: "at the forest-road junction" },
  { road: "tie R2", at: { x: 1515, y: -1200 }, fi: "Rahkasuon kaakkoispuolella", en: "south-east of Rahkasuo" },
  { road: "tie R2", at: { x: 1529, y: -1750 }, fi: "Lahdenkylän pohjoispuolella", en: "north of Lahdenkylä" },
  { road: "tie R2", at: { x: 1900, y: -2160 }, fi: "Lahdenkylän kohdalla", en: "at Lahdenkylä" },
  { road: "metsäautotie (Honkaharju)", at: FEATURES.FR_W, fi: "syttymäkohdan kaakkoispuolella", en: "south-east of the point of origin" },
  { road: "metsäautotie (Honkaharju)", at: FEATURES.FR_MID, fi: "Rahkasuon pohjoispuolella", en: "north of Rahkasuo" },
  { road: "metsäautotie (Honkaharju)", at: { x: 1200, y: -700 }, fi: "R2:n risteyksen länsipuolella", en: "west of the R2 junction" },
];
/** "tie R1 Kuusimäen kohdalla" / "road R1 by Kuusimäki": the road and the stretch nearest `p`. */
function stretchName(road: string, p: P): string {
  const s = STRETCHES.filter((x) => x.road === road).reduce<(typeof STRETCHES)[number] | null>((a, x) => (!a || dist(x.at, p) < dist(a.at, p) ? x : a), null);
  return s ? `${pl(road)} ${L(s.fi, s.en)}` : pl(road);
}
/** A road report covers the camera's footprint and this much beyond it (FF2: was 400 m, which put R1 in DR2's reports from the origin's south edge). */
const ROAD_REACH_BEYOND_M = 300; // revision (aj): 250 → 300, so DR2 over the south-east front still checks R2 at 19:4x (the front ~560 m from it)
const WATER_POINTS_FI: readonly { readonly fi: string; readonly at: P }[] = [
  { fi: "vesipiste W1 (Haukilampi)", at: FEATURES.POND_W1 },
  { fi: "vesipiste W2 (Lahdenkylän lampi)", at: FEATURES.POND_W2 },
  { fi: "vesipiste W3, R3:n silta (Kotkanjoki)", at: FEATURES.BRIDGE_W3 },
];
/** Why a drone lands before the next step (SPEC/18 §8.2, SPEC/19 §3.4); a landing with every pack empty comes from the battery model. */
const SORTIE_ENDS_FI = "lento päättyy, akut latautuvat johtopaikalla";
const LANDING_FI: Readonly<Record<string, string>> = {
  "DR1@8": "helikopteri tulee työskentelemään R1:n pohjoispuolelle, ilmatila vapautetaan",
  "DR3@8": "helikopteri tulee työskentelemään R1:n pohjoispuolelle, ilmatila vapautetaan",
  "DR3@15": "alue on pyytänyt DR3:n toiselle palolle", // SPEC/18 §8.2 step 14: DR3 release requested
};
const LANDING_EN: Readonly<Record<string, string>> = {
  "helikopteri tulee työskentelemään R1:n pohjoispuolelle, ilmatila vapautetaan": "the helicopter will work north of R1, the airspace is cleared",
  "alue on pyytänyt DR3:n toiselle palolle": "the region has requested DR3 for another fire",
  [SORTIE_ENDS_FI]: "end of the sortie, the batteries are charging at the command post",
};

const TIMELINES = new Map<string, BatteryTimeline>();
/** The platform's battery over the day, from the steps `AIR_PLAN` flies it. */
export function batteryOf(id: string): BatteryTimeline {
  let t = TIMELINES.get(id);
  if (!t) {
    // determinism-lint-allow: batteryTimeline sorts the steps itself, so key order cannot matter (I1).
    t = batteryTimeline(id, Object.keys(AIR_PLAN).map(Number).filter((n) => AIR_PLAN[n]![id] !== undefined));
    TIMELINES.set(id, t);
  }
  return t;
}
/** The battery level at offset `atS` of step n, or at the nearest later moment in the step it is in the air. */
function levelNear(id: string, n: number, atS: number): number | null {
  const t = batteryOf(id);
  for (let s = atS; s < 1200; s += 30) { const v = t.levelAt(stepStartS(n) + s); if (v !== null) return v; }
  return null;
}

function confidenceFi(id: string, n: number, cls: number): string {
  if (id === "DR3" && n === 10) return L("luotettavuus heikko: matala savukerros kuvassa", "reliability poor: a low smoke layer in the image");
  // Radio TE-08 (SPEC/31): an image is "saturoitunut", not "kylläinen" (chemistry), as DR1's story beat 6.1 says it (evt.c06.015, .017).
  if (id === "DR3" && n === 6) return L("luotettavuus heikko: lämpökameran kuva saturoitunut latvapalon kohdalla, reunaa ei erota", "reliability poor: the thermal camera image is saturated over the crown fire, the edge cannot be made out");
  if (id === "DR2" && n === 4) return L("luotettavuus kohtalainen: linkkikatko noin 3 min, osa kuvasta vanhaa", "reliability moderate: link dropped for about 3 min, part of the image is old");
  if (cls >= 4) return L("luotettavuus kohtalainen: paksu savu peittää osan reunasta", "reliability moderate: thick smoke hides part of the edge");
  return L("luotettavuus hyvä", "reliability good");
}

function tempFi(cls: number, rnd: () => number): string {
  const band: readonly (readonly [number, number])[] = [[15, 30], [60, 180], [250, 450], [400, 650], [600, 850], [650, 900]];
  const [lo, hi] = band[Math.max(0, Math.min(5, cls))]!;
  return `${Math.round(lo + rnd() * (hi - lo))} °C`;
}

/** Where a drone's flight is, in the log's words; L3 is named for what the camera actually covers. */
function taskPlace(flight: string, coversBog: boolean): { place: string | null; sector: string | null; edgeFi: string } {
  if (flight === "loop") return { place: "koko kehä", sector: null, edgeFi: L("kehän", "the perimeter") };
  const code = flight.replace(/^(orbit|scoop):/, "");
  if (code === "edge:L3" && !coversBog) return { place: "eteläreuna (L3)", sector: "L3-Etelä", edgeFi: L("eteläreunan", "the south edge") };
  const a = ANCHOR_PLACE[code];
  const edgeFi: Record<string, string> = {
    head: "kärjen", "edge:L1": "pohjoisreunan", "edge:L1B": "pohjoisreunan", "edge:L3": "syttymäkohdan eteläreunan", "edge:L3SE": "kaakkoisrintaman",
    "edge:RIDGE": "harjun", "edge:SPR": "Kuusimäen reunan", "at:CABINS": "Mökkirannan puoleisen reunan", "at:BOG_S": "Rahkasuon palon", "at:VILLAGE": "Lahdenkylän puoleisen reunan",
  };
  const edgeEn: Record<string, string> = {
    head: "the head", "edge:L1": "the north edge", "edge:L1B": "the north edge", "edge:L3": "the south edge by the point of origin", // EN-02 (SPEC/31) "edge:L3SE": "the south-east front",
    "edge:RIDGE": "the esker", "edge:SPR": "the Kuusimäki edge", "at:CABINS": "the edge facing Mökkiranta", "at:BOG_S": "the Rahkasuo fire", "at:VILLAGE": "the edge facing Lahdenkylä",
  };
  return { place: a?.place ?? null, sector: a?.sector ?? null, edgeFi: L(edgeFi[code] ?? "reunan", edgeEn[code] ?? "the edge") };
}

/** This step's swaps and landings from the battery model (`drone-battery.ts`), and the landing if the platform is not up next step. */
function battery(a: TrafficAircraft, inp: TrafficCycleInput, out: Out, place: string | null) {
  const t = batteryOf(a.id);
  const t0 = stepStartS(inp.n);
  const inStep = (s: number) => s >= t0 && s < t0 + 1200;
  const actorType = a.kind === "water_drone" ? "water_drone" : "drone";
  for (const sw of t.swaps.filter((x) => inStep(x.atS))) {
    const gap = Math.round((sw.backS - sw.atS) / 60);
    out.push({ offsetS: Math.min(1190, sw.atS - t0), actor: a.id, actor_type: actorType, addressee: "JOHTO", pos: a.target, place, event_type: "status", task: a.flight,
      content: a.id === "DR3"
        ? L(`${a.id} akkuloki: akku 20 %, laskeutuu vaihtoon klo ${hm(sw.atS)}. Kehäkartoitus katkeaa noin ${gap + 6} min.`, `${a.id} battery log: battery 20 %, landing for a swap at ${hm(sw.atS)}. Perimeter mapping interrupted for about ${gap + 6} min.`)
        : L(`${a.id} akkuloki: akku 20 %, vaihto klo ${hm(sw.atS)}. ${a.kind === "water_drone" ? "Pudotukset tauolla" : "Kuva poikki"} noin ${gap} min.`, `${a.id} battery log: battery 20 %, swap at ${hm(sw.atS)}. ${a.kind === "water_drone" ? "Drops paused" : "Image off"} for about ${gap} min.`),
      tier: "T2_system", channel: "sensor_feed", nav: "ilma" });
  }
  const dry = t.dry.find((d) => inStep(d.atS));
  if (dry) {
    out.push({ offsetS: Math.min(1190, dry.atS - t0), actor: a.id, actor_type: actorType, addressee: "JOHTO", pos: a.target, place, event_type: "status", task: a.flight,
      content: L(`${a.id} akkuloki: akku 20 % klo ${hm(dry.atS)}, ladattua vara-akkua ei ole. Laskeutuu johtopaikalle: kaikki akut tyhjinä, ensimmäinen latautuu noin klo ${hm(dry.chargedAtS)}.`, `${a.id} battery log: battery 20 % at ${hm(dry.atS)}, no charged spare battery. Landing at the command post: all batteries empty, the first one charged at about ${hm(dry.chargedAtS)}.`),
      tier: "T2_system", channel: "sensor_feed", nav: "ilma" });
    return;
  }
  // The last step ends with the handover to the night organisation (20.00): no landing is logged in it.
  if (inp.n < 20 && !AIR_PLAN[inp.n + 1]?.[a.id]) {
    // An end of sortie, not "waiting for a new task" (fix pass 2, FC3: that read as the participant's plan reaching the drone team).
    const whyFi = LANDING_FI[`${a.id}@${inp.n + 1}`] ?? SORTIE_ENDS_FI;
    const why = L(whyFi, LANDING_EN[whyFi] ?? whyFi);
    out.push({ offsetS: 1140, actor: a.id, actor_type: actorType, addressee: "JOHTO", pos: a.target, place, event_type: "status", task: a.flight,
      // The task's place goes with the callsign, so "johtopaikalla (Mökkiranta)" cannot be read as one place (audit item 19).
      content: L(`${a.id}${place ? ` (${flatPlace(place)})` : ""} laskeutuu klo ${hm(t0 + 1140)}: ${a.kind === "water_drone" ? "pudotukset päättyvät, " : ""}${why}.`, `${a.id}${place ? ` (${flatPlace(pl(place))})` : ""} landing at ${hm(t0 + 1140)}: ${a.kind === "water_drone" ? "drops ending, " : ""}${why}.`), tier: "T2_system", channel: "sensor_feed", nav: "ilma" });
  }
}

/**
 * Roads and water points within reach of the footprint, from the same image (at `atS`): how far
 * the reported fire is from the stretch of road in view, and whether that stretch is safe judged by
 * the flames the camera measures there (the intensity class from the local spread and the ground it
 * was measured on, as in the thermal picture; consistency review item 8).
 */
function infrastructure(a: TrafficAircraft, inp: TrafficCycleInput, out: Out, place: string | null, conf: string, atS: number) {
  const reach = THERMAL_FOOTPRINT_M + ROAD_REACH_BEYOND_M;
  let k = 0;
  // Only the roads within reach of the footprint (FF2), the nearest first and at most two (fix pass 3: the Honkaharju
  // road and R2 both run past the south-east front); otherwise nothing about roads.
  const inReach = NAMED_ROADS.map((r) => ({ r, d: Math.min(...r.pts.map((p) => dist(p, a.target))) })).filter((x) => x.d <= reach)
    .sort((x, y) => x.d - y.d).slice(0, 2);
  for (const { r } of inReach) {
    const near = r.pts.filter((p) => dist(p, a.target) <= reach);
    if (near.length === 0) continue;
    // The distance said is the fire's to the stretch in view, judged at that stretch (review 6 Oct 2026, A1;
    // researcher decision: reverts the 2 Oct whole-road choice, under which DR2 over the slow south edge
    // reported the fire 10 m from a stretch of R1 it could not see).
    const closest = near.reduce((x, y) => (inp.fire.distanceM(y, 3000) < inp.fire.distanceM(x, 3000) ? y : x));
    const d = inp.fire.distanceM(closest, 3000);
    if (!Number.isFinite(d) || d > 800) continue;
    const burning = inp.fire.freshHa(closest, 150) > 0;
    const run = inp.fire.advanceAt(closest, 150);
    const roadLc = inp.landCoverAt(run.at ?? closest);
    const cls = intensityClass(roadLc, run.m / 20, burning);
    const fw = flameWords(cls, run.m / 20, roadLc, inp.n);
    const state = burning && d < 60 && cls >= 2 ? L(`liekit tien reunassa (${fw}), ajo ei turvallista`, `flames at the roadside (${fw}), not safe to drive`)
      : burning && d < 60 ? L(`matalaa paloa tien reunassa (${fw}), ajettavissa varoen`, `low fire at the roadside (${fw}), passable with care`)
      : burning && d < 250 ? L("savua tiellä, ajettavissa varoen", "smoke on the road, passable with care")
      : d < 60 ? L("tien varsi palanut, ei liekkejä, ajettavissa", "the roadside has burned, no flames, passable") : L("tie ajettavissa, ei savua tiellä", "road passable, no smoke on the road");
    // A burned-out verge is not "fire 10 m from the road" (review 3 Oct 2026: the V5 R1 key read ambiguously).
    const cold = !burning && d < 60;
    const name = r.fi === "R3:n silta (Kotkanjoki)" ? pl(r.fi) : stretchName(r.fi, closest);
    out.push({ offsetS: atS + 15 * ++k, actor: a.id, actor_type: "drone", addressee: null, pos: a.target, place, event_type: "detection", task: a.flight,
      content: cold
        ? L(`${a.id} tiehavainto: ${name}, palanut alue tien reunassa — ei liekkejä, ajettavissa (${conf}).`, `${a.id} road report: ${name}, burned ground at the roadside — no flames, passable (${conf}).`)
        : L(`${a.id} tiehavainto: ${name}, palo noin ${r10(d)} m tiestä — ${state} (${conf}).`, `${a.id} road report: ${name}, fire about ${r10(d)} m from the road — ${state} (${conf}).`), tier: "T2_system", channel: "sensor_feed", nav: "vesi_reitit" });
  }
  for (const w of WATER_POINTS_FI) {
    if (dist(w.at, a.target) > reach + 300) continue;
    const d = inp.fire.distanceM(w.at, 3000);
    out.push({ offsetS: atS + 15 * ++k, actor: a.id, actor_type: "drone", addressee: null, pos: w.at, place, event_type: "detection", task: a.flight,
      content: L(`${a.id} vesipistehavainto: ${w.fi} ${Number.isFinite(d) ? `palo noin ${r50(d)} m päässä` : "kaukana palosta"}, ranta ajettavissa${Number.isFinite(d) && d < 300 ? ", savu haittaa täyttöä" : ""}.`,
        `${a.id} water point report: ${pl(w.fi)}, ${Number.isFinite(d) ? `fire about ${r50(d)} m away` : "far from the fire"}, the shore is drivable${Number.isFinite(d) && d < 300 ? ", smoke is hampering the filling" : ""}.`), tier: "T2_system", channel: "sensor_feed", nav: "vesi_reitit" });
  }
}

/** People and vehicles, only where the world state has them (SPEC/18 §9 V1, V2). */
function people(a: TrafficAircraft, inp: TrafficCycleInput, out: Out, place: string | null, atS: number) {
  const cabins = dist(a.target, FEATURES.CABINS) < 400;
  const village = dist(a.target, FEATURES.VILLAGE) < 500;
  if (!cabins && !village) return;
  const d = inp.fire.distanceM(cabins ? FEATURES.CABINS : FEATURES.VILLAGE, 4000);
  const fireFi = Number.isFinite(d) ? L(`palon reuna noin ${r50(d)} m`, `the fire edge about ${r50(d)} m away`) : L("palo yli 4 km päässä", "the fire more than 4 km away");
  const content = cabins
    ? L(`${a.id} Mökkiranta: 14 mökkiä kuvassa, ${fireFi}. Osa pihoista puuston peitossa; lämpökuvassa ei erotu ihmisiä eikä käynnissä olevia ajoneuvoja. Käyttöastetta ei voida vahvistaa ilmasta.`,
      `${a.id} Mökkiranta: 14 cabins in the image, ${fireFi}. Some yards are under the trees; the thermal image shows no people and no running vehicles. Occupancy cannot be confirmed from the air.`)
    : inp.n >= 17
      ? L(`${a.id} Lahdenkylä: maantiellä autoja liikkeellä pois kylästä, evakuointi käynnissä. Pihoilla vielä ihmisiä ainakin kolmessa talossa (9 taloa, 2 tilaa), ${fireFi}.`,
        `${a.id} Lahdenkylä: cars on the main road leaving the village, evacuation under way. Still people in the yards of at least three houses (9 houses, 2 farms), ${fireFi}.`)
      : L(`${a.id} Lahdenkylä: 9 taloa ja 2 tilaa kuvassa, ${fireFi}. Pihoilla liikettä, ei evakuointia näkyvissä.`, `${a.id} Lahdenkylä: 9 houses and 2 farms in the image, ${fireFi}. Movement in the yards, no evacuation in sight.`);
  out.push({ offsetS: atS, actor: a.id, actor_type: "drone", addressee: "JOHTO", pos: a.target, place, event_type: "detection", task: a.flight, content, tier: "T1_pushed", channel: "radio_command", nav: "kohteet" });
}

/** A thermal multicopter over a point or edge (DR1, DR2; DR3 when it orbits). */
function orbitProducts(a: TrafficAircraft, inp: TrafficCycleInput, out: Out) {
  const { fire, n } = inp;
  const R = THERMAL_FOOTPRINT_M;
  const coversBog = coversBogS(a);
  const { place, edgeFi } = taskPlace(a.flight, coversBog);
  const slot = inp.aircraft.indexOf(a);
  const tgt = a.target;
  const burned = fire.burnedHa(tgt, R), freshHa = fire.freshHa(tgt, R), run = fire.advanceAt(tgt, R), adv = run.m;
  const fresh = fire.fresh.filter((f) => dist(f.p, tgt) <= R);
  const jumped = fresh.filter((f) => f.separate);
  const rate = adv / 20;
  // The intensity is read where the rate was measured, over the same interval (A2): the ground of the cell that advanced most.
  const lc = inp.landCoverAt(run.at ?? tgt);
  const cls = jumped.length > 0 ? Math.max(2, intensityClass(lc, rate, true)) : intensityClass(lc, rate, freshHa > 0);
  // A new separate fire is hot wherever it burns: at least one hot spot per three of its cells.
  const hot = Math.max(inp.detections.filter((d) => dist(d, tgt) <= R).length, Math.ceil(jumped.length / 3));
  const conf = confidenceFi(a.id, n, cls);
  const t0 = stepStartS(n);
  // The sector is the one the target lies in, as for the units (A9); the anchor's name stays the place.
  const loc = { pos: tgt, place, location: sectorOfPoint(tgt) };
  let picture: string;
  // The flame stated: the provisional table's at the rate measured here (SPEC/31 §3.11), at every step (phase A since 20 Oct 2026). A
  // separate fire's own run is not in the footprint's advance (`advanceAt` leaves its cells out): in phase B the separate fire is the
  // rekindled front, whose head run is the step's observed rate (DR2 17:25: the 17:00–17:20 run); phase A's images hold none.
  const flameRate = jumped.length > 0 && n >= PHASE_B_FIRST_STEP ? Math.max(rate, inp.observedRateMpm) : rate;
  const fw = flameWords(cls, flameRate, lc, n);
  // The image's hottest pixel reads the class of the flame stated (one draw either way, so the step's stream is unchanged): a
  // 3–4 m flame with "maks. 283 °C" (DR2 18.25, class-2 temperatures) contradicted itself.
  const tempCls = statedClass(cls, flameRate, lc, n);
  // Fix pass 6: a crown run's rate counts the spot fires that merged with the head (DR1's 38 m/min, evt.c07.010).
  const includesJumps = jumped.length > 0 || (rate >= 25 && inp.spotFires.length > 0);
  if (jumped.length > 0) {
    // What is hot is what burns there: peat and ditch banks only where the new fire is on peat (consistency review item 7).
    const onPeat = jumped.filter((f) => isBog(inp.landCoverAt(f.p))).length * 2 > jumped.length;
    picture = ((t: string) => L(`erillinen palo kuva-alalla, noin ${fmt1(jumped.length * fire.cellHa)} ha, ${fw}; ${onPeat ? "ojanpenkat ja turve kuumia" : "maapuusto ja karike palavat"}, maks. ${t}`,
      `a separate fire in the image, about ${fmt1(jumped.length * fire.cellHa)} ha, ${fw}; ${onPeat ? "ditch banks and peat hot" : "deadwood and litter burning"}, max. ${t}`))(tempFi(Math.max(tempCls, 3), out.draw.rnd));
  } else if (includesJumps && freshHa > 0) {
    // Radio FB-01 / fire FT-C6 (SPEC/31): the pushed crown-run picture (DR1 15.25, V5) said "51,3 m/min" with no caveat; it now says the
    // head advanced through the spot fires' jumps and gives the continuous front's rate without them — the crown run's authored rate
    // (`scenario-18.ts` step 6, 30 m/min, FBP C-2; the CA's 38 m/min and the image's rate include the merged spots; `24` ah.7).
    const outward = run.at ? fire.outwardBearing(run.at, 400) : null;
    const front = frontRateWithoutJumps(n - 1);
    // Worded without "pistepalo" (as EK11's 14:0x line): a lexical match on it takes a V5 retrieval slot from DR1's spot-fire
    // confirmations (`test/server/thinker-review-ah.spec.ts` C2); the recorded measurement keeps "(sisältää pistepalojen hypyt)".
    picture = ((t: string) => L(`kärki edennyt ${dirTo(outward ?? inp.headingDeg)} hyppäyksin noin ${r10(adv)} m (klo ${hm(t0 - 1200)}–${hm(t0)}, ${fmt1(rate)} m/min hypyt mukaan lukien; yhtenäinen reuna noin ${front} m/min), ${fw}, maks. ${t}`,
      `the head has advanced ${dirTo(outward ?? inp.headingDeg)} in jumps, about ${r10(adv)} m (${hm(t0 - 1200)}–${hm(t0)}, ${fmt1(rate)} m/min including the jumps; the continuous front about ${front} m/min), ${fw}, max. ${t}`))(tempFi(tempCls, out.draw.rnd));
  } else if (burned === 0) {
    const d = fire.distanceM(tgt, 4000);
    picture = L(`kuva-alalla ei paloa${Number.isFinite(d) ? `, lähin reuna noin ${r50(d)} m` : ""}`, `no fire in the image${Number.isFinite(d) ? `, nearest edge about ${r50(d)} m` : ""}`);
  } else if (freshHa === 0) {
    picture = ((t: string) => L(`reuna ei ole liikkunut edellisestä kuvasta, liekkejä ei näy; palaneella alalla jälkilämpöä, maks. ${t}`, `the edge has not moved since the last image, no flames; residual heat in the burned area, max. ${t}`))(tempFi(1, out.draw.rnd));
  } else {
    // The direction is the outward normal where the edge advanced most (burned interior to outside), not the drift of the fresh cells'
    // centroid, which flipped on a slow edge between steps; a slow edge (< 2 m/min) is backing, against the wind (fix pass 5, 8 Oct 2026).
    const outward = run.at ? fire.outwardBearing(run.at, 400) : null;
    const dir = rate < BACKING_BELOW_MPM ? dirTo((inp.headingDeg + 180) % 360) : dirTo(outward ?? inp.headingDeg);
    picture = ((t: string) => L(`reuna etenee ${dir} noin ${fmt1(rate)} m/min (klo ${hm(t0 - 1200)}–${hm(t0)}), ${fw}, maks. ${t}`, `the edge is spreading ${dir} at about ${fmt1(rate)} m/min (${hm(t0 - 1200)}–${hm(t0)}), ${fw}, max. ${t}`))(tempFi(tempCls, out.draw.rnd));
  }
  const hotFi = hot > 0 ? L(`${hot} tuoretta lämpöpistettä kuva-alalla`, `${hot} fresh hot spots in the image`) : L("ei uusia lämpöpisteitä kuva-alalla", "no new hot spots in the image");
  const shotAt = 300 + slot * 45;
  // The rekindled front's size is a measurement for the record (phase-B rebuild, 4 Oct 2026): at
  // `NEW_FIRE_STEPS` the thermal image of the new separate fire goes to the sensor feed, not the radio;
  // the crews on it radio that it is new and small (`traffic.ts`).
  const recorded = NEW_FIRE_STEPS.has(n) && jumped.length > 0;
  out.push({ offsetS: shotAt + 40, actor: a.id, actor_type: "drone", addressee: recorded ? null : "JOHTO", ...loc, event_type: "detection", task: a.flight,
    content: L(`${a.id} lämpökuva, ${place ?? "kuva-ala"} klo ${hm(t0 + shotAt)}: ${picture}; ${hotFi}. (${conf}.)`, `${a.id} thermal image, ${pl(place ?? "kuva-ala")} at ${hm(t0 + shotAt)}: ${picture}; ${hotFi}. (${conf}.)`),
    tier: recorded ? "T2_system" : "T1_pushed", channel: recorded ? "sensor_feed" : "radio_command", nav: "ilma" });
  if (freshHa > 0 && jumped.length < fresh.length) {
    const k = statedClass(cls, rate, lc, n);
    out.push({ offsetS: shotAt + 70, actor: a.id, actor_type: "drone", addressee: null, ...loc, event_type: "detection", task: a.flight,
      content: L(`${a.id} mittaus: ${edgeFi} etenemä ${r10(adv)} m klo ${hm(t0 - 1200)}–${hm(t0)} (kahden kuvan vertailu), ${fmt1(rate)} m/min${includesJumps ? " (sisältää pistepalojen hypyt)" : ""}. Intensiteettiluokka ${k}/5, ${fw}. ${cap(conf)}.`,
        `${a.id} measurement: ${edgeFi} advanced ${r10(adv)} m between ${hm(t0 - 1200)} and ${hm(t0)} (two images compared), ${fmt1(rate)} m/min${includesJumps ? " (includes the spot-fire jumps)" : ""}. Intensity class ${k}/5, ${fw}. ${cap(conf)}.`),
      tier: "T2_system", channel: "sensor_feed", nav: "palo" });
  }
  // Where a spot fire is said against the CURRENT head (FF9, 7 Oct 2026: "1360 m from the edge in the previous image"); an
  // old edge flaring up again is an "uudelleensyttymä" (`fire-display.ts` REKINDLE_PREFIX), placed from the point of origin.
  for (const s of inp.spotFires.filter((s) => dist(s.pos, tgt) <= R + 300)) {
    const rekindle = isRekindleCallsign(s.callsign);
    const from = rekindle ? FEATURES.IGN : inp.head;
    const d = r10(dist(from, s.pos)), dir = dirTo(bearing(from, s.pos));
    const ahead = Math.abs(((bearing(inp.head, s.pos) - inp.headingDeg + 540) % 360) - 180) <= 90;
    out.push({ actor: a.id, actor_type: "drone", addressee: "JOHTO", pos: s.pos, place, location: sectorOfPoint(s.pos), event_type: "detection", task: a.flight,
      content: rekindle
        ? L(`${a.id}: uudelleensyttymä ${s.callsign} vahvistettu lämpökuvasta, noin ${d} m syttymäkohdasta ${dir}${dist(FEATURES.IGN, s.pos) > 400 ? ", vanhan reunan tuntumassa" : ""}.`, `${a.id}: rekindle ${s.callsign} confirmed from the thermal image, about ${d} m ${dir} of the point of origin${dist(FEATURES.IGN, s.pos) > 400 ? ", by the old edge" : ""}.`)
        : L(`${a.id}: pistepalo ${s.callsign} vahvistettu lämpökuvasta, noin ${d} m ${ahead ? "kärjen edessä" : "kärjestä"} ${dir}.`, `${a.id}: spot fire ${s.callsign} confirmed from the thermal image, about ${d} m ${dir} of the head${ahead ? ", ahead of it" : ""}.`),
      tier: "T1_pushed", channel: "radio_command", nav: "palo" });
  }
  battery(a, inp, out, place);
  // In the strongest gusts (18.40: 14 m/s) a multicopter does not fly its normal sortie: it holds position low and the loop is shortened.
  const windy = inp.wind.gustMs > THERMAL_DRONE_MAX_GUST_MS;
  if (windy) out.push({ offsetS: 120 + slot * 20, actor: a.id, actor_type: "drone", addressee: "JOHTO", ...loc, event_type: "status", task: a.flight,
    content: L(`${a.id} lentoloki: puuskat ${fmt1(inp.wind.gustMs)} m/s ylittävät ${THERMAL_DRONE_MAX_GUST_MS} m/s rajan, lento rajoitettu: pitää asemaa 100 m korkeudessa${place ? ` (${flatPlace(place)})` : ""}, kuvaus lyhyempinä jaksoina.`,
      `${a.id} flight log: gusts ${fmt1(inp.wind.gustMs)} m/s exceed the ${THERMAL_DRONE_MAX_GUST_MS} m/s limit, flight restricted: holding position at 100 m${place ? ` (${flatPlace(pl(place))})` : ""}, imaging in shorter periods.`),
    tier: "T2_system", channel: "sensor_feed", nav: "ilma" });
  const logAt = 640 + slot * 35;
  const pct = levelNear(a.id, n, logAt);
  if (pct !== null) out.push({ offsetS: logAt, actor: a.id, actor_type: "drone", addressee: null, ...loc, event_type: "status", task: a.flight,
    content: ((alt: number) => L(`${a.id} anturiloki: korkeus ${alt} m, kartoitettu alue noin ${R} m säteellä, akku ${pct} %, viimeisin kuva klo ${hm(t0 + logAt - 20)}.`, `${a.id} sensor log: altitude ${alt} m, mapped area within about ${R} m, battery ${pct} %, last image at ${hm(t0 + logAt - 20)}.`))(windy ? (out.draw.rnd(), 100) : 100 + Math.round(out.draw.rnd() * 2) * 10), tier: "T2_system", channel: "sensor_feed", nav: "ilma" });
  infrastructure(a, inp, out, place, conf, shotAt + 100);
  people(a, inp, out, place, shotAt + 60);
}

/** The rekindled south-east front's name in the mapping loop's active-edge list (F8); English in `traffic-text.ts` SECTOR_EN. */
const SE_FRONT = "Kaakkoisrintama";

/** The VTOL's mapping loop: the whole perimeter, active edges by sector, the smoke plume. */
function loopProducts(a: TrafficAircraft, inp: TrafficCycleInput, out: Out) {
  const { fire, n } = inp;
  const t0 = stepStartS(n);
  const bySector = new Map<string, { ha: number; adv: number }>();
  let jumpedHa = 0;
  for (const f of fire.fresh) {
    if (f.separate) { jumpedHa += fire.cellHa; continue; }
    // F8 (review fixes (ah)): from the rekindle on, the front south of the point of origin is the south-east front, whatever
    // its bearing from the ignition point (DR3 at 17:55 named it "L2-Koillinen", the old head's sector, by bearing alone).
    const s0 = sectorOfPoint(f.p);
    const s = n >= NEW_FRONT_STEP && f.p.y < 0 && (s0 === "L2-Koillinen" || s0 === "L3-Etelä") ? SE_FRONT : s0;
    const e = bySector.get(s) ?? { ha: 0, adv: 0 };
    bySector.set(s, { ha: e.ha + fire.cellHa, adv: Math.max(e.adv, f.advanceM) });
  }
  const active = ["L1-Pohjoinen", "L2-Koillinen", SE_FRONT, "L3-Etelä", "L4-Länsi"].filter((s) => (bySector.get(s)?.ha ?? 0) >= 0.25);
  const headCls = intensityClass(inp.landCoverAt(inp.head), inp.observedRateMpm, true);
  const conf = confidenceFi(a.id, n, headCls);
  const activeFi = active.length === 0
    ? L("reuna ei ole liikkunut missään", "the edge has not moved anywhere")
    : L(`aktiivista reunaa: ${active.map((s) => `${s} (${fmt1(bySector.get(s)!.ha)} ha uutta, enintään ${fmt1(bySector.get(s)!.adv / 20)} m/min)`).join(", ")}`,
      `active edge: ${active.map((s) => `${sec(s)} (${fmt1(bySector.get(s)!.ha)} ha new, up to ${fmt1(bySector.get(s)!.adv / 20)} m/min)`).join(", ")}`);
  const jumpFi = jumpedHa > 0 ? L(` Erillinen uusi palo, noin ${fmt1(jumpedHa)} ha.`, ` A separate new fire, about ${fmt1(jumpedHa)} ha.`) : "";
  // The mapping that measures the rekindled front's size is recorded, as DR2's thermal image is (`orbitProducts`).
  const recorded = NEW_FIRE_STEPS.has(n) && jumpedHa > 0;
  out.push({ offsetS: 930, actor: a.id, actor_type: "drone", addressee: recorded ? null : "JOHTO", pos: a.target, place: "koko kehä", location: sectorOfPoint(a.target), event_type: "detection", task: a.flight,
    content: L(`${a.id} kehäkartoitus valmis klo ${hm(t0 + 900)}: palanut ala noin ${fmt1(inp.areaHa)} ha; ${activeFi} (vertailu ${hm(t0 - 1200)}–${hm(t0)} kuviin).${jumpFi} (${conf}.)`,
      `${a.id} perimeter mapping done at ${hm(t0 + 900)}: burned area about ${fmt1(inp.areaHa)} ha; ${activeFi} (compared with the ${hm(t0 - 1200)}–${hm(t0)} images).${jumpFi} (${conf}.)`),
    tier: recorded ? "T2_system" : "T1_pushed", channel: recorded ? "sensor_feed" : "radio_command", nav: "ilma" });
  const down = (inp.wind.fromDeg + 180) % 360;
  const plume = r50(200 + headCls * 250 + inp.wind.meanMs * 30);
  out.push({ actor: a.id, actor_type: "drone", addressee: null, pos: a.target, place: "koko kehä", location: null, event_type: "detection", task: a.flight,
    content: L(`${a.id} savupatsas: nousee noin ${plume} m, kallistuu ${dirTo(down)}. Savu laskeutuu palon ${dirAdj(down)}puolelle, näkyvyys siellä ${headCls >= 3 ? "alle 100 m" : "200–500 m"}.`,
      `${a.id} smoke column: rising about ${plume} m, leaning ${dirTo(down)}. The smoke settles on the ${dirAdj(down)} side of the fire, visibility there ${headCls >= 3 ? "under 100 m" : "200–500 m"}.`),
    tier: "T2_system", channel: "sensor_feed", nav: "saa" }, "feed");
  battery(a, inp, out, "koko kehä");
  const pct = levelNear(a.id, n, 960);
  if (pct !== null) out.push({ offsetS: 960, actor: a.id, actor_type: "drone", addressee: null, pos: a.target, place: "koko kehä", location: null, event_type: "status", task: a.flight,
    content: ((lap: number) => L(`${a.id} anturiloki: lentokorkeus 120 m, kierros ${lap} min, kartoitettu alue noin 300 m palon reunan ulkopuolelle, akku ${pct} %.`, `${a.id} sensor log: flight altitude 120 m, loop ${lap} min, mapped area about 300 m beyond the edge of the fire, battery ${pct} %.`))(Math.round(14 + out.draw.rnd() * 6)), tier: "T2_system", channel: "sensor_feed", nav: "ilma" });
}

/** The water drone: drops, where it scoops, and the scoop point's state. */
function waterDrone(a: TrafficAircraft, inp: TrafficCycleInput, out: Out) {
  const pond = WATER_POINTS_FI.reduce((x, y) => (dist(y.at, a.target) < dist(x.at, a.target) ? y : x));
  const { place } = taskPlace(a.flight, true);
  const lap = Math.max(3, Math.round(dist(pond.at, a.target) / 400 + 2));
  // As many rounds as fit in the step's ~17–19 flying minutes (positions audit item 15: was 5–8 whatever the round).
  const drops = Math.max(1, Math.floor((17 + out.draw.rnd() * 2) / lap));
  const d = inp.fire.distanceM(pond.at, 3000);
  // Over the wind limit the drops stop (fix pass 5, 8 Oct 2026); they resume the step the gusts are below it again.
  const windy = inp.wind.gustMs > WATER_DRONE_MAX_GUST_MS;
  const resumed = !windy && inp.windPrev !== null && inp.windPrev.gustMs > WATER_DRONE_MAX_GUST_MS;
  const limitFi = L(`puuskat ${fmt1(inp.wind.gustMs)} m/s, raja ${WATER_DRONE_MAX_GUST_MS} m/s`, `gusts ${fmt1(inp.wind.gustMs)} m/s, the limit is ${WATER_DRONE_MAX_GUST_MS} m/s`);
  out.push({ actor: a.id, actor_type: "water_drone", addressee: "JOHTO", pos: a.target, place, location: sectorOfPoint(a.target), event_type: "water_drop", task: a.flight,
    content: windy
      ? L(`${a.id}: pudotukset tauolla, tuuli yli rajan (${limitFi}). Jatkaa, kun puuskat eivät enää ylitä rajaa.`, `${a.id}: drops paused, the wind is over the limit (${limitFi}). Resuming when the gusts no longer exceed the limit.`)
      : L(`${a.id}: ${resumed ? "pudotukset jatkuvat, tuuli ei ole enää yli rajan. " : ""}${drops} pudotusta, ${place ?? "reuna"}, yhteensä noin ${drops * WATER_DRONE_LOAD_L} l. Kauhonta: ${pond.fi}, kierros noin ${lap} min.`, `${a.id}: ${resumed ? "drops resumed, the wind is no longer over the limit. " : ""}${drops} drops, ${pl(place ?? "reuna")}, about ${drops * WATER_DRONE_LOAD_L} l in all. Scooping at ${pl(pond.fi)}, a round of about ${lap} min.`), tier: "T1_pushed", channel: "radio_command", nav: "ilma" });
  const pct = levelNear(a.id, inp.n, 600);
  battery(a, inp, out, place);
  out.push({ offsetS: 600, actor: a.id, actor_type: "water_drone", addressee: null, pos: pond.at, place, location: null, event_type: "status", task: a.flight,
    content: L(`${a.id} järjestelmäloki: ${pct !== null ? `akku ${pct} %` : "akun vaihto käynnissä"}, kuorma ${WATER_DRONE_LOAD_L} l, tuuli pudotuskorkeudella ${fmt1(inp.wind.gustMs)} m/s${windy ? " (yli rajan, pudotukset tauolla)" : ""}; ${pond.fi} ${Number.isFinite(d) && d < 300 ? "savun reunassa, kauhonta hidastuu" : "vapaa savusta"}.`,
      `${a.id} system log: ${pct !== null ? `battery ${pct} %` : "battery swap in progress"}, load ${WATER_DRONE_LOAD_L} l, wind at drop height ${fmt1(inp.wind.gustMs)} m/s${windy ? " (over the limit, drops paused)" : ""}; ${pl(pond.fi)} ${Number.isFinite(d) && d < 300 ? "at the edge of the smoke, scooping slows" : "clear of smoke"}.`), tier: "T2_system", channel: "sensor_feed", nav: "vesi_reitit" }, "feed");
  if (inp.n === 11) {
    out.push({ offsetS: 30, actor: a.id, actor_type: "water_drone", addressee: "JOHTO", pos: a.target, place, event_type: "size_up", task: a.flight,
      content: L(`${a.id} (vesidrooni) valmiina. Kauhoo lähimmästä vesipisteestä, kuorma ${WATER_DRONE_LOAD_L} l, pudotukset pohjoisreunalle Karhujärven suuntaan.`, `${a.id} (water drone) ready. Scooping from the nearest water point, load ${WATER_DRONE_LOAD_L} l, drops on the north edge towards Karhujärvi.`), tier: "T1_pushed", channel: "radio_command", nav: "ilma" });
  }
}

/** Every drone's products this step, then the drone team's status line: which drones are up, over what. */
export function droneTraffic(inp: TrafficCycleInput, out: Out): void {
  for (const a of inp.aircraft) {
    if (a.kind === "drone") (a.flight === "loop" ? loopProducts : orbitProducts)(a, inp, out);
    else if (a.kind === "water_drone") waterDrone(a, inp, out);
  }
  const up = inp.aircraft.filter((a) => a.kind === "drone");
  // After the step's first reports (review 6 Oct 2026, A12): DR1 over Kuivakangas at 14:00:45 came before the
  // first smoke report from the esker (14:01), DR3 over Kuusimäki before the head was reported at its edge.
  out.push({ offsetS: 150, actor: "DRONERYHMÄ", actor_type: "drone", addressee: null, pos: FEATURES.CP, place: "johtopaikka", location: null, event_type: "status", task: null,
    // Radio CS-06 (one spelling, "drooni", as the roster and the briefing) and ST-07 (no "(eteläreuna (L3))": the task after a dash).
    content: L(`Drooniryhmä klo ${hm(stepStartS(inp.n))}: ${up.length === 0 ? "ei drooneja ilmassa" : `ilmassa ${up.map((a) => `${a.id} – ${taskPlace(a.flight, coversBogS(a)).place ?? a.flight}`).join(", ")}`}.`,
      `Drone team at ${hm(stepStartS(inp.n))}: ${up.length === 0 ? "no drones in the air" : `in the air ${up.map((a) => `${a.id} – ${pl(taskPlace(a.flight, coversBogS(a)).place ?? a.flight)}`).join(", ")}`}.`),
    tier: "T2_system", channel: "system_log", nav: "ilma" });
}
