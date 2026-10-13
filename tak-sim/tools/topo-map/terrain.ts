/**
 * The generated site — SPEC/23 §11, §13. One fictional landscape, laid out from the SPEC/18 §5
 * feature table (without the Salpa Line), from which BOTH the participant's topographic map and the
 * fire model's fuel and elevation grids are derived. The fire therefore burns exactly the ground the
 * map shows.
 *
 * This module adds the hydrography to terrain-base.ts's ground (and re-exports it): Kotkanjoki is
 * traced as a least-cost path through the low ground, its water surface falls monotonically
 * downstream (south → north, the regional slope), and its valley — and the brooks' — are carved
 * into the terrain, so the river always lies at the bottom and contours form V's pointing upstream.
 */

import {
  baseElevation,
  bearingOf,
  bigLakeIsland,
  bogWInside,
  distToPolyline,
  fbm,
  HALF_M,
  inBogS,
  inFarmFields,
  inFarmYard,
  inVillageFields,
  knollField,
  knollScale,
  lakeAt,
  meander,
  mireIndex,
  type Lake,
  type P,
} from "./terrain-base.js";

export * from "./terrain-base.js";

export const RIVER_NAME = "Kotkanjoki";
/** SPEC/18 §5 BRIDGE: the timber bridge where R3 crosses Kotkanjoki. The river is pinned through it. */
export const BRIDGE: P = { x: 3050, y: 390 };

// ---------------------------------------------------------------------------
// Least-cost paths on a 50 m grid
// ---------------------------------------------------------------------------

const G = 50;
const GN = (2 * HALF_M) / G;
const gx = (c: number) => -HALF_M + (c + 0.5) * G;
const gcell = (p: P) => Math.min(GN - 1, Math.max(0, Math.floor((p.y + HALF_M) / G))) * GN + Math.min(GN - 1, Math.max(0, Math.floor((p.x + HALF_M) / G)));
const gpt = (i: number): P => ({ x: gx(i % GN), y: gx(Math.floor(i / GN)) });

/** Dijkstra over 8-neighbour cells; edge cost = length × mean node weight. Returns the cell path. */
function leastCostPath(weight: Float32Array, sources: readonly number[], isTarget: (i: number) => boolean): number[] {
  const dist = new Float64Array(GN * GN).fill(Infinity);
  const prev = new Int32Array(GN * GN).fill(-1);
  const heapI: number[] = [];
  const heapD: number[] = [];
  const push = (i: number, d: number) => {
    let k = heapI.length;
    heapI.push(i); heapD.push(d);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heapD[p]! <= d) break;
      heapI[k] = heapI[p]!; heapD[k] = heapD[p]!; k = p;
    }
    heapI[k] = i; heapD[k] = d;
  };
  const pop = (): [number, number] => {
    const top: [number, number] = [heapI[0]!, heapD[0]!];
    const li = heapI.pop()!;
    const ld = heapD.pop()!;
    if (heapI.length > 0) {
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        if (l >= heapI.length) break;
        const c = l + 1 < heapI.length && heapD[l + 1]! < heapD[l]! ? l + 1 : l;
        if (heapD[c]! >= ld) break;
        heapI[k] = heapI[c]!; heapD[k] = heapD[c]!; k = c;
      }
      heapI[k] = li; heapD[k] = ld;
    }
    return top;
  };
  for (const s of sources) { dist[s] = 0; push(s, 0); }
  while (heapI.length > 0) {
    const [i, d] = pop();
    if (d > dist[i]!) continue;
    if (isTarget(i)) {
      const path: number[] = [];
      for (let k = i; k >= 0; k = prev[k]!) path.push(k);
      return path.reverse();
    }
    const r = Math.floor(i / GN);
    const c = i % GN;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if ((dr === 0 && dc === 0) || r + dr < 0 || r + dr >= GN || c + dc < 0 || c + dc >= GN) continue;
      const j = i + dr * GN + dc;
      const nd = d + (dr !== 0 && dc !== 0 ? Math.SQRT2 : 1) * G * 0.5 * (weight[i]! + weight[j]!);
      if (nd < dist[j]!) { dist[j] = nd; prev[j] = i; push(j, nd); }
    }
  }
  throw new Error("no least-cost path");
}

/** Chaikin corner cutting with both end points kept. */
function smooth(line: readonly P[], passes: number): P[] {
  let pts = [...line];
  for (let n = 0; n < passes; n++) {
    const out: P[] = [pts[0]!];
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k]!;
      const b = pts[k + 1]!;
      out.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    out.push(pts[pts.length - 1]!);
    pts = out;
  }
  return pts;
}

/** Smoothed, gently meandering water course through `cells`, pinned to `from` and `to`. */
function course(from: P, cells: readonly number[], to: P, amp: number, wl: number, salt: number): P[] {
  const line = meander(smooth([from, ...cells.slice(1, -1).map(gpt), to], 3), 20, amp, wl, salt);
  line[0] = from;
  return line;
}

const BASE = new Float32Array(GN * GN);
for (let i = 0; i < GN * GN; i++) { const p = gpt(i); BASE[i] = baseElevation(p.x, p.y); }

/** The hand-drawn course used before SPEC/23 §13: the corridor the traced river keeps to near IGN. */
const OLD_COURSE = meander([{ x: 2600, y: 10000 }, { x: 2900, y: 6500 }, { x: 2828, y: 2828 }, { x: 3100, y: 1500 }, { x: 3050, y: 380 }, { x: 3300, y: -1000 }, { x: 2950, y: -2350 }, { x: 3500, y: -4500 }, { x: 3900, y: -10000 }], 40, 90, 700, 31);

function traceRiver(): P[] {
  const w = new Float32Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) {
    const p = gpt(i);
    const lake = lakeAt(p.x, p.y);
    if (lake && lake.level > 0) { w[i] = Infinity; continue; } // Karhujärvi, Haukilampi, Iso-Hirvijärvi lie off its course
    const dev = distToPolyline(p.x, p.y, OLD_COURSE);
    // Low ground is cheap; within 4.5 km of IGN the course stays by the designed one (fire breaks, H6).
    const corridor = Math.hypot(p.x, p.y) < 4500 ? 1 + (dev / 150) ** 2 : 1 + (Math.max(0, dev - 1000) / 300) ** 2;
    w[i] = Math.exp((BASE[i]! - 70) / 6) * corridor;
  }
  const bridge = gcell(BRIDGE);
  const south = Array.from({ length: GN }, (_, c) => c).filter((c) => gx(c) > 2400 && gx(c) < 5400);
  const up = leastCostPath(w, south, (i) => i === bridge);
  const down = leastCostPath(w, [bridge], (i) => Math.floor(i / GN) === GN - 1 && gx(i % GN) > 1100 && gx(i % GN) < 4100);
  const src = { x: gpt(up[0]!).x, y: -HALF_M };
  const mouth = { x: gpt(down[down.length - 1]!).x, y: HALF_M };
  return [...course(src, up, BRIDGE, 30, 380, 31), ...course(BRIDGE, down, mouth, 30, 380, 32).slice(1)];
}

/** Kotkanjoki, in flow order: from the south sheet edge, through BRIDGE, to the north edge. */
export const RIVER: readonly P[] = traceRiver();

// ---------------------------------------------------------------------------
// River geometry index (exact distance, crossings)
// ---------------------------------------------------------------------------

const B = 100;
const BN = (2 * HALF_M) / B;
const buckets = new Map<number, number[]>();
for (let k = 0; k + 1 < RIVER.length; k++) {
  const a = RIVER[k]!;
  const b = RIVER[k + 1]!;
  for (let bx = Math.floor((Math.min(a.x, b.x) + HALF_M) / B); bx <= Math.floor((Math.max(a.x, b.x) + HALF_M) / B); bx++) {
    for (let by = Math.floor((Math.min(a.y, b.y) + HALF_M) / B); by <= Math.floor((Math.max(a.y, b.y) + HALF_M) / B); by++) {
      const key = by * BN + bx;
      const list = buckets.get(key);
      if (list) list.push(k); else buckets.set(key, [k]);
    }
  }
}
function segmentsNear(x0: number, y0: number, x1: number, y1: number): Set<number> {
  const out = new Set<number>();
  for (let bx = Math.floor((x0 + HALF_M) / B); bx <= Math.floor((x1 + HALF_M) / B); bx++) {
    for (let by = Math.floor((y0 + HALF_M) / B); by <= Math.floor((y1 + HALF_M) / B); by++) {
      for (const k of buckets.get(by * BN + bx) ?? []) out.add(k);
    }
  }
  return out;
}

/** Distance (m) to Kotkanjoki's centreline; Infinity beyond `maxM`. */
export function riverDist(x: number, y: number, maxM = 200): number {
  let best = Infinity;
  for (const k of segmentsNear(x - maxM, y - maxM, x + maxM, y + maxM)) {
    const d = distToPolyline(x, y, [RIVER[k]!, RIVER[k + 1]!]);
    if (d < best) best = d;
  }
  return best <= maxM ? best : Infinity;
}

/** Points where `line` crosses Kotkanjoki. */
export function riverCrossings(line: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    for (const k of segmentsNear(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y))) {
      const c = RIVER[k]!;
      const d = RIVER[k + 1]!;
      const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
      if (den === 0) continue;
      const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
      const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
      if (t >= 0 && t < 1 && u >= 0 && u < 1 && !out.some((p) => Math.hypot(p.x - a.x - t * (b.x - a.x), p.y - a.y - t * (b.y - a.y)) < 60)) {
        out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Water surfaces and carved valleys
// ---------------------------------------------------------------------------

/** Levels of the lakes on Kotkanjoki's or a brook's course: flat steps in its falling profile. */
const WATER_LEVEL = new Map<Lake, number>();

/** Kotkanjoki's water surface at each RIVER vertex: non-increasing downstream, ≥ 1.2 m below its banks. */
export const RIVER_SURFACE: readonly number[] = (() => {
  const out: number[] = [];
  let cur = Infinity;
  for (let k = 0; k < RIVER.length; k++) {
    const p = RIVER[k]!;
    const step = k > 0 ? Math.hypot(p.x - RIVER[k - 1]!.x, p.y - RIVER[k - 1]!.y) : 0;
    const lake = lakeAt(p.x, p.y);
    if (lake && lake.level === 0) {
      if (!WATER_LEVEL.has(lake)) WATER_LEVEL.set(lake, Math.min(cur, 71.5));
      cur = WATER_LEVEL.get(lake)!;
    } else {
      cur = Math.min(cur - 0.0002 * step, baseElevation(p.x, p.y) - 1.2);
    }
    out.push(cur);
  }
  return out;
})();

// Carve raster: the lowest "valley surface" (water level + cross-profile) of any channel, 20 m cells.
const CG = 20;
const CN = (2 * HALF_M) / CG;
const TOP = new Float32Array(CN * CN).fill(1e4);

/** Lowers TOP to `surface + profile(distance)` around a channel, sampled every 5 m along it (the
 * surface interpolated linearly, so a monotone profile stays monotone). */
function stamp(line: readonly P[], surf: readonly number[], profile: (d: number) => number, radiusM: number): void {
  const pts: P[] = [];
  const surface: number[] = [];
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5));
    for (let i = 0; i < n; i++) {
      pts.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
      surface.push(surf[k]! + ((surf[k + 1]! - surf[k]!) * i) / n);
    }
  }
  pts.push(line[line.length - 1]!);
  surface.push(surf[surf.length - 1]!);
  const rc = Math.ceil(radiusM / CG);
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k]!;
    const c0 = Math.floor((p.x + HALF_M) / CG);
    const r0 = Math.floor((p.y + HALF_M) / CG);
    for (let r = Math.max(0, r0 - rc); r <= Math.min(CN - 1, r0 + rc); r++) {
      for (let c = Math.max(0, c0 - rc); c <= Math.min(CN - 1, c0 + rc); c++) {
        const d = Math.hypot(-HALF_M + (c + 0.5) * CG - p.x, -HALF_M + (r + 0.5) * CG - p.y);
        if (d > radiusM) continue;
        const v = surface[k]! + profile(d);
        const i = r * CN + c;
        if (v < TOP[i]!) TOP[i] = v;
      }
    }
  }
}

function carveAt(x: number, y: number): number {
  const fc = (x + HALF_M) / CG - 0.5;
  const fr = (y + HALF_M) / CG - 0.5;
  const c = Math.max(0, Math.min(CN - 2, Math.floor(fc)));
  const r = Math.max(0, Math.min(CN - 2, Math.floor(fr)));
  const tx = Math.max(0, Math.min(1, fc - c));
  const ty = Math.max(0, Math.min(1, fr - r));
  const i = r * CN + c;
  return (TOP[i]! * (1 - tx) + TOP[i + 1]! * tx) * (1 - ty) + (TOP[i + CN]! * (1 - tx) + TOP[i + CN + 1]! * tx) * ty;
}

/** River cross-profile above its water surface: 8 m channel, bank, a floodplain meadow ~100 m wide,
 * then valley walls steepening outward — a shallow valley a few hundred metres across. */
const riverProfile = (d: number) =>
  d <= 16 ? 0 : d <= 36 ? (0.8 * (d - 16)) / 20 : d <= 116 ? 0.8 + (0.6 * (d - 36)) / 80 : 1.4 + 0.07 * (d - 116) + 0.00008 * (d - 116) ** 2;
const brookProfile = (d: number) => (d <= 8 ? 0 : d <= 24 ? (0.5 * (d - 8)) / 16 : 0.5 + 0.09 * (d - 24) + 0.0004 * (d - 24) ** 2);

stamp(RIVER, RIVER_SURFACE, riverProfile, 700);

/** Terrain with the valleys carved so far (the river first, then each brook). */
const carved = (x: number, y: number) => Math.min(baseElevation(x, y), carveAt(x, y));

export interface Brook { readonly name: string; readonly line: readonly P[] }

/** Water surface of `line` at the vertex nearest `p`. */
function surfaceNear(line: readonly P[], surface: readonly number[], p: P): number {
  let near = 0;
  for (let k = 1; k < line.length; k++) if (Math.hypot(line[k]!.x - p.x, line[k]!.y - p.y) < Math.hypot(line[near]!.x - p.x, line[near]!.y - p.y)) near = k;
  return surface[near]!;
}

/** A brook's water surface from source to mouth: non-increasing, never below `floor` (the level of
 * the river or brook it flows into, at its mouth). */
function brookSurface(line: readonly P[], floor: number): number[] {
  let cur = Infinity;
  return line.map((p, k) => {
    const step = k > 0 ? Math.hypot(p.x - line[k - 1]!.x, p.y - line[k - 1]!.y) : 0;
    const lake = lakeAt(p.x, p.y);
    if (lake && !lake.big) {
      // A lake on the brook's course (Korpioja through Karhujärvi) is a flat step in its profile.
      if (!WATER_LEVEL.has(lake)) WATER_LEVEL.set(lake, Math.min(lake.level > 0 ? lake.level : 72, cur));
      cur = WATER_LEVEL.get(lake)!;
    } else {
      // Incised below the lowest ground within 60 m, so a brook never rides along a spur: its
      // valley — and the contours' upstream V's — form wherever it runs.
      let low = carved(p.x, p.y);
      for (let a = 0; a < 8; a++) low = Math.min(low, carved(p.x + 60 * Math.cos((a * Math.PI) / 4), p.y + 60 * Math.sin((a * Math.PI) / 4)));
      cur = Math.min(cur - 0.0005 * step, low - 0.6);
    }
    return Math.max(cur, floor);
  });
}

/** Ends a brook where it first meets `into` (Kotkanjoki, or another brook: a confluence, never a
 * crossing), or else joins it from its last point. */
function joinTo(line: readonly P[], into: readonly P[]): P[] {
  const out: P[] = [];
  for (const p of line) {
    if (out.length > 3 && distToPolyline(p.x, p.y, into) < 40) break;
    out.push(p);
  }
  const last = out[out.length - 1]!;
  let best = into[0]!;
  for (const q of into) if (Math.hypot(q.x - last.x, q.y - last.y) < Math.hypot(best.x - last.x, best.y - last.y)) best = q;
  out.push(best);
  return out;
}
const toRiver = (line: readonly P[]) => joinTo(line, RIVER);

/** Tributaries: from the two wettest large mires 1.5–4.5 km from the river (and > 5 km from IGN),
 * traced downhill over the carved terrain to Kotkanjoki. */
function tributaries(): Brook[] {
  const cand: { p: P; m: number }[] = [];
  for (let y = -HALF_M + 500; y < HALF_M - 500; y += 250) for (let x = -HALF_M + 500; x < HALF_M - 500; x += 250) {
    const rd = distToPolyline(x, y, RIVER);
    if (Math.hypot(x, y) > 5000 && rd > 1500 && rd < 4500 && !lakeAt(x, y)) cand.push({ p: { x, y }, m: mireIndex(x, y) });
  }
  cand.sort((a, b) => b.m - a.m);
  const picks: P[] = [];
  for (const c of cand) {
    if (picks.length < 2 && picks.every((q) => Math.hypot(q.x - c.p.x, q.y - c.p.y) > 6000)) picks.push(c.p);
  }
  const w = new Float32Array(GN * GN);
  const eNow = new Float32Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) { const p = gpt(i); eNow[i] = Math.min(BASE[i]!, carveAt(p.x, p.y)); }
  const names = ["Suo-oja", "Rahkapuro"];
  return picks.map((src, n) => {
    const e0 = eNow[gcell(src)]!;
    for (let i = 0; i < GN * GN; i++) {
      const p = gpt(i);
      const lake = lakeAt(p.x, p.y);
      w[i] = lake && lake.level > 0 ? Infinity : Math.exp(Math.max(-3, (eNow[i]! - e0) / 3));
    }
    const cells = leastCostPath(w, [gcell(src)], (i) => { const p = gpt(i); return riverDist(p.x, p.y, 40) < 40; });
    const end = gpt(cells[cells.length - 1]!);
    return { name: names[n]!, line: toRiver(course(src, cells, end, 12, 200, 45 + n)) };
  });
}

/** Brooks in flow order (source → mouth), with their water surfaces; each valley is carved before
 * the next brook's surface is set. Koivuoja, whose designed line crossed Korpioja, now ends in it. */
export const BROOKS: Brook[] = [];
export const BROOK_SURFACES: number[][] = [];
function addBrook(name: string, line: readonly P[], into?: number): void {
  const parent = into === undefined ? undefined : BROOKS[into]!;
  const path = parent ? joinTo(line, parent.line) : toRiver(line);
  const mouth = path[path.length - 1]!;
  const floor = parent ? surfaceNear(parent.line, BROOK_SURFACES[into!]!, mouth) : surfaceNear(RIVER, RIVER_SURFACE, mouth);
  const s = brookSurface(path, floor);
  stamp(path, s, brookProfile, 350);
  BROOKS.push({ name, line: path });
  BROOK_SURFACES.push(s);
}
addBrook("Korpioja", meander([{ x: -3600, y: 1700 }, { x: -1000, y: 1500 }, { x: 1500, y: 1450 }, { x: 3050, y: 1480 }], 30, 60, 400, 41));
addBrook("Koivuoja", meander([{ x: 600, y: 2700 }, { x: 1662, y: 1662 }, { x: 2700, y: 700 }, { x: 3080, y: 640 }], 30, 45, 350, 43), 0);
for (const t of tributaries()) addBrook(t.name, t.line);

// ---------------------------------------------------------------------------
// Power line
// ---------------------------------------------------------------------------

export const POWER_LINE: readonly P[] = [
  { x: 1500 - 15000 * Math.sin(Math.PI / 4), y: -15000 * Math.cos(Math.PI / 4) },
  { x: 1500 + 15000 * Math.sin(Math.PI / 4), y: 15000 * Math.cos(Math.PI / 4) },
];

/** A channel's runs outside the lakes it flows through, each starting/ending on the shore. */
export function runsOutsideLakes(line: readonly P[]): P[][] {
  const runs: P[][] = [];
  let cur: P[] = [];
  for (let k = 0; k < line.length; k++) {
    const p = line[k]!;
    if (lakeAt(p.x, p.y)) {
      if (cur.length > 0) runs.push([...cur, p]);
      cur = [];
    } else {
      if (cur.length === 0 && k > 0) cur.push(line[k - 1]!);
      cur.push(p);
    }
  }
  if (cur.length > 1) runs.push(cur);
  return runs.filter((r) => r.length > 1);
}

export function inWater(x: number, y: number): boolean {
  return lakeAt(x, y) !== undefined || riverDist(x, y, 8) < 8;
}

// ---------------------------------------------------------------------------
// Elevation and land cover
// ---------------------------------------------------------------------------

export function elevation(x: number, y: number): number {
  const lake = lakeAt(x, y);
  if (lake) return WATER_LEVEL.get(lake) ?? baseElevation(x, y);
  return carved(x, y);
}

export const LC_FOREST = 0;
export const LC_WATER = 1;
export const LC_FIELD = 2;
export const LC_OPEN_BOG = 3;
export const LC_DRAINED_BOG = 4;
export const LC_PINE_BOG = 5;

export function landCover(x: number, y: number, _e: number): number {
  if (inWater(x, y)) return LC_WATER;
  if (bigLakeIsland(x, y) > 0 || inFarmYard(x, y)) return LC_FOREST; // rocky islets; farmstead yards
  if (inBogS(x, y)) return LC_DRAINED_BOG;
  // Iso-Rahkasuo: a second, undrained open mire west of IGN, distinct from the ditched BOG-S.
  if (bogWInside(x, y) > 0) return LC_OPEN_BOG;
  if (inVillageFields(x, y) || inFarmFields(x, y)) return LC_FIELD;
  // Other peatlands fill the hollows between knolls.
  const wet = fbm(x / 900, y / 900, 3, 61);
  const m = mireIndex(x, y);
  if (m > 0.15) {
    if (m > 0.36 && wet > 0.24) return LC_OPEN_BOG;
    // Most southern Finnish peatland was ditched for forestry (L521: parallel ditches on most mires).
    return fbm(x / 1600, y / 1600, 2, 77) > -0.08 ? LC_DRAINED_BOG : LC_PINE_BOG;
  }
  // VALLEY-N's wet floor, with a ragged (not ruler-straight) edge.
  if (Math.abs(y - 1500) < 170 + 110 * fbm(x / 300, y / 300, 2, 67) && Math.abs(x) < 3000 && wet > 0.3) return LC_PINE_BOG;
  return LC_FOREST;
}

/** Cosmetic (not a fuel class): undrained mire wet enough for MML's "vaikeakulkuinen suo" —
 * the horizontal blue line symbol. Only meaningful on open/pine bog cells. */
export function isWetMire(x: number, y: number): boolean {
  if (bogWInside(x, y) > 0) return bogWInside(x, y) > 220;
  return mireIndex(x, y) > 0.3;
}

/** Cosmetic (not a fuel class): MML "soistuma", paludified forest fringing the mires. */
export function isPaludified(x: number, y: number): boolean {
  const m = mireIndex(x, y);
  return m > 0.07 && m <= 0.15;
}

/**
 * Exposed bedrock ("avokallio") — cosmetic only, drawn on the map's forest background
 * (`render.py`) but NOT a land-cover class: it does not reach `landCover()` above, so it cannot
 * change the fuel grid the fire model reads. Crops out on knoll tops and upper slopes, never in the
 * peat-filled hollows, as on L521.
 */
export function isRocky(x: number, y: number, _e: number): boolean {
  if (inWater(x, y) || inBogS(x, y)) return false;
  const k = knollField(x, y);
  if (k < 0.1) return false;
  const r = fbm(x / 160, y / 160, 3, 151) + 1.4 * (k - 0.1) * knollScale(x, y);
  return r > 0.6;
}

/** Hidden stand map (not on the topographic map — that is the Metsäkeskus register's job). */
export function standClass(x: number, y: number, e: number): "pine_heath" | "spruce_mature" | "birch_aspen" | "spr" {
  const d = Math.hypot(x, y);
  const b = bearingOf(x, y);
  if (d >= 1300 && d <= 2200 && b >= 25 && b <= 70) return "spr";
  if (d >= 2250 && d <= 2450 && b >= 15 && b <= 80) return "birch_aspen";
  if (BROOKS.some((br) => distToPolyline(x, y, br.line) < 60) || riverDist(x, y, 90) < 90) return "birch_aspen";
  if (e < 83 && fbm(x / 600, y / 600, 2, 55) > 0.1) return "spruce_mature";
  return "pine_heath";
}
