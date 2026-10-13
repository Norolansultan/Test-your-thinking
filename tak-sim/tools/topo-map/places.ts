/**
 * Buildings and place names on the generated site (SPEC/23 §11, §13).
 *
 * Buildings are scenario-relevant, not decoration ("Ihmiset ja asutus ensin"): the designed ones
 * (VILLAGE-E, Mökkiranta, farmsteads) are unchanged, and every building added since — the Hiekkala
 * hamlet, the Iso-Hirvijärvi cottages and the buildings at road ends — stands at least
 * NO_NEW_BUILDINGS_M from IGN, beyond the fire's reach and the scenario's operating area.
 *
 * MML 1:50 000 legend: residential and holiday buildings share one symbol ("asuin-, loma-, liike- ja
 * yleisiä rakennuksia", kind "house"); saunas, barns and huts are "muita rakennuksia" (kind "other").
 */

import { Mulberry32 } from "../fire-ca/model.js";
import { PLACE_NAMES_EN } from "../../app/i18n/place-names.js";
import { COTTAGE_ROAD_ENDS, MAANTIE_S, ROAD_ENDS, SOUTH_ROAD, type RoadEnd } from "./roads.js";
import {
  BROOKS,
  elevation,
  ESKER_CENTRE,
  FARMS,
  HAMLET_S,
  inLake,
  inWater,
  lakeAt,
  LAKES,
  landCover,
  LC_DRAINED_BOG,
  LC_OPEN_BOG,
  LC_PINE_BOG,
  polar,
  RIVER,
  riverDist,
  RIVER_NAME,
  VILLAGE,
  VILLAGE_NAME,
  type P,
} from "./terrain.js";

const SEED = 0x2030_0723;
/** No building added after the designed ones may stand closer than this to IGN (fire-ca's burn
 * footprint reaches ~3.5 km; the operating area 3–4 km). */
export const NO_NEW_BUILDINGS_M = 4500;
/** Kotkanjoki's valley floor (channel, banks, floodplain meadow): no new building within this of it. */
export const VALLEY_FLOOR_M = 120;

export type BuildingKind = "house" | "other";
export interface Building { readonly x: number; readonly y: number; readonly size: number; readonly kind: BuildingKind }

/** Steps from `from` along `bearing` until a lake's edge (≤ maxM); null if no lake that way. River
 * shores are skipped: buildings stay off Kotkanjoki's valley floor. */
function shoreAlong(from: P, bearing: number, maxM: number): P | null {
  for (let s = 5; s <= maxM; s += 5) {
    const p = polar(bearing, s);
    if (riverDist(from.x + p.x, from.y + p.y, VALLEY_FLOOR_M) < VALLEY_FLOOR_M) return null;
    if (lakeAt(from.x + p.x, from.y + p.y)) {
      const q = polar(bearing, s - 5);
      return { x: from.x + q.x, y: from.y + q.y };
    }
  }
  return null;
}

/** A shore cottage: the cottage set back from the water, its sauna at the water's edge. */
function cottage(out: Building[], edge: P, bearingToWater: number): void {
  const back = polar(bearingToWater + 180, 40);
  const saunaBack = polar(bearingToWater + 180, 10);
  out.push({ x: edge.x + back.x, y: edge.y + back.y, size: 10, kind: "house" });
  out.push({ x: edge.x + saunaBack.x, y: edge.y + saunaBack.y, size: 6, kind: "other" });
}

export interface RoadEndStats {
  deadEnds: number; insideNoBuildZone: number; withBuilding: number; lakeCottages: number;
  /** Per class, dead ends outside the no-build zone: [total, with a building]. */
  byCls: Record<string, [number, number]>;
}
export const ROAD_END_STATS: RoadEndStats = { deadEnds: 0, insideNoBuildZone: 0, withBuilding: 0, lakeCottages: 0, byCls: {} };
/** Dead ends inside the no-new-buildings zone, left as bare forest-road endings (reported). */
export const BARE_ENDS_NEAR_IGN: RoadEnd[] = [];

/** Point and road bearing at arc distance s (m, signed) along `road` from its point nearest VILLAGE. */
function villageRoadFrame(road: readonly P[]): (s: number) => { p: P; tangent: number } {
  const arc = [0];
  for (let k = 1; k < road.length; k++) arc.push(arc[k - 1]! + Math.hypot(road[k]!.x - road[k - 1]!.x, road[k]!.y - road[k - 1]!.y));
  const d = (p: P) => Math.hypot(p.x - VILLAGE.x, p.y - VILLAGE.y);
  const c = road.reduce((best, p, k) => (d(p) < d(road[best]!) ? k : best), 0);
  return (s) => {
    const target = arc[c]! + s;
    let k = 1;
    while (k < road.length - 1 && arc[k]! < target) k++;
    const a = road[k - 1]!;
    const b = road[k]!;
    const t = Math.max(0, Math.min(1, (target - arc[k - 1]!) / (arc[k]! - arc[k - 1]!)));
    return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, tangent: (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI };
  };
}

function buildBuildings(): Building[] {
  const rng = new Mulberry32(SEED ^ 0x5b5b);
  const out: Building[] = [];
  // VILLAGE-E: 9 houses and 2 farms (SPEC/18 §9 V2). A roadside village (tienvarsikylä): the houses
  // stand along the maantie either side of the village centre, alternating sides, 80–110 m apart and
  // 30–45 m back from the road (was a random scatter over the fields). Two draws per house, as before,
  // so the farmsteads' draws below are unchanged.
  const along = villageRoadFrame(MAANTIE_S);
  for (let i = 0; i < 9; i++) {
    const { p, tangent } = along((i - 4) * 95 + (rng.nextFloat() - 0.5) * 30);
    const h = polar(tangent + (i % 2 === 0 ? 90 : -90), 30 + rng.nextFloat() * 15);
    out.push({ x: p.x + h.x, y: p.y + h.y, size: 14, kind: "house" });
  }
  for (const p of [polar(200, 380), polar(60, 420)]) {
    out.push({ x: VILLAGE.x + p.x, y: VILLAGE.y + p.y, size: 22, kind: "house" });
    out.push({ x: VILLAGE.x + p.x + 30, y: VILLAGE.y + p.y - 25, size: 16, kind: "other" });
  }
  // Mökkiranta: 14 cottages on Karhujärvi's shore facing IGN (SPEC/18 §9 V1).
  const lake = LAKES[0]!;
  for (let i = 0; i < 14; i++) {
    const bearing = 95 + i * 7.5;
    for (let r = lake.r * 0.7; r < lake.r * 1.8; r += 5) {
      const p = polar(bearing, r);
      if (!inLake(lake, lake.cx + p.x, lake.cy + p.y)) {
        const q = polar(bearing, r + 22);
        out.push({ x: lake.cx + q.x, y: lake.cy + q.y, size: 9, kind: "house" });
        break;
      }
    }
  }
  // Farmsteads: the house and two outbuildings.
  for (const f of FARMS) {
    if (f.fieldOnly) continue;
    for (let i = 0; i < 3; i++) {
      const p = polar(rng.nextFloat() * 360, 20 + rng.nextFloat() * 50);
      out.push({ x: f.x + p.x, y: f.y + p.y, size: i === 0 ? 18 : 12, kind: i === 0 ? "house" : "other" });
    }
  }

  // --- Added in SPEC/23 §13; all ≥ NO_NEW_BUILDINGS_M from IGN ------------------------------
  const rng2 = new Mulberry32(SEED ^ 0x6d6d);
  // Free of other buildings within m, and itself (with its 50 m yard) outside the no-new-buildings zone.
  const clear = (p: P, m: number) => Math.hypot(p.x, p.y) > NO_NEW_BUILDINGS_M + 50 && !out.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < m);

  // Hiekkala: five houses, each with an outbuilding, set back 45 m either side of the southern road.
  const south = SOUTH_ROAD;
  const near = south.map((p, k) => ({ p, k })).filter(({ p }) => Math.hypot(p.x - HAMLET_S.x, p.y - HAMLET_S.y) < 330);
  for (let j = 0; j < near.length; j += Math.max(1, Math.floor(near.length / 5))) {
    const { p, k } = near[j]!;
    const q = south[Math.min(k + 1, south.length - 1)]!;
    const side = j % 2 === 0 ? 90 : -90;
    const tangent = (Math.atan2(q.x - p.x, q.y - p.y) * 180) / Math.PI;
    const h = polar(tangent + side, 45);
    const o = polar(tangent + side, 75);
    out.push({ x: p.x + h.x, y: p.y + h.y, size: 14, kind: "house" });
    out.push({ x: p.x + o.x + 15, y: p.y + o.y, size: 10, kind: "other" });
  }

  // Iso-Hirvijärvi and Pirttilampi: three cottages with shore saunas where each cottage road ends.
  for (const { end, toWater } of COTTAGE_ROAD_ENDS) {
    for (const off of [0, 110, -110]) {
      const side = polar(toWater + 90, off);
      const back = polar(toWater, -60);
      const edge = shoreAlong({ x: end.x + side.x + back.x, y: end.y + side.y + back.y }, toWater, 400);
      if (edge) { cottage(out, edge, toWater); ROAD_END_STATS.lakeCottages++; }
    }
  }

  // Road ends: most dead-end tracks lead somewhere. Shore ends get a summer cottage and sauna;
  // other forest-road ends often a house (with an outbuilding) or a hunting cabin; the rest are
  // logging sites / turning places. None on peat, none inside NO_NEW_BUILDINGS_M.
  for (const end of ROAD_ENDS) {
    if (end.cls === "path") continue;
    ROAD_END_STATS.deadEnds++;
    if (Math.hypot(end.x, end.y) < NO_NEW_BUILDINGS_M) { ROAD_END_STATS.insideNoBuildZone++; BARE_ENDS_NEAR_IGN.push(end); continue; }
    const tally = (ROAD_END_STATS.byCls[end.cls] ??= [0, 0]);
    tally[0]++;
    const lc = landCover(end.x, end.y, elevation(end.x, end.y));
    if (lc === LC_OPEN_BOG || lc === LC_PINE_BOG || lc === LC_DRAINED_BOG) continue;
    let water: { edge: P; bearing: number } | null = null;
    for (let b = 0; b < 360 && !water; b += 30) {
      const edge = shoreAlong(end, end.heading + b, 90);
      if (edge) water = { edge, bearing: end.heading + b };
    }
    const u = rng2.nextFloat();
    const at = polar(end.heading, 25);
    const p = { x: end.x + at.x, y: end.y + at.y };
    if (riverDist(p.x, p.y, VALLEY_FLOOR_M) < VALLEY_FLOOR_M) continue;
    if (water && u < (end.cls === "forest" ? 0.9 : 0.7) && clear(water.edge, 120)) {
      cottage(out, water.edge, water.bearing);
    } else if (!water && end.cls === "forest" && u < 0.7 && clear(p, 150) && !inWater(p.x, p.y)) {
      // House with an outbuilding, or (1 in 7) a hunting cabin.
      const hunting = u < 0.1;
      out.push({ x: p.x, y: p.y, size: hunting ? 8 : 14, kind: "house" });
      if (!hunting) out.push({ x: p.x + 28, y: p.y - 18, size: 10, kind: "other" });
    } else if (!water && end.cls === "track" && u < 0.25 && clear(p, 150) && !inWater(p.x, p.y)) {
      out.push({ x: p.x, y: p.y, size: 8, kind: "other" }); // forest hut / hay barn
    } else continue;
    ROAD_END_STATS.withBuilding++;
    tally[1]++;
  }
  return out;
}

export const BUILDINGS: readonly Building[] = buildBuildings();

export type LabelStyle = "place" | "village" | "water" | "bog" | "terrain" | "height" | "small";
export interface Label { readonly text: string; readonly x: number; readonly y: number; readonly style: LabelStyle }

/** A map label's English (revision (ae)): from the one table, `app/i18n/place-names.ts`; a name it lacks is a build error. */
export function englishLabel(fi: string): string {
  const en = PLACE_NAMES_EN[fi];
  if (en === undefined) throw new Error(`map label "${fi}" has no English in app/i18n/place-names.ts`);
  return en;
}

export function namedLabels(): Label[] {
  const labels: Label[] = [];
  for (const l of LAKES) labels.push({ text: l.name, x: l.big ? l.cx - 300 : l.cx, y: l.big ? l.cy - 150 : l.cy, style: "water" });
  const riverMid = RIVER[Math.floor(RIVER.length * 0.62)]!;
  labels.push({ text: RIVER_NAME, x: riverMid.x + 260, y: riverMid.y, style: "water" });
  for (const b of BROOKS) {
    const m = b.line[Math.floor(b.line.length * 0.3)]!;
    labels.push({ text: b.name, x: m.x, y: m.y + 90, style: "water" });
  }
  labels.push({ text: VILLAGE_NAME, x: VILLAGE.x + 250, y: VILLAGE.y - 380, style: "village" });
  labels.push({ text: "Hiekkala", x: HAMLET_S.x + 260, y: HAMLET_S.y + 60, style: "place" });
  const shore = polar(140, 2080 + 60);
  labels.push({ text: "Mökkiranta", x: polar(320, 2500).x + shore.x * 0.05 + 380, y: polar(320, 2500).y - 300, style: "place" });
  const bog = polar(168, 1250);
  labels.push({ text: "Rahkasuo", x: bog.x, y: bog.y, style: "bog" });
  labels.push({ text: "Iso-Rahkasuo", x: -2400, y: -300, style: "bog" });
  labels.push({ text: "Kuivakangas", x: ESKER_CENTRE.x + 420, y: ESKER_CENTRE.y + 60, style: "terrain" });
  const spr = polar(47, 1750);
  labels.push({ text: "Kuusimäki", x: spr.x, y: spr.y, style: "terrain" });
  labels.push({ text: "Korpilaakso", x: -2300, y: 1250, style: "terrain" });
  labels.push({ text: "Honkaharju", x: 250, y: -250, style: "terrain" });
  for (const f of FARMS) if (!f.fieldOnly) labels.push({ text: f.name, x: f.x + 180, y: f.y + 160, style: "place" });
  return labels;
}
