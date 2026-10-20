/**
 * The designed roads of the generated site (SPEC/18 §5, SPEC/33 §3): the maantie, the scenario's gravel roads R1–R3 and R2, the
 * Mökkiranta and peat roads, the southern roads, and the Honkaharju forest road. Each is pinned where the contract fixes it (the
 * unit anchors, the R3 bridge, the junctions) and routed over the terrain between (road-grid.ts): it curves with the ground, skirts
 * mires and lakes, and crosses Kotkanjoki only on a bridge, straight across the river. Where the contract fixes a road closely
 * (R1, R2, R3 at the bridge, the Honkaharju road) it is a spline through its anchors with bends between them (road-shape.ts);
 * elsewhere a long straight the router left is bent gently to the easier side, so no road runs ruler-straight for kilometres.
 *
 * FIXED_ROADS keeps its order (crossings.ts names them by index: maantie, maantie, R3, R1, R3, R2, Mökkiranta road, peat road,
 * Hiekkala road, Pirttilampi road); the Honkaharju forest road follows them in ROADS and is found by its id, "honkaharju".
 */

import {
  BIG_LAKE, BRIDGE, cellOf, cellX, cellY, closestOnPolyline, GN, HAMLET_S, ISO_RAHKASUO_BASIN, polar, resample, type P,
} from "./terrain-base.js";
import { lakeAt, LAKES, RIVER, type Lake } from "./water.js";
import { mireAt } from "./soil.js";
import { longestMireRun, roadLine, route, straightenCrossings, terrainCost, windowAround, type RoadClass } from "./road-grid.js";
import { riverCrossings } from "./water-query.js";
import { bendStraights, nearWet, spline } from "./road-shape.js";

export type { RoadClass };
export interface Road {
  readonly cls: RoadClass;
  readonly line: readonly P[];
  /** Stable name of a road the scenario refers to (SPEC/33 §3); generated roads have none. */
  readonly id?: string;
}

export const COMMAND_POINT: P = { x: -1000, y: 400 };
export { BRIDGE };

const COST_MAIN = terrainCost("main", true);
const COST_GRAVEL = terrainCost("gravel", true);
/** The same with mires much dearer: a stretch that would cross more than MAX_MIRE_M of mire is re-routed round it. */
const COST_DRY = { main: terrainCost("main", true, 40), gravel: terrainCost("gravel", true, 30) };
const MAX_MIRE_M = 420;
const onMire = (p: P) => mireAt(p.x, p.y) !== 0;

/** `p`, or (when it falls in water) the nearest cell centre the road may use. */
function onLand(p: P, cost: Float32Array): P {
  if (Number.isFinite(cost[cellOf(p.x, p.y)]!)) return p;
  for (let r = 1; r < 60; r++) for (let k = 0; k < 8 * r; k++) {
    const a = (2 * Math.PI * k) / (8 * r);
    const q = { x: p.x + Math.cos(a) * r * 20, y: p.y + Math.sin(a) * r * 20 };
    if (Number.isFinite(cost[cellOf(q.x, q.y)]!)) return { x: cellX(Math.round((q.x + 10_000) / 20 - 0.5)), y: cellY(Math.round((q.y + 10_000) / 20 - 0.5)) };
  }
  return p;
}

/** Moves the points of a densely sampled line that fall in a lake (a corner cut between two diagonal cells) out to the nearest dry
 * ground, 10 m clear of the shore. */
function keepDry(line: readonly P[]): P[] {
  return line.map((p) => {
    if (!lakeAt(p.x, p.y)) return p;
    for (let r = 5; r <= 60; r += 5) for (let k = 0; k < 16; k++) {
      const q = { x: p.x + r * Math.cos((k * Math.PI) / 8), y: p.y + r * Math.sin((k * Math.PI) / 8) };
      const o = { x: p.x + (r + 10) * Math.cos((k * Math.PI) / 8), y: p.y + (r + 10) * Math.sin((k * Math.PI) / 8) };
      if (!lakeAt(q.x, q.y) && !lakeAt(o.x, o.y)) return o;
    }
    return p;
  });
}

/** Routes through `points` in turn (each one kept exactly, a waypoint in water moved to the nearest dry cell), over `cost`. */
function via(pointsIn: readonly P[], cost: Float32Array, simplifyM = 18, dry = false): P[] {
  const points = pointsIn.map((p, k) => (k === 0 || k === pointsIn.length - 1 ? p : onLand(p, cost)));
  const out: P[] = [points[0]!];
  for (let k = 0; k + 1 < points.length; k++) {
    const a = points[k]!;
    const b = points[k + 1]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const goal = cellOf(b.x, b.y);
    const cells = route(cost, [cellOf(a.x, a.y)], (i) => i === goal, b, { window: windowAround([a, b], Math.max(900, d * 0.6)), hWeight: 1.3 }) ??
      route(cost, [cellOf(a.x, a.y)], (i) => i === goal, b, { hWeight: 1.3 });
    if (!cells) throw new Error(`roads-main: no route from (${Math.round(a.x)},${Math.round(a.y)}) to (${Math.round(b.x)},${Math.round(b.y)})`);
    // A smoothed line that cuts a lake shore falls back to a tighter one.
    let line = roadLine(cells, a, b, simplifyM);
    if (resample(line, 5).some((p) => lakeAt(p.x, p.y))) line = roadLine(cells, a, b, 6);
    if (resample(line, 5).some((p) => lakeAt(p.x, p.y))) line = keepDry(resample(roadLine(cells, a, b, 0), 5));
    if (!dry && longestMireRun(line, onMire) > MAX_MIRE_M) {
      out.push(...via([a, b], cost === COST_MAIN ? COST_DRY.main : COST_DRY.gravel, simplifyM, true).slice(1));
      continue;
    }
    out.push(...line.slice(1));
  }
  return out;
}

const causeways = (line: readonly P[]) => straightenCrossings(line, (p) => mireAt(p.x, p.y) !== 0, (p) => lakeAt(p.x, p.y) !== undefined);

/** No ruler-straight run over ~600 m (SPEC/33 §2.3): a long straight the router left gets a gentle bend to the easier side, kept
 * off lakes, the river (no new crossing) and longer mire runs. Causeways across mires stay straight. */
function natural(line: readonly P[], cost: Float32Array, salt: number): P[] {
  const crossings = riverCrossings(line).length;
  const mireRun = longestMireRun(line, onMire);
  const inside = (p: P) => Math.abs(p.x) <= 10_000 && Math.abs(p.y) <= 10_000;
  const wet = (l: readonly P[]) => resample(l, 10).filter((p) => nearWet(p, (q) => lakeAt(q.x, q.y) !== undefined)).length;
  const wet0 = wet(line);
  return bendStraights(line, {
    cost: (p) => (inside(p) ? Math.min(60, cost[cellOf(p.x, p.y)]!) : 60),
    causeway: onMire,
    accept: (l) => !resample(l, 5).some((p) => lakeAt(p.x, p.y) || (!inside(p) && line.every(inside))) && wet(l) <= wet0 &&
      riverCrossings(l).length === crossings && longestMireRun(l, onMire) <= mireRun + 10,
    salt,
  });
}

/** A straight crossing of Kotkanjoki at the river vertex nearest `near`: points `half` m either side along its normal. */
function riverCrossing(near: P, half: number): [P, P, P] {
  let k = 1;
  for (let i = 1; i + 1 < RIVER.length; i++) if (Math.hypot(RIVER[i]!.x - near.x, RIVER[i]!.y - near.y) < Math.hypot(RIVER[k]!.x - near.x, RIVER[k]!.y - near.y)) k = i;
  const a = RIVER[k - 1]!;
  const b = RIVER[k + 1]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const m = RIVER[k]!;
  const p1 = { x: m.x - nx * half, y: m.y - ny * half };
  const p2 = { x: m.x + nx * half, y: m.y + ny * half };
  // West bank first.
  return p1.x <= p2.x ? [p1, m, p2] : [p2, m, p1];
}

// ---------------------------------------------------------------------------
// The maantie
// ---------------------------------------------------------------------------

const SOUTH_JUNCTION: P = { x: -1500, y: -3500 };
const MAANTIE_BRIDGE = riverCrossing({ x: 3150, y: -2500 }, 70);
export const MAANTIE_S: readonly P[] = [
  ...natural(causeways(via([{ x: -10000, y: -3300 }, { x: -6200, y: -3700 }, SOUTH_JUNCTION, { x: 600, y: -3050 }, { x: 1900, y: -2300 }], COST_MAIN, 45)), COST_MAIN, 21),
  ...spline([{ x: 1900, y: -2300 }, { x: 2300, y: -2318 }, { x: 2700, y: -2420 }]).slice(1),
  ...causeways(via([{ x: 2700, y: -2420 }, MAANTIE_BRIDGE[0]], COST_MAIN, 45)).slice(1),
  ...MAANTIE_BRIDGE.slice(1),
  ...natural(causeways(via([MAANTIE_BRIDGE[2], { x: 6000, y: -2400 }, { x: 10000, y: -1800 }], COST_MAIN, 45)), COST_MAIN, 22).slice(1),
];
const NORTH_BRIDGE = riverCrossing({ x: 2300, y: 7800 }, 70);
const MAANTIE_N: readonly P[] = [
  ...natural(causeways(via([{ x: -10000, y: 7200 }, { x: -3000, y: 7600 }, NORTH_BRIDGE[0]], COST_MAIN, 45)), COST_MAIN, 23),
  ...NORTH_BRIDGE.slice(1),
  ...natural(causeways(via([NORTH_BRIDGE[2], { x: 6000, y: 8100 }, { x: 10000, y: 8300 }], COST_MAIN, 45)), COST_MAIN, 24).slice(1),
];

// ---------------------------------------------------------------------------
// The scenario's gravel roads
// ---------------------------------------------------------------------------

const R3_JUNCTION = closestOnPolyline(SOUTH_JUNCTION.x, SOUTH_JUNCTION.y, MAANTIE_S);
/** R3 west: from the maantie north to the command point at the R1/R3 junction; its last stretch swings north-east into the
 * junction, so R3 runs on into R1 round a bend instead of meeting it at a right angle. */
const R3_W_ROUTED = natural(causeways(via([R3_JUNCTION, { x: -1750, y: -2000 }, { x: -1350, y: -700 }, { x: -1160, y: 150 }], COST_GRAVEL)), COST_GRAVEL, 25);
const R3_W: readonly P[] = [
  ...R3_W_ROUTED,
  ...spline([{ x: -1160, y: 150 }, { x: -1100, y: 290 }, COMMAND_POINT], 20, R3_W_ROUTED[Math.max(0, R3_W_ROUTED.length - 4)], { x: -800, y: 440 }).slice(1),
];
/**
 * R1: E–W about 400 m north of IGN, through its unit anchors (SPEC/33 §3, each within 15 m), to its end at the R3 east junction.
 * A spline through the anchors and, between them, points 25–45 m off the straight line: it sags south past IGN (still ~380 m off,
 * due north), lifts north over Kuivakangas where it crosses the esker square to its crest (x ≈ 1100), and bends gently on to the
 * bridge road. No straight run over ~300 m.
 */
const R1_END: P = { x: 2600, y: 400 };
const R1: readonly P[] = spline([
  COMMAND_POINT, { x: -800, y: 440 }, { x: -560, y: 464 }, { x: -300, y: 414 }, { x: -60, y: 374 }, { x: 210, y: 405 }, { x: 350, y: 410 },
  { x: 620, y: 472 }, { x: 900, y: 425 }, { x: 1090, y: 466 }, { x: 1290, y: 464 }, { x: 1500, y: 418 }, { x: 1760, y: 452 },
  { x: 2060, y: 474 }, { x: 2360, y: 454 }, R1_END,
], 20, R3_W[Math.max(0, R3_W.length - 4)]);
/** R3 east: on from R1 with a slight bend, straight across the river on the timber bridge, then east over the terrain. */
const R3_E: readonly P[] = [
  ...spline([R1_END, { x: 2650, y: 403 }, { x: 2790, y: 386 }, { x: 2930, y: 393 }, BRIDGE, { x: 3200, y: 402 }], 20, R1[R1.length - 3]),
  ...natural(causeways(via([{ x: 3200, y: 402 }, { x: 5600, y: 900 }, { x: 10000, y: 1200 }], COST_GRAVEL)), COST_GRAVEL, 26).slice(1),
];
/**
 * R2: leaves R1 south-south-east, crosses Kuivakangas obliquely to its crest (south-west, x ≈ 1500, y ≈ 0), then runs south
 * along the Rahkasuo's dry east side through its anchors (each within 15 m, R2_FR exact: the Honkaharju junction), and on to the
 * maantie at Lahdenkylä.
 */
const R2_SOUTH: P = { x: 1530, y: -1360 };
const R2_FR: P = { x: 1525, y: -842 };
const R2_END = closestOnPolyline(1950, -2290, MAANTIE_S);
const R2_START = closestOnPolyline(1500, 420, R1);
const R2: readonly P[] = [
  ...spline([R2_START, { x: 1556, y: 200 }, { x: 1522, y: -10 }, { x: 1472, y: -205 }, { x: 1480, y: -415 }, { x: 1508, y: -600 }, R2_FR,
    { x: 1540, y: -985 }, { x: 1506, y: -1120 }, R2_SOUTH], 20, { x: R2_START.x - 30, y: R2_START.y + 120 }),
  ...natural(causeways(via([R2_SOUTH, R2_END], COST_GRAVEL)), COST_GRAVEL, 27).slice(1),
];

/** Mökkiranta: the gravel road from R1 ends among the cottages on Karhujärvi's south-east shore, 70 m behind the water. */
const CABINS: P = { x: -1340, y: 1590 };
function karhujarvi(): Lake {
  const l = LAKES.find((x) => x.name === "Karhujärvi");
  if (!l) throw new Error("roads-main: no Karhujärvi");
  return l;
}
/** The shore point nearest `p` on `lake` (walking from p towards the lake's inside point). */
export function shoreToward(lake: Lake, p: P): P {
  const d = Math.hypot(lake.cx - p.x, lake.cy - p.y);
  for (let s = 0; s <= d; s += 5) {
    const q = { x: p.x + ((lake.cx - p.x) * s) / d, y: p.y + ((lake.cy - p.y) * s) / d };
    if (lakeAt(q.x, q.y)?.id === lake.id) return q;
  }
  return { x: lake.cx, y: lake.cy };
}
const KARHU_SHORE = shoreToward(karhujarvi(), CABINS);
export const MOKKIRANTA_JUNCTION: P = (() => {
  const d = Math.hypot(CABINS.x - KARHU_SHORE.x, CABINS.y - KARHU_SHORE.y);
  return d <= 70 ? { x: KARHU_SHORE.x + ((CABINS.x - KARHU_SHORE.x) * 70) / Math.max(d, 1), y: KARHU_SHORE.y + ((CABINS.y - KARHU_SHORE.y) * 70) / Math.max(d, 1) } : CABINS;
})();
const KARHU_ROAD: readonly P[] = natural(via([closestOnPolyline(-600, 400, R1), { x: -780, y: 1000 }, { x: -1150, y: 1450 }, MOKKIRANTA_JUNCTION], COST_GRAVEL), COST_GRAVEL, 28);

/** Peat-road spur from R3 west to Iso-Rahkasuo's edge. */
const PEAT_START = closestOnPolyline(-1800, -2000, R3_W);
const PEAT_ROAD: readonly P[] = (() => {
  const target = { x: ISO_RAHKASUO_BASIN.cx, y: ISO_RAHKASUO_BASIN.cy };
  const onIso = (i: number) => { const x = cellX(i % GN); const y = cellY(Math.floor(i / GN)); return mireAt(x, y) !== 0 && Math.hypot(x - target.x, y - target.y) < 1300; };
  const cells = route(COST_GRAVEL, [cellOf(PEAT_START.x, PEAT_START.y)], onIso, target, { window: windowAround([PEAT_START, target], 600) });
  if (!cells) throw new Error("roads-main: no peat road");
  return natural(roadLine(cells, PEAT_START), COST_GRAVEL, 29);
})();

/** Second timber bridge: where the southern gravel road crosses Kotkanjoki. */
const SOUTH_BRIDGE = riverCrossing({ x: 4000, y: -7800 }, 60);
export const BRIDGE_S: P = SOUTH_BRIDGE[1];

/** End of a cottage road: from `from` along `bearing` to the lake's edge, then `setback` m short of the water. */
function shoreEnd(from: P, bearing: number, setback: number, maxM = 4000): P | null {
  for (let s = 0; s <= maxM; s += 10) {
    const q = polar(bearing, s);
    if (lakeAt(from.x + q.x, from.y + q.y)) { const b = polar(bearing, Math.max(0, s - setback)); return { x: from.x + b.x, y: from.y + b.y }; }
  }
  return null;
}
const BIG_ROAD_END = shoreEnd({ x: 5600, y: -8150 }, 90, 90) ?? { x: BIG_LAKE.cx - BIG_LAKE.r - 200, y: -8150 };
/** Southern yksityistie: from the maantie through Hiekkala, over Kotkanjoki (BRIDGE_S) to the cottages on Iso-Hirvijärvi. */
const SOUTH_ROAD: readonly P[] = [
  ...natural(causeways(via([R3_JUNCTION, { x: -2150, y: -5000 }, HAMLET_S, SOUTH_BRIDGE[0]], COST_GRAVEL)), COST_GRAVEL, 30),
  ...SOUTH_BRIDGE.slice(1),
  ...natural(causeways(via([SOUTH_BRIDGE[2], BIG_ROAD_END], COST_GRAVEL)), COST_GRAVEL, 31).slice(1),
];
/** Pirttilampi: the lake the road west of Hiekkala leads to (water.ts names it). */
const PIRTTI = LAKES.find((l) => l.name === "Pirttilampi");
const PIRTTI_START = closestOnPolyline(HAMLET_S.x - 250, HAMLET_S.y - 150, SOUTH_ROAD);
/** The road ends 120 m behind the lake's south shore, where its cottages are. */
const PIRTTI_END: P = (() => {
  if (!PIRTTI) return { x: PIRTTI_START.x - 1500, y: PIRTTI_START.y };
  const far = { x: PIRTTI.cx + 200, y: PIRTTI.cy - 3000 };
  const shore = shoreToward(PIRTTI, far);
  const d = Math.hypot(far.x - shore.x, far.y - shore.y);
  return { x: shore.x + ((far.x - shore.x) * 120) / d, y: shore.y + ((far.y - shore.y) * 120) / d };
})();
const PIRTTI_ROAD: readonly P[] = natural(causeways(via([PIRTTI_START, PIRTTI_END], COST_GRAVEL)), COST_GRAVEL, 32);
export const COTTAGE_ROAD_ENDS: readonly { readonly end: P; readonly toWater: number }[] = [
  { end: BIG_ROAD_END, toWater: 90 },
  { end: PIRTTI_END, toWater: PIRTTI ? (Math.atan2(PIRTTI.cx - PIRTTI_END.x, PIRTTI.cy - PIRTTI_END.y) * 180) / Math.PI : 270 },
];

export const FIXED_ROADS: readonly Road[] = [
  { cls: "main", line: MAANTIE_S, id: "maantie_s" },
  { cls: "main", line: MAANTIE_N, id: "maantie_n" },
  { cls: "gravel", line: R3_W, id: "r3_w" },
  { cls: "gravel", line: R1, id: "r1" },
  { cls: "gravel", line: R3_E, id: "r3_e" },
  { cls: "gravel", line: R2, id: "r2" },
  { cls: "gravel", line: KARHU_ROAD, id: "karhu" },
  { cls: "gravel", line: PEAT_ROAD, id: "peat" },
  { cls: "gravel", line: SOUTH_ROAD, id: "hiekkala" },
  { cls: "gravel", line: PIRTTI_ROAD, id: "pirttilampi" },
];

/** The Honkaharju forest road (metsäautotie) along the esker crest, from R2 at the log landing west to its end south of IGN: a
 * spline that weaves 10–20 m either side of the crest line through its anchors (FR_E, FR_MID, FR_W within 5 m; R2_FR exact). */
export const HONKAHARJU_ROAD: Road = {
  cls: "forest", id: "honkaharju",
  line: spline([R2_FR, { x: 1335, y: -772 }, { x: 1110, y: -626 }, { x: 935, y: -569 }, { x: 812, y: -513 }, { x: 720, y: -487 }, { x: 495, y: -447 },
    { x: 259, y: -384 }, { x: 100, y: -345 }, { x: -52, y: -329 }], 20, { x: R2_FR.x + 40, y: R2_FR.y - 30 }),
};
