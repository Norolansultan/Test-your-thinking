/**
 * The generated site's road network (SPEC/23 §11, §13): the designed roads (FIXED_ROADS), then
 * forest roads, drive paths, footpaths and farm access roads grown from them the way Finnish forest-road
 * networks are laid out — a metsäautotie leaves an existing road at roughly right angles, runs
 * fairly straight on firm mineral ground (steering around mires, water and steep knoll sides,
 * crossing peat only where it must), and ends in the forest or joins another road; side roads and
 * drive paths (ajopolku) branch off it. Deterministic (seeded).
 */

import { Mulberry32 } from "../fire-ca/model.js";
import {
  bearingOf,
  BRIDGE,
  closestOnPolyline,
  elevation,
  FARMS,
  HALF_M,
  HAMLET_S,
  inLake,
  inWater,
  LAKES,
  landCover,
  LC_DRAINED_BOG,
  LC_FIELD,
  LC_OPEN_BOG,
  LC_PINE_BOG,
  meander,
  polar,
  RIVER,
  riverCrossings,
  type P,
} from "./terrain.js";

// ---------------------------------------------------------------------------
// Designed roads (SPEC/18 §5)
// ---------------------------------------------------------------------------

/** MML 1:50 000 classes: main = II a/b autotie, gravel = III a/b yksikaistainen autotie,
 * forest = ajotie (metsäautotie), track = ajopolku, path = polku. */
export type RoadClass = "main" | "gravel" | "forest" | "track" | "path";
export interface Road { readonly cls: RoadClass; readonly line: readonly P[] }

export const COMMAND_POINT: P = { x: -1000, y: 400 };
export { BRIDGE };

export const MAANTIE_S = meander([{ x: -10000, y: -3300 }, { x: -5000, y: -3650 }, { x: -1500, y: -3500 }, { x: 1000, y: -2900 }, { x: 2050, y: -2250 }, { x: 4000, y: -2600 }, { x: 10000, y: -1800 }], 60, 70, 1400, 11);

/** Second timber bridge: where the southern gravel road crosses Kotkanjoki. */
export const BRIDGE_S: P = RIVER.reduce((a, p) => (Math.abs(p.y + 7800) < Math.abs(a.y + 7800) ? p : a));

/** End of a cottage road: walking from x0 along latitude y toward the lake (dir ±1), 90 m short of the water. */
function shoreRoadEnd(lakeName: string, x0: number, y: number, dir: 1 | -1): P {
  const lake = LAKES.find((l) => l.name === lakeName)!;
  let x = x0;
  while (!inLake(lake, x, y) && Math.abs(x - lake.cx) > 1) x += 10 * dir;
  return { x: x - 90 * dir, y };
}

/** Cottage roads' ends and the bearing from each toward its lake (places.ts puts cottages there). */
export const COTTAGE_ROAD_ENDS: readonly { readonly end: P; readonly toWater: number }[] = [
  { end: shoreRoadEnd("Iso-Hirvijärvi", 5000, -8150, 1), toWater: 90 },
  { end: shoreRoadEnd("Pirttilampi", -4000, -7900, -1), toWater: 270 },
];

/** Land point behind a lake's shore: out from the centre on `bearing` to the water's edge, then `setback` m on. */
function behindShore(lakeName: string, bearing: number, setback: number): P {
  const lake = LAKES.find((l) => l.name === lakeName)!;
  let r = lake.r * 0.7;
  while (inLake(lake, lake.cx + polar(bearing, r).x, lake.cy + polar(bearing, r).y)) r += 5;
  const p = polar(bearing, r + setback);
  return { x: lake.cx + p.x, y: lake.cy + p.y };
}

/** Mökkiranta (SPEC/18 §9 V1): the 14 cottages stand on Karhujärvi's shore at bearings 95°–192.5°
 * from its centre (places.ts). The gravel road ends 70 m behind the shore at the middle of the row
 * (beside CABINS in deployment.ts), and a track runs either way along the row, 70 m behind the shore. */
const MOKKIRANTA_JUNCTION = behindShore("Karhujärvi", 140, 70);
const mokkirantaArm = (bearings: readonly number[], salt: number): P[] => {
  const line = meander([MOKKIRANTA_JUNCTION, ...bearings.map((b) => behindShore("Karhujärvi", b, 70))], 20, 8, 300, salt);
  line[0] = MOKKIRANTA_JUNCTION;
  return line;
};
/** The Karhujärvi road as designed (its tail ran into the lake) — kept for growing the generated
 * network, which draws its branch points along it, so the rest of the map is unchanged — and as built:
 * cut where it comes nearest the junction and ended there. */
const KARHU_ROAD_DESIGNED = meander([{ x: -600, y: 400 }, { x: -900, y: 1100 }, { x: -1300, y: 1600 }, { x: -1700, y: 1640 }], 40, 30, 500, 16);
const KARHU_ROAD: readonly P[] = (() => {
  const d = (p: P) => Math.hypot(p.x - MOKKIRANTA_JUNCTION.x, p.y - MOKKIRANTA_JUNCTION.y);
  const k = KARHU_ROAD_DESIGNED.reduce((best, p, i) => (d(p) < d(KARHU_ROAD_DESIGNED[best]!) ? i : best), 0);
  return [...KARHU_ROAD_DESIGNED.slice(0, k), MOKKIRANTA_JUNCTION];
})();
const MOKKIRANTA_TRACKS: readonly Road[] = [
  { cls: "track", line: mokkirantaArm([130, 120, 110, 100, 92], 21) },
  { cls: "track", line: mokkirantaArm([150, 160, 170, 180, 190, 196], 22) },
];

/** Meandered polyline pinned exactly to both its end points (junctions, bridge). */
function pinned(points: readonly P[], amp: number, wl: number, salt: number): P[] {
  const line = meander(points, 40, amp, wl, salt);
  line[0] = points[0]!;
  return line;
}

/** Southern yksityistie: from the maantie through Hiekkala, over Kotkanjoki (BRIDGE_S) to the
 * cottages on Iso-Hirvijärvi. All of it lies ≥ 3.5 km south of IGN, beyond the fire's reach. */
export const SOUTH_ROAD: readonly P[] = [
  ...pinned([closestOnPolyline(-1500, -3500, MAANTIE_S), { x: -1750, y: -5000 }, { x: -1250, y: -6300 }, HAMLET_S, { x: -700, y: -6900 }, { x: 900, y: -7400 }, { x: 2400, y: -7700 }, BRIDGE_S], 55, 800, 18),
  ...pinned([BRIDGE_S, { x: 5200, y: -8000 }, COTTAGE_ROAD_ENDS[0]!.end], 45, 700, 19).slice(1),
];

export const FIXED_ROADS: readonly Road[] = [
  // Maantie through the village (red): SPEC/18 §5 reinforcement and evacuation routes.
  { cls: "main", line: MAANTIE_S },
  { cls: "main", line: meander([{ x: -10000, y: 7200 }, { x: -3000, y: 7600 }, { x: 4000, y: 8000 }, { x: 10000, y: 8300 }], 60, 90, 1600, 12) },
  // R3 west: from the maantie north to the command point at the R1/R3 junction.
  { cls: "gravel", line: meander([{ x: -1500, y: -3500 }, { x: -1800, y: -2000 }, { x: -1300, y: -800 }, COMMAND_POINT], 40, 50, 700, 13) },
  // R1: E–W forest road 400 m north of IGN.
  { cls: "gravel", line: [COMMAND_POINT, { x: 0, y: 400 }, { x: 1500, y: 420 }, { x: 2600, y: 400 }] },
  // R3 east: across the timber bridge (load limit), pinned exactly to it and to R1's end, and on east.
  { cls: "gravel", line: [...pinned([{ x: 2600, y: 400 }, BRIDGE], 20, 300, 14), ...pinned([BRIDGE, { x: 5000, y: 700 }, { x: 10000, y: 1200 }], 60, 900, 14).slice(1)] },
  // R2: along the east side, crossing BOG-S's east edge, to the village.
  { cls: "gravel", line: meander([{ x: 1500, y: 420 }, { x: 1500, y: -1000 }, { x: 1520, y: -2000 }, { x: 2000, y: -2250 }], 40, 40, 600, 15) },
  // Road to the cottages on Karhujärvi (Mökkiranta); ROADS carries KARHU_ROAD, ending on land.
  { cls: "gravel", line: KARHU_ROAD_DESIGNED },
  // Peat-road spur to Iso-Rahkasuo, west.
  { cls: "gravel", line: meander([{ x: -1800, y: -2000 }, { x: -2100, y: -1200 }, { x: -2350, y: -500 }], 40, 35, 550, 17) },
  { cls: "gravel", line: SOUTH_ROAD },
  // West from Hiekkala to the cottages on Pirttilampi's east shore.
  { cls: "gravel", line: pinned([closestOnPolyline(-1300, -6250, SOUTH_ROAD), { x: -2600, y: -6850 }, { x: -3900, y: -7450 }, COTTAGE_ROAD_ENDS[1]!.end], 45, 700, 20) },
];

// ---------------------------------------------------------------------------
// Generated minor roads
// ---------------------------------------------------------------------------

const STEP_M = 40;
const OCC_M = 40;
const OCC_N = Math.ceil((2 * HALF_M) / OCC_M);

const angleDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

interface Grow {
  readonly cls: RoadClass;
  readonly maxLen: number;
  /** Heading to hold (deg), or a point to head for. */
  readonly heading?: number;
  readonly target?: P;
  /** Road the new one starts on; joins to it are ignored for the first 300 m. */
  readonly parent: number;
  /** Cost of crossing peat (paths use duckboards and care less). */
  readonly bogCost: number;
  readonly wander: number;
}

/** Where a generated road dead-ends (does not join another road); places.ts decides what stands there. */
export interface RoadEnd { readonly x: number; readonly y: number; readonly cls: RoadClass; readonly heading: number }

function buildRoads(ends: RoadEnd[]): Road[] {
  const rng = new Mulberry32(0x2030_0723 ^ 0x3c3c);
  const roads: Road[] = [...FIXED_ROADS];
  const occ = new Int32Array(OCC_N * OCC_N).fill(-1);
  const cellOf = (x: number, y: number) => {
    const c = Math.floor((x + HALF_M) / OCC_M);
    const r = Math.floor((y + HALF_M) / OCC_M);
    return c < 0 || r < 0 || c >= OCC_N || r >= OCC_N ? -1 : r * OCC_N + c;
  };
  const mark = (line: readonly P[], id: number) => {
    for (let k = 0; k + 1 < line.length; k++) {
      const a = line[k]!;
      const b = line[k + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 15));
      for (let s = 0; s <= n; s++) {
        const i = cellOf(a.x + ((b.x - a.x) * s) / n, a.y + ((b.y - a.y) * s) / n);
        if (i >= 0) occ[i] = id;
      }
    }
  };
  const roadNear = (x: number, y: number, ignore: number): number => {
    const c0 = Math.floor((x + HALF_M) / OCC_M);
    const r0 = Math.floor((y + HALF_M) / OCC_M);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const c = c0 + dc;
      const r = r0 + dr;
      if (c < 0 || r < 0 || c >= OCC_N || r >= OCC_N) continue;
      const id = occ[r * OCC_N + c]!;
      if (id >= 0 && id !== ignore) return id;
    }
    return -1;
  };
  const cost = (x: number, y: number, fromE: number, bogCost: number) => {
    if (Math.abs(x) > HALF_M - 20 || Math.abs(y) > HALF_M - 20 || inWater(x, y)) return { c: Infinity, e: fromE };
    const e = elevation(x, y);
    const slope = Math.abs(e - fromE) / STEP_M;
    const lc = landCover(x, y, e);
    let c = slope > 0.1 ? 3 + slope * 30 : slope * 12;
    if (lc === LC_OPEN_BOG || lc === LC_PINE_BOG || lc === LC_DRAINED_BOG) c += bogCost;
    else if (lc === LC_FIELD) c += 0.4;
    return { c, e };
  };

  /** Grows a road; `joined` is false when it dead-ends (in the forest, or at water). */
  const grow = (start: P, g: Grow): { line: P[]; joined: boolean } => {
    const line: P[] = [start];
    let x = start.x;
    let y = start.y;
    let e = elevation(x, y);
    let h = g.heading ?? bearingOf(g.target!.x - x, g.target!.y - y);
    // The preferred heading itself drifts slowly (±40° of the initial bearing), so roads curve
    // gently over hundreds of metres instead of running ruler-straight.
    let drift = 0;
    for (let s = STEP_M; s <= g.maxLen; s += STEP_M) {
      drift = Math.max(-40, Math.min(40, drift + (rng.nextFloat() - 0.5) * 9));
      const pref = g.target ? bearingOf(g.target.x - x, g.target.y - y) : g.heading! + drift;
      let best: { h: number; x: number; y: number; e: number; t: number } | null = null;
      for (const dh of [-26, -13, 0, 13, 26]) {
        const nh = h + dh;
        const p = polar(nh, STEP_M);
        // Forest roads, tracks and paths never cross water (no bridge is built for them); gravel
        // farm roads may, and get a bridge (build.ts).
        const wetStep = [0.25, 0.5, 0.75].some((f) => inWater(x + p.x * f, y + p.y * f));
        if (wetStep && g.cls !== "gravel") continue;
        const r1 = cost(x + p.x, y + p.y, e, g.bogCost);
        if (wetStep) r1.c += 40; // a bridge is costly: cross once where needed, not repeatedly
        if (!Number.isFinite(r1.c)) continue;
        const p2 = polar(nh, 2 * STEP_M);
        const r2 = cost(x + p2.x, y + p2.y, r1.e, g.bogCost);
        const t = r1.c + 0.5 * Math.min(r2.c, 6) + (Math.abs(dh) / 26) * 0.3 +
          (Math.abs(angleDiff(nh, pref)) / 90) * 0.7 + rng.nextFloat() * g.wander;
        if (!best || t < best.t) best = { h: nh, x: x + p.x, y: y + p.y, e: r1.e, t };
      }
      if (!best) break;
      ({ h, x, y, e } = best);
      line.push({ x, y });
      if (g.target && Math.hypot(g.target.x - x, g.target.y - y) < STEP_M) { line.push(g.target); return { line, joined: true }; }
      const hit = roadNear(x, y, s < 300 ? g.parent : -1);
      if (s > 120 && hit >= 0) {
        const q = closestOnPolyline(x, y, roads[hit]!.line);
        const wet = [0.25, 0.5, 0.75, 1].some((f) => inWater(x + (q.x - x) * f, y + (q.y - y) * f));
        if (g.cls === "gravel" || !wet) { line.push(q); return { line, joined: true }; }
      }
    }
    return { line, joined: false };
  };

  const add = ({ line, joined }: { line: P[]; joined: boolean }, cls: RoadClass, minLen: number) => {
    if (line.length * STEP_M < minLen) return -1;
    const id = roads.length;
    roads.push({ cls, line });
    mark(line, id);
    if (!joined && line.length >= 2) {
      const a = line[line.length - 2]!;
      const b = line[line.length - 1]!;
      ends.push({ x: b.x, y: b.y, cls, heading: bearingOf(b.x - a.x, b.y - a.y) });
    }
    return id;
  };
  FIXED_ROADS.forEach((r, i) => mark(r.line, i));

  // Farm access roads: every farmstead is reached by a road (III b), headed for the nearest road.
  for (const f of FARMS) {
    if (f.fieldOnly) continue;
    let target: P | null = null;
    let bd = Infinity;
    for (const r of roads) {
      if (r.cls !== "main" && r.cls !== "gravel") continue;
      for (const p of r.line) {
        const d = Math.hypot(p.x - f.x, p.y - f.y);
        if (d < bd) { bd = d; target = p; }
      }
    }
    if (target) add(grow({ x: f.x, y: f.y }, { cls: "gravel", maxLen: bd * 1.8, target, parent: -1, bogCost: 1.5, wander: 0.1 }), "gravel", 0);
  }

  /** Branch roads of class `cls` off every road in `from`, at `spacing` m (± half) along it. */
  const branch = (from: readonly number[], cls: RoadClass, spacing: number, minLen: number, maxLen: number, bogCost: number, wander: number) => {
    for (const id of from) {
      const line = roads[id]!.line;
      let next = spacing * (0.3 + rng.nextFloat());
      let s = 0;
      for (let k = 0; k + 1 < line.length; k++) {
        const a = line[k]!;
        const b = line[k + 1]!;
        s += Math.hypot(b.x - a.x, b.y - a.y);
        if (s < next) continue;
        next = s + spacing * (0.5 + rng.nextFloat());
        const tangent = bearingOf(b.x - a.x, b.y - a.y);
        const sides = rng.nextFloat() < 0.25 ? [90, -90] : [rng.nextFloat() < 0.5 ? 90 : -90];
        for (const side of sides) {
          const heading = tangent + side + (rng.nextFloat() - 0.5) * 50;
          const len = minLen + rng.nextFloat() * (maxLen - minLen);
          add(grow(b, { cls, maxLen: len, heading, parent: id, bogCost, wander }), cls, minLen * 0.5);
        }
      }
    }
  };
  const idsOf = (cls: RoadClass, from = 0) => roads.map((r, i) => (r.cls === cls && i >= from ? i : -1)).filter((i) => i >= 0);

  const trunk = roads.map((r, i) => (r.cls === "main" || r.cls === "gravel" ? i : -1)).filter((i) => i >= 0);
  const firstForest = roads.length;
  // Spacing set so forest roads run ~0.5 km/km² near IGN, which with the fixed gravel roads R1–R3
  // gives ~1 km/km² — managed southern-Finnish forest (was ~1.6, twice that; 24 Sep 2026).
  branch(trunk, "forest", 2100, 1500, 4000, 1.4, 0.15);
  branch(idsOf("forest", firstForest), "forest", 2600, 700, 2000, 1.4, 0.15);
  branch(idsOf("forest"), "track", 1400, 300, 900, 0.8, 0.3);
  branch(idsOf("forest").filter(() => rng.nextFloat() < 0.35), "path", 2500, 400, 1400, 0.25, 0.6);
  return roads;
}

const ends: RoadEnd[] = [];
// The Mökkiranta tracks come after the generated roads so those keep their indices (traffic-drones.ts).
export const ROADS: readonly Road[] = [
  ...buildRoads(ends).map((r) => (r.line === KARHU_ROAD_DESIGNED ? { cls: r.cls, line: KARHU_ROAD } : r)),
  ...MOKKIRANTA_TRACKS,
];
export const ROAD_ENDS: readonly RoadEnd[] = ends;

/** Bridges: every place a main or gravel road crosses Kotkanjoki (BRIDGE and BRIDGE_S among them). */
export const BRIDGES: readonly P[] = (() => {
  const out = ROADS.filter((r) => r.cls === "main" || r.cls === "gravel").flatMap((r) => riverCrossings(r.line));
  for (const must of [BRIDGE, BRIDGE_S]) if (!out.some((b) => Math.hypot(b.x - must.x, b.y - must.y) < 30)) out.push(must);
  return out;
})();
/** Forest roads, tracks or paths crossing the river — none by construction (they may not step over water). */
export const UNBRIDGED_CROSSINGS: readonly { readonly cls: RoadClass; readonly at: P }[] = ROADS
  .filter((r) => r.cls !== "main" && r.cls !== "gravel")
  .flatMap((r) => riverCrossings(r.line).map((at) => ({ cls: r.cls, at })));
