/**
 * Buildings and place names on the generated site (SPEC/33 §2.3 settlement, §9 names).
 *
 * Buildings are scenario-relevant, not decoration ("Ihmiset ja asutus ensin"): the designed ones near the fire (Lahdenkylä along
 * the maantie, Mökkiranta's cottages on Karhujärvi's shore) and, only beyond NO_NEW_BUILDINGS_M of IGN, the farmsteads at their
 * fields, houses along the public roads, the Hiekkala hamlet, shore cottages with their tracks, and a few cabins at road ends.
 *
 * MML 1:50 000 legend: residential and holiday buildings share one symbol (kind "house"); saunas, barns and huts are "muita
 * rakennuksia" (kind "other").
 */

import { Mulberry32 } from "../fire-ca/model.js";
import { PLACE_NAMES_EN } from "../../app/i18n/place-names.js";
import { COTTAGE_ROAD_ENDS, COTTAGES, FIXED_ROADS, MAANTIE_S, MOKKIRANTA_JUNCTION, ROAD_ENDS, roadById, type RoadEnd } from "./roads.js";
import {
  bearingOf, BROOKS, ESKER_CENTRE, HAMLET_S, ISO_RAHKASUO_BASIN, lakeAt, LAKES, landCover, LC_FOREST, polar, RIVER, riverDist,
  RIVER_NAME, VILLAGE, VILLAGE_NAME, type P,
} from "./terrain.js";
import { FARMS, parcelAt } from "./fields.js";

const SEED = 0x2030_0723;
/** No building added after the designed ones may stand closer than this to IGN (fire-ca's burn footprint reaches ~3.5 km). */
export const NO_NEW_BUILDINGS_M = 4500;
/** Kotkanjoki's valley floor (channel, banks, floodplain meadow): no new building within this of it. */
export const VALLEY_FLOOR_M = 120;

export type BuildingKind = "house" | "other";
export interface Building { readonly x: number; readonly y: number; readonly size: number; readonly kind: BuildingKind }

export interface RoadEndStats { deadEnds: number; insideNoBuildZone: number; withBuilding: number; lakeCottages: number; byCls: Record<string, [number, number]> }
export const ROAD_END_STATS: RoadEndStats = { deadEnds: 0, insideNoBuildZone: 0, withBuilding: 0, lakeCottages: 0, byCls: {} };
/** Dead ends inside the no-new-buildings zone, left as bare forest-road endings (reported). */
export const BARE_ENDS_NEAR_IGN: RoadEnd[] = [];

/** Point and road bearing at arc distance s (m, signed) along `road` from its point nearest `at`. */
function roadFrame(road: readonly P[], at: P): (s: number) => { p: P; tangent: number } {
  const arc = [0];
  for (let k = 1; k < road.length; k++) arc.push(arc[k - 1]! + Math.hypot(road[k]!.x - road[k - 1]!.x, road[k]!.y - road[k - 1]!.y));
  const d = (p: P) => Math.hypot(p.x - at.x, p.y - at.y);
  const c = road.reduce((best, p, k) => (d(p) < d(road[best]!) ? k : best), 0);
  return (s) => {
    const target = arc[c]! + s;
    let k = 1;
    while (k < road.length - 1 && arc[k]! < target) k++;
    const a = road[k - 1]!;
    const b = road[k]!;
    const t = Math.max(0, Math.min(1, (target - arc[k - 1]!) / (arc[k]! - arc[k - 1]! || 1)));
    return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, tangent: (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI };
  };
}

/** Firm, dry ground for a building: forest land (not water, mire or a field parcel) off the river's valley floor. */
const firm = (p: P) => landCover(p.x, p.y) === LC_FOREST && riverDist(p.x, p.y, VALLEY_FLOOR_M) >= VALLEY_FLOOR_M;

function buildBuildings(): Building[] {
  const rng = new Mulberry32(SEED ^ 0x5b5b);
  const out: Building[] = [];
  const free = (p: P, m: number) => !out.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < m);
  // Lahdenkylä (VILLAGE-E, SPEC/18 §9 V2): a roadside village, 9 houses along the maantie and 2 farms.
  const along = roadFrame(MAANTIE_S, VILLAGE);
  for (let i = 0; i < 9; i++) {
    const { p, tangent } = along((i - 4) * 95 + (rng.nextFloat() - 0.5) * 30);
    const h = polar(tangent + (i % 2 === 0 ? 90 : -90), 30 + rng.nextFloat() * 15);
    out.push({ x: p.x + h.x, y: p.y + h.y, size: 14, kind: "house" });
  }
  for (const p of [polar(200, 380), polar(60, 420)]) {
    out.push({ x: VILLAGE.x + p.x, y: VILLAGE.y + p.y, size: 22, kind: "house" });
    out.push({ x: VILLAGE.x + p.x + 30, y: VILLAGE.y + p.y - 25, size: 16, kind: "other" });
  }
  // Mökkiranta (SPEC/18 §9 V1): 14 cottages on Karhujärvi's sandy south-east shore, either side of the road's end.
  const karhu = LAKES.find((l) => l.name === "Karhujärvi")!;
  const base = bearingOf(MOKKIRANTA_JUNCTION.x - karhu.cx, MOKKIRANTA_JUNCTION.y - karhu.cy);
  for (let k = 0; k < 14; k++) {
    const b = base + (k - 6.5) * 4.6;
    for (let s = 0; s < 1600; s += 5) {
      const q = polar(b, s);
      if (lakeAt(karhu.cx + q.x, karhu.cy + q.y)?.id !== karhu.id) { const o = polar(b, s + 22); out.push({ x: karhu.cx + o.x, y: karhu.cy + o.y, size: 9, kind: "house" }); break; }
    }
  }
  // --- Beyond NO_NEW_BUILDINGS_M only -------------------------------------------------------------
  const rng2 = new Mulberry32(SEED ^ 0x6d6d);
  const outside = (p: P) => Math.hypot(p.x, p.y) > NO_NEW_BUILDINGS_M + 50;
  // Farmsteads: the house and two outbuildings in the yard.
  for (const f of FARMS) {
    for (let i = 0; i < 3; i++) {
      const p = polar(rng.nextFloat() * 360, i === 0 ? 0 : 25 + rng.nextFloat() * 25);
      const q = { x: f.x + p.x, y: f.y + p.y };
      if (parcelAt(q.x, q.y) < 0) out.push({ x: q.x, y: q.y, size: i === 0 ? 18 : 12, kind: i === 0 ? "house" : "other" });
    }
  }
  // Hiekkala: five houses, each with an outbuilding, 45 m either side of the southern road.
  const south = roadFrame(roadById("hiekkala").line, HAMLET_S);
  for (let j = 0; j < 5; j++) {
    const { p, tangent } = south((j - 2) * 110);
    const side = j % 2 === 0 ? 90 : -90;
    const h = polar(tangent + side, 45);
    const o = polar(tangent + side, 75);
    const house = { x: p.x + h.x, y: p.y + h.y };
    if (!firm(house)) continue;
    out.push({ ...house, size: 14, kind: "house" });
    out.push({ x: p.x + o.x + 15, y: p.y + o.y, size: 10, kind: "other" });
  }
  // Houses along the public and village roads: every few hundred metres, set back 35–50 m, on firm ground at a field edge or in
  // the forest; a few with an outbuilding.
  for (const road of FIXED_ROADS) {
    if (road.cls !== "main" && road.cls !== "gravel") continue;
    let s = 200 + rng2.nextFloat() * 400;
    const frame = roadFrame(road.line, road.line[0]!);
    const total = road.line.reduce((t, p, k) => (k ? t + Math.hypot(p.x - road.line[k - 1]!.x, p.y - road.line[k - 1]!.y) : 0), 0);
    for (; s < total - 50; s += 300 + rng2.nextFloat() * 700) {
      if (rng2.nextFloat() > 0.42) continue;
      const { p, tangent } = frame(s);
      const h = polar(tangent + (rng2.nextFloat() < 0.5 ? 90 : -90), 35 + rng2.nextFloat() * 15);
      const q = { x: p.x + h.x, y: p.y + h.y };
      if (!outside(q) || !firm(q) || !free(q, 120)) continue;
      out.push({ ...q, size: 13, kind: "house" });
      if (rng2.nextFloat() < 0.6) out.push({ x: q.x + 22, y: q.y - 16, size: 9, kind: "other" });
    }
  }
  // Shore cottages: the cottage set back from the water, its sauna at the water's edge.
  const cottage = (c: P, toWater: number) => {
    const sauna = polar(toWater, 25);
    out.push({ x: c.x, y: c.y, size: 10, kind: "house" });
    out.push({ x: c.x + sauna.x, y: c.y + sauna.y, size: 6, kind: "other" });
    ROAD_END_STATS.lakeCottages++;
  };
  for (const c of COTTAGES) cottage(c, c.toWater);
  for (const { end, toWater } of COTTAGE_ROAD_ENDS) {
    for (const off of [0, 120, -120]) {
      const side = polar(toWater + 90, off);
      const q = { x: end.x + side.x, y: end.y + side.y };
      if (firm(q) && free(q, 80) && outside(q)) cottage(q, toWater);
    }
  }
  // Road ends: a turning place in the forest; one in six forest roads ends at a house, a few tracks at a hut.
  for (const end of ROAD_ENDS) {
    ROAD_END_STATS.deadEnds++;
    if (!outside(end)) { ROAD_END_STATS.insideNoBuildZone++; BARE_ENDS_NEAR_IGN.push(end); continue; }
    const tally = (ROAD_END_STATS.byCls[end.cls] ??= [0, 0]);
    tally[0]++;
    const u = rng2.nextFloat();
    const at = polar(end.heading, 25);
    const p = { x: end.x + at.x, y: end.y + at.y };
    if (!firm(p) || !free(p, 150)) continue;
    if (end.cls === "forest" && u < 0.17) {
      out.push({ ...p, size: u < 0.05 ? 8 : 13, kind: "house" });
      if (u >= 0.05) out.push({ x: p.x + 24, y: p.y - 15, size: 9, kind: "other" });
    } else if (end.cls === "track" && u < 0.1) out.push({ ...p, size: 7, kind: "other" });
    else continue;
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
  for (const l of LAKES) if (l.name) labels.push({ text: l.name, x: l.big ? l.cx - 300 : l.cx, y: l.big ? l.cy - 150 : l.cy, style: "water" });
  const riverMid = RIVER[Math.floor(RIVER.length * 0.62)]!;
  labels.push({ text: RIVER_NAME, x: riverMid.x + 260, y: riverMid.y, style: "water" });
  for (const b of BROOKS) {
    if (b.name === "puro") continue;
    const m = b.line[Math.floor(b.line.length * 0.35)]!;
    labels.push({ text: b.name, x: m.x, y: m.y + 90, style: "water" });
  }
  labels.push({ text: VILLAGE_NAME, x: VILLAGE.x + 250, y: VILLAGE.y - 380, style: "village" });
  labels.push({ text: "Hiekkala", x: HAMLET_S.x + 260, y: HAMLET_S.y + 60, style: "place" });
  labels.push({ text: "Mökkiranta", x: MOKKIRANTA_JUNCTION.x + 330, y: MOKKIRANTA_JUNCTION.y + 40, style: "place" });
  // The contract's named terrain (SPEC/33 §3): Rahkasuo and Kuusimäki at their anchors, Honkaharju on the esker crest by its road.
  const bog = polar(168, 1250);
  labels.push({ text: "Rahkasuo", x: bog.x, y: bog.y, style: "bog" });
  labels.push({ text: "Iso-Rahkasuo", x: ISO_RAHKASUO_BASIN.cx, y: ISO_RAHKASUO_BASIN.cy, style: "bog" });
  labels.push({ text: "Kuivakangas", x: ESKER_CENTRE.x + 420, y: ESKER_CENTRE.y + 60, style: "terrain" });
  const spr = polar(47, 1750);
  labels.push({ text: "Kuusimäki", x: spr.x, y: spr.y, style: "terrain" });
  labels.push({ text: "Korpilaakso", x: -400, y: 1720, style: "terrain" });
  labels.push({ text: "Honkaharju", x: 600, y: -400, style: "terrain" });
  for (const f of FARMS) if (f.name) labels.push({ text: f.name, x: f.x + 140, y: f.y + 120, style: "place" });
  return labels;
}
