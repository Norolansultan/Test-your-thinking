/**
 * Road routing on the 20 m grid (SPEC/33 §4 stage 5): a cost per metre from slope, mire, rock, fields and water, and an A* over 16
 * move directions (the knight's moves give 26.6° and 63.4° headings, so routed roads do not zig-zag at 45°). The cost idea follows
 * Azgaar's Fantasy-Map-Generator routes (MIT, SPEC/33 §8): existing roads are cheap to reuse, so new roads join the network
 * instead of running beside it. Then the cell path is smoothed into a road line, mire crossings are straightened into causeways
 * and the junction is turned to a near right angle.
 */

import { angleDiff, bearingOf, chaikin, closestOnPolyline, cellX, cellY, G, GN, HALF_M, MinHeap, polar, resample, simplify, type P } from "./terrain-base.js";
import { LAKE_ID, STREAM_CELL } from "./water.js";
import { MIRE, PALUDIFIED, ROCK, SLOPE } from "./soil.js";

export type RoadClass = "main" | "gravel" | "forest" | "track" | "path";

/** Per-metre cost of a cell for a road of class `cls`; Infinity where it may not go. */
export function terrainCost(cls: RoadClass, allowRiver: boolean, mireExtra = 0): Float32Array {
  const mire = (cls === "main" ? 4 : cls === "gravel" ? 6 : cls === "forest" ? 7 : cls === "track" ? 5 : 1.2) + mireExtra;
  // A main road is built with cuts and fills: it minds the slope less and keeps its line.
  const slopeW = cls === "main" ? 10 : 30;
  const out = new Float32Array(GN * GN);
  // Roads keep ~40 m off lake shores (a smoothed line must not cut into the water).
  const shore = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) {
    if (LAKE_ID[i]! < 0) continue;
    const r = Math.floor(i / GN);
    const c = i % GN;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < GN && cc < GN) shore[rr * GN + cc] = 1;
    }
  }
  for (let i = 0; i < GN * GN; i++) {
    if (LAKE_ID[i]! >= 0) { out[i] = Infinity; continue; }
    const s = SLOPE[i]!;
    let c = 1 + slopeW * Math.max(0, s - 0.03) + (s > 0.14 ? 12 : 0);
    if (MIRE[i]) c += mire;
    else if (PALUDIFIED[i]) c += 0.8;
    if (ROCK[i]) c += 1.5;
    if (shore[i]) c += 4;
    const st = STREAM_CELL[i]!;
    if (st === 0) c = allowRiver ? c + 120 : Infinity;
    else if (st > 0) c += 8;
    out[i] = c;
  }
  return out;
}

const MOVES: readonly (readonly [number, number, number])[] = (() => {
  const m: [number, number, number][] = [];
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    if (dr === 0 && dc === 0) continue;
    const a = Math.abs(dr);
    const b = Math.abs(dc);
    if ((a === 2 && b !== 1) || (b === 2 && a !== 1)) continue;
    m.push([dc, dr, Math.hypot(dc, dr) * G]);
  }
  return m;
})();

export interface RouteOptions {
  /** Search window (cells): only cells inside [c0, c1] × [r0, r1] are expanded. */
  readonly window?: { c0: number; c1: number; r0: number; r1: number };
  /** Heuristic weight (1 = admissible for a minimum cost of `minCost`). */
  readonly hWeight?: number;
  readonly minCost?: number;
  /** A custom heuristic (cells → cost estimate), e.g. the distance to the nearest road when the goal is any road. */
  readonly heuristic?: (i: number) => number;
}

// Search state reused across calls (a generation stamp marks the cells touched by the current search).
const G_COST = new Float64Array(GN * GN);
const PREV = new Int32Array(GN * GN);
const STAMP = new Int32Array(GN * GN);
const CLOSED = new Int32Array(GN * GN);
let generation = 0;

/** A* from `sources` to the first cell where `isGoal`; `goalPoint` for the heuristic (omit for Dijkstra). Returns cells or null. */
export function route(costIn: ArrayLike<number> | ((i: number) => number), sources: readonly number[], isGoal: (i: number) => boolean, goalPoint?: P, opt: RouteOptions = {}): number[] | null {
  const cost = typeof costIn === "function" ? costIn : (i: number) => costIn[i]!;
  const w = opt.window ?? { c0: 0, c1: GN - 1, r0: 0, r1: GN - 1 };
  const hw = opt.hWeight ?? 1;
  const minC = opt.minCost ?? 1;
  const h = opt.heuristic ?? ((i: number) => (goalPoint ? hw * minC * Math.hypot(cellX(i % GN) - goalPoint.x, cellY(Math.floor(i / GN)) - goalPoint.y) : 0));
  const gen = ++generation;
  const gOf = (i: number) => (STAMP[i] === gen ? G_COST[i]! : Infinity);
  const heap = new MinHeap(1024);
  for (const s of sources) { STAMP[s] = gen; G_COST[s] = 0; PREV[s] = -1; heap.push(h(s), s); }
  while (heap.size > 0) {
    const i = heap.pop();
    if (CLOSED[i] === gen) continue;
    CLOSED[i] = gen;
    if (isGoal(i)) {
      const path: number[] = [];
      for (let k = i; k >= 0; k = PREV[k]!) path.push(k);
      return path.reverse();
    }
    const r = Math.floor(i / GN);
    const c = i % GN;
    const gi = G_COST[i]!;
    for (const [dc, dr, len] of MOVES) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < w.r0 || rr > w.r1 || cc < w.c0 || cc > w.c1) continue;
      const j = rr * GN + cc;
      if (CLOSED[j] === gen) continue;
      // A knight's move straddles two cells: charge their mean with the end cells'.
      let cj = cost(j);
      if (Math.abs(dr) + Math.abs(dc) === 3) {
        const m1 = (r + Math.trunc(dr / 2)) * GN + c + Math.trunc(dc / 2);
        const m2 = (r + Math.round(dr / 2)) * GN + c + Math.round(dc / 2);
        cj = (cj + cost(m1) + cost(m2)) / 3;
      }
      if (!Number.isFinite(cj)) continue;
      const ng = gi + len * 0.5 * (cost(i) + cj);
      if (ng < gOf(j)) { STAMP[j] = gen; G_COST[j] = ng; PREV[j] = i; heap.push(ng + h(j), j); }
    }
  }
  return null;
}

/** A window around the given points, `marginM` wide. */
export function windowAround(pts: readonly P[], marginM: number): { c0: number; c1: number; r0: number; r1: number } {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cl = (v: number) => Math.max(0, Math.min(GN - 1, Math.floor((v + HALF_M) / G)));
  return { c0: cl(Math.min(...xs) - marginM), c1: cl(Math.max(...xs) + marginM), r0: cl(Math.min(...ys) - marginM), r1: cl(Math.max(...ys) + marginM) };
}

/** A routed cell path as a road line: staircase thinned (Douglas–Peucker at `simplifyM`: a main road keeps long, even curves),
 * corners cut, resampled every 20 m. */
export function roadLine(cells: readonly number[], from?: P, to?: P, simplifyM = 14): P[] {
  const pts = cells.map((i) => ({ x: cellX(i % GN), y: cellY(Math.floor(i / GN)) }));
  if (from) pts[0] = from;
  if (to) pts[pts.length - 1] = to;
  const thin = simplify(pts, simplifyM);
  return resample(chaikin(thin, 4), 20);
}

/** The longest stretch (m) of `line` on mire, sampled every 10 m. */
export function longestMireRun(line: readonly P[], onMire: (p: P) => boolean): number {
  let run = 0;
  let best = 0;
  const pts = resample(line, 10);
  for (let k = 1; k < pts.length; k++) {
    if (onMire(pts[k]!)) { run += Math.hypot(pts[k]!.x - pts[k - 1]!.x, pts[k]!.y - pts[k - 1]!.y); best = Math.max(best, run); } else run = 0;
  }
  return best;
}

/** Replaces each run of the line across mire (shorter than `maxM`) by a straight causeway between its entry and exit. */
export function straightenCrossings(line: readonly P[], onMire: (p: P) => boolean, blocked: (p: P) => boolean, maxM = 700): P[] {
  const out: P[] = [];
  let k = 0;
  while (k < line.length) {
    if (!onMire(line[k]!) || k === 0) { out.push(line[k]!); k++; continue; }
    let e = k;
    while (e < line.length && onMire(line[e]!)) e++;
    const a = line[k - 1]!;
    const b = line[Math.min(e, line.length - 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const straight = resample([a, b], 20).slice(1, -1);
    if (len < maxM && e < line.length && !resample([a, b], 5).some(blocked)) { out.push(...straight); k = e; } else { out.push(line[k]!); k++; }
  }
  return out;
}

/**
 * Turns the start of a road leaving `parent` at its first point to within ±15° of a right angle: the first `legM` metres run
 * straight out along the parent's normal (on the side the road goes), then the routed line resumes.
 */
export function squareJunction(line: readonly P[], parent: readonly P[], legM = 60): P[] {
  if (line.length < 3) return [...line];
  const j = closestOnPolyline(line[0]!.x, line[0]!.y, parent);
  let k = 0;
  for (let i = 0; i + 1 < parent.length; i++) if (Math.hypot(parent[i]!.x - j.x, parent[i]!.y - j.y) < Math.hypot(parent[k]!.x - j.x, parent[k]!.y - j.y)) k = i;
  const a = parent[Math.max(0, k - 1)]!;
  const b = parent[Math.min(parent.length - 1, k + 1)]!;
  const tangent = bearingOf(b.x - a.x, b.y - a.y);
  const far = line[Math.min(line.length - 1, 6)]!;
  const heading = bearingOf(far.x - j.x, far.y - j.y);
  const normal = angleDiff(heading, tangent + 90) < 90 && angleDiff(heading, tangent + 90) > -90 ? tangent + 90 : tangent - 90;
  const leg = polar(normal, legM);
  const p1 = { x: j.x + leg.x, y: j.y + leg.y };
  const rest = line.filter((p) => Math.hypot(p.x - j.x, p.y - j.y) > legM * 1.3);
  if (rest.length === 0) return [j, p1];
  return [j, ...resample([j, p1], 20).slice(1), ...chaikin([p1, ...rest], 1).slice(1)];
}
