/**
 * Stream channels on the 20 m grid (SPEC/33 §4 stage 2): least-cost tracing through low ground, cell paths to smooth polylines,
 * monotone water surfaces and carving the channel into the DEM so the drawn stream is where the water runs.
 */

import { chaikin, cellX, cellY, G, GN, HALF_M, MinHeap, meander, resample, type P } from "./geom.js";

/** Dijkstra over 8-neighbour cells; edge cost = length × mean node weight; `inside(i)` limits the search. Returns the cell path. */
export function leastCostPath(weight: ArrayLike<number>, sources: readonly number[], isTarget: (i: number) => boolean, inside: (i: number) => boolean = () => true): number[] {
  const dist = new Float64Array(GN * GN).fill(Infinity);
  const prev = new Int32Array(GN * GN).fill(-1);
  const heap = new MinHeap(4096);
  for (const s of sources) { dist[s] = 0; heap.push(0, s); }
  while (heap.size > 0) {
    const i = heap.pop();
    const d = heap.lastKey;
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
      if (!inside(j)) continue;
      const w = weight[j]!;
      if (!Number.isFinite(w)) continue;
      const nd = d + (dr !== 0 && dc !== 0 ? Math.SQRT2 : 1) * G * 0.5 * (weight[i]! + w);
      if (nd < dist[j]!) { dist[j] = nd; prev[j] = i; heap.push(nd, j); }
    }
  }
  throw new Error("channels: no least-cost path");
}

export const cellPoint = (i: number): P => ({ x: cellX(i % GN), y: cellY(Math.floor(i / GN)) });

/** A cell path as a smooth polyline: Chaikin-smoothed, resampled every `stepM`, ends pinned to `from` / `to` when given. */
export function cellsToLine(cells: readonly number[], stepM = 10, from?: P, to?: P): P[] {
  const pts = cells.map(cellPoint);
  if (from) pts[0] = from;
  if (to) pts[pts.length - 1] = to;
  // Thin the staircase to every other cell before smoothing (the 8-direction zig-zag is the tell of a raster path).
  const thin = pts.filter((_, k) => k === 0 || k === pts.length - 1 || k % 2 === 0);
  return resample(chaikin(thin, 3), stepM);
}

/** Natural meanders, stronger on flat ground (`flatAt` 0 steep … 1 flat), ends kept. */
export function naturalise(line: readonly P[], ampM: number, wavelengthM: number, salt: number, flatAt: (p: P) => number): P[] {
  const big = meander(line, 10, ampM, wavelengthM, salt, flatAt);
  const out = meander(big, 6, ampM * 0.25, wavelengthM * 0.3, salt + 1, flatAt);
  out[0] = line[0]!;
  out[out.length - 1] = line[line.length - 1]!;
  return resample(out, 10);
}

/**
 * A channel's water surface at each vertex, source → mouth: non-increasing, `incision` below the lowest ground within
 * `lookM` (so it never rides a spur), flat at a lake's level where it crosses one, never below `floor`.
 */
export function channelSurface(line: readonly P[], groundAt: (x: number, y: number) => number, lakeLevelAt: (x: number, y: number) => number | undefined, incision: number, lookM: number, dropPerM: number, floor = -Infinity): number[] {
  let cur = Infinity;
  const out: number[] = [];
  for (let k = 0; k < line.length; k++) {
    const p = line[k]!;
    const step = k > 0 ? Math.hypot(p.x - line[k - 1]!.x, p.y - line[k - 1]!.y) : 0;
    const level = lakeLevelAt(p.x, p.y);
    if (level !== undefined) cur = Math.min(cur, level);
    else {
      let low = groundAt(p.x, p.y);
      for (let a = 0; a < 8; a++) low = Math.min(low, groundAt(p.x + lookM * Math.cos((a * Math.PI) / 4), p.y + lookM * Math.sin((a * Math.PI) / 4)));
      cur = Math.min(cur - dropPerM * step, low - incision);
    }
    out.push(Math.max(cur, floor));
  }
  return out;
}

/** Lowers `dem` to `surface + profile(distance)` around a channel, sampled every 4 m along it; cells where `skip(i)` are left. */
export function carve(dem: Float32Array, line: readonly P[], surface: readonly number[], profile: (d: number) => number, radiusM: number, skip: (i: number) => boolean = () => false): void {
  const rc = Math.ceil(radiusM / G);
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const z = surface[k]! + (surface[k + 1]! - surface[k]!) * t;
      const c0 = Math.floor((x + HALF_M) / G);
      const r0 = Math.floor((y + HALF_M) / G);
      for (let r = Math.max(0, r0 - rc); r <= Math.min(GN - 1, r0 + rc); r++) {
        for (let c = Math.max(0, c0 - rc); c <= Math.min(GN - 1, c0 + rc); c++) {
          const d = Math.hypot(cellX(c) - x, cellY(r) - y);
          if (d > radiusM) continue;
          const i = r * GN + c;
          if (skip(i)) continue;
          const v = z + profile(d);
          if (v < dem[i]!) dem[i] = v;
        }
      }
    }
  }
}

/**
 * Makes the DEM fall monotonically along a drawn channel: the grid node nearest each point (every 5 m, source → mouth) is lowered
 * to the lowest value met upstream, so no flood fill later raises the channel into a pond. Nodes where `skip(i)` are left.
 */
export function enforceMonotone(dem: Float32Array, line: readonly P[], skip: (i: number) => boolean): void {
  let low = Infinity;
  for (const p of resample(line, 5)) {
    const c = Math.max(0, Math.min(GN - 1, Math.round((p.x + HALF_M) / G - 0.5)));
    const r = Math.max(0, Math.min(GN - 1, Math.round((p.y + HALF_M) / G - 0.5)));
    const i = r * GN + c;
    if (skip(i)) continue;
    if (dem[i]! > low) dem[i] = low;
    low = Math.min(low, dem[i]!);
  }
}

/** Marks the cells within `radiusM` of a line with `id` (where not yet marked). */
export function markLine(grid: Int32Array, line: readonly P[], radiusM: number, id: number): void {
  const rc = Math.ceil(radiusM / G);
  for (const p of resample(line, 8)) {
    const c0 = Math.floor((p.x + HALF_M) / G);
    const r0 = Math.floor((p.y + HALF_M) / G);
    for (let r = Math.max(0, r0 - rc); r <= Math.min(GN - 1, r0 + rc); r++) {
      for (let c = Math.max(0, c0 - rc); c <= Math.min(GN - 1, c0 + rc); c++) {
        if (Math.hypot(cellX(c) - p.x, cellY(r) - p.y) <= radiusM && grid[r * GN + c]! < 0) grid[r * GN + c] = id;
      }
    }
  }
}

/** Channel floor half-width on the 20 m grid: every point of the drawn line has a grid node on the channel floor within it, so
 * the DEM sampled along the line falls exactly as the surface does. */
export const FLOOR_M = 15;
/** River cross-profile above its surface: floor, banks, a low floodplain; carving reaches 90 m. */
export const riverProfile = (d: number) => (d <= FLOOR_M ? 0 : d <= 40 ? (1.4 * (d - FLOOR_M)) / 25 : 1.4 + 0.02 * (d - 40));
/** Brook cross-profile: the floor in a small V, 45 m either side. */
export const brookProfile = (d: number) => (d <= FLOOR_M ? 0 : 0.5 + 0.03 * (d - FLOOR_M));
/** Ditch-sized outlet stream. */
export const rillProfile = (d: number) => (d <= FLOOR_M ? 0 : 0.3 + 0.03 * (d - FLOOR_M));

/**
 * A channel led smoothly through a pinned point (SPEC/33 gate R, 20 Oct 2026: Kotkanjoki at the R3 bridge ran a ruler-straight
 * 280 m reach through the bridge with a hairpin kink at each end). `a` flows to the pin, `b` on from it; each loses the stretch
 * within `reachM` of the pin, replaced by a cubic Bézier that leaves the kept line on its own heading and crosses the pin along
 * `axis` (the unit flow direction there, square to the bridge). Points about `stepM` apart.
 */
export function throughPin(a: readonly P[], pin: P, b: readonly P[], axis: P, reachM: number, stepM = 10): P[] {
  const dist = (p: P, q: P) => Math.hypot(p.x - q.x, p.y - q.y);
  const unit = (p: P, q: P): P => { const d = Math.max(1e-9, dist(p, q)); return { x: (q.x - p.x) / d, y: (q.y - p.y) / d }; };
  let ka = a.length - 1;
  while (ka > 1 && dist(a[ka]!, pin) < reachM) ka--;
  let kb = 0;
  while (kb < b.length - 2 && dist(b[kb]!, pin) < reachM) kb++;
  const h = reachM * 0.4;
  const bez = (p0: P, p1: P, p2: P, p3: P): P[] => {
    const n = Math.max(2, Math.ceil((dist(p0, p1) + dist(p1, p2) + dist(p2, p3)) / stepM));
    return Array.from({ length: n - 1 }, (_, i) => {
      const t = (i + 1) / n, u = 1 - t;
      return { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y };
    });
  };
  const ta = unit(a[ka - 1]!, a[ka]!), tb = unit(b[kb]!, b[kb + 1]!);
  const inA = bez(a[ka]!, { x: a[ka]!.x + ta.x * h, y: a[ka]!.y + ta.y * h }, { x: pin.x - axis.x * h, y: pin.y - axis.y * h }, pin);
  const outB = bez(pin, { x: pin.x + axis.x * h, y: pin.y + axis.y * h }, { x: b[kb]!.x - tb.x * h, y: b[kb]!.y - tb.y * h }, b[kb]!);
  return [...a.slice(0, ka + 1), ...inA.slice(0, -1), pin, ...outB, ...b.slice(kb)];
}
